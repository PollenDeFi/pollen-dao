import chai from 'chai';
import { ethers, waffle } from 'hardhat';
import { BigNumber as BN } from 'ethers';

import { ERC20, MockPriceFeed, PollenToken, LockedPollen, Portfolio, PollenDAO, IPollenDAO } from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { ZERO_ADDRESS, INITIAL_BALANCES, MAX_LOCK_PERIOD, BASE_WEIGHTS } from './helpers/constants';
import { getExpectedPortfolioReturn } from './helpers/functions';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

const BASE_18 = BN.from(10 ** 10).mul(10 ** 8);

describe('Portfolio', function () {
  let snapshot: string;
  let pollenToken: PollenToken;
  let vePLN: LockedPollen;
  let pollenDAO: IPollenDAO;
  let assetUSD: ERC20;
  let assetA: ERC20;
  let assetB: ERC20;
  let assetC: ERC20;
  let mockPriceFeed1: MockPriceFeed;
  let mockPriceFeed2: MockPriceFeed;
  let mockPriceFeed3: MockPriceFeed;

  const [
    admin,
    user1,
    user2,
    user3,
    delegator,
    delegatee1,
    delegatee2,
    delegatee3
  ] = provider.getWallets();

  before(async function () {
    // deploy Pollen (PLN)
    const PollenToken = await ethers.getContractFactory('PollenToken');
    pollenToken = await PollenToken.deploy(admin.address) as PollenToken;
    await pollenToken.deployed();

    // send pollenToken to other users
    await pollenToken.connect(admin).transfer(user1.address, BN.from('100000000000000000000').add(INITIAL_BALANCES));
    await pollenToken.connect(admin).transfer(user2.address, BN.from('100000000000000000000').add(INITIAL_BALANCES));
    await pollenToken.connect(admin).transfer(user3.address, BN.from('100000000000000000000').add(INITIAL_BALANCES));

    // deploy PollenDAO contract
    const PollenDAO = await ethers.getContractFactory('PollenDAO');
    const pollenDAOImplementation = await PollenDAO.deploy() as PollenDAO;
    await pollenDAOImplementation.deployed();

    // Deploy LockedPollen (vePLN)
    const VEPLN = await ethers.getContractFactory('LockedPollen');
    vePLN = await VEPLN.deploy(pollenDAOImplementation.address, pollenToken.address) as LockedPollen;
    await vePLN.deployed();

    // Deploy assets
    const ERC20Factory = await ethers.getContractFactory('ERC20');

    assetUSD = await ERC20Factory.deploy('AssetUSD', 'AUSD') as ERC20;
    await assetUSD.deployed();

    assetA = await ERC20Factory.deploy('AssetA', 'AA') as ERC20;
    await assetA.deployed();

    assetB = await ERC20Factory.deploy('AssetA', 'AB') as ERC20;
    await assetB.deployed();

    assetC = await ERC20Factory.deploy('AssetA', 'AC') as ERC20;
    await assetC.deployed();

    //deploy modules
    const Portfolio = await ethers.getContractFactory('Portfolio');
    const portfolioImplementation = await Portfolio.deploy() as Portfolio;
    await portfolioImplementation.deployed();

    const Quoter = await ethers.getContractFactory('Quoter');
    const quoterImplementation = await Quoter.deploy();
    await quoterImplementation.deployed();

    const Minter = await ethers.getContractFactory('Minter');
    const minterImplementation = await Minter.deploy();
    await minterImplementation.deployed();

    // deploy modules selectors
    const portfolioSelectors = Object.keys(Portfolio.interface.functions).map((item) => Portfolio.interface.getSighash(item));
    const quoterSelectors = Object.keys(Quoter.interface.functions).map((item) => Quoter.interface.getSighash(item));
    const minterSelectors = Object.keys(Minter.interface.functions).map((item) => Minter.interface.getSighash(item));

    // instantiate full pollenDAO
    pollenDAO = await ethers.getContractAt('IPollenDAO', pollenDAOImplementation.address) as IPollenDAO;
    await pollenDAO.setPollenTokens(pollenToken.address, vePLN.address);

    // set Dao in token contract
    await pollenToken.setDaoAddress(pollenDAO.address);

    // add modules to DAO
    await pollenDAO.addModule(portfolioImplementation.address, portfolioSelectors);
    await pollenDAO.addModule(quoterImplementation.address, quoterSelectors);
    await pollenDAO.addModule(minterImplementation.address, minterSelectors);

    const timestamp = 365 * 24 * 60 * 60 * 4;
    const date = new Date();
    const current = (date.getTime()).toString().slice(0, -3);
    const rate = '10000000000000000';
    const schedule = [{
      maxTime: BN.from(timestamp).add(current), // end of time period
      offsetX: current, // time now
      offsetY: ethers.utils.parseEther('94000000'),
      rate
    }];
    await pollenDAO.connect(admin).initializeIssuanceInfo(schedule);

    const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

    mockPriceFeed1 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed1.deployed();
    await mockPriceFeed1.incrementRoundAndSetAnswer(1);

    mockPriceFeed2 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed2.deployed();
    await mockPriceFeed2.incrementRoundAndSetAnswer(2);

    mockPriceFeed3 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed3.deployed();
    await mockPriceFeed3.incrementRoundAndSetAnswer(1);

    await pollenDAO.connect(admin).addPriceFeeds(
      [0, 0, 0],
      [assetA.address, assetB.address, assetC.address],
      [mockPriceFeed1.address, mockPriceFeed2.address, mockPriceFeed3.address]
    );

    // Set max number of possible assets in the portfolio
    await pollenDAO.setMaxNumberOfAssetsPerPortfolio(4);

    // set allowances to DAO
    const allowance = ethers.utils.parseEther('10');
    await pollenToken.connect(user1).approve(pollenDAOImplementation.address, allowance);
    await pollenToken.connect(user2).approve(pollenDAOImplementation.address, allowance);
    await pollenToken.connect(user3).approve(pollenDAOImplementation.address, allowance);


  });

  beforeEach(async function () {
    snapshot = await createSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshot);
  });

  describe('createPortfolio', function () {
    const invalidWeightArrayLength = [0, 30, 10];
    const invalidWeightArrayValue = [0, 30, 20, 20];
    const validWeightArrayDelistedAsset = [0, 0, 30, 70];
    const validWeightArray = [0, 30, 30, 40];
    const initialPollenAmount = ethers.utils.parseEther('10');
    const invalidPollenAmount = initialPollenAmount.mul(2);
    const tokenType = false; // PLN
    const isShort = Array(validWeightArray.length).fill(false);

    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);

      // seed user account with Pollen tokens
      await pollenToken.connect(admin).transfer(user1.address, initialPollenAmount.mul(2));
      await pollenToken.connect(user1).approve(pollenDAO.address, initialPollenAmount);

      // get vePLN tokens and approve PollenDAO
      const currentTimestampInSeconds = Math.ceil(Date.now() / 1000);
      const account = user1.address;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year
      await pollenToken.connect(user1).approve(vePLN.address, initialPollenAmount);
      await vePLN.connect(user1).lock(initialPollenAmount, lockEnd);
      await vePLN.connect(user1).approve(pollenDAO.address, initialPollenAmount);
    });
    // *** REVERT CHECKS ***
    it('Should revert if portfolio has already been initialized', async function () {
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType))
        .to.be.revertedWith('Portfolio has been initialized');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, true))
        .to.be.revertedWith('Portfolio has been initialized');
    });
    it('Should revert if weights do not add up to 100', async function () {
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, invalidWeightArrayValue, Array(invalidWeightArrayValue.length).fill(false), tokenType))
        .to.be.revertedWith('Weights should sum up to 100');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, invalidWeightArrayValue, Array(invalidWeightArrayValue.length).fill(false), true))
        .to.be.revertedWith('Weights should sum up to 100');
    });
    it('Should revert if weights array length does not match the number of whitelisted assets', async function () {
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, invalidWeightArrayLength, Array(invalidWeightArrayLength.length).fill(false), tokenType))
        .to.be.revertedWith('Weights length must equal that of whitelisted assets');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, invalidWeightArrayLength, Array(invalidWeightArrayLength.length).fill(false), true))
        .to.be.revertedWith('Weights length must equal that of whitelisted assets');
    });
    it('Should revert if number of assets exceeds maximum number of assets per portfolio', async function () {
      await pollenDAO.setMaxNumberOfAssetsPerPortfolio(2);

      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType))
        .to.be.revertedWith('Exceeds max number of assets');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, true))
        .to.be.revertedWith('Exceeds max number of assets');
    });
    it('Should revert if amount is insufficient', async function () {
      await pollenDAO.setLimitPortfolioBalance(10, 10000);
      await expect(pollenDAO.connect(user1).createPortfolio(0, validWeightArray, isShort, tokenType))
        .to.be.revertedWith('Insufficient amount');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(0, validWeightArray, isShort, true))
        .to.be.revertedWith('Insufficient amount');
    });
    it('Should revert if user has insufficient PLN/vePLN balance', async function () {
      await expect(pollenDAO.connect(user1).createPortfolio(invalidPollenAmount, validWeightArray, isShort, tokenType))
        .to.be.revertedWith('ERC20: transfer amount exceeds allowance');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(invalidPollenAmount, validWeightArray, isShort, true))
        .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
    it('Should revert if user inputs a non-zero weight for a delisted asset', async function () {
      await pollenDAO.connect(admin).removeAsset(assetA.address);
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType))
        .to.be.revertedWith('Weight must be 0 for a delisted asset');
      // vePLN
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, true))
        .to.be.revertedWith('Weight must be 0 for a delisted asset');
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should allow user to create Portfolio after an asset has been delisted as long as weight is 0', async function () {
      await pollenDAO.connect(admin).removeAsset(assetA.address);
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArrayDelistedAsset, Array(validWeightArrayDelistedAsset.length).fill(false), tokenType))
        .to.not.be.reverted;
    });
    it('Should correctly store the asset amounts depending on their weight and initial PLN amount', async function () {
      const USD_ENUM_INDEX = 0;
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);
      const assets = await pollenDAO.getPortfolio(user1.address, user1.address);

      // off-chain value calculation
      const UsdPrice = BASE_18;
      const asset1UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetA.address);
      const asset2UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetB.address);
      const asset3UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetC.address);
      const assetArray = [UsdPrice, asset1UsdPrice.rate, asset2UsdPrice.rate, asset3UsdPrice.rate];
      const initialPortfolioIndex = BASE_18;
      const allocations: Array<BN> = [];
      validWeightArray.forEach((weight, index) => {
        const bnWeight = BN.from(weight);
        const numerator = bnWeight.mul(initialPortfolioIndex).mul(BASE_18);
        const denominator = assetArray[index].mul(100);
        allocations.push(numerator.div(denominator));
      });

      // on-chain/off-chain assertions
      expect(assets[0].length).to.eq(validWeightArray.length);
      assets.assetAmounts.forEach((amount, index) => {
        expect(amount).to.eq(allocations[index]);
      });

    });
    it('Should correctly store the asset amounts depending on their weight and initial vePLN amount', async function () {
      const USD_ENUM_INDEX = 0;
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, true);
      const assets = await pollenDAO.getPortfolio(user1.address, user1.address);

      // off-chain value calculation
      const UsdPrice = BASE_18;
      const asset1UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetA.address);
      const asset2UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetB.address);
      const asset3UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetC.address);
      const assetArray = [UsdPrice, asset1UsdPrice.rate, asset2UsdPrice.rate, asset3UsdPrice.rate];
      const initialPortfolioIndex = BASE_18;
      const allocations: Array<BN> = [];
      validWeightArray.forEach((weight, index) => {
        const bnWeight = BN.from(weight);
        const numerator = bnWeight.mul(initialPortfolioIndex).mul(BASE_18);
        const denominator = assetArray[index].mul(100);
        allocations.push(numerator.div(denominator));
      });

      // on-chain/off-chain assertions
      expect(assets[0].length).to.eq(validWeightArray.length);
      assets.assetAmounts.forEach((amount, index) => {
        expect(amount).to.eq(allocations[index]);
      });
    });
    // *** EVENT CHECKS ***
    it('Should emit PortfolioCreated event with the correct params', async function () {
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType))
        .to.emit(pollenDAO, 'PortfolioCreated');
      // .withArgs(user1.address, amount, validWeightArray);
    });
    it('Should emit PortfolioCreated event with the correct params (vePLN)', async function () {
      await expect(pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, true))
        .to.emit(pollenDAO, 'PortfolioCreated');
      // .withArgs(user1.address, amount, validWeightArray);
    });
  });

  describe('rebalancePortfolio', async function () {
    const validWeightArray = [0, 30, 30, 40];
    const rebalancedWeightArray = [5, 55, 10, 30];
    const rebalancedWeightArrayToClosePortfolio = [100, 0, 0, 0];
    const invalidWeightArrayLength = [0, 30, 30, 20, 10, 10];
    const invalidWeightArrayValue = [0, 30, 20, 20];
    const initialPollenAmount = ethers.utils.parseEther('10');
    const rebalanceAmount = initialPollenAmount.div(3);
    const tokenType = false;
    const isShort = Array(validWeightArray.length).fill(false);

    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);

      // seed user account with Pollen tokens
      await pollenToken.connect(admin).transfer(user1.address, initialPollenAmount.mul(2));
      await pollenToken.connect(user1).approve(pollenDAO.address, initialPollenAmount);

      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);
      await pollenToken.connect(user1).approve(pollenDAO.address, rebalanceAmount);

      // create deployer Lock
      const currentTimestampInSeconds = Math.ceil(Date.now() / 1000);
      const account = user1.address;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year
      await pollenToken.connect(user1).approve(vePLN.address, initialPollenAmount);
      await vePLN.connect(user1).lock(initialPollenAmount, lockEnd);
      await vePLN.connect(user1).approve(pollenDAO.address, initialPollenAmount);
    });
    // *** REVERT CHECKS ***
    it('Should revert if weights do not add up to 100', async function () {
      await expect(pollenDAO.connect(user1).rebalancePortfolio(invalidWeightArrayValue, Array(invalidWeightArrayValue.length).fill(false), rebalanceAmount, tokenType))
        .to.be.revertedWith('Weights should sum up to 100');
      // vePLN
      await expect(pollenDAO.connect(user1).rebalancePortfolio(invalidWeightArrayValue, Array(invalidWeightArrayValue.length).fill(false), rebalanceAmount, true))
        .to.be.revertedWith('Weights should sum up to 100');
    });
    it('Should revert if weights array length does not equal assets length', async function () {
      await expect(pollenDAO.connect(user1).rebalancePortfolio(invalidWeightArrayLength, Array(invalidWeightArrayLength.length).fill(false), rebalanceAmount, tokenType))
        .to.be.revertedWith('Weights length must equal that of whitelisted assets');
      // vePLN
      await expect(pollenDAO.connect(user1).rebalancePortfolio(invalidWeightArrayLength, Array(invalidWeightArrayLength.length).fill(false), rebalanceAmount, true))
        .to.be.revertedWith('Weights length must equal that of whitelisted assets');
    });
    it('Should revert if number of assets exceeds maximum number of assets per portfolio', async function () {
      const ERC20Factory = await ethers.getContractFactory('ERC20');
      const assetD = await ERC20Factory.deploy('AssetD', 'AD') as ERC20;
      await assetUSD.deployed();

      await pollenDAO.connect(admin).addAsset(assetD.address);
      await pollenDAO.setMaxNumberOfAssetsPerPortfolio(4);

      const newWeightsArray = [0, 30, 30, 30, 10];

      await expect(pollenDAO.connect(user1).rebalancePortfolio(newWeightsArray, Array(newWeightsArray.length).fill(false), rebalanceAmount, tokenType))
        .to.be.revertedWith('Quoter: asset doesn\'t have feed');
      // vePLN
      await expect(pollenDAO.connect(user1).rebalancePortfolio(newWeightsArray, Array(newWeightsArray.length).fill(false), rebalanceAmount, true))
        .to.be.revertedWith('Quoter: asset doesn\'t have feed');
    });
    it('Should revert if user inputs a non-zero weight for a delisted asset', async function () {
      await pollenDAO.connect(admin).removeAsset(assetA.address);
      await expect(pollenDAO.connect(user1).rebalancePortfolio(validWeightArray, Array(validWeightArray.length).fill(false), rebalanceAmount, tokenType))
        .to.be.revertedWith('Weight must be 0 for a delisted asset');
      // vePLN
      await expect(pollenDAO.connect(user1).rebalancePortfolio(validWeightArray, Array(validWeightArray.length).fill(false), rebalanceAmount, tokenType))
        .to.be.revertedWith('Weight must be 0 for a delisted asset');
    });
    it('Should revert if cooldown period for rebalancing has not already passed', async function () {
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenDAO.connect(admin).setRebalancePeriod(timeStamp * 2);
      await expect(pollenDAO.connect(user1).rebalancePortfolio(validWeightArray, Array(validWeightArray.length).fill(false), rebalanceAmount, tokenType))
        .to.be.revertedWith('Too early to rebalance');
      // vePLN
      await expect(pollenDAO.connect(user1).rebalancePortfolio(validWeightArray, Array(validWeightArray.length).fill(false), rebalanceAmount, true))
        .to.be.revertedWith('Too early to rebalance');
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should close portfolio if the first weight is 100', async function () {
      await pollenToken.connect(user1).approve(pollenDAO.address, rebalanceAmount);
      await pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArrayToClosePortfolio, Array(rebalancedWeightArrayToClosePortfolio.length).fill(false), rebalanceAmount, tokenType);
      const portfolioInfo = await pollenDAO.connect(user1.address).getPortfolio(user1.address, user1.address);
      expect(portfolioInfo[4]).to.be.false;
    });
    it('Should close portfolio if the first weight is 100 (vePLN)', async function () {
      await pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArrayToClosePortfolio, Array(rebalancedWeightArrayToClosePortfolio.length).fill(false), rebalanceAmount, true);
      const portfolioInfo = await pollenDAO.connect(user1.address).getPortfolio(user1.address, user1.address);
      expect(portfolioInfo[4]).to.be.false;
    });
    it('Should rebalance portfolio with correct asset amounts', async function () {
      await pollenToken.connect(user1).approve(pollenDAO.address, rebalanceAmount);
      await pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArray, Array(rebalancedWeightArray.length).fill(false), rebalanceAmount, tokenType);
      const assets = await pollenDAO.getPortfolio(user1.address, user1.address);
      // off-chain value
      const USD_ENUM_INDEX = 0;
      const UsdPrice = BASE_18;
      const asset1UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetA.address);
      const asset2UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetB.address);
      const asset3UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetC.address);
      const assetArray = [UsdPrice, asset1UsdPrice.rate, asset2UsdPrice.rate, asset3UsdPrice.rate];
      const initialPortfolioIndex = BASE_18;
      const allocations: Array<BN> = [];
      rebalancedWeightArray.forEach((weight, index) => {
        const bnWeight = BN.from(weight);
        const numerator = bnWeight.mul(initialPortfolioIndex).mul(BASE_18);
        const denominator = assetArray[index].mul(100);
        allocations.push(numerator.div(denominator));
      });
      // on-chain/off-chain assertions
      expect(assets[0].length).to.eq(validWeightArray.length);
      assets.assetAmounts.forEach((amount, index) => {
        expect(amount).to.eq(allocations[index]);
      });
    });
    it('Should rebalance portfolio with correct asset amounts (vePLN)', async function () {
      await pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArray, Array(rebalancedWeightArray.length).fill(false), rebalanceAmount, true);
      const assets = await pollenDAO.getPortfolio(user1.address, user1.address);
      // off-chain value
      const USD_ENUM_INDEX = 0;
      const UsdPrice = BASE_18;
      const asset1UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetA.address);
      const asset2UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetB.address);
      const asset3UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetC.address);
      const assetArray = [UsdPrice, asset1UsdPrice.rate, asset2UsdPrice.rate, asset3UsdPrice.rate];
      const initialPortfolioIndex = BASE_18;
      const allocations: Array<BN> = [];
      rebalancedWeightArray.forEach((weight, index) => {
        const bnWeight = BN.from(weight);
        const numerator = bnWeight.mul(initialPortfolioIndex).mul(BASE_18);
        const denominator = assetArray[index].mul(100);
        allocations.push(numerator.div(denominator));
      });
      // on-chain/off-chain assertions
      expect(assets[0].length).to.eq(validWeightArray.length);
      assets.assetAmounts.forEach((amount, index) => {
        expect(amount).to.eq(allocations[index]);
      });
    });
    // *** EVENT CHECKS ***
    it('Should emit a PortfolioClosed event with the correct params when portfolio is closed', async function () {
      await expect(pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArrayToClosePortfolio, Array(rebalancedWeightArrayToClosePortfolio.length).fill(false), rebalanceAmount, tokenType))
        .to.emit(pollenDAO, 'PortfolioClosed');
      // .withArgs(user1.address, rebalancedWeightArray, 0);
    });
    it('Should emit a PortfolioClosed event with the correct params when portfolio is closed (vePLN)', async function () {
      await expect(pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArrayToClosePortfolio, Array(rebalancedWeightArrayToClosePortfolio.length).fill(false), rebalanceAmount, true))
        .to.emit(pollenDAO, 'PortfolioClosed');
      // .withArgs(user1.address, rebalancedWeightArray, 0);
    });
    it('Should emit a PortfolioRebalanced event with the correct params', async function () {
      await expect(pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArray, Array(rebalancedWeightArray.length).fill(false), rebalanceAmount, tokenType))
        .to.emit(pollenDAO, 'PortfolioRebalanced');
      // .withArgs(user1.address, rebalancedWeightArray, 0);
    });
    it('Should emit a PortfolioRebalanced event with the correct params (vePLN)', async function () {
      await expect(pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArray, Array(rebalancedWeightArray.length).fill(false), rebalanceAmount, tokenType))
        .to.emit(pollenDAO, 'PortfolioRebalanced');
      // .withArgs(user1.address, rebalancedWeightArray, 0);
    });
  });

  describe('setRebalancePeriod', async function () {
    // *** REVERT CHECKS ***
    it('Should revert if not called by the admin', async function () {
      await expect(pollenDAO.connect(user1).setRebalancePeriod(10))
        .to.be.revertedWith('Admin access required');
    });
  });

  describe('setLimitPortfolioBalance', async function () {
    // *** REVERT CHECKS ***
    it('Should revert if not called by the admin', async function () {
      await expect(pollenDAO.connect(user1).setLimitPortfolioBalance(100, 100))
        .to.be.revertedWith('Admin access required');
    });
  });

  describe('addAsset', async function () {
    // *** REVERT CHECKS ***
    it('Should revert if not called by the admin', async function () {
      await expect(pollenDAO.connect(user1).addAsset(assetA.address))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if asset already exists in the PortfolioAssetSet', async function () {
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await expect(pollenDAO.connect(admin).addAsset(assetA.address))
        .to.be.revertedWith('Asset already in set');
    });
    it('Should revert if input is the zero address', async function () {
      await expect(pollenDAO.connect(admin).addAsset(ZERO_ADDRESS))
        .to.be.revertedWith('Asset cannot be zero address');
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should allow admin to add an asset', async function () {
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);

      expect((await pollenDAO.getAssets())[0]).to.equal(assetA.address);
      expect((await pollenDAO.getAssets())[1]).to.equal(assetB.address);
    });
    // *** EVENT CHECKS ***
    it('Should emit AssetAdded event with the correct params', async function () {
      await expect(pollenDAO.connect(admin).addAsset(assetA.address))
        .to.emit(pollenDAO, 'AssetAdded');
      // .withArgs(assetA.address);
    });
  });

  describe('removeAsset', async function () {
    let transferAmount: BN;

    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);
      transferAmount = ethers.utils.parseEther('1');

      // seed user account with Pollen tokens
      await pollenToken.connect(admin).transfer(user1.address, transferAmount);
      await pollenToken.connect(admin).transfer(user2.address, transferAmount);
      await pollenToken.connect(user1).approve(pollenDAO.address, transferAmount);
      await pollenToken.connect(user2).approve(pollenDAO.address, transferAmount);
    });
    // *** REVERT CHECKS ***
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(pollenDAO.connect(user1).removeAsset(assetA.address))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if input asset is not in the PortfolioAssetSet', async function () {
      await pollenDAO.connect(admin).removeAsset(assetB.address);
      await expect(pollenDAO.connect(admin).removeAsset(assetB.address))
        .to.be.revertedWith('Asset not in set');
    });
    it('Should revert if input is the zero address', async function () {
      await expect(pollenDAO.connect(admin).removeAsset(ZERO_ADDRESS))
        .to.be.revertedWith('Asset cannot be zero address');
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Removed asset should not be in PortfolioAssetSet', async function () {
      expect(await pollenDAO.getAssets()).to.contain(assetA.address);
      await pollenDAO.connect(admin).removeAsset(assetA.address);
      expect(await pollenDAO.getAssets()).to.not.contain(assetA.address);
    });
    it('Removed asset that is re-added should be in PortfolioAssetSet', async function () {
      const whitelistedAssetsLengthBefore = (await pollenDAO.getAssets()).length;
      await pollenDAO.connect(admin).removeAsset(assetA.address);
      expect(await pollenDAO.getAssets()).to.not.contain(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      const whitelistedAssetsLengthAfter = (await pollenDAO.getAssets()).length;
      expect(await pollenDAO.getAssets()).to.contain(assetA.address);
      expect(whitelistedAssetsLengthBefore).to.eq(whitelistedAssetsLengthAfter);
    });
    // *** EVENT CHECKS ***
    it('Should emit AssetRemoved event with the correct params', async function () {
      await expect(pollenDAO.connect(admin).removeAsset(assetA.address))
        .to.emit(pollenDAO, 'AssetRemoved');
      // .withArgs(assetA.address);
    });
  });

  describe('delegatePollen', async function () {
    const amountDelegated = 1000;
    const validWeightArray = [0, 30, 30, 40];
    const initialPollenAmount = ethers.utils.parseEther('10');
    const tokenType = false;
    const isShort = Array(validWeightArray.length).fill(false);

    // seed user account with Pollen tokens
    beforeEach(async function () {
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, initialPollenAmount.mul(10));
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);

      await pollenToken.connect(admin).transfer(user1.address, initialPollenAmount.mul(2));
      await pollenToken.connect(user1).approve(pollenDAO.address, initialPollenAmount);
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);
      await pollenToken.connect(admin).transfer(delegator.address, initialPollenAmount.add(amountDelegated));
      await pollenToken.connect(delegator).approve(pollenDAO.address, amountDelegated);

      // create deployer Lock
      const currentTimestampInSeconds = Math.ceil(Date.now() / 1000);
      const account = delegator.address;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year
      await pollenToken.connect(delegator).approve(vePLN.address, initialPollenAmount);
      await vePLN.connect(delegator).lock(initialPollenAmount, lockEnd);
      await vePLN.connect(delegator).approve(pollenDAO.address, initialPollenAmount);
    });
    // *** REVERT CHECKS ***
    it('Should revert if delegatee address is the zero address', async function () {
      await expect(
        pollenDAO.connect(delegator).delegatePollen(ZERO_ADDRESS, amountDelegated, tokenType)
      ).to.be.revertedWith('invalid delegate');
      // vePLN
      await expect(
        pollenDAO.connect(delegator).delegatePollen(ZERO_ADDRESS, amountDelegated, true)
      ).to.be.revertedWith('invalid delegate');
    });
    it('Should revert if delegator has insufficient balance', async function () {
      await expect(
        pollenDAO.connect(delegator).delegatePollen(user1.address, initialPollenAmount.mul(2), tokenType),
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
      // vePLN
      await expect(
        pollenDAO.connect(delegator).delegatePollen(user1.address, initialPollenAmount.mul(2), true),
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should update the delegators and DAOs balance', async function () {
      await expect(async () => {
        await pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, tokenType);
      }).to.changeTokenBalances(pollenToken, [pollenDAO, delegator], [amountDelegated, -amountDelegated]);
      // vePLN
      await expect(async () => {
        await pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, true);
      }).to.changeTokenBalances(vePLN, [pollenDAO, delegator], [amountDelegated, -amountDelegated]);
    });
    it('Should update the portfolios balance', async function () {
      const dataBefore = await pollenDAO.getPortfolio(user1.address, delegator.address);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, tokenType);
      const dataAfter = await pollenDAO.connect(delegator).getPortfolio(user1.address, delegator.address);
      expect(dataAfter[1]).to.eq(dataBefore[1].add(amountDelegated));
      // vePLN
      const dataBeforeVE = await pollenDAO.getPortfolio(user1.address, delegator.address);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, true);
      const dataAfterVE = await pollenDAO.connect(delegator).getPortfolio(user1.address, delegator.address);
      expect(dataAfterVE[1]).to.eq(dataBeforeVE[1].add(amountDelegated));
    });
    it('Should update the portfolios deposits', async function () {
      const dataBefore = await pollenDAO.getPortfolio(user1.address, delegator.address);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, tokenType);
      const dataAfter = await pollenDAO.connect(delegator).getPortfolio(user1.address, delegator.address);
      expect(dataAfter[2]).to.eq(dataBefore[2].add(amountDelegated));
      // vePLN
      const dataBeforeVE = await pollenDAO.getPortfolio(user1.address, delegator.address);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, true);
      const dataAfterVE = await pollenDAO.connect(delegator).getPortfolio(user1.address, delegator.address);
      expect(dataAfterVE[3]).to.eq(dataBeforeVE[3].add(amountDelegated));
    });
    it('Should not allow the Delegator balance to interfere with the maximum delegate amount', async function () {
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, amountDelegated);
      await expect(pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, tokenType))
        .to.emit(pollenDAO, 'Delegated');
    });
    // *** EVENT CHECKS ***
    it('Should emit Delegated event with the correct params', async function () {
      await expect(pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, tokenType))
        .to.emit(pollenDAO, 'Delegated');
      // vePLN
      await expect(pollenDAO.connect(delegator).delegatePollen(user1.address, amountDelegated, true))
        .to.emit(pollenDAO, 'Delegated');
      // .withArgs(user1.address, amount, validWeightArray);
    });
  });

  describe('multiDelegatePollen', async function () {
    const amountDelegated = BASE_18.mul(1000);
    const validWeightArray = [5, 30, 25, 40];
    const initialPollenAmount = ethers.utils.parseEther('.5');
    const delegatees = [delegatee1.address, delegatee2.address, delegatee3.address];
    const percentagePerPortfolio = [40, 20, 30];
    const amounts = [amountDelegated.mul(percentagePerPortfolio[0]).div(100),
      amountDelegated.mul(percentagePerPortfolio[1]).div(100),
      amountDelegated.mul(percentagePerPortfolio[2]).div(100)];
    const tokenType = false;
    const isShort = Array(validWeightArray.length).fill(false);

    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, amountDelegated.mul(1000));

      // create portfolios
      await pollenToken.connect(admin).transfer(delegatee1.address, initialPollenAmount);
      await pollenToken.connect(delegatee1).approve(pollenDAO.address, initialPollenAmount);
      await pollenDAO.connect(delegatee1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);

      await pollenToken.connect(admin).transfer(delegatee2.address, initialPollenAmount);
      await pollenToken.connect(delegatee2).approve(pollenDAO.address, initialPollenAmount);
      await pollenDAO.connect(delegatee2).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);

      await pollenToken.connect(admin).transfer(delegatee3.address, initialPollenAmount);
      await pollenToken.connect(delegatee3).approve(pollenDAO.address, initialPollenAmount);
      await pollenDAO.connect(delegatee3).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);

      await pollenToken.connect(admin).transfer(delegator.address, amountDelegated);
      await pollenToken.connect(delegator).approve(pollenDAO.address, amountDelegated);
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should correctly delegate Pollen to multiple delegatees', async function () {
      const totalAmountDelegated = amounts.reduce((prev, curr) => prev.add(curr));
      const tokenType = false;

      await expect(async () => {
        await pollenDAO.connect(delegator).multiDelegatePollen(delegatees, amounts, tokenType);
      }).to.changeTokenBalances(pollenToken, [pollenDAO], [totalAmountDelegated]);
    });
    it('Should correctly store the correct value in each portfolio', async function () {
      const assetList = [assetUSD.address, assetA.address, assetB.address, assetC.address];
      await pollenDAO.connect(delegator).multiDelegatePollen(delegatees, amounts, tokenType);
      const prices = await pollenDAO.getPrices(validWeightArray, assetList);
      const portfolioIndeces: Array<BN> = [];
      // get current portfolio values
      amounts.forEach(async function (amount, index) {
        const portfolio_i = await pollenDAO.getPortfolio(delegatees[index], delegator.address);
        expect(portfolio_i.depositPLN).to.eq(amount);
        expect(portfolio_i.balance).to.eq(amount);
      });
    });
    // *** EVENT CHECKS ***
    it('Should emit Delegated event with the correct params', async function () {
      await expect(pollenDAO.connect(delegator).multiDelegatePollen(delegatees, amounts, tokenType))
        .to.emit(pollenDAO, 'Delegated');
      // .withArgs(user1.address, amount, validWeightArray);
    });
  });

  describe('getTotalReward & withdraw rewards', async function () {
    const initialPollenAmount = BN.from(1000).mul(BASE_18);
    const totalAmountDelegated = BN.from(1000).mul(BASE_18);
    const portfolioAllocations = [.2, .8];
    const amountsDelegated = [totalAmountDelegated.mul(portfolioAllocations[0] * 100).div(1000),
      totalAmountDelegated.mul(portfolioAllocations[1] * 100).div(1000)];
    const delegatees = [delegatee1.address, delegatee2.address];
    const portfolio1Weights = [0, 20, 70, 10];
    const portfolio2Weights = [0, 20, 10, 70];
    const startPrices = 10;
    const initialPrices = [1, startPrices, startPrices, startPrices];
    const newAsset1Price = 2;
    const newAsset2Price = 45;
    const newAsset3Price = 5;
    const prices = [1, newAsset1Price, newAsset2Price, newAsset3Price];
    const tokenType = false;

    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, initialPollenAmount.mul(1000));

      await pollenDAO.connect(admin).createBenchMarkPortfolio([100, 0, 0, 0]);

      await pollenToken.connect(admin).transfer(delegator.address, totalAmountDelegated);
      await pollenToken.connect(delegator).approve(pollenDAO.address, totalAmountDelegated);

      await pollenToken.connect(admin).transfer(delegatee1.address, initialPollenAmount);
      await pollenToken.connect(admin).transfer(delegatee2.address, initialPollenAmount);
      await pollenToken.connect(delegatee1).approve(pollenDAO.address, initialPollenAmount);
      await pollenToken.connect(delegatee2).approve(pollenDAO.address, initialPollenAmount);


      await mockPriceFeed1.incrementRoundAndSetAnswer(initialPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(initialPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(initialPrices[3]);

      await pollenDAO.connect(delegatee1).createPortfolio(initialPollenAmount, portfolio1Weights, Array(portfolio1Weights.length).fill(false), tokenType);
      await pollenDAO.connect(delegatee2).createPortfolio(initialPollenAmount, portfolio2Weights, Array(portfolio2Weights.length).fill(false), tokenType);
      await pollenDAO.connect(delegator).multiDelegatePollen(delegatees, amountsDelegated, tokenType);
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should correctly get current rewards and penalties', async function () {
      await mockPriceFeed1.incrementRoundAndSetAnswer(prices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(prices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(prices[3]);

      const [portfolioReturn, rewards, isPositive] = await pollenDAO.getTotalReward(delegator.address, delegatees, tokenType);

      const expectedReturn1 = getExpectedPortfolioReturn(portfolio1Weights, initialPrices, prices);
      const expectedReturnWithFee1 = expectedReturn1.return.mul(BASE_18).div(BASE_WEIGHTS).mul(80).div(100);
      const expectedRewards1 = amountsDelegated[0].mul(expectedReturn1.return).div(100);
      const expectedRewardWithFee1 = expectedRewards1.mul(80).div(100);

      expect(portfolioReturn[0]).to.equal(expectedReturnWithFee1); // 224% return (with 20% fee)
      expect(rewards[0]).to.eq(expectedRewardWithFee1);
      expect(isPositive[0]).to.be.true;

      const expectedReturn2 = getExpectedPortfolioReturn(portfolio2Weights, initialPrices, prices);
      const expectedRewards2 = amountsDelegated[1].mul(expectedReturn2.return).div(100);

      expect(portfolioReturn[1]).to.equal(expectedReturn2.return.mul(BASE_18).div(BASE_WEIGHTS)); // -16% return
      expect(rewards[1]).to.eq(expectedRewards2);
      expect(isPositive[1]).to.be.false;
    });
    it('Creator can close portfolio, and delegators can withdraw rewards', async function () {
      // increase time to allow for full reward rate
      provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
      provider.send('evm_mine', []);
      await provider.send('evm_mine', []);
      const priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];
      const ts = (await provider.getBlock('latest')).timestamp;
      priceFeeds.forEach((feed, index) => {
        feed.setUpdatedAt(ts);
      });

      await mockPriceFeed1.incrementRoundAndSetAnswer(prices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(prices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(prices[3]);
      const closeWeights = [100, 0, 0, 0];
      await pollenDAO.connect(delegatee1).rebalancePortfolio(closeWeights, Array(closeWeights.length).fill(false), 0, tokenType);
      const plnBalanceBefore = await pollenToken.balanceOf(delegator.address);
      const portfolioManagerBalanceBefore = await pollenToken.balanceOf(delegatee1.address);
      await pollenDAO.connect(delegator).withdrawRewards(delegatee1.address, tokenType);
      const plnBalanceAfter = await pollenToken.balanceOf(delegator.address);
      const portfolioManagerBalanceAfter = await pollenToken.balanceOf(delegatee1.address);

      const expectedReturn = getExpectedPortfolioReturn(portfolio1Weights, initialPrices, prices);
      const expectedRewards = amountsDelegated[0].mul(expectedReturn.return).div(100);
      const expectedRewardsWithDelegatorFee = expectedRewards.mul(80).div(100);
      const expectedManagerRewards = expectedRewards.mul(20).div(100);

      expect(plnBalanceAfter.sub(plnBalanceBefore)).to.be.eq(expectedRewardsWithDelegatorFee);
      expect(portfolioManagerBalanceAfter.sub(portfolioManagerBalanceBefore)).to.be.eq(expectedManagerRewards);
    });
  });

  describe('getAssets', async function () {
    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should return empty array if no assets are added', async function () {
      const assets = [assetUSD.address, assetA.address, assetB.address, assetC.address];
      for (let i = 0; i < assets.length; i++) {
        await pollenDAO.connect(admin).removeAsset(assets[i]);
      }

      expect(await pollenDAO.connect(user1).getAssets()).to.be.empty;
    });
    it('Should return the current assets', async function () {
      const assets = [assetUSD.address, assetA.address, assetB.address, assetC.address];

      expect(await pollenDAO.connect(user1).getAssets()).to.eql(assets);
    });
  });

  describe('getPortfolio', async function () {
    const validWeightArray = [0, 30, 30, 40];
    const initialPollenAmount = ethers.utils.parseEther('.1');
    const amountDelegated = 1000;
    const wholePollen = ethers.utils.parseEther('2');
    const tokenType = false;
    const isShort = Array(validWeightArray.length).fill(false);

    before(async function () {
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, initialPollenAmount.mul(10));
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).addAsset(assetC.address);

      // create portfolio
      await pollenToken.connect(admin).transfer(delegatee1.address, wholePollen.mul(2));
      await pollenToken.connect(delegatee1).approve(pollenDAO.address, initialPollenAmount);
      await pollenDAO.connect(delegatee1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);

      // get vePLN tokens and approve PollenDAO
      const currentTimestampInSeconds = Math.ceil(Date.now() / 1000);
      const account = delegatee1.address;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year
      await pollenToken.connect(delegatee1).approve(vePLN.address, initialPollenAmount);
      await vePLN.connect(delegatee1).lock(initialPollenAmount, lockEnd);
      await vePLN.connect(delegatee1).approve(pollenDAO.address, initialPollenAmount);
      await pollenDAO.connect(delegatee1).rebalancePortfolio(validWeightArray, Array(validWeightArray.length).fill(false), initialPollenAmount, true);
    });
    // *** FUNCTIONALITY CHECKS ***
    it('Should return a user\'s balances for a portfolio', async function () {
      await pollenToken.connect(delegatee1).approve(pollenDAO.address, amountDelegated);
      await pollenDAO.connect(delegatee1).delegatePollen(delegatee1.address, amountDelegated, tokenType);
      const portfolio = await pollenDAO.connect(delegatee1).getPortfolio(delegatee1.address, delegatee1.address);
      const userBalances = portfolio[1];

      expect(userBalances).to.eql(initialPollenAmount.add(amountDelegated).add(initialPollenAmount));
    });
    it('Should return a user\'s deposits for a portfolio', async function () {
      await pollenToken.connect(delegatee1).approve(pollenDAO.address, amountDelegated);
      await pollenDAO.connect(delegatee1).delegatePollen(delegatee1.address, amountDelegated, tokenType);
      const portfolio = await pollenDAO.connect(delegatee1).getPortfolio(delegatee1.address, delegatee1.address);
      const userDeposits = portfolio[2];

      expect(userDeposits).to.eql(initialPollenAmount.add(amountDelegated));
    });
  });

  describe('getPrices', async function () {
    // *** REVERT CHECKS ***
    it('Should revert if price feed is too old', async function () {
      const amounts = [1, 2, 3];
      const assets = [assetA.address, assetB.address, assetC.address];

      await mockPriceFeed2.setUpdatedAt(0);

      await expect(pollenDAO.getPrices(amounts, assets))
        .to.be.revertedWith('Price feed is too old');
    });
  });
});
