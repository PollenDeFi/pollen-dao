import chai from 'chai';
// chai.use(require('chai-bignumber')());
import { BigNumber as BN } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { PollenToken, IPollenDAO, LockedPollen, ERC20, MockPriceFeed, PollenDAO, Portfolio } from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import {
  INITIAL_BALANCES,
  VEPLN_TOKEN_NAME,
  VEPLN_TOKEN_SYMBOL,
  MAX_LOCK_PERIOD,
  MIN_LOCK_PERIOD,
  DAYS_TO_SECONDS,
  BASE_18,
  ISSUANCE_SCHEDULE,
  ONE_YEAR
} from './helpers/constants';
import { getCurrentTimestamp } from './helpers/helpers';
import { getExpectedPortfolioReturnBN, getBenchmarkReturn, getVotingPower } from './helpers/calculations';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

// extra
const pollenAmount = INITIAL_BALANCES;
const INITIAL_PRICES = BASE_18.mul(10);
const TOTAL_REWARD_PER_SECOND = BASE_18.mul(20000000).div(1406 * 86400);

describe('LockedPollenToken', async function () {
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
    deployer,
    user1,
    user2,
    user3,
    noLockUser
  ] = provider.getWallets();

  const benchmarkWeights = [100, 0, 0, 0];

  beforeEach(async () => {
    const PollenToken = await ethers.getContractFactory('PollenToken');
    pollenToken = await PollenToken.deploy(deployer.address) as PollenToken;
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
    await pollenDAO.connect(deployer).addPriceFeeds(
      [0, 0, 0],
      [assetA.address, assetB.address, assetC.address],
      [mockPriceFeed1.address, mockPriceFeed2.address, mockPriceFeed3.address]
    );

    await pollenDAO.connect(deployer).addAsset(assetUSD.address);
    await pollenDAO.connect(deployer).addAsset(assetA.address);
    await pollenDAO.connect(deployer).addAsset(assetB.address);
    await pollenDAO.connect(deployer).addAsset(assetC.address);

    // Set max number of possible assets in the portfolio
    await pollenDAO.setMaxNumberOfAssetsPerPortfolio(4);
    await pollenDAO.setLimitPortfolioBalance(0, BASE_18.mul(10 ** 6));

    // MINTER
    await pollenDAO.initializeIssuanceInfo(ISSUANCE_SCHEDULE);
    await pollenToken.connect(deployer).transfer(user1.address, pollenAmount.mul(1000));
    await pollenToken.connect(deployer).transfer(user2.address, pollenAmount.mul(2000));
    await pollenToken.connect(deployer).transfer(user3.address, pollenAmount.mul(4000));
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
    await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
    await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
  });

  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('Constructor', function () {
    it('Should return the correct token name', async function () {
      expect(await vePLN.name()).to.eq(VEPLN_TOKEN_NAME);
    });
    it('Should return the correct token symbol', async function () {
      expect(await vePLN.symbol()).to.eq(VEPLN_TOKEN_SYMBOL);
    });
    it('Should fail to transfer', async () => {
      await expect(vePLN.connect(deployer).transfer(user1.address, INITIAL_BALANCES))
        .to.be.revertedWith('vePLN can\'t be transfered');
    });
  });

  describe('lock', function () {
    const account = user2.address;

    beforeEach(async () => {
      const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await vePLN.connect(user1).lock(pollenAmount, lastTimestamp + ONE_YEAR);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      // await vePLN.connect(deployer).lock(pollenAmount, lastTimestamp + ONE_YEAR);
    });
    //  REVERT CHECKS
    it('Should revert if lock period is too short', async function () {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + (MIN_LOCK_PERIOD - (1 * DAYS_TO_SECONDS));
      await expect(vePLN.connect(user2).lock(pollenAmount, lockEnd))
        .to.be.revertedWith('Period is too short');
    });
    it('Should revert if lock period is too long', async function () {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD + (1 * DAYS_TO_SECONDS));
      await expect(vePLN.connect(user2).lock(pollenAmount, lockEnd))
        .to.be.revertedWith('Period is too large');
    });
    //  FUNCTIONALITY
    it('Should succeed, decrease the locker\'s PLN balance, and increase the receivers vePLN balance', async function () {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + Math.floor(MAX_LOCK_PERIOD / 4); // end in 1 year

      // approve PLN tokens for locking
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);

      // ensure deployer locked PLN tokens
      await expect(() => vePLN.connect(deployer).lock(pollenAmount, lockEnd))
        .to.changeTokenBalance(pollenToken, deployer, pollenAmount.mul(-1));

      // ensure user2 vePLN balance increased
      const user2VePLNBalance = await vePLN.balanceOf(deployer.address);
      expect(user2VePLNBalance).to.be.eq(pollenAmount);

      // ensure lock is correct
      const lock = await vePLN.locks(deployer.address);
      expect(lock.lockEnd).to.be.eq(lockEnd, 'lockEnd is not correct');
      expect(lock.amount).to.be.eq(pollenAmount, 'Locked amount is not correct');

      // check voting Power
      const votingPower = await vePLN.getVotingPower(deployer.address);
      const ts = (await ethers.provider.getBlock('latest')).timestamp;
      const expectedVotingPower = getVotingPower(BN.from(ts), BN.from(lockEnd), pollenAmount);
      expect(votingPower).to.be.eq(expectedVotingPower, 'Voting Power is not correct');
    });

    //  EVENTS
    it('Should emit LockCreated event', async () => {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 4); // end in 1 year

      // approve PLN tokens for locking
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);

      await expect(vePLN.connect(deployer).lock(pollenAmount, lockEnd))
        .to.emit(vePLN, 'LockCreated');
    });
  });

  describe('increaseLock', async function () {
    beforeEach(async () => {
      const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await vePLN.connect(user1).lock(pollenAmount, lastTimestamp + ONE_YEAR);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      await vePLN.connect(deployer).lock(pollenAmount, lastTimestamp + ONE_YEAR);
    });
    //  REVERT CHECKS
    it('Should revert with 0 amount', async () => {
      await pollenToken.connect(deployer).approve(vePLN.address, 0);
      await expect(vePLN.connect(deployer).increaseLock(0))
        .to.be.revertedWith('Cannot increase lock by zero');
    });
    it('Should revert with no locked tokens', async () => {
      await pollenToken.connect(noLockUser).approve(vePLN.address, pollenAmount);
      await expect(vePLN.connect(noLockUser).increaseLock(pollenAmount))
        .to.be.revertedWith('Invalid lock');
    });
    it('Should revert if lock expired', async () => {
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await ethers.provider.send('evm_increaseTime', [timeStamp + MAX_LOCK_PERIOD]);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      await expect(vePLN.connect(deployer).increaseLock(pollenAmount))
        .to.be.revertedWith('lock expired');
    });
    //  FUNCTIONALITY
    it('Should succeed, increase account\'s vePLN balance, and decrease PLN balance', async () => {
      const plnBalance1 = await pollenToken.balanceOf(deployer.address);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      await expect(() => vePLN.connect(deployer)
        .increaseLock(pollenAmount), 'Receivers vePLN balance did not increase')
        .to.changeTokenBalance(vePLN, deployer, pollenAmount);
      const plnBalance2 = await pollenToken.balanceOf(deployer.address);
      expect(plnBalance1.sub(plnBalance2)).to.be.eq(pollenAmount, 'Locker\'s PLN balance did not decrease');

      // ensure lock is correct
      const lock = await vePLN.locks(deployer.address);
      expect(lock.amount).to.be.eq(pollenAmount.add(INITIAL_BALANCES), 'Locked amount is not correct');

      // check voting Power
      const VP = await vePLN.getVotingPower(deployer.address);
      const ts = (await ethers.provider.getBlock('latest')).timestamp;
      const expectedVotingPower = getVotingPower(BN.from(ts), lock.lockEnd, pollenAmount.add(INITIAL_BALANCES));
      expect(VP).to.be.eq(expectedVotingPower, 'Voting Power is not correct');
    });
    //  EVENTS
    it('Should emit LockIncreases event', async () => {
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await expect(vePLN.connect(user1).increaseLock(pollenAmount))
        .to.emit(vePLN, 'LockIncreased');
    });
  });

  describe('extendLock', function () {
    beforeEach(async () => {
      const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await vePLN.connect(user1).lock(pollenAmount, lastTimestamp + ONE_YEAR);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      await vePLN.connect(deployer).lock(pollenAmount, lastTimestamp + ONE_YEAR);
    });
    //  REVERT CHECKS
    it('Should revert if locked amount is 0', async function () {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + MAX_LOCK_PERIOD;
      await expect(vePLN.connect(noLockUser).extendLock(lockEnd))
        .to.be.revertedWith('Invalid lock');
    });
    it('Should not be able to decrease lock', async function () {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = 1;
      await expect(vePLN.connect(deployer).extendLock(lockEnd))
        .to.be.revertedWith('Invalid period');
    });
    //  FUNCTIONALITY
    it('Should succeed and increase voting power', async () => {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 2);
      const votingPowerBefore1 = await vePLN.getVotingPower(deployer.address);
      await vePLN.connect(deployer).extendLock(lockEnd);
      const votingPowerAfter1 = await vePLN.getVotingPower(deployer.address);
      expect(votingPowerAfter1.sub(votingPowerBefore1)).to.be.gt(BN.from(0), 'Voting Power did not increase');

      // ensure lock is correct
      const lock = await vePLN.locks(deployer.address);
      expect(lock.lockEnd).to.be.eq(lockEnd, 'lockEnd is not correct');

      // check voting Power
      const votingPower = await vePLN.getVotingPower(deployer.address);
      const ts = (await ethers.provider.getBlock('latest')).timestamp;
      const expectedVotingPower = getVotingPower(BN.from(ts), BN.from(lockEnd), pollenAmount);
      expect(votingPower).to.be.eq(expectedVotingPower, 'Voting Power is not correct');

    });
    //  EVENTS
    it('Should emit LockExtended event', async () => {
      const currentTimestampInSeconds = (await provider.getBlock('latest')).timestamp;
      const lockEnd = currentTimestampInSeconds + (MAX_LOCK_PERIOD / 2);
      const tx = await vePLN.connect(deployer).extendLock(lockEnd);
      await expect(tx)
        .to.emit(vePLN, 'LockExtended');
    });
  });

  describe('unlock', async function () {
    beforeEach(async () => {
      const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await vePLN.connect(user1).lock(pollenAmount, lastTimestamp + ONE_YEAR);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      await vePLN.connect(deployer).lock(pollenAmount, lastTimestamp + ONE_YEAR);
    });
    const burnAmount = 100;
    it('Should revert if locked amount is 0', async function () {
      await expect(vePLN.connect(noLockUser).unlock())
        .to.be.revertedWith('Invalid lock');
    });
    it('Should revert if locked is active', async function () {
      await expect(vePLN.connect(deployer).unlock())
        .to.be.revertedWith('Lock is active');
    });
    it('Should succeed, burn vePLN balance, and increase PLN balance', async () => {
      const veBalance1 = await vePLN.balanceOf(deployer.address);
      const plnBalance1 = await pollenToken.balanceOf(deployer.address);
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await ethers.provider.send('evm_increaseTime', [timeStamp + MAX_LOCK_PERIOD]);

      const receipt = await (await vePLN.connect(deployer).unlock()).wait();
      const event = receipt!.events!.find((e: any) => e.event === 'UnLocked');
      const claimable = event!.args!.claimable;
      const veBalance2 = await vePLN.balanceOf(deployer.address);
      const plnBalance2 = await pollenToken.balanceOf(deployer.address);
      expect(plnBalance2.sub(plnBalance1).sub(claimable)).to.be.eq(veBalance1, 'Unlocker did not get PLN amount equivalent to total locked vePLN');
      expect(veBalance2).to.be.eq(BN.from(0));

      const VP = await vePLN.getVotingPower(deployer.address);
      expect(VP).to.be.eq(BN.from(0));
    });
    //  EVENTS
    it('Should emit UnLocked event', async () => {
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await ethers.provider.send('evm_increaseTime', [timeStamp + MAX_LOCK_PERIOD]);
      await expect(vePLN.connect(deployer).unlock())
        .to.emit(vePLN, 'UnLocked');
    });
  });

  // TODO
  describe('burn', async () => {
    beforeEach(async () => {
      const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await vePLN.connect(user1).lock(pollenAmount, lastTimestamp + ONE_YEAR);
      await pollenToken.connect(deployer).approve(vePLN.address, pollenAmount);
      await vePLN.connect(deployer).lock(pollenAmount, lastTimestamp + ONE_YEAR);
    });
    it('Should succeed, increase the DAO\'s PLN balance, and decrease the target\'s vePLN balance', async () => {
      await expect(vePLN.connect(deployer).burn(deployer.address, 100))
        .to.be.revertedWith('Pollen: only callable by DAO contract');
    });
  });

  describe('staking', async function () {
    let startTime: number;
    beforeEach(async () => {
      await pollenToken.connect(user1).approve(vePLN.address, pollenAmount);
      await pollenToken.connect(user2).approve(vePLN.address, BN.from('2').mul(pollenAmount));
      await pollenToken.connect(user3).approve(vePLN.address, BN.from('4').mul(pollenAmount));

    });
    it('Should return 100% of total rewards if locked alone', async function () {
      const ts = (await ethers.provider.getBlock('latest')).timestamp;
      await vePLN.connect(user1).lock(pollenAmount, ts + ONE_YEAR);

      const t0 = (await ethers.provider.getBlock('latest')).timestamp;

      const timeDiff = 5 * 86400; // 5 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0 + timeDiff]);
      await ethers.provider.send('evm_mine', []);

      const totalLocked = await vePLN.connect(user1).totalLocked();
      expect(totalLocked).to.be.eq(pollenAmount);

      const c = await vePLN.rewardCurve();
      const balanceBefore = await pollenToken.balanceOf(user1.address);
      await vePLN.connect(user1).claimRewards();
      const t1 = (await ethers.provider.getBlock('latest')).timestamp;
      const balanceAfter = await pollenToken.balanceOf(user1.address);

      expect(balanceAfter.sub(balanceBefore)).to.be.equal(c.rate.mul(BN.from(t1 - t0)));

    });

    it('Should return corresponding rewards for several users lock only', async function () {
      const secondsPerDay = 24 * 60 * 60;
      const user1_end = BN.from(100 * secondsPerDay);
      const user2_end = BN.from(130 * secondsPerDay);
      const user3_end = BN.from(150 * secondsPerDay);
      const user1_amt = pollenAmount;
      const user2_amt = BN.from('1').mul(pollenAmount);
      const user3_amt = BN.from('1').mul(pollenAmount);

      const ts = BN.from((await ethers.provider.getBlock('latest')).timestamp);

      await vePLN.connect(user1).lock(user1_amt, ts.add(user1_end));
      const t0_1 = (await ethers.provider.getBlock('latest')).timestamp;

      await vePLN.connect(user2).lock(user2_amt, ts.add(user2_end));
      const t0_2 = (await ethers.provider.getBlock('latest')).timestamp;

      await vePLN.connect(user3).lock(user3_amt, ts.add(user3_end));
      const t0_3 = (await ethers.provider.getBlock('latest')).timestamp;

      let timeDiff;
      timeDiff = 100 * 86400; // 100 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);

      let balanceBefore;
      let balanceAfter;
      const totalLocked = await vePLN.totalLocked();
      const c = await vePLN.rewardCurve();

      balanceBefore = await pollenToken.balanceOf(user1.address);
      await vePLN.connect(user1).claimRewards();
      const t1_1 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user1.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_1 - t0_1)).mul(user1_amt).div(totalLocked));

      timeDiff = 130 * 86400; // 130 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);
      balanceBefore = await pollenToken.balanceOf(user2.address);
      await vePLN.connect(user2).claimRewards();
      const t1_2 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user2.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_2 - t0_2)).mul(user2_amt).div(totalLocked));

      timeDiff = 160 * 86400; // 160 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);
      balanceBefore = await pollenToken.balanceOf(user3.address);
      await vePLN.connect(user3).claimRewards();
      const t1_3 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user3.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_3 - t0_3)).mul(user3_amt).div(totalLocked));

    });

    it('Should return corresponding rewards for several users unlock and then increase lock', async function () {
      const secondsPerDay = 24 * 60 * 60;
      const user1_end = BN.from(100 * secondsPerDay);
      const user2_end = BN.from(130 * secondsPerDay);
      const user3_end = BN.from(190 * secondsPerDay);
      const user1_amt = pollenAmount;
      const user2_amt = BN.from('1').mul(pollenAmount);
      const user3_amt = BN.from('1').mul(pollenAmount);

      const ts = BN.from((await ethers.provider.getBlock('latest')).timestamp);

      await vePLN.connect(user1).lock(user1_amt, ts.add(user1_end));
      const t0_1 = (await ethers.provider.getBlock('latest')).timestamp;

      await vePLN.connect(user2).lock(user2_amt, ts.add(user2_end));
      const t0_2 = (await ethers.provider.getBlock('latest')).timestamp;

      await vePLN.connect(user3).lock(user3_amt, ts.add(user3_end));

      let timeDiff;
      timeDiff = 100 * 86400; // 100 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);

      let balanceBefore;
      let balanceAfter;
      const totalLocked = await vePLN.totalLocked();
      const c = await vePLN.rewardCurve();

      balanceBefore = await pollenToken.balanceOf(user1.address);
      await vePLN.connect(user1).claimRewards();
      const t1_1 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user1.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_1 - t0_1)).mul(user1_amt).div(totalLocked));

      timeDiff = 130 * 86400; // 130 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);
      balanceBefore = await pollenToken.balanceOf(user2.address);
      await vePLN.connect(user2).claimRewards();
      const t1_2 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user2.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_2 - t0_2)).mul(user2_amt).div(totalLocked));

      timeDiff = 160 * 86400; // 160 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);

      const user2ClaimableBefore = await vePLN.getAvailableRewards(user2.address);

      // after some user unlock first
      await (await vePLN.connect(user1).unlock()).wait();
      const totalLockedAfterUnlock = await vePLN.totalLocked();
      expect(totalLocked.sub(totalLockedAfterUnlock)).to.be.eq(user1_amt);

      const user2ClaimableAfterUnlock = await vePLN.getAvailableRewards(user2.address);
      expect(user2ClaimableAfterUnlock).to.be.gte(user2ClaimableBefore);

      // after some other user increase lock
      await (await vePLN.connect(user3).increaseLock(user1_amt.mul(2))).wait();

      const totalLockedAfterIncrease = await vePLN.totalLocked();
      expect(totalLockedAfterIncrease.sub(totalLockedAfterUnlock)).to.be.eq(user1_amt.mul(2));
      const user2ClaimableAfterIncrease = await vePLN.getAvailableRewards(user2.address);
      expect(user2ClaimableAfterIncrease).to.be.gte(user2ClaimableAfterUnlock);
    });

    it('Should return corresponding rewards for several users increase lock and then unlock', async function () {
      const secondsPerDay = 24 * 60 * 60;
      const user1_end = BN.from(100 * secondsPerDay);
      const user2_end = BN.from(130 * secondsPerDay);
      const user3_end = BN.from(190 * secondsPerDay);
      const user1_amt = pollenAmount;
      const user2_amt = BN.from('1').mul(pollenAmount);
      const user3_amt = BN.from('1').mul(pollenAmount);

      const ts = BN.from((await ethers.provider.getBlock('latest')).timestamp);

      await vePLN.connect(user1).lock(user1_amt, ts.add(user1_end));
      const t0_1 = (await ethers.provider.getBlock('latest')).timestamp;

      await vePLN.connect(user2).lock(user2_amt, ts.add(user2_end));
      const t0_2 = (await ethers.provider.getBlock('latest')).timestamp;

      await vePLN.connect(user3).lock(user3_amt, ts.add(user3_end));

      let timeDiff;
      timeDiff = 100 * 86400; // 100 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);

      let balanceBefore;
      let balanceAfter;
      const totalLocked = await vePLN.totalLocked();
      const c = await vePLN.rewardCurve();

      balanceBefore = await pollenToken.balanceOf(user1.address);
      await vePLN.connect(user1).claimRewards();
      const t1_1 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user1.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_1 - t0_1)).mul(user1_amt).div(totalLocked));

      timeDiff = 130 * 86400; // 130 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);
      balanceBefore = await pollenToken.balanceOf(user2.address);
      await vePLN.connect(user2).claimRewards();
      const t1_2 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user2.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t1_2 - t0_2)).mul(user2_amt).div(totalLocked));

      timeDiff = 160 * 86400; // 160 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);

      const user2ClaimableBefore = await vePLN.getAvailableRewards(user2.address);

      // after some user increase lock first
      await (await vePLN.connect(user3).increaseLock(user1_amt.mul(2))).wait();

      const totalLockedAfterIncrease = await vePLN.totalLocked();
      expect(totalLockedAfterIncrease.sub(totalLocked)).to.be.eq(user1_amt.mul(2));
      const user2ClaimableAfterIncrease = await vePLN.getAvailableRewards(user2.address);
      expect(user2ClaimableAfterIncrease).to.be.gte(user2ClaimableBefore);

      // after some user unlock
      await (await vePLN.connect(user1).unlock()).wait();
      const totalLockedAfterUnlock = await vePLN.totalLocked();
      expect(totalLockedAfterIncrease.sub(totalLockedAfterUnlock)).to.be.eq(user1_amt);

      const user2ClaimableAfterUnlock = await vePLN.getAvailableRewards(user2.address);
      expect(user2ClaimableAfterUnlock).to.be.gte(user2ClaimableAfterIncrease);

      // claim rewards
      await vePLN.connect(user2).claimRewards();
      const t2_2 = (await ethers.provider.getBlock('latest')).timestamp;

      // check claimable after few days
      timeDiff = 190 * 86400; // 190 days after
      await ethers.provider.send('evm_setNextBlockTimestamp', [t0_1 + timeDiff]);
      await ethers.provider.send('evm_mine', []);
      balanceBefore = await pollenToken.balanceOf(user2.address);
      await vePLN.connect(user2).claimRewards();
      const t3_2 = (await ethers.provider.getBlock('latest')).timestamp;
      balanceAfter = await pollenToken.balanceOf(user2.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.gte(c.rate.mul(BN.from(t3_2 - t2_2)).mul(user2_amt).div(totalLockedAfterIncrease));
    });
  });
});
