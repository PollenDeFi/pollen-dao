import chai from 'chai';
import { ethers, waffle } from 'hardhat';
import { BigNumber as BN } from 'ethers';

import {
  ERC20,
  MockPriceFeed,
  PollenToken,
  LockedPollen,
  Portfolio,
  PollenDAO,
  IPollenDAO,
  Quoter,
  Minter,
} from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { INITIAL_BALANCES, MAX_LOCK_PERIOD } from './helpers/constants';
import { calcValueWithShorts } from './helpers/calculations';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

const BASE_18 = BN.from(10 ** 10).mul(10 ** 8);

describe('Shorts', function () {
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

  //let mInfo: Object;

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
    await pollenToken.connect(admin).transfer(delegator.address, BN.from('100000000000000000000').add(INITIAL_BALANCES));

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
    const portfolio = await Portfolio.deploy() as Portfolio;
    await portfolio.deployed();

    const Quoter = await ethers.getContractFactory('Quoter');
    const quoter = await Quoter.deploy() as Quoter;
    await quoter.deployed();

    const Minter = await ethers.getContractFactory('Minter');
    const minter = await Minter.deploy() as Minter;
    await minter.deployed();

    // deploy modules selectors
    const portfolioSelectors = Object.keys(Portfolio.interface.functions).map((item) => Portfolio.interface.getSighash(item));
    const quoterSelectors = Object.keys(Quoter.interface.functions).map((item) => Quoter.interface.getSighash(item));
    const minterSelectors = Object.keys(Minter.interface.functions).map((item) => Minter.interface.getSighash(item));

    // deploy PollenDAO contract
    const PollenDAO = await ethers.getContractFactory('PollenDAO');
    const pollenDAOImplementation = await PollenDAO.deploy() as PollenDAO;
    await pollenDAOImplementation.deployed();

    // Deploy LockedPollen (vePLN)
    const VEPLN = await ethers.getContractFactory('LockedPollen');
    vePLN = await VEPLN.deploy(pollenDAOImplementation.address, pollenToken.address) as LockedPollen;
    await vePLN.deployed();

    // instantiate full pollenDAO
    pollenDAO = await ethers.getContractAt('IPollenDAO', pollenDAOImplementation.address) as IPollenDAO;
    await pollenDAO.setPollenTokens(pollenToken.address, vePLN.address);

    // set Dao in token contract
    await pollenToken.setDaoAddress(pollenDAO.address);

    // add modules to DAO
    await pollenDAO.addModule(portfolio.address, portfolioSelectors);
    await pollenDAO.addModule(quoter.address, quoterSelectors);
    await pollenDAO.addModule(minter.address, minterSelectors);

    const timestamp = 365 * 24 * 60 * 60 * 4;
    const date = new Date();
    const current = (date.getTime()).toString().slice(0, -3);
    const rate = '10000000000000000';
    const issuanceSchedule = [{
      maxTime: BN.from(timestamp).add(current), // end of time period
      offsetX: current, // time now
      offsetY: ethers.utils.parseEther('94000000'),
      rate
    }];
    await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);

    const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

    mockPriceFeed1 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed1.deployed();
    await mockPriceFeed1.incrementRoundAndSetAnswer(ethers.utils.parseEther('1'));

    mockPriceFeed2 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed2.deployed();
    await mockPriceFeed2.incrementRoundAndSetAnswer(ethers.utils.parseEther('2'));

    mockPriceFeed3 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed3.deployed();
    await mockPriceFeed3.incrementRoundAndSetAnswer(ethers.utils.parseEther('1'));

    const rateBases = [0, 0, 0];
    const assets = [assetA.address, assetB.address, assetC.address];
    const feeds = [mockPriceFeed1.address, mockPriceFeed2.address, mockPriceFeed3.address];

    await pollenDAO.connect(admin).addPriceFeeds(rateBases, assets, feeds);

    // Set max number of possible assets in the portfolio
    await pollenDAO.setMaxNumberOfAssetsPerPortfolio(4);

    //set allowances to DAO
    const allowance = ethers.utils.parseEther('10000');
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
    const validWeightArray = [0, 30, 30, 40];
    const initialPollenAmount = ethers.utils.parseEther('10');
    const tokenType = false; // PLN
    const isShort = Array(validWeightArray.length).fill(true);

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
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year
      await pollenToken.connect(user1).approve(vePLN.address, initialPollenAmount);
      await vePLN.connect(user1).lock(initialPollenAmount, lockEnd);
      await vePLN.connect(user1).approve(pollenDAO.address, initialPollenAmount);
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
  });

  // describe('rebalancePortfolio', function () {
  //   const validWeightArray = [0, 30, 30, 40];
  //   const rebalancedWeightArray = [5, 55, 10, 30];
  //   const rebalancedWeightArrayToClosePortfolio = [100, 0, 0, 0];
  //   const initialPollenAmount = ethers.utils.parseEther('10');
  //   const rebalanceAmount = initialPollenAmount.div(3);
  //   const tokenType = false; // PLN
  //   const isShort = Array(validWeightArray.length).fill(true);
  //   const shortsValue = BASE_18;

  //   beforeEach(async function () {
  //     await pollenDAO.connect(admin).addAsset(assetUSD.address);
  //     await pollenDAO.connect(admin).addAsset(assetA.address);
  //     await pollenDAO.connect(admin).addAsset(assetB.address);
  //     await pollenDAO.connect(admin).addAsset(assetC.address);

  //     // seed user account with Pollen tokens
  //     await pollenToken.connect(admin).transfer(user1.address, initialPollenAmount.mul(2));
  //     await pollenToken.connect(user1).approve(pollenDAO.address, initialPollenAmount);

  //     await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, validWeightArray, isShort, tokenType);
  //     await pollenToken.connect(user1).approve(pollenDAO.address, rebalanceAmount);

  //     // create deployer Lock
  //     const currentTimestampInSeconds = Math.ceil(Date.now() / 1000);
  //     const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year
  //     await pollenToken.connect(user1).approve(vePLN.address, initialPollenAmount);
  //     await vePLN.connect(user1).lock(initialPollenAmount, lockEnd);
  //     await vePLN.connect(user1).approve(pollenDAO.address, initialPollenAmount);
  //   });
  //   it('Should close portfolio if the first weight is 100', async function () {
  //     await pollenToken.connect(user1).approve(pollenDAO.address, rebalanceAmount);
  //     await pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArrayToClosePortfolio, isShort, rebalanceAmount, tokenType);
  //     const portfolioInfo = await pollenDAO.connect(user1.address).getPortfolio(user1.address, user1.address);
  //     expect(portfolioInfo[4]).to.be.false;
  //   });
  //   it('Should rebalance portfolio with correct asset amounts', async function () {
  //     const initialAssets = await pollenDAO.getPortfolio(user1.address, user1.address);
  //     await pollenToken.connect(user1).approve(pollenDAO.address, rebalanceAmount);
  //     await pollenDAO.connect(user1).rebalancePortfolio(rebalancedWeightArray, isShort, rebalanceAmount, tokenType);
  //     const assets = await pollenDAO.getPortfolio(user1.address, user1.address);
  //     // off-chain value
  //     const USD_ENUM_INDEX = 0;
  //     const UsdPrice = BASE_18;
  //     const asset1UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetA.address);
  //     const asset2UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetB.address);
  //     const asset3UsdPrice = await pollenDAO.quotePrice(USD_ENUM_INDEX, assetC.address);
  //     const assetArray = [UsdPrice, asset1UsdPrice.rate, asset2UsdPrice.rate, asset3UsdPrice.rate];
  //     const baseFunds = calcValueWithShorts(initialAssets.assetAmounts, assetArray, isShort, shortsValue);
  //     const allocations: Array<BN> = [];
  //     rebalancedWeightArray.forEach((weight, index) => {
  //       const bnWeight = BN.from(weight);
  //       const numerator = bnWeight.mul(baseFunds).mul(BASE_18);
  //       const denominator = assetArray[index].mul(100);
  //       allocations.push(numerator.div(denominator));
  //     });
  //     // on-chain/off-chain assertions
  //     expect(assets[0].length).to.eq(validWeightArray.length);
  //     assets.assetAmounts.forEach((amount, index) => {
  //       expect(amount).to.eq(allocations[index]);
  //     });
  //   });
  // });

  describe('getTotalReward & withdraw rewards', async function () {
    const initialPollenAmount = BN.from(1000).mul(BASE_18);
    const totalAmountDelegated = BN.from(1000).mul(BASE_18);
    const portfolioAllocations = [.2, .8];
    const amountsDelegated = [totalAmountDelegated.mul(portfolioAllocations[0] * 100).div(1000),
      totalAmountDelegated.mul(portfolioAllocations[1] * 100).div(1000)];
    const delegatees = [delegatee1.address, delegatee2.address];
    const portfolio1Weights = [0, 50, 50];
    const portfolio2Weights = [0, 50, 50];
    const tokenType = false;

    beforeEach(async function () {
      await pollenDAO.connect(admin).addAsset(assetUSD.address);
      await pollenDAO.connect(admin).addAsset(assetA.address);
      await pollenDAO.connect(admin).addAsset(assetB.address);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, initialPollenAmount.mul(1000));

      await pollenDAO.connect(admin).createBenchMarkPortfolio([100, 0, 0]);

      await pollenToken.connect(admin).transfer(delegator.address, totalAmountDelegated);
      await pollenToken.connect(delegator).approve(pollenDAO.address, totalAmountDelegated);

      await pollenToken.connect(admin).transfer(delegatee1.address, initialPollenAmount);
      await pollenToken.connect(admin).transfer(delegatee2.address, initialPollenAmount);
      await pollenToken.connect(delegatee1).approve(pollenDAO.address, initialPollenAmount);
      await pollenToken.connect(delegatee2).approve(pollenDAO.address, initialPollenAmount);
    });

    it('Should correctly get returns. CASE 1: ALL SHORTS POSITIVE RETURN', async function () {
      // move time ahead
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 200]);
      await ethers.provider.send('evm_mine', []);

      // set variables
      const isShort = [false, true, true];
      const initialPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('2'), ethers.utils.parseEther('4')];
      const finalPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('1'), ethers.utils.parseEther('1')];

      const assetsAmounts = [
        BN.from(0),
        BN.from(portfolio1Weights[1]).mul(BASE_18).mul(BASE_18).div(initialPrices[1].mul(BN.from(100))),
        BN.from(portfolio1Weights[2]).mul(BASE_18).mul(BASE_18).div(initialPrices[2].mul(BN.from(100))),
      ];

      const initialPortfolioValue = BASE_18;
      const finalPortfolioValue = calcValueWithShorts(assetsAmounts, finalPrices, isShort, BASE_18);

      const expectedReturn = BASE_18.mul((finalPortfolioValue).sub(initialPortfolioValue)).div(initialPortfolioValue);


      // Set inital prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(initialPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(initialPrices[2]);

      // create portfolio
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, portfolio1Weights, isShort, tokenType);

      // set final prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(finalPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(finalPrices[2]);

      // get total returns
      const balanceBefore = await pollenToken.balanceOf(user1.address);
      await pollenDAO.connect(user1).closeAndWithdraw(initialPollenAmount, tokenType);
      const totalreceived = (await pollenToken.balanceOf(user1.address)).sub(balanceBefore);
      const userReturn = (BASE_18).mul(totalreceived.sub(initialPollenAmount)).div(initialPollenAmount);

      // require returns match
      expect(userReturn).to.be.equal(expectedReturn);


    });
    it('Should correctly get returns. CASE 2: ALL SHORTS NEGATIVE RETURN', async function () {
      // move time ahead
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 200]);
      await ethers.provider.send('evm_mine', []);

      // set variables
      const isShort = [false, true, true];
      const initialPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('2'), ethers.utils.parseEther('2')];
      const finalPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('3'), ethers.utils.parseEther('3')];

      const assetsAmounts = [
        BN.from(0),
        BN.from(portfolio1Weights[1]).mul(BASE_18).mul(BASE_18).div(initialPrices[1].mul(BN.from(100))),
        BN.from(portfolio1Weights[2]).mul(BASE_18).mul(BASE_18).div(initialPrices[2].mul(BN.from(100))),
      ];

      const initialPortfolioValue = BASE_18;
      const finalPortfolioValue = calcValueWithShorts(assetsAmounts, finalPrices, isShort, BASE_18);

      const expectedReturn = BASE_18.mul((finalPortfolioValue).sub(initialPortfolioValue)).div(initialPortfolioValue);


      // Set inital prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(initialPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(initialPrices[2]);

      // create portfolio
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, portfolio1Weights, isShort, tokenType);

      // set final prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(finalPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(finalPrices[2]);

      // get total returns
      const balanceBefore = await pollenToken.balanceOf(user1.address);
      await pollenDAO.connect(user1).closeAndWithdraw(initialPollenAmount, tokenType);
      const totalreceived = (await pollenToken.balanceOf(user1.address)).sub(balanceBefore);
      const userReturn = (BASE_18).mul(totalreceived.sub(initialPollenAmount)).div(initialPollenAmount);

      // require returns match
      expect(userReturn).to.be.equal(expectedReturn);


    });
    it('Should correctly get returns. CASE 3: LONGS AND SHORTS POSITIVE RETURN', async function () {
      // move time ahead
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 200]);
      await ethers.provider.send('evm_mine', []);

      // set variables
      const isShort = [false, true, true];
      const initialPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('2'), ethers.utils.parseEther('5')];
      const finalPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('3'), ethers.utils.parseEther('3')];

      const assetsAmounts = [
        BN.from(0),
        BN.from(portfolio1Weights[1]).mul(BASE_18).mul(BASE_18).div(initialPrices[1].mul(BN.from(100))),
        BN.from(portfolio1Weights[2]).mul(BASE_18).mul(BASE_18).div(initialPrices[2].mul(BN.from(100))),
      ];

      const initialPortfolioValue = BASE_18;
      const finalPortfolioValue = calcValueWithShorts(assetsAmounts, finalPrices, isShort, BASE_18);

      const expectedReturn = BASE_18.mul((finalPortfolioValue).sub(initialPortfolioValue)).div(initialPortfolioValue);


      // Set inital prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(initialPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(initialPrices[2]);

      // create portfolio
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, portfolio1Weights, isShort, tokenType);

      // set final prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(finalPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(finalPrices[2]);

      // get total returns
      const balanceBefore = await pollenToken.balanceOf(user1.address);
      await pollenDAO.connect(user1).closeAndWithdraw(initialPollenAmount, tokenType);
      const totalreceived = (await pollenToken.balanceOf(user1.address)).sub(balanceBefore);
      const userReturn = (BASE_18).mul(totalreceived.sub(initialPollenAmount)).div(initialPollenAmount);

      // require returns match
      expect(userReturn).to.be.equal(expectedReturn);
    });
    it('Should correctly get returns. CASE 4: LONGS AND SHORTS NEGATIVE RETURN', async function () {
      // move time ahead
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 200]);
      await ethers.provider.send('evm_mine', []);

      // set variables
      const isShort = [false, true, true];
      const initialPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('6'), ethers.utils.parseEther('5')];
      const finalPrices = [ethers.utils.parseEther('1'), ethers.utils.parseEther('3'), ethers.utils.parseEther('10')];

      const assetsAmounts = [
        BN.from(0),
        BN.from(portfolio1Weights[1]).mul(BASE_18).mul(BASE_18).div(initialPrices[1].mul(BN.from(100))),
        BN.from(portfolio1Weights[2]).mul(BASE_18).mul(BASE_18).div(initialPrices[2].mul(BN.from(100))),
      ];

      const initialPortfolioValue = BASE_18;
      const finalPortfolioValue = calcValueWithShorts(assetsAmounts, finalPrices, isShort, BASE_18);

      const expectedReturn = BASE_18.mul((finalPortfolioValue).sub(initialPortfolioValue)).div(initialPortfolioValue);


      // Set inital prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(initialPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(initialPrices[2]);

      // create portfolio
      await pollenDAO.connect(user1).createPortfolio(initialPollenAmount, portfolio1Weights, isShort, tokenType);

      // set final prices
      await mockPriceFeed1.incrementRoundAndSetAnswer(finalPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(finalPrices[2]);

      // get total returns
      const balanceBefore = await pollenToken.balanceOf(user1.address);
      await pollenDAO.connect(user1).closeAndWithdraw(initialPollenAmount, tokenType);
      const totalreceived = (await pollenToken.balanceOf(user1.address)).sub(balanceBefore);
      const userReturn = (BASE_18).mul(totalreceived.sub(initialPollenAmount)).div(initialPollenAmount);

      // require returns match
      expect(userReturn).to.be.equal(expectedReturn);
    });

  });

});
