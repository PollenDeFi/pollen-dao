import chai from 'chai';
import hre, { ethers, waffle } from 'hardhat';
import { BigNumber as BN, Contract } from 'ethers';

import {
  ERC20,
  MockPriceFeed,
  PollenToken,
  LockedPollen,
  Portfolio,
  PollenDAO,
  IPollenDAO,
  Launcher,
  Quoter,
  Minter,
  Governance,
  MockGovProposal,
  MockModule
} from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { ZERO_ADDRESS, INITIAL_BALANCES, MAX_LOCK_PERIOD, BASE_WEIGHTS } from './helpers/constants';
import {ExpectedReturn, getSelectors} from './helpers/functions';
import {getBenchmarkReturn, getExpectedPortfolioReturnBN} from './helpers/calculations';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

const BASE_18 = BN.from(10 ** 10).mul(10 ** 8);

describe('Launcher', function () {
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
  let mockGovProposal: MockGovProposal;
  let launcher: Contract;
  let priceFeeds;

  //let mInfo: Object;

  const benchmarkWeights = [50, 0, 50];

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

  beforeEach(async function () {
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

    const Governance = await ethers.getContractFactory('Governance');
    const governance = await Governance.deploy() as Governance;
    await governance.deployed();


    // deploy modules selectors
    const portfolioSelectors = Object.keys(Portfolio.interface.functions).map((item) => Portfolio.interface.getSighash(item));
    const quoterSelectors = Object.keys(Quoter.interface.functions).map((item) => Quoter.interface.getSighash(item));
    const minterSelectors = Object.keys(Minter.interface.functions).map((item) => Minter.interface.getSighash(item));
    const governanceSelectors = Object.keys(Governance.interface.functions).map((item) => Governance.interface.getSighash(item));

    const mInfo = {
      quoterSelectors: quoterSelectors,
      portfolioSelectors: portfolioSelectors,
      minterSelectors: minterSelectors,
      governanceSelectors: governanceSelectors,
      quoterAddr: quoter.address,
      portfolioAddr: portfolio.address,
      minterAddr: minter.address,
      governanceAddr: governance.address,
      daoAdminAddr: admin.address,
      benchMark: benchmarkWeights
    };

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
    //await pollenDAO.connect(admin).initializeIssuanceInfo(schedule);

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

    const rateBases = [0, 0, 0];
    const assets = [assetA.address, assetB.address, assetC.address];
    const feeds = [mockPriceFeed1.address, mockPriceFeed2.address, mockPriceFeed3.address];
    priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];

    const LAUNCH = await await ethers.getContractFactory('Launcher');
    launcher = await LAUNCH.deploy(
      pollenToken.address,
      assets,
      feeds,
      rateBases,
      issuanceSchedule,
      mInfo
    );
    //set allowances to DAO
    const allowance = ethers.utils.parseEther('10000');
    await pollenToken.connect(user1).approve(launcher.address, allowance);
    await pollenToken.connect(user2).approve(launcher.address, allowance);
    await pollenToken.connect(user3).approve(launcher.address, allowance);
  });

  beforeEach(async function () {
    snapshot = await createSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshot);
  });

  it('Should allows an user to vote', async function () {
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    const campaign = await launcher.campaigns(0);
    expect(campaign.totalApprove).to.be.equal(amount);
  });
  it('Should allows an users to claim tokens after the vote expire', async function () {
    const tokenBalance = await pollenToken.balanceOf(user1.address);
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    const campaign = await launcher.campaigns(0);

    const contractBalance = await pollenToken.balanceOf(launcher.address);
    expect(contractBalance).to.be.equal(amount);

    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    await launcher.connect(user1).claimTokens();
    const newTokenBalance = await pollenToken.balanceOf(user1.address);
    expect(newTokenBalance).to.be.equal(tokenBalance);

    const newContractBalance = await pollenToken.balanceOf(launcher.address);
    expect(newContractBalance).to.be.equal(BN.from('0'));
  });
  it('Should allows users to vote and claim tokens after the vote expire', async function () {
    const user1Balance = await pollenToken.balanceOf(user1.address);
    const user2Balance = await pollenToken.balanceOf(user2.address);
    const user3Balance = await pollenToken.balanceOf(user3.address);

    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    await launcher.connect(user2).vote(amount, true);
    await launcher.connect(user3).vote(amount, true);

    const contractBalance = await pollenToken.balanceOf(launcher.address);
    expect(contractBalance).to.be.equal(amount.mul(BN.from('3')));


    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    await launcher.connect(user1).claimTokens();
    await launcher.connect(user2).claimTokens();
    await launcher.connect(user3).claimTokens();

    const newUser1Balance = await pollenToken.balanceOf(user1.address);
    const newUser2Balance = await pollenToken.balanceOf(user2.address);
    const newUser3Balance = await pollenToken.balanceOf(user3.address);

    expect(newUser1Balance).to.be.equal(user1Balance);
    expect(newUser2Balance).to.be.equal(user2Balance);
    expect(newUser3Balance).to.be.equal(user3Balance);

    const newContractBalance = await pollenToken.balanceOf(launcher.address);
    expect(newContractBalance).to.be.equal(BN.from('0'));
  });

  it('Should validate vote and launch if quorum is achieved', async function () {
    const tokenBalance = await pollenToken.balanceOf(user1.address);
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    const campaign = await launcher.campaigns(0);

    const contractBalance = await pollenToken.balanceOf(launcher.address);
    expect(contractBalance).to.be.equal(amount);

    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    const ts = (await provider.getBlock('latest')).timestamp;
    const priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];
    priceFeeds.forEach((feed, index) => {
      feed.setUpdatedAt(ts);
    });

    await expect(launcher.validateCampaign(0)).to.emit(launcher, 'DaoLaunched');
    const dao = await launcher.daoAddr();

    await launcher.connect(user1).claimTokens();

    const pollenDAO = await ethers.getContractAt('IPollenDAO', dao);
    const plnAddress = await pollenDAO.pollenToken();

    expect(plnAddress).to.be.equal(pollenToken.address);

    // Creating Proposal
    const MockModule = await ethers.getContractFactory('MockModule');
    const mockModule = await MockModule.deploy() as MockModule;
    await mockModule.deployed();

    // Get module selectors
    const mockModuleSelectors = getSelectors(MockModule.interface);
    const MockGovProposal = await ethers.getContractFactory('MockGovProposal');
    mockGovProposal = await MockGovProposal.deploy(pollenDAO.address, mockModule.address, mockModuleSelectors) as MockGovProposal;
    await mockGovProposal.deployed();

    await expect(pollenDAO.connect(user1).submitProposal(mockGovProposal.address))
      .to.emit(pollenDAO, 'NewProposal');

    // Vote Proposal
    const proposalId = 0;
    let timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
    const lockEnd = (timeStamp + 365 * 24 * 60 * 60).toString();

    const vePollen = await launcher.vePollenAddr();
    const vePLN = await ethers.getContractAt('LockedPollen', vePollen);

    await pollenToken.connect(user1).approve(vePollen, amount);
    await pollenToken.connect(user2).approve(vePollen, amount);

    await vePLN.connect(user1).lock(amount, lockEnd);
    await vePLN.connect(user2).lock(amount, lockEnd);

    await expect(pollenDAO.connect(user2).voteProposal(proposalId, true)).to.emit(pollenDAO, 'Voted');
    await pollenDAO.connect(user1).voteProposal(proposalId, true);

    timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
    await ethers.provider.send('evm_increaseTime', [timeStamp + 1000000]);
    await provider.send('evm_mine', []);
    await expect(pollenDAO.connect(user2).executeProposal(proposalId))
      .to.emit(pollenDAO, 'ModuleAdded');
  });

  it('Should work for portfolio functions.', async function () {
    const INITIAL_PRICE = BASE_18.mul(10);
    const initialPrices = [BASE_18, INITIAL_PRICE, INITIAL_PRICE];
    const weights = [BN.from(0), BN.from(50), BN.from(50)];
    const weights2 = [BN.from(0), BN.from(30), BN.from(70)];
    const amount = BASE_18.mul(10);
    const amountDelegated = BASE_18;
    const portfolioAmount = amount.mul(10);
    const isShort = Array(weights.length).fill(false);
    const isShort2 = Array(weights2.length).fill(false);

    await launcher.connect(user1).vote(amount, true);
    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    let ts = (await provider.getBlock('latest')).timestamp;
    const priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];
    priceFeeds.forEach((feed, index) => {
      feed.setUpdatedAt(ts);
    });

    const currentCampaign = await launcher.currentCampaign();
    await launcher.validateCampaign(currentCampaign);

    const dao = await launcher.daoAddr();
    const pollenDAO = await ethers.getContractAt('IPollenDAO', dao);

    // set Dao in token contract
    await pollenToken.connect(admin).setDaoAddress(dao);


    await pollenToken.connect(user1).approve(dao, portfolioAmount);
    await pollenToken.connect(user2).approve(dao, portfolioAmount);
    await pollenToken.connect(delegator).approve(dao, amount);
    await pollenDAO.connect(user1).createPortfolio(portfolioAmount, weights, isShort, false);
    await pollenDAO.connect(user2).createPortfolio(portfolioAmount, weights2, isShort2, false);
    await pollenDAO.connect(delegator).delegatePollen(user2.address, amountDelegated, false);

    const newPrices = [BASE_18, INITIAL_PRICE.mul(2), INITIAL_PRICE.mul(3)];
    await mockPriceFeed1.incrementRoundAndSetAnswer(newPrices[0]);
    await mockPriceFeed2.incrementRoundAndSetAnswer(newPrices[1]);
    await mockPriceFeed3.incrementRoundAndSetAnswer(newPrices[2]);

    // increase time to allow for full reward rate
    await provider.send('evm_increaseTime', [MAX_LOCK_PERIOD]);
    await provider.send('evm_mine', []);

    const benchmarkReturn = await getBenchmarkReturn(
      benchmarkWeights, // weights
      initialPrices, // prices at delegation/creation
      newPrices // current prices
    );

    const boostScale = await pollenDAO.getBoostingScale();
    const change: ExpectedReturn = await getExpectedPortfolioReturnBN(
      boostScale,
      weights, // weights
      initialPrices, // prices at delegation/creation
      newPrices, // current prices
      benchmarkReturn
    );

    ts = (await provider.getBlock('latest')).timestamp;
    priceFeeds.forEach((feed, index) => {
      feed.setUpdatedAt(ts);
    });

    await expect(pollenDAO.connect(user1)
      .closeAndWithdraw(amount, false)).to.emit(pollenDAO, 'WithdrawWithReward');
    await expect(pollenDAO.connect(delegator)
      .withdraw(user2.address, amountDelegated, false)).to.emit(pollenDAO, 'WithdrawWithReward');
  });

  it('Should prevent a user from voting with amount 0', async function () {
    const amount = BN.from('0');

    await expect(launcher.connect(user1).vote(amount, true)).to.be.revertedWith('Zero vote amount');

    const campaign = await launcher.campaigns(0);
    expect(campaign.totalApprove).to.be.equal(0);
  });

  it('Should allow a user to add to vote', async function () {
    const amount = BN.from('10').mul(BASE_18);

    await launcher.connect(user1).vote(amount, true);
    await launcher.connect(user1).vote(amount, true);

    const campaign = await launcher.campaigns(0);
    expect(campaign.totalApprove).to.be.equal(amount.mul(2));
  });

  it('Should prevent a user from reusing vote in the same campaign', async function () {
    const amount = BN.from('10').mul(BASE_18);

    await launcher.connect(user1).vote(amount, true);
    const campaign = await launcher.campaigns(0);

    await expect(launcher.connect(user1).reUseVotes(true)).to.be.revertedWith('Already reused tokens');
    expect(campaign.totalApprove).to.be.equal(amount);
  });

  it('Should prevent a users from claiming tokens when vote is not expired', async function () {
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);

    const contractBalance = await pollenToken.balanceOf(launcher.address);
    expect(contractBalance).to.be.equal(amount);

    await expect( launcher.connect(user1).claimTokens()).to.be.revertedWith('User vote is active');
  });

  it('Should prevent a user from claiming twice', async function () {
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    await launcher.connect(user2).vote(amount, true);
    await launcher.connect(user3).vote(amount, true);

    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    await launcher.connect(user1).claimTokens();

    await expect(launcher.connect(user1).claimTokens()).to.be.revertedWith('No tokens to claim');
  });

  it('Should mark a campaign as false if it didn\'t pass', async function () {
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    await launcher.connect(user2).vote(amount, false);
    await launcher.connect(user3).vote(amount, false);

    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    const ts = (await provider.getBlock('latest')).timestamp;
    const priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];
    priceFeeds.forEach((feed, index) => {
      feed.setUpdatedAt(ts);
    });

    await launcher.validateCampaign(0);

    const campaign = await launcher.campaigns(0);

    expect(campaign.passed).to.be.false;
    expect(campaign.executed).to.be.true;
  });

  it('Should allow a user to claim tokens for a new campaign that the user didn\'t participate in', async function () {
    const amount = BN.from('10').mul(BASE_18);
    await launcher.connect(user1).vote(amount, true);
    await launcher.connect(user2).vote(amount, false);
    await launcher.connect(user3).vote(amount, false);

    let contractBalance = await pollenToken.balanceOf(launcher.address);

    expect(contractBalance).to.be.equal(amount.mul(3));

    await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
    await provider.send('evm_mine', []);

    const ts = (await provider.getBlock('latest')).timestamp;
    const priceFeeds = [mockPriceFeed1, mockPriceFeed2, mockPriceFeed3];
    priceFeeds.forEach((feed, index) => {
      feed.setUpdatedAt(ts);
    });

    await launcher.validateCampaign(0);
    await launcher.startCampaign();

    await launcher.connect(user3).reUseVotes(false);

    await launcher.connect(user1).claimTokens();
    await expect(launcher.connect(user3).claimTokens()).to.be.revertedWith('User vote is active');

    contractBalance = await pollenToken.balanceOf(launcher.address);

    expect(contractBalance).to.be.equal(amount.mul(2));
  });

});
