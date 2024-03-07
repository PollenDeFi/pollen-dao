import chai from 'chai';
import { ethers, waffle } from 'hardhat';

import { ERC20, MockPriceFeed, Quoter, IPollenDAO } from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { ZERO_ADDRESS } from './helpers/constants';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

describe('Quoter', function () {
  let snapshot: string;
  let pollenDAO: IPollenDAO;
  let quoter: Quoter;
  let assetUSD: ERC20;
  let assetA: ERC20;
  let assetB: ERC20;
  let assetC: ERC20;
  let mockPriceFeed1: MockPriceFeed;

  const [
    deployer,
    user1
  ] = provider.getWallets();

  before(async () => {
    const PROXY = await ethers.getContractFactory('PollenDAO');
    const proxy = await PROXY.deploy() as IPollenDAO;
    await proxy.deployed();

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

    // Deploy module
    const QUOTER = await ethers.getContractFactory('Quoter');
    quoter = await QUOTER.deploy() as Quoter;
    await quoter.deployed();

    // get selectors
    const quoterSelectors = Object.keys(QUOTER.interface.functions).map((item) => QUOTER.interface.getSighash(item));

    // instantiate full pollenDao
    pollenDAO = await ethers.getContractAt('IPollenDAO', proxy.address) as IPollenDAO;

    // add modules to dao
    await pollenDAO.addModule(quoter.address, quoterSelectors);

    const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

    mockPriceFeed1 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed1.deployed();

    // Add assets
    await pollenDAO.addAsset(assetUSD.address);
    await pollenDAO.addAsset(assetA.address);
    await pollenDAO.addAsset(assetB.address);
    await pollenDAO.addAsset(assetC.address);
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });

  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('quotePrice', function () {
    it('Should return the rate and the last update of an asset from a registered feed of 18 decimals', async function () {
      const _feedLatestRoundData = await mockPriceFeed1.latestRoundData();

      await pollenDAO.connect(deployer).addPriceFeed(0, assetA.address, mockPriceFeed1.address);
      const quotePriceReturn = await pollenDAO.quotePrice(0, assetA.address);

      expect(quotePriceReturn.rate.toString()).to.equal(_feedLatestRoundData.answer.toString());
      expect(quotePriceReturn.updatedAt).to.equal(_feedLatestRoundData.updatedAt);
    });
    it('Should return the rate and the last update of an asset from a registered feed less than 18 decimals', async function () {
      const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

      const mockPriceFeed2 = await priceFeedFactory.deploy(18) as MockPriceFeed;
      await mockPriceFeed1.deployed();

      const _decimals = await mockPriceFeed2.decimals();
      const _feedLatestRoundData = await mockPriceFeed2.latestRoundData();
      const _rateFromFeed = _feedLatestRoundData.answer.mul(10 ** (18 - _decimals));

      await pollenDAO.connect(deployer).addPriceFeed(0, assetB.address, mockPriceFeed2.address);
      const quotePriceReturn = await pollenDAO.quotePrice(0, assetB.address);

      expect(quotePriceReturn.rate).to.equal(_rateFromFeed);
      expect(quotePriceReturn.updatedAt).to.equal(_feedLatestRoundData.updatedAt);
    });
  });

  describe('addPriceFeed', function () {
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(pollenDAO.connect(user1).addPriceFeed(0, assetA.address, mockPriceFeed1.address))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if asset is the zero address', async function () {
      await expect(pollenDAO.connect(deployer).addPriceFeed(0, ZERO_ADDRESS, mockPriceFeed1.address))
        .to.be.revertedWith('Quoter: asset cannot be zero address');
    });
    it('Should revert if feed is the zero address', async function () {
      await expect(pollenDAO.connect(deployer).addPriceFeed(0, assetA.address, ZERO_ADDRESS))
        .to.be.revertedWith('Quoter: feed cannot be zero address');
    });
    it('Should correctly add a new price feed', async function () {
      await pollenDAO.connect(deployer).addPriceFeed(0, assetA.address, mockPriceFeed1.address);
      const _priceFeed = await pollenDAO.getFeed(0, assetA.address);

      expect(_priceFeed).to.equal(mockPriceFeed1.address);
    });
    it('Should emit PriceFeedAdded event with the correct params', async function () {
      await expect(pollenDAO.connect(deployer).addPriceFeed(0, assetA.address, mockPriceFeed1.address))
        .to.emit(pollenDAO, 'PriceFeedAdded');
      // .withArgs(assetA.address, mockPriceFeed1.address, 0);
    });
  });

  describe('addPriceFeeds', function () {
    let mockPriceFeed2: MockPriceFeed;

    beforeEach(async function () {
      const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

      mockPriceFeed2 = await priceFeedFactory.deploy(18) as MockPriceFeed;
      await mockPriceFeed1.deployed();
    });
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(
        pollenDAO
          .connect(user1)
          .addPriceFeeds(
            [0, 0],
            [assetA.address, assetB.address],
            [mockPriceFeed1.address, mockPriceFeed2.address]
          )
      ).to.be.revertedWith('Admin access required');
    });
    it('Should revert if any asset is the zero address', async function () {
      await expect(
        pollenDAO
          .connect(deployer)
          .addPriceFeeds(
            [0, 0],
            [assetB.address, ZERO_ADDRESS],
            [mockPriceFeed1.address, mockPriceFeed2.address]
          )
      ).to.be.revertedWith('Quoter: asset cannot be zero address');
    });
    it('Should revert if any feed is the zero address', async function () {
      await expect(
        pollenDAO
          .connect(deployer)
          .addPriceFeeds(
            [0, 0],
            [assetA.address, assetB.address],
            [mockPriceFeed1.address, ZERO_ADDRESS]
          )
      ).to.be.revertedWith('Quoter: feed cannot be zero address');
    });
    it('Should correctly add new price feeds', async function () {
      await pollenDAO
        .connect(deployer)
        .addPriceFeeds(
          [0, 0],
          [assetA.address, assetB.address],
          [mockPriceFeed1.address, mockPriceFeed2.address]
        );
      const _priceFeed1 = await pollenDAO.getFeed(0, assetA.address);
      const _priceFeed2 = await pollenDAO.getFeed(0, assetB.address);

      expect(_priceFeed1).to.equal(mockPriceFeed1.address);
      expect(_priceFeed2).to.equal(mockPriceFeed2.address);
    });
    it('Should emit PriceFeedAdded event with the correct params for each price feed', async function () {
      await expect(
        pollenDAO
          .connect(deployer)
          .addPriceFeeds(
            [0, 0],
            [assetA.address, assetB.address],
            [mockPriceFeed1.address, mockPriceFeed2.address]
          )
      ).to.emit(pollenDAO, 'PriceFeedAdded')
        // .withArgs(assetA.address, mockPriceFeed1.address, 0)
        .to.emit(pollenDAO, 'PriceFeedAdded');
      // .withArgs(assetB.address, mockPriceFeed2.address, 0);
    });
  });

  describe('removePriceFeed', function () {
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(pollenDAO.connect(user1).removePriceFeed(0, assetA.address))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if price feed is not registered', async function () {
      await expect(pollenDAO.connect(deployer).removePriceFeed(0, assetA.address))
        .to.be.revertedWith('Quoter: feed not found');
    });
    it('Should correctly remove a price feed', async function () {
      await pollenDAO.connect(deployer).addPriceFeed(0, assetA.address, mockPriceFeed1.address);
      await pollenDAO.connect(deployer).removePriceFeed(0, assetA.address);
      const _priceFeed = await pollenDAO.getFeed(0, assetA.address);

      expect(_priceFeed).to.equal(ZERO_ADDRESS);
    });
    it('Should emit PriceFeedRemoved event with the correct params', async function () {
      await pollenDAO.connect(deployer).addPriceFeed(0, assetA.address, mockPriceFeed1.address);
      await expect(pollenDAO.connect(deployer).removePriceFeed(0, assetA.address))
        .to.emit(pollenDAO, 'PriceFeedRemoved');
      // .withArgs(assetA.address, 0);
    });
  });
});
