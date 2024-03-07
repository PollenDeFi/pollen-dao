import chai from 'chai';
import { ethers, waffle } from 'hardhat';
import { BigNumber as BN } from 'ethers';

import { ERC20, MockPriceFeed, PollenToken, Portfolio, PollenDAO, IPollenDAO, LockedPollen } from '../typechain';
// import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { ZERO_ADDRESS, ONE_YEAR, BASE_18, ISSUANCE_SCHEDULE } from './helpers/constants';
import { getCurrentTimestamp } from './helpers/helpers';

import { IntegrationManager, Pollinator, PollinatorType, INITIAL_PRICES } from './integration/classes';
import { poll } from 'ethers/lib/utils';
import { randomWeights } from './helpers/random';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

describe('Integration', function () {
  let snapshot: string;
  let pollenToken: PollenToken;
  let vePLN: LockedPollen;
  let pollenDAO: IPollenDAO;
  let assetUSD: ERC20;
  let assetA: ERC20;
  let assetB: ERC20;
  let assetC: ERC20;
  let assets: ERC20[];
  let mockPriceFeedUSD: MockPriceFeed;
  let mockPriceFeed1: MockPriceFeed;
  let mockPriceFeed2: MockPriceFeed;
  let mockPriceFeed3: MockPriceFeed;
  let priceFeeds: MockPriceFeed[];

  const [
    admin
  ] = provider.getWallets();

  const benchmarkWeights = [25, 25, 25, 25];

  before(async () => {
    const PollenToken = await ethers.getContractFactory('PollenToken');
    pollenToken = await PollenToken.deploy(admin.address) as PollenToken;
    await pollenToken.deployed();

    // deploy PollenDAO contract
    const PollenDAO = await ethers.getContractFactory('PollenDAO');
    const pollenDAOImplementation = await PollenDAO.deploy() as PollenDAO;
    await pollenDAOImplementation.deployed();

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

    assets = [assetUSD, assetA, assetB, assetC];


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

    const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

    mockPriceFeed1 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed1.deployed();
    await mockPriceFeed1.incrementRoundAndSetAnswer(INITIAL_PRICES);

    mockPriceFeed2 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed2.deployed();
    await mockPriceFeed2.incrementRoundAndSetAnswer(INITIAL_PRICES);

    mockPriceFeed3 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed3.deployed();
    await mockPriceFeed3.incrementRoundAndSetAnswer(INITIAL_PRICES);
    priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];
    await pollenDAO.connect(admin).addPriceFeeds(
      [0, 0, 0],
      [assetA.address, assetB.address, assetC.address],
      [mockPriceFeed1.address, mockPriceFeed2.address, mockPriceFeed3.address]
    );

    await pollenDAO.connect(admin).addAsset(assetUSD.address);
    await pollenDAO.connect(admin).addAsset(assetA.address);
    await pollenDAO.connect(admin).addAsset(assetB.address);
    await pollenDAO.connect(admin).addAsset(assetC.address);

    // Set max number of possible assets in the portfolio
    await pollenDAO.setMaxNumberOfAssetsPerPortfolio(4);
    await pollenDAO.setLimitPortfolioBalance(0, BASE_18.mul(10 ** 6));

    // MINTER
    await pollenDAO.initializeIssuanceInfo(ISSUANCE_SCHEDULE);
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });

  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('All test', async function () {
    it('Should not fail', async function () {
      const manager = new IntegrationManager(pollenToken, vePLN, pollenDAO, assets, benchmarkWeights);
      await manager.init();
      const numManagers = Array(3);
      const numDelegators = Array(5);
      const sum = numManagers.length + numDelegators.length;
      if (sum > manager.availableWallets) throw 'more pollinators than available wallets';
      // *** CREATE POLLINATORS ***
      // init Managers and create portfolios
      for await (const _ of numManagers) {
        const pollinator = await manager.newPollinator(PollinatorType.MANAGER);
        await pollinator.createPortfolio(false);
      }
      // init Delegators
      for await (const _ of numDelegators) {
        await manager.newPollinator(PollinatorType.DELEGATOR);
      }

      // *** ROUND START ***
      const TOTAL_TIME = ONE_YEAR * 4;
      const NUM_INTERVALS = 4;
      const INTERVAL = TOTAL_TIME / NUM_INTERVALS;
      const current = (await provider.getBlock('latest')).timestamp;
      const end = current + TOTAL_TIME;
      let index = 0;
      const intervals = [];
      for (let i = current; i < end; i += INTERVAL) {
        intervals.push(i);
      }

      for await (const i of intervals) {
        index += 1;
        // run executions
        await manager.runRound();
        // increase time
        await ethers.provider.send('evm_increaseTime', [INTERVAL]);
        await ethers.provider.send('evm_mine', []);
        const lastBlock = await ethers.provider.getBlock('latest');
        await manager.updateCurrentTime();
        // change price
        manager.changePrices();
        const prices = manager.getPrices();
        let priceIndex = 1;
        for await (const feed of priceFeeds) {
          await feed.incrementRoundAndSetAnswer(prices[priceIndex]);
          await feed.setUpdatedAt(lastBlock.timestamp);
          priceIndex += 1;
        }
      }
      // managers close
      for await (const pm of manager.getPortfolioManagers()) {
        try {
          await pm.closeAndWithdrawPortfolio();
        } catch (e) {
          throw {
            msg: 'Test: managers close portfolio',
            e
          };
        }
      }
      // delegators withdraw
      for await (const pd of manager.getDelegators()) {
        try {
          await pd.withdrawAll();
        } catch (e) {
          throw {
            msg: 'Test: delegators rage quit',
            e
          };
        }
      }
    });
  });
});
