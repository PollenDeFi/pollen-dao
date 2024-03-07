import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { BigNumber as BN } from 'ethers';

import {
  ERC20,
  IPollenDAO,
  PollenToken,
  LockedPollen,
  MockMinterGetters,
  MockPriceFeed
} from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { deployContracts } from './helpers/setup';
import { ExpectedReturn, getSelectors } from './helpers/functions';
import { calcExpectedPortfolioWithdraw, calcValue, getBenchmarkReturn, getExpectedPortfolioReturnBN, calcWeightedAverage } from './helpers/calculations';
import { BytesLike, BigNumber } from 'ethers';
import { ISSUANCE_SCHEDULE, BASE_18, ONE_YEAR, MAX_LOCK_PERIOD, } from './helpers/constants';
import { getCurrentTimestamp, interpolate } from './helpers/helpers';
import { INITIAL_PRICES } from './integration/classes';
import { poll } from 'ethers/lib/utils';
import { IssuanceSchedule } from './integration/classes/manager/manager';
import { exit } from 'process';

const dummyPrices = [BASE_18, BASE_18, BASE_18, BASE_18];

const { solidity } = waffle;
chai.use(solidity);

const provider = waffle.provider;

describe('Minter', async function () {
  let pollenDAO: IPollenDAO;
  let pollenToken: PollenToken;
  let vePLN: LockedPollen;
  let mockGetters: MockMinterGetters;
  let mockSelectors: BytesLike[];
  let snapshot: string;
  let assetUSD: ERC20;
  let assetA: ERC20;
  let assetB: ERC20;
  let assetC: ERC20;
  let mockPriceFeed1: MockPriceFeed;
  let mockPriceFeed2: MockPriceFeed;
  let mockPriceFeed3: MockPriceFeed;
  let priceFeeds: MockPriceFeed[];
  let lockEnd: BN;
  let lockAmounts: BN;
  let issuanceSchedule: IssuanceSchedule[];

  const rate = ISSUANCE_SCHEDULE[0].rate;
  const timestamp = ONE_YEAR;
  const date = new Date();
  const current = getCurrentTimestamp();
  const useVePLN = true;
  const usePLN = false;
  const INITIAL_PRICE = BASE_18.mul(10);
  const initialPrices = [BASE_18, INITIAL_PRICE, INITIAL_PRICE, INITIAL_PRICE];
  const initialWeights = [BN.from(0), BN.from(20), BN.from(30), BN.from(50)];
  const benchmarkWeights = [25, 25, 25, 25];
  const isShort = Array(initialWeights.length).fill(false);

  const schedule = ISSUANCE_SCHEDULE;

  const calculatePLNReturn = (expectedReturn: BigNumber, amountPLN: BigNumber, isOwner: boolean) => {
    if (isOwner) return expectedReturn.mul(amountPLN).div(BASE_18).add(amountPLN);
    return expectedReturn.mul(amountPLN).div(BASE_18).mul(80).div(100).add(amountPLN);
  };

  const calculatePLNPenalty = (expectedReturn: BigNumber, amountPLN: BigNumber) => {
    return amountPLN.sub(expectedReturn.mul(amountPLN).div(BASE_18));
  };

  const [
    admin,
    user1,
    portfolioOwner1,
    portfolioOwner2,
    delegator
  ] = provider.getWallets();

  before(async () => {
    const contracts = await deployContracts(admin.address);
    pollenDAO = contracts.pollenDAO;
    pollenToken = contracts.pollenToken;
    vePLN = contracts.vePLN;

    const MockGetters = await ethers.getContractFactory('MockMinterGetters');
    mockGetters = await MockGetters.deploy() as MockMinterGetters;
    await mockGetters.deployed();

    mockSelectors = getSelectors(MockGetters.interface);
    await pollenDAO.addModule(mockGetters.address, mockSelectors);

    // Set max number of possible assets in the portfolio
    await pollenDAO.setMaxNumberOfAssetsPerPortfolio(4);

    // Set max number of withdrawls per transaction
    await pollenDAO.setMaxNumberWithdrawls(5);

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

    await pollenDAO.connect(admin).addAsset(assetUSD.address);
    await pollenDAO.connect(admin).addAsset(assetA.address);
    await pollenDAO.connect(admin).addAsset(assetB.address);
    await pollenDAO.connect(admin).addAsset(assetC.address);

    const priceFeedFactory = await ethers.getContractFactory('MockPriceFeed');

    mockPriceFeed1 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed1.deployed();
    await mockPriceFeed1.incrementRoundAndSetAnswer(INITIAL_PRICE);

    mockPriceFeed2 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed2.deployed();
    await mockPriceFeed2.incrementRoundAndSetAnswer(INITIAL_PRICE);

    mockPriceFeed3 = await priceFeedFactory.deploy(18) as MockPriceFeed;
    await mockPriceFeed3.deployed();
    await mockPriceFeed3.incrementRoundAndSetAnswer(INITIAL_PRICE);
    priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];

    await pollenDAO.connect(admin).addPriceFeeds(
      [0, 0, 0],
      [assetA.address, assetB.address, assetC.address],
      [mockPriceFeed1.address, mockPriceFeed2.address, mockPriceFeed3.address],
    );

    // Mint tokens
    const amount = BASE_18.mul(10000);
    await pollenToken.connect(admin).transfer(portfolioOwner1.address, amount);
    await pollenToken.connect(admin).transfer(portfolioOwner2.address, amount);
    await pollenToken.connect(admin).transfer(delegator.address, amount);

    await pollenToken.connect(portfolioOwner1).approve(pollenDAO.address, amount);
    await pollenToken.connect(portfolioOwner2).approve(pollenDAO.address, amount);
    await pollenToken.connect(delegator).approve(pollenDAO.address, amount);

    // Get vePLN
    lockEnd = current.add(MAX_LOCK_PERIOD);
    lockAmounts = amount.div(5);
    issuanceSchedule = ISSUANCE_SCHEDULE;
    await pollenToken.connect(portfolioOwner1).approve(vePLN.address, amount);
    await vePLN.connect(portfolioOwner1)
      .lock(lockAmounts, lockEnd);
    await pollenToken.connect(portfolioOwner2).approve(vePLN.address, amount);
    await vePLN.connect(portfolioOwner2)
      .lock(lockAmounts, lockEnd);
    await pollenToken.connect(delegator).approve(vePLN.address, amount);
    await vePLN.connect(delegator)
      .lock(lockAmounts, lockEnd);
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });
  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('initializeIssuanceInfo', async () => {
    it('Should revert if not called by an admin', async () => {
      await expect(pollenDAO.connect(user1).initializeIssuanceInfo(issuanceSchedule))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert it already initialized', async () => {
      await pollenDAO.connect(admin).initializeIssuanceInfo(schedule);
      await expect(pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule))
        .to.be.revertedWith('Already initialized');
    });
    it('Should correctly set the rate', async () => {
      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      const rateFromGetter = await pollenDAO.connect(admin).getRate();
      expect(rateFromGetter).to.equal(rate);
    });
    it('Should emit IssuanceRateChanged event', async () => {
      await expect(pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule))
        .to.emit(pollenDAO, 'IssuanceScheduleSet');
    });
  });

  describe('closeAndWithdraw', async () => {
    const amount = BASE_18.mul(100);
    const invalidWithdrawnAmountOwner = amount.mul(2);

    beforeEach(async () => {

      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);
      await pollenDAO.connect(portfolioOwner1).createPortfolio(amount, initialWeights, Array(initialWeights.length).fill(false), usePLN);
    });

    it('Should revert if owner withdraws amount greater than deposited', async () => {
      await expect(pollenDAO.connect(portfolioOwner1)
        .closeAndWithdraw(invalidWithdrawnAmountOwner, usePLN))
        .to.be.revertedWith('Insufficient balance');
    });
    it('Should revert if portfolio is closed', async () => {
      await pollenDAO.connect(portfolioOwner1)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);
      await pollenDAO.connect(portfolioOwner1)
        .withdraw(portfolioOwner1.address, amount, usePLN);

      await expect(pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN))
        .to.be.revertedWith('Portfolio must be open');
    });
    it('Should correctly close portfolio', async () => {
      await pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN);

      const portfolio = await pollenDAO.getPortfolio(
        portfolioOwner1.address,
        portfolioOwner1.address
      );

      expect(portfolio.isOpen).to.be.false;
    });
    it('Should update balances for a reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      // increase time to allow for full reward rate
      provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
      provider.send('evm_mine', []);
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      priceFeeds.forEach((feed, index) => {
        feed.setUpdatedAt(ts);
      });

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );
      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const ownerReturn = calculatePLNReturn(change.return, amount, true);
      await expect(() => pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN))
        .to.changeTokenBalance(pollenToken, portfolioOwner1, ownerReturn);
    });
    it('Should update balances for a penalty', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.div(2), INITIAL_PRICE.div(3), INITIAL_PRICE.div(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices,  // prices at delegation/creation
        newPrices,      // current prices
        benchmarkReturn
      );

      const penalty = calculatePLNPenalty(change.return, amount);

      await expect(() => pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN))
        .to.changeTokenBalance(pollenToken, portfolioOwner1, amount.sub(penalty));
    });
    it('Should emit WithdrawWithReward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await expect(pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithReward');
    });
    it('Should emit WithdrawWithPenalty', async () => {
      await mockPriceFeed1.incrementRoundAndSetAnswer(1);
      await mockPriceFeed2.incrementRoundAndSetAnswer(1);
      await mockPriceFeed3.incrementRoundAndSetAnswer(1);

      await expect(pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithPenalty');
    });
    it('Should emit PortfolioClosed when owner closes the portfolio on withdrawal', async () => {
      await expect(pollenDAO.connect(portfolioOwner1).closeAndWithdraw(amount, usePLN))
        .to.emit(pollenDAO, 'PortfolioClosed');
    });
  });

  describe('withdraw', async () => {
    const amount = BASE_18.mul(1000);
    const amountDelegated = BASE_18.mul(100);
    const invalidWithdrawnAmountOwner = amount.mul(2);
    const invalidWithdrawnAmountDelegator = amountDelegated.mul(2);
    let lockEnd: BN;

    beforeEach(async () => {
      const currentTimestamp = getCurrentTimestamp();
      lockEnd = currentTimestamp.add(MAX_LOCK_PERIOD);
      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, amount.mul(100));
      await vePLN.connect(delegator).approve(pollenDAO.address, amount);
      await vePLN.connect(portfolioOwner2).approve(pollenDAO.address, amount);

      await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);
      await pollenDAO.connect(portfolioOwner1)
        .createPortfolio(amount, initialWeights, isShort, usePLN);
      await pollenDAO.connect(portfolioOwner2)
        .createPortfolio(amount, initialWeights, isShort, useVePLN);

      await pollenDAO.connect(delegator)
        .delegatePollen(portfolioOwner1.address, amountDelegated, usePLN);
      await pollenDAO.connect(delegator)
        .delegatePollen(portfolioOwner2.address, amountDelegated, usePLN);

      // TODO: add in when vePLN reward calculation function is complete
      // await pollenDAO.connect(delegator)
      //   .delegatePollen(portfolioOwner1.address, amountDelegated, useVePLN);
      await pollenDAO.connect(delegator)
        .delegatePollen(portfolioOwner2.address, amountDelegated, useVePLN);
    });

    it('Should revert if owner withdraws more PLN than deposited', async () => {
      await pollenDAO.connect(portfolioOwner1)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);

      await expect(pollenDAO.connect(portfolioOwner1)
        .withdraw(portfolioOwner1.address, invalidWithdrawnAmountOwner, usePLN))
        .to.be.revertedWith('Insufficient balance');
    });
    it('Should revert if the owner withdraws more vePLN than deposited', async () => {
      await pollenDAO.connect(portfolioOwner2)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, true);

      await expect(pollenDAO.connect(portfolioOwner2)
        .withdraw(portfolioOwner2.address, invalidWithdrawnAmountOwner, useVePLN))
        .to.be.revertedWith('Insufficient balance');
    });
    it('Should revert if delegator withdraws amount more PLN than deposited', async () => {
      await expect(pollenDAO.connect(delegator)
        .withdraw(
          portfolioOwner1.address,
          invalidWithdrawnAmountDelegator,
          usePLN
        )
      )
        .to.be.revertedWith('Insufficient balance');
    });
    it('Should revert if delegator withdraws amount more vePLN than deposited', async () => {
      await expect(pollenDAO.connect(delegator)
        .withdraw(
          portfolioOwner1.address,
          invalidWithdrawnAmountDelegator,
          useVePLN
        )
      )
        .to.be.revertedWith('User deposit is zero');
    });
    it('Should update PLN balances for a reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      // increase time to allow for full reward rate
      provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
      provider.send('evm_mine', []);
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      priceFeeds.forEach((feed, index) => {
        feed.setUpdatedAt(ts);
      });

      await pollenDAO.connect(portfolioOwner1)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const delegatorReturn = calculatePLNReturn(change.return, amountDelegated, false);
      const ownerReturn = calculatePLNReturn(change.return, amount, true);
      await expect(() => pollenDAO.connect(delegator)
        .withdraw(portfolioOwner1.address, amountDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, delegatorReturn);

      await expect(() => pollenDAO.connect(portfolioOwner1)
        .withdraw(portfolioOwner1.address, amount, usePLN))
        .to.changeTokenBalance(pollenToken, portfolioOwner1, ownerReturn);

      // TODO: add in when vePLN reward calculation function is complete
    });
    it('Should update vePLN balances for a reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      const elapsedTime = 1000000;
      const totalPollenDelegated = amount.mul(2).add(amountDelegated.mul(2));
      await ethers.provider.send('evm_increaseTime', [elapsedTime]);
      await ethers.provider.send('evm_mine', []);
      let currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed1.setUpdatedAt(currentBlockTime);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed2.setUpdatedAt(currentBlockTime);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
      await mockPriceFeed3.setUpdatedAt(currentBlockTime);

      await pollenDAO.connect(portfolioOwner2)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, useVePLN);

      const boostScale = await pollenDAO.getBoostingScale();
      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const changePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale, //boost scale
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const totalWithdrawalPLN = calculatePLNReturn(changePLN.return, amountDelegated, false);
      await expect(() => pollenDAO.connect(delegator)
        .withdraw(portfolioOwner2.address, amountDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, totalWithdrawalPLN);

      const plnBalBefore = await pollenToken.balanceOf(portfolioOwner2.address);
      const vePlnBalBefore = await vePLN.balanceOf(portfolioOwner2.address);
      const withdrawalExecution = await pollenDAO.connect(portfolioOwner2).withdraw(portfolioOwner2.address, amount, useVePLN);
      const plnBalAfter = await pollenToken.balanceOf(portfolioOwner2.address);
      const vePlnBalAfter = await vePLN.balanceOf(portfolioOwner2.address);

      const lockEnd = (await vePLN.locks(portfolioOwner2.address)).lockEnd;
      currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      const vePlnTotalLocked = await vePLN.totalLocked();

      const changeVePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn,
        BN.from(currentBlockTime),
        vePlnTotalLocked,
        lockAmounts,
        lockEnd,
      );
      const totalWithdrawalVePLN = await calculatePLNReturn(changeVePLN.return, amount, true);
      expect(plnBalAfter.sub(plnBalBefore)).to.eq(totalWithdrawalVePLN.sub(amount), 'precision not good enough');
      const portofolioOwner2VePlnBalance = await vePLN.balanceOf(portfolioOwner2.address);
      expect(vePlnBalAfter.sub(vePlnBalBefore)).to.eq(amount);
    });
    it('Should update PLN balances for a penalty', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.div(2), INITIAL_PRICE.div(3), INITIAL_PRICE.div(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await pollenDAO.connect(portfolioOwner1)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const penalty = calculatePLNPenalty(change.return, amountDelegated);
      await expect(() => pollenDAO.connect(delegator)
        .withdraw(portfolioOwner1.address, amountDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, amountDelegated.sub(penalty));
    });
    it('Should update vePLN balances for a penalty', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.div(2), INITIAL_PRICE.div(3), INITIAL_PRICE.div(1)];
      const elapsedTime = 1000000;
      const totalPollenDelegated = amount.mul(2).add(amountDelegated.mul(2));
      await ethers.provider.send('evm_increaseTime', [elapsedTime]);
      await ethers.provider.send('evm_mine', []);
      let currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed1.setUpdatedAt(currentBlockTime);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed2.setUpdatedAt(currentBlockTime);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
      await mockPriceFeed3.setUpdatedAt(currentBlockTime);

      await pollenDAO.connect(portfolioOwner2)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, useVePLN);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const changePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const penaltyPLN = calculatePLNPenalty(changePLN.return, amountDelegated);
      await expect(() => pollenDAO.connect(delegator)
        .withdraw(portfolioOwner2.address, amountDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, amountDelegated.sub(penaltyPLN));

      const plnBalBefore = await pollenToken.balanceOf(portfolioOwner2.address);
      const vePlnBalBefore = await vePLN.balanceOf(portfolioOwner2.address);
      await pollenDAO.connect(portfolioOwner2).withdraw(portfolioOwner2.address, amount, useVePLN);
      const plnBalAfter = await pollenToken.balanceOf(portfolioOwner2.address);
      const vePlnBalAfter = await vePLN.balanceOf(portfolioOwner2.address);

      const lockEnd = (await vePLN.locks(portfolioOwner2.address)).lockEnd;
      currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      const vePlnTotalLocked = await vePLN.totalLocked();


      const changeVePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn,
        BN.from(currentBlockTime),
        vePlnTotalLocked,
        lockAmounts,
        lockEnd,
      );
      const penaltyVePLN = calculatePLNPenalty(changeVePLN.return, amount);
      const portofolioOwner2VePlnBalance = await vePLN.balanceOf(portfolioOwner2.address);
      expect(vePlnBalAfter.sub(vePlnBalBefore)).to.eq(amount.sub(penaltyVePLN), 'precision is not good enough');
    });
    it('Should emit WithdrawWithReward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await expect(pollenDAO.connect(delegator)
        .withdraw(portfolioOwner1.address, amountDelegated, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithReward');
    });
    it('Should emit WithdrawWithPenalty', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.div(2), INITIAL_PRICE.div(3), INITIAL_PRICE.div(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await expect(pollenDAO.connect(delegator)
        .withdraw(portfolioOwner1.address, amountDelegated, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithPenalty');
    });
    it('Should close portfolio if owner withdraws all funds', async () => {
      await pollenDAO.connect(portfolioOwner1)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);

      await pollenDAO.connect(portfolioOwner1)
        .withdraw(portfolioOwner1.address, amount, usePLN);

      const portfolio = await pollenDAO.getPortfolio(
        portfolioOwner1.address,
        portfolioOwner1.address
      );

      expect(portfolio.isOpen).to.be.false;
    });
  });

  describe('withdrawMany', async () => {
    const portfolioOwnerWallets = [portfolioOwner1, portfolioOwner2];
    const portfolioOwners = [portfolioOwner1.address, portfolioOwner2.address];
    const amount = BASE_18.mul(10);
    const amountsDelegated = [amount.div(2), amount.div(5)];
    const totalDelegated = (amount.div(2)).add(amount.div(5));
    const invalidAmountsDelegated = [100, 200, 300];


    beforeEach(async () => {
      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, amount.mul(100));
      await vePLN.connect(delegator).approve(pollenDAO.address, amount);
      await vePLN.connect(portfolioOwner2).approve(pollenDAO.address, amount);
      await pollenDAO.connect(portfolioOwner1)
        .createPortfolio(amount, initialWeights, isShort, usePLN);

      await pollenDAO.connect(portfolioOwner2)
        .createPortfolio(amount, initialWeights, isShort, useVePLN);

      await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);

      await pollenDAO.connect(delegator)
        .multiDelegatePollen(portfolioOwners, amountsDelegated, useVePLN);
      await pollenDAO.connect(delegator)
        .multiDelegatePollen(portfolioOwners, amountsDelegated, usePLN);
    });

    it('Should revert if owners array length does not match amounts array length', async () => {
      await expect(pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, invalidAmountsDelegated, usePLN))
        .to.be.revertedWith('Invalid length parameters');
    });
    it('Should revert if exceeds maximum number of withdrawls per transaction', async () => {
      await pollenDAO.setMaxNumberWithdrawls(1);

      await expect(pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.be.revertedWith('Exceeds max number of withdrawls');
    });
    it('Should update PLN balances for a reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      // increase time to allow for full reward rate
      provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
      provider.send('evm_mine', []);
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      priceFeeds.forEach((feed, index) => {
        feed.setUpdatedAt(ts);
      });

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      await pollenDAO.connect(portfolioOwner1)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);
      await pollenDAO.connect(portfolioOwner2)
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, useVePLN);

      const expectedReward = calculatePLNReturn(change.return, totalDelegated, false);

      await expect(() => pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, expectedReward);
    });
    it('Should update PLN balances for a vePLN reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      const elapsedTime = 1000000;
      const totalPollenDelegated = amountsDelegated[0].add(amountsDelegated[1]);
      await ethers.provider.send('evm_increaseTime', [elapsedTime]);
      await ethers.provider.send('evm_mine', []);
      let currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed1.setUpdatedAt(currentBlockTime);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed2.setUpdatedAt(currentBlockTime);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
      await mockPriceFeed3.setUpdatedAt(currentBlockTime);

      await pollenDAO.connect(portfolioOwnerWallets[0])
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);
      await pollenDAO.connect(portfolioOwnerWallets[1])
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, useVePLN);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const changePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const totalWithdrawalPLN1 = calculatePLNReturn(changePLN.return, amountsDelegated[0], false);
      const totalWithdrawalPLN2 = calculatePLNReturn(changePLN.return, amountsDelegated[1], false);
      // PLN: withdrawMany assertions
      await expect(() => pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, totalWithdrawalPLN1.add(totalWithdrawalPLN2));

      // VEPLN: withdrawMany execution
      const plnBalBefore = await pollenToken.balanceOf(delegator.address);
      const vePlnBalBefore = await vePLN.balanceOf(delegator.address);
      await pollenDAO.connect(delegator).withdrawMany(portfolioOwners, amountsDelegated, useVePLN);
      currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      const plnBalAfter = await pollenToken.balanceOf(delegator.address);
      const vePlnBalAfter = await vePLN.balanceOf(delegator.address);

      // VEPLN: withdrawMany off chain calculation
      const lockEnd = (await vePLN.locks(delegator.address)).lockEnd;
      const vePlnTotalLocked = await vePLN.totalLocked();
      const changeVePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn,
        BN.from(currentBlockTime),
        vePlnTotalLocked,
        lockAmounts,
        lockEnd,
      );
      // VEPLN: withdrawMany off chain assertions
      const totalWithdrawalVePLN1 = calculatePLNReturn(changeVePLN.return, amountsDelegated[0], false);
      const totalWithdrawalVePLN2 = calculatePLNReturn(changeVePLN.return, amountsDelegated[1], false);
      const totalVePlnDelegated = totalPollenDelegated;
      const totalWithdrawalVePLN = totalWithdrawalVePLN1.add(totalWithdrawalVePLN2);
      expect(plnBalAfter.sub(plnBalBefore)).to.eq(totalWithdrawalVePLN.sub(totalVePlnDelegated), 'precision not good enough');
      // const portofolioOwner2VePlnBalance = await vePLN.balanceOf(portfolioOwner2.address);
      expect(vePlnBalAfter.sub(vePlnBalBefore)).to.eq(amountsDelegated[0].add(amountsDelegated[1]));
    });
    it('Should update PLN balances for a penalty', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.div(2), INITIAL_PRICE.div(3), INITIAL_PRICE.div(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const expectedPenalty = calculatePLNPenalty(change.return, totalDelegated);
      const totalAmountDelegated = amountsDelegated.reduce((prev, running) => prev.add(running), BN.from(0));

      await expect(() => pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, totalAmountDelegated.sub(expectedPenalty));

    });
    it('Should update vePLN balances for a penalty', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.div(2), INITIAL_PRICE.div(3), INITIAL_PRICE.div(1)];
      const elapsedTime = 1000000;
      const totalPollenDelegated = amountsDelegated[0].add(amountsDelegated[1]);
      await ethers.provider.send('evm_increaseTime', [elapsedTime]);
      await ethers.provider.send('evm_mine', []);
      let currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed1.setUpdatedAt(currentBlockTime);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed2.setUpdatedAt(currentBlockTime);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
      await mockPriceFeed3.setUpdatedAt(currentBlockTime);

      await pollenDAO.connect(portfolioOwnerWallets[0])
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, usePLN);
      await pollenDAO.connect(portfolioOwnerWallets[1])
        .rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, useVePLN);

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const changePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const totalWithdrawalPLN1 = calculatePLNPenalty(changePLN.return, amountsDelegated[0]);
      const totalWithdrawalPLN2 = calculatePLNPenalty(changePLN.return, amountsDelegated[1]);
      // PLN: withdrawMany assertions
      await expect(() => pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, totalPollenDelegated.sub(totalWithdrawalPLN1.add(totalWithdrawalPLN2)));

      // VEPLN: withdrawMany execution
      const plnBalBefore = await pollenToken.balanceOf(delegator.address);
      const vePlnBalBefore = await vePLN.balanceOf(delegator.address);
      await pollenDAO.connect(delegator).withdrawMany(portfolioOwners, amountsDelegated, useVePLN);
      currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      const plnBalAfter = await pollenToken.balanceOf(delegator.address);
      const vePlnBalAfter = await vePLN.balanceOf(delegator.address);

      // VEPLN: withdrawMany off chain calculation
      const lockEnd = (await vePLN.locks(delegator.address)).lockEnd;
      const vePlnTotalLocked = await vePLN.totalLocked();
      const changeVePLN: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn,
        BN.from(currentBlockTime),
        vePlnTotalLocked,
        lockAmounts,
        lockEnd,
      );
      // VEPLN: withdrawMany off chain assertions
      const totalPenaltyVePLN1 = calculatePLNPenalty(changeVePLN.return, amountsDelegated[0]);
      const totalPenaltyVePLN2 = calculatePLNPenalty(changeVePLN.return, amountsDelegated[1]);
      const totalVePlnDelegated = totalPollenDelegated;
      const totalPenaltyVePLN = totalPenaltyVePLN1.add(totalPenaltyVePLN2);
      expect(vePlnBalAfter.sub(vePlnBalBefore)).to.eq(totalVePlnDelegated.sub(totalPenaltyVePLN), 'precision not good enough');
      const portofolioOwner2VePlnBalance = await vePLN.balanceOf(portfolioOwner2.address);
      // expect(vePlnBalAfter.sub(vePlnBalBefore)).to.eq(amountsDelegated[0].add(amountsDelegated[1]));
    });
    it('Should emit WithdrawWithReward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await expect(pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithReward');
    });
    it('Should emit WithdrawWithPenalty', async () => {
      await mockPriceFeed1.incrementRoundAndSetAnswer(1);
      await mockPriceFeed2.incrementRoundAndSetAnswer(1);
      await mockPriceFeed3.incrementRoundAndSetAnswer(1);

      await expect(pollenDAO.connect(delegator)
        .withdrawMany(portfolioOwners, amountsDelegated, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithPenalty');
    });
  });

  describe('withdrawRewards', async () => {
    const amount = BASE_18.mul(100);
    const amountDelegated = BASE_18.mul(10);

    beforeEach(async () => {
      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, amount.mul(1000));
      await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);

      // await vePLN.connect(delegator).approve(pollenDAO.address, amount);
      // await vePLN.connect(portfolioOwner2).approve(pollenDAO.address, amount);

      await pollenDAO.connect(portfolioOwner1)
        .createPortfolio(amount, initialWeights, isShort, usePLN);
      await pollenDAO.connect(delegator)
        .delegatePollen(portfolioOwner1.address, amountDelegated, usePLN);

      // await pollenDAO.connect(delegator)
      //   .delegatePollen(portfolioOwner1.address, amountDelegated, useVePLN);
    });
    it('Should revert if there is no reward to be withdrawn', async () => {
      await mockPriceFeed1.incrementRoundAndSetAnswer(INITIAL_PRICE);
      await mockPriceFeed2.incrementRoundAndSetAnswer(INITIAL_PRICE);
      await mockPriceFeed3.incrementRoundAndSetAnswer(INITIAL_PRICE);

      await expect(pollenDAO.connect(delegator)
        .withdrawRewards(portfolioOwner1.address, usePLN))
        .to.be.revertedWith('Porfolio returns are negative');
      // await expect(pollenDAO.connect(delegator)
      //   .withdrawRewards(portfolioOwner1.address, useVePLN))
      //   .to.be.revertedWith('Porfolio returns are negative');
    });
    it('Should update balances for a PLN reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      // increase time to allow for full reward rate
      provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
      provider.send('evm_mine', []);
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      priceFeeds.forEach((feed, index) => {
        feed.setUpdatedAt(ts);
      });

      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();
      const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const delegatorReturn = calculatePLNReturn(change.return, amountDelegated, false);
      const ownerReturn = calculatePLNReturn(change.return, amount, true);

      await expect(() => pollenDAO.connect(delegator)
        .withdrawRewards(portfolioOwner1.address, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, delegatorReturn.sub(amountDelegated));

      await expect(() => pollenDAO.connect(portfolioOwner1)
        .withdrawRewards(portfolioOwner1.address, usePLN))
        .to.changeTokenBalance(pollenToken, portfolioOwner1, ownerReturn.sub(amount));
    });
    it('Should emit WithdrawWithReward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await expect(pollenDAO.connect(delegator)
        .withdrawRewards(portfolioOwner1.address, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithReward');
    });
  });

  describe('withdrawRewardsMany', async () => {
    const portfolioOwners = [portfolioOwner1.address, portfolioOwner2.address];
    const amount = BASE_18.mul(10);
    const amountsDelegated = [amount.div(2), amount.div(5)];
    const totalDelegated = (amount.div(2)).add(amount.div(5));
    const initialWeights2 = [BN.from(0), BN.from(50), BN.from(20), BN.from(30)];

    beforeEach(async () => {
      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, amount.mul(1000));
      await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);

      await pollenDAO.connect(portfolioOwner1)
        .createPortfolio(amount, initialWeights, isShort, usePLN);
      await pollenDAO.connect(portfolioOwner2)
        .createPortfolio(amount, initialWeights2, isShort, usePLN);
      await pollenDAO.connect(delegator)
        .multiDelegatePollen(portfolioOwners, amountsDelegated, usePLN);
    });

    it('Should revert if there is no reward to be withdrawn', async () => {
      await mockPriceFeed1.incrementRoundAndSetAnswer(1);
      await mockPriceFeed2.incrementRoundAndSetAnswer(1);
      await mockPriceFeed3.incrementRoundAndSetAnswer(1);

      await expect(pollenDAO.connect(delegator)
        .withdrawRewardsMany(portfolioOwners, usePLN))
        .to.be.revertedWith('Porfolio returns are negative');
    });
    it('Should revert if exceeds maximum number of withdrawls per transaction', async () => {
      await pollenDAO.setMaxNumberWithdrawls(1);

      await expect(pollenDAO.connect(delegator)
        .withdrawRewardsMany(portfolioOwners, usePLN))
        .to.be.revertedWith('Exceeds max number of withdrawls');
    });
    it('Should update balances for a reward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      // increase time to allow for full reward rate
      provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
      provider.send('evm_mine', []);
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      priceFeeds.forEach((feed, index) => {
        feed.setUpdatedAt(ts);
      });
      const benchmarkReturn = await getBenchmarkReturn(
        benchmarkWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices // current prices
      );

      const boostScale = await pollenDAO.getBoostingScale();

      const change1: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        benchmarkReturn
      );

      const change2: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights2, // weights
        initialPrices, // prices at delegation/creation
        newPrices, //[1, 2, 4, 4] // current prices
        benchmarkReturn
      );

      const expectedReward1 = calculatePLNReturn(change1.return, amountsDelegated[0], false);
      const expectedReward2 = calculatePLNReturn(change2.return, amountsDelegated[1], false);

      const totalExpectedReward = expectedReward1.add(expectedReward2);

      await expect(() => pollenDAO.connect(delegator)
        .withdrawRewardsMany(portfolioOwners, usePLN))
        .to.changeTokenBalance(pollenToken, delegator, totalExpectedReward.sub(totalDelegated));
    });
    it('Should emit WithdrawWithReward', async () => {
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);

      await expect(pollenDAO.connect(delegator)
        .withdrawRewardsMany(portfolioOwners, usePLN))
        .to.emit(pollenDAO, 'WithdrawWithReward');
    });
  });
  // describe('Rewards at max supply', async function () {
  //   let totalBalance: BN;
  //   let portfolioBalance: BN;
  //   beforeEach(async () => {
  //     await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
  //     totalBalance = await pollenToken.balanceOf(admin.address);
  //     portfolioBalance = totalBalance.div(2);
  //     await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);
  //   });
  //   it('Should reward the delegator at a reduced reward rate', async () => {
  //     await pollenToken.connect(admin).transfer(user1.address, portfolioBalance);
  //     await pollenToken.connect(admin).approve(pollenDAO.address, portfolioBalance);
  //     await pollenDAO.connect(admin).createPortfolio(portfolioBalance, initialWeights, usePLN);
  //
  //     await pollenToken.connect(user1).approve(pollenDAO.address, portfolioBalance);
  //     await pollenDAO.connect(user1).createPortfolio(portfolioBalance, initialWeights, usePLN);
  //
  //     const priceMultiplier = 100;
  //     const newPrices = [BASE_18, INITIAL_PRICE.mul(priceMultiplier), INITIAL_PRICE.mul(priceMultiplier), INITIAL_PRICE.mul(priceMultiplier)];
  //     await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
  //     await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
  //     await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
  //     await pollenDAO.connect(admin)
  //       .rebalancePortfolio([100, 0, 0, 0], 0, usePLN);
  //     await pollenDAO.connect(user1)
  //       .rebalancePortfolio([100, 0, 0, 0], 0, usePLN);
  //
  //     const benchmarkReturn = await getBenchmarkReturn(
  //       benchmarkWeights, // weights
  //       initialPrices, // prices at delegation/creation
  //       newPrices // current prices
  //     );
  //
  //     const boostScale = await pollenDAO.getBoostingScale();
  //     const expectedReturn: ExpectedReturn = await getExpectedPortfolioReturnBN(
  //       boostScale,
  //       initialWeights, // weights
  //       initialPrices, // prices at delegation/creation
  //       newPrices, // current prices
  //       benchmarkReturn
  //     );
  //
  //     const pollenTotalSupply1 = await pollenToken.totalSupply();
  //     const inflationInfo1 = await vePLN.inflationInfo();
  //     const adminBalanceBefore = await pollenToken.balanceOf(admin.address);
  //     await pollenDAO.connect(admin).withdraw(admin.address, portfolioBalance, usePLN);
  //     const adminBalanceAfter = await pollenToken.balanceOf(admin.address);
  //
  //     const currentTimestamp1 = (await provider.getBlock('latest')).timestamp;
  //     const rewardAmountAdmin = calcExpectedPortfolioWithdraw(
  //       issuanceSchedule,
  //       BASE_18.mul(priceMultiplier),
  //       portfolioBalance,
  //       portfolioBalance,
  //       totalBalance,
  //       pollenTotalSupply1,
  //       inflationInfo1.reserved,
  //       BN.from(currentTimestamp1),
  //       portfolioBalance,
  //       expectedReturn.return);
  //
  //     const pollenTotalSupply2 = await pollenToken.totalSupply();
  //     const inflationInfo2 = await vePLN.inflationInfo();
  //     const userBalanceBefore = await pollenToken.balanceOf(user1.address);
  //     await pollenDAO.connect(user1).withdraw(user1.address, portfolioBalance, usePLN);
  //     const userBalanceAfter = await pollenToken.balanceOf(user1.address);
  //
  //     const currentTimestamp2 = (await provider.getBlock('latest')).timestamp;
  //     const rewardAmountUser = calcExpectedPortfolioWithdraw(
  //       issuanceSchedule,
  //       BASE_18.mul(priceMultiplier),
  //       portfolioBalance,
  //       portfolioBalance,
  //       portfolioBalance,
  //       pollenTotalSupply2,
  //       inflationInfo2.reserved,
  //       BN.from(currentTimestamp2),
  //       portfolioBalance,
  //       expectedReturn.return);
  //
  //     expect(adminBalanceAfter.sub(adminBalanceBefore)).to.eq(portfolioBalance.add(rewardAmountAdmin));
  //     expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(portfolioBalance.add(rewardAmountUser));
  //   });
  //   it('Should reward the delegator at a reduced reward rate with vePLN', async () => {
  //     const totalVePLNLocked = totalBalance.add(lockAmounts.mul(3));
  //     await pollenToken.connect(admin).transfer(user1.address, portfolioBalance);
  //     await pollenToken.connect(admin).approve(vePLN.address, portfolioBalance);
  //     await pollenToken.connect(user1).approve(vePLN.address, portfolioBalance);
  //
  //     await vePLN.connect(admin).lock(portfolioBalance, lockEnd);
  //     await vePLN.connect(admin).approve(pollenDAO.address, portfolioBalance);
  //     await pollenDAO.connect(admin).createPortfolio(portfolioBalance, initialWeights, useVePLN);
  //
  //     await vePLN.connect(user1).lock(portfolioBalance, lockEnd);
  //     await vePLN.connect(user1).approve(pollenDAO.address, portfolioBalance);
  //     await pollenDAO.connect(user1).createPortfolio(portfolioBalance, initialWeights, useVePLN);
  //
  //     const priceMultiplier = 100;
  //     const newPrices = [BASE_18, INITIAL_PRICE.mul(priceMultiplier), INITIAL_PRICE.mul(priceMultiplier), INITIAL_PRICE.mul(priceMultiplier)];
  //     await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
  //     await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
  //     await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
  //
  //     await pollenDAO.connect(admin)
  //       .rebalancePortfolio([100, 0, 0, 0], 0, useVePLN);
  //     await pollenDAO.connect(user1)
  //       .rebalancePortfolio([100, 0, 0, 0], 0, useVePLN);
  //
  //     const pollenTotalSupply1 = await pollenToken.totalSupply();
  //     const inflationInfo1 = await vePLN.inflationInfo();
  //     const adminBalanceBefore = await pollenToken.balanceOf(admin.address);
  //     await pollenDAO.connect(admin).withdraw(admin.address, portfolioBalance, useVePLN);
  //     const adminBalanceAfter = await pollenToken.balanceOf(admin.address);
  //
  //     const benchmarkReturn = await getBenchmarkReturn(
  //       benchmarkWeights, // weights
  //       initialPrices, // prices at delegation/creation
  //       newPrices);
  //
  //     const currentTimestamp1 = (await provider.getBlock('latest')).timestamp;
  //     const onChainlockEndAdmin = (await vePLN.locks(admin.address)).lockEnd;
  //     const boostScale = await pollenDAO.getBoostingScale();
  //     const expectedReturnAdmin: ExpectedReturn = await getExpectedPortfolioReturnBN(
  //       boostScale,
  //       initialWeights, // weights
  //       initialPrices, // prices at delegation/creation
  //       newPrices, // [1, 2, 4, 4] // current prices
  //       benchmarkReturn,
  //       BN.from(currentTimestamp1),
  //       totalVePLNLocked,
  //       portfolioBalance,
  //       onChainlockEndAdmin
  //     );
  //
  //     const rewardAmountAdmin = calcExpectedPortfolioWithdraw(
  //       issuanceSchedule,
  //       BASE_18.mul(priceMultiplier),
  //       portfolioBalance,
  //       portfolioBalance,
  //       totalBalance,
  //       pollenTotalSupply1,
  //       inflationInfo1.reserved,
  //       BN.from(currentTimestamp1),
  //       portfolioBalance,
  //       expectedReturnAdmin.return);
  //
  //     const pollenTotalSupply2 = await pollenToken.totalSupply();
  //     const inflationInfo2 = await vePLN.inflationInfo();
  //     const userBalanceBefore = await pollenToken.balanceOf(user1.address);
  //     await pollenDAO.connect(user1).withdraw(user1.address, portfolioBalance, useVePLN);
  //     const userBalanceAfter = await pollenToken.balanceOf(user1.address);
  //
  //     const currentTimestamp2 = (await provider.getBlock('latest')).timestamp;
  //     const onChainlockEndUser = (await vePLN.locks(admin.address)).lockEnd;
  //     const expectedReturnUser: ExpectedReturn = await getExpectedPortfolioReturnBN(
  //       boostScale,
  //       initialWeights, // weights
  //       initialPrices, // prices at delegation/creation
  //       newPrices, // [1, 2, 4, 4] // current prices
  //       benchmarkReturn,
  //       BN.from(currentTimestamp2),
  //       totalVePLNLocked,
  //       portfolioBalance,
  //       onChainlockEndUser
  //     );
  //
  //     const rewardAmountUser = calcExpectedPortfolioWithdraw(
  //       issuanceSchedule,
  //       BASE_18.mul(priceMultiplier),
  //       portfolioBalance,
  //       portfolioBalance,
  //       portfolioBalance,
  //       pollenTotalSupply2,
  //       inflationInfo2.reserved,
  //       BN.from(currentTimestamp2),
  //       portfolioBalance,
  //       expectedReturnUser.return);
  //
  //     expect(onChainlockEndAdmin).to.eq(onChainlockEndUser);
  //     expect(adminBalanceAfter.sub(adminBalanceBefore)).to.eq(rewardAmountAdmin);
  //     expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(rewardAmountUser);
  //   });
  // });
  describe('Benchmark portfolio', async function () {
    let totalBalance: BN;
    let portfolioBalance: BN;
    let ownerBalance: BN;
    let delegatorBalance: BN;
    let initialDeposits: BN;
    beforeEach(async () => {
      await pollenDAO.connect(admin).initializeIssuanceInfo(issuanceSchedule);
      await pollenDAO.connect(admin).setLimitPortfolioBalance(0, BASE_18.mul(94000000));
      totalBalance = await pollenToken.balanceOf(admin.address);
      portfolioBalance = totalBalance.div(10);
      ownerBalance = portfolioBalance.div(10);
      delegatorBalance = portfolioBalance.div(10);
      initialDeposits = ownerBalance.div(2);
      await pollenDAO.connect(admin).createBenchMarkPortfolio(benchmarkWeights);
      // create portfolio
      await pollenToken.connect(admin).transfer(user1.address, ownerBalance);
      await pollenToken.connect(user1).approve(pollenDAO.address, ownerBalance);
      await pollenDAO.connect(user1).createPortfolio(initialDeposits, initialWeights, isShort, false);
      // delegate
      await pollenToken.connect(admin).transfer(delegator.address, delegatorBalance);
      await pollenToken.connect(delegator).approve(pollenDAO.address, delegatorBalance);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, initialDeposits, false);
      await provider.send('evm_increaseTime', [ONE_YEAR * 4]);

    });
    it('Should update benchmark reference based on a weighted average of deposits and amount to deposit', async function () {
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      // price change
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
      for await (const feed of priceFeeds) {
        await feed.setUpdatedAt(ts);
      }
      // owner dummy rebalance (should not change benchmark ref)
      await pollenDAO.connect(user1).rebalancePortfolio(initialWeights, Array(initialWeights.length).fill(false), 0, false);

      // deposit into portfolio (should change benchmark refs)
      const additionAmount = initialDeposits.div(4);
      await pollenDAO.connect(user1).rebalancePortfolio(initialWeights, Array(initialWeights.length).fill(false), additionAmount, false);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, additionAmount, false);
      // close portfolio for withdraw
      await pollenDAO.connect(user1).rebalancePortfolio([100, 0, 0, 0], Array(4).fill(false), 0, false);
      // withdraw some of the tokens
      const withdrawAmount = additionAmount.div(2);
      const ownerBalanceBefore = await pollenToken.balanceOf(user1.address);
      const delegatorBalanceBefore = await pollenToken.balanceOf(delegator.address);
      await pollenDAO.connect(user1).withdraw(user1.address, withdrawAmount, false);
      await pollenDAO.connect(delegator).withdraw(user1.address, withdrawAmount, false);
      const ownerBalanceAfter = await pollenToken.balanceOf(user1.address);
      const delegatorBalanceAfter = await pollenToken.balanceOf(delegator.address);
      // off chain calcs
      // weighted average
      const initBenchmarkValue = BASE_18;
      const benchmarkReturn = getBenchmarkReturn(benchmarkWeights, initialPrices, newPrices);

      const benchmarkValue = benchmarkReturn.add(BASE_18);
      const adjustedBenchmarkRef = calcWeightedAverage(initialDeposits, additionAmount, initBenchmarkValue, benchmarkValue);
      const adjustedBenchmarkReturn = benchmarkValue.mul(BASE_18).div(adjustedBenchmarkRef).sub(BASE_18);
      // owner calc
      const baseReturn = getBenchmarkReturn(initialWeights.map((num) => num.toNumber()), initialPrices, newPrices).sub(1); // subtract 1 due to precision issues from off chain return calc
      const boostScale = await pollenDAO.getBoostingScale();
      const expectedInitialReturn: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        adjustedBenchmarkReturn
      );

      // calc weighted return
      const adjustedExpectedReturn = calcWeightedAverage(initialDeposits, additionAmount, baseReturn, BN.from(0)).sub(adjustedBenchmarkReturn);
      // with fees
      const delegatorTotalWithdraw = calculatePLNReturn(adjustedExpectedReturn, withdrawAmount, false);
      const delegatorFee = withdrawAmount.mul(adjustedExpectedReturn).div(BASE_18).mul(20).div(100);
      const ownerTotalWithdraw = calculatePLNReturn(adjustedExpectedReturn, withdrawAmount, true);
      // assertions
      expect(delegatorTotalWithdraw).to.eq(delegatorBalanceAfter.sub(delegatorBalanceBefore));
      expect(ownerTotalWithdraw.add(delegatorFee)).to.eq(ownerBalanceAfter.sub(ownerBalanceBefore));
    });
    it('Should reset benchmark ref when taking rewards', async function () {
      // deposit into portfolio
      // price change
      // take rewards
      // take rea
      await provider.send('evm_mine', []);
      const ts = (await provider.getBlock('latest')).timestamp;
      // price change
      const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3), INITIAL_PRICE.mul(1)];
      await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[1]);
      await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[2]);
      await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[3]);
      for await (const feed of priceFeeds) {
        await feed.setUpdatedAt(ts);
      }

      // deposit into portfolio (should change benchmark refs)
      const additionAmount = initialDeposits.div(4);
      await pollenDAO.connect(delegator).delegatePollen(user1.address, additionAmount, false);
      // withdraw some of the tokens
      const withdrawAmount = additionAmount.div(2);
      const delegatorBalanceBefore = await pollenToken.balanceOf(delegator.address);
      await pollenDAO.connect(delegator).withdrawRewards(user1.address, false);
      const delegatorBalanceAfter = await pollenToken.balanceOf(delegator.address);
      // off chain calcs
      // weighted average
      const initBenchmarkValue = BASE_18;
      const benchmarkReturn = getBenchmarkReturn(benchmarkWeights, initialPrices, newPrices);
      const benchmarkValue = benchmarkReturn.add(BASE_18);
      const adjustedBenchmarkRef = calcWeightedAverage(initialDeposits, additionAmount, initBenchmarkValue, benchmarkValue);
      const adjustedBenchmarkReturn = benchmarkValue.mul(BASE_18).div(adjustedBenchmarkRef).sub(BASE_18);
      // owner calc
      const baseReturn = getBenchmarkReturn(initialWeights.map((num) => num.toNumber()), initialPrices, newPrices).sub(1);
      const boostScale = await pollenDAO.getBoostingScale();
      const expectedInitialReturn: ExpectedReturn = await getExpectedPortfolioReturnBN(
        boostScale,
        initialWeights, // weights
        initialPrices, // prices at delegation/creation
        newPrices, // current prices
        adjustedBenchmarkReturn
      );
      // calc weighted return
      const adjustedExpectedReturn = calcWeightedAverage(initialDeposits, additionAmount, baseReturn, BN.from(0)).sub(adjustedBenchmarkReturn);
      // Rewards
      const rewards = adjustedExpectedReturn.mul(initialDeposits.add(additionAmount)).div(BASE_18).mul(80).div(100);
      // assertions
      expect(rewards).to.eq(delegatorBalanceAfter.sub(delegatorBalanceBefore));
    });
  });
});
