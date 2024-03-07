import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { BigNumber as BN } from 'ethers';

import {
  IPollenDAO,
  PollenToken,
  MockGovGetters,
  Governance,
  MockGovProposal,
  MockModule,
  MockGetters,
  LockedPollen
} from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { getSelectors } from './helpers/functions';
import { BytesLike } from 'ethers';
import { deployContracts } from './helpers/setup';
import { getVotingPower } from './helpers/calculations';

const { solidity } = waffle;
chai.use(solidity);

const provider = waffle.provider;

describe('Governance', async function () {
  let pollenDAO: IPollenDAO;
  let pollenToken: PollenToken;
  let vePLN: LockedPollen;
  let mockGetters: MockGovGetters;
  let mockGettersSelectors: BytesLike[];
  let mockDAOGetters: MockGetters;
  let mockDAOGetterSelectors: BytesLike[];
  let mockGovProposal: MockGovProposal;
  let mockModule: MockModule;
  let mockModuleSelectors: BytesLike[];
  let snapshot: string;

  const quorum = 100;
  const timeLock = 1000;
  const votingPeriod = 1000;
  const allowance = '100000000000000000000';

  const [
    admin,
    user1,
    user2
  ] = provider.getWallets();

  before(async () => {
    const contracts = await deployContracts(admin.address);
    pollenDAO = contracts.pollenDAO;
    pollenToken = contracts.pollenToken;
    vePLN = contracts.vePLN;

    const MockGetters = await ethers.getContractFactory('MockGovGetters');
    mockGetters = await MockGetters.deploy() as MockGovGetters;
    await mockGetters.deployed();

    const DAOMockGetters = await ethers.getContractFactory('MockGetters');
    mockDAOGetters = await DAOMockGetters.deploy() as MockGetters;
    await mockDAOGetters.deployed();

    const MockModule = await ethers.getContractFactory('MockModule');
    mockModule = await MockModule.deploy() as MockModule;
    await mockModule.deployed();

    // Get module selectors
    mockModuleSelectors = getSelectors(MockModule.interface);
    mockGettersSelectors = getSelectors(MockGetters.interface);
    mockDAOGetterSelectors = getSelectors(DAOMockGetters.interface);

    const MockGovProposal = await ethers.getContractFactory('MockGovProposal');
    mockGovProposal = await MockGovProposal.deploy(pollenDAO.address, mockModule.address, mockModuleSelectors) as MockGovProposal;
    await mockGovProposal.deployed();

    // Add modules
    await pollenDAO.addModule(mockGetters.address, mockGettersSelectors);
    await pollenDAO.addModule(mockDAOGetters.address, mockDAOGetterSelectors);

    await pollenToken.transfer(user1.address, allowance);
    await pollenToken.transfer(user2.address, allowance);
    await pollenToken.connect(user1).approve(pollenDAO.address, allowance);
    await pollenToken.connect(user2).approve(pollenDAO.address, allowance);
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });
  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('setQuorum', async () => {
    it('Should revert if not called by an admin', async () => {
      await expect(pollenDAO.connect(user1).setQuorum(100)).to.be.revertedWith('Admin access required');
    });
    it('Should revert if percentage is too low', async () => {
      await expect(pollenDAO.connect(admin).setQuorum(2000)).to.be.revertedWith('Invalid percentage');
    });
    it('Should correctly update the quorum', async () => {
      await pollenDAO.connect(admin).setQuorum(quorum);

      const quorumFromGetters = await pollenDAO.connect(admin).getQuorum();
      expect(quorumFromGetters).to.equal(quorum);
    });
    it('Should emit QuorumChanged event', async () => {
      await expect(pollenDAO.connect(admin).setQuorum(quorum)).to.emit(pollenDAO, 'QuorumChanged');
    });
  });

  describe('setTimeLock', async () => {
    it('Should revert if not called by an admin', async () => {
      await expect(pollenDAO.connect(user1).setTimeLock(timeLock)).to.be.revertedWith('Admin access required');
    });
    it('Should correctly update the time lock', async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock);

      const timeLockFromGetters = await pollenDAO.getTimeLock();
      expect(timeLockFromGetters).to.equal(timeLock);
    });
    it('Should emit TimeLockChanged event', async () => {
      await expect(pollenDAO.connect(admin).setTimeLock(timeLock)).to.emit(pollenDAO, 'TimeLockChanged');
    });
  });

  describe('setVotingPeriod', async () => {
    it('Should revert if not called by an admin', async () => {
      await expect(pollenDAO.connect(user1).setVotingPeriod(votingPeriod)).to.be.revertedWith('Admin access required');
    });
    it('Should correctly update the voting period', async () => {
      await pollenDAO.connect(admin).setVotingPeriod(votingPeriod);

      const votingPeriodFromGetters = await pollenDAO.getVotingPeriod();
      expect(votingPeriodFromGetters).to.equal(votingPeriod);
    });
    it('Should emit VotingPeriodChanged event', async () => {
      await expect(pollenDAO.connect(admin).setVotingPeriod(votingPeriod)).to.emit(pollenDAO, 'VotingPeriodChanged');
    });
  });

  describe('submitProposal', async () => {
    it('Should revert if time lock is not set', async () => {
      await expect(pollenDAO.connect(user1).submitProposal(mockGovProposal.address))
        .to.be.revertedWith('TimeLock not set');
    });
    it('Should revert if voting period is not set', async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock);

      await expect(pollenDAO.connect(user1).submitProposal(mockGovProposal.address))
        .to.be.revertedWith('Voting period not set');
    });
    it('Should revert if quorum is not set', async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock);
      await pollenDAO.connect(admin).setVotingPeriod(votingPeriod);

      await expect(pollenDAO.connect(user1).submitProposal(mockGovProposal.address))
        .to.be.revertedWith('Quorum not set');
    });
    it('Should submit a new proposal', async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock);
      await pollenDAO.connect(admin).setVotingPeriod(votingPeriod);
      await pollenDAO.connect(admin).setQuorum(quorum);
      await pollenDAO.connect(user1).submitProposal(mockGovProposal.address);

      const proposalFromGetters = await pollenDAO.getProposal(0);

      expect(proposalFromGetters[0]).to.equal(user1.address);
      expect(proposalFromGetters[1]).to.equal(mockGovProposal.address);
      expect(proposalFromGetters[2]).to.equal(0);
      expect(proposalFromGetters[3]).to.equal(0);
    });
    it('Should emit NewProposal event', async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock);
      await pollenDAO.connect(admin).setVotingPeriod(votingPeriod);
      await pollenDAO.connect(admin).setQuorum(quorum);

      await expect(pollenDAO.connect(user1).submitProposal(mockGovProposal.address))
        .to.emit(pollenDAO, 'NewProposal');
    });
  });

  describe('voteProposal', async () => {
    const proposalId = 0;
    let lockEnd: string;
    let timeStamp: number;

    beforeEach(async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock);
      await pollenDAO.connect(admin).setVotingPeriod(votingPeriod);
      await pollenDAO.connect(admin).setQuorum(quorum);
      await pollenDAO.connect(user1).submitProposal(user2.address);

      timeStamp = (await ethers.provider.getBlock('latest')).timestamp;

      await pollenToken.connect(user1).approve(vePLN.address, allowance);
      await pollenToken.connect(user2).approve(vePLN.address, allowance);

      lockEnd = (timeStamp + 365 * 24 * 60 * 60).toString();

      await vePLN.connect(user1).lock(allowance, lockEnd);
      await vePLN.connect(user2).lock(allowance, lockEnd);
    });
    it('Should revert if the proposal is expired', async () => {
      await ethers.provider.send('evm_increaseTime', [100000]);

      await expect(pollenDAO.connect(user1).voteProposal(proposalId, true)).to.be.revertedWith('Proposal expired');
    });
    it('Should adjust the vote amounts', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, true);
      timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      const votingPower1 = getVotingPower(BN.from(timeStamp), BN.from(lockEnd), BN.from(allowance));

      await pollenDAO.connect(user2).voteProposal(proposalId, false);
      timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      const votingPower2 = getVotingPower(BN.from(timeStamp), BN.from(lockEnd), BN.from(allowance));

      const proposalFromGetters = await pollenDAO.getProposal(proposalId);

      expect(proposalFromGetters[2]).to.equal(votingPower1.toString());
      expect(proposalFromGetters[3]).to.equal(votingPower2.toString());
    });
    it('Should mark a user as having voted', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, true);
      expect(await pollenDAO.hasUserVoted(user1.address, proposalId)).to.be.true;
      expect(await pollenDAO.hasUserVoted(user2.address, proposalId)).to.be.false;
    });
    it('Should revert if a user votes more then once', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, true);

      await expect(pollenDAO.connect(user1).voteProposal(proposalId, false))
        .to.be.revertedWith('User has voted already');
    });
    it('Should emit Voted event', async () => {
      await expect(pollenDAO.connect(user1).voteProposal(proposalId, false)).to.emit(pollenDAO, 'Voted');
    });
  });
  describe('executeProposal', async () => {
    const proposalId = 0;
    beforeEach(async () => {
      await pollenDAO.connect(admin).setTimeLock(timeLock + 1000);
      await pollenDAO.connect(admin).setVotingPeriod(votingPeriod);
      await pollenDAO.connect(admin).setQuorum(quorum/2);

      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await pollenToken.connect(user1).approve(vePLN.address, allowance);
      await pollenToken.connect(user2).approve(vePLN.address, allowance);

      const lockEnd = (timeStamp + 100 * 24 * 60 * 60).toString();

      await vePLN.connect(user1).lock(allowance, lockEnd);
      await vePLN.connect(user2).lock(allowance, lockEnd);

      await pollenDAO.connect(user1).submitProposal(mockGovProposal.address);
    });
    it('Should revert if voting is still active', async () => {
      await expect(pollenDAO.connect(user2).executeProposal(proposalId)).to.be.revertedWith('Voting active');
    });
    it('Should revert if time lock is active', async () => {
      await ethers.provider.send('evm_increaseTime', [1500]);
      await expect(pollenDAO.connect(user2).executeProposal(proposalId)).to.be.revertedWith('Time lock active');
    });
    it('Should revert if the voting has not reached quorum', async () => {
      await ethers.provider.send('evm_increaseTime', [3050]);
      await expect(pollenDAO.connect(user2).executeProposal(proposalId)).to.be.revertedWith('Not passed');
    });
    it('Should revert if the proposal has not passed', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, false);
      await ethers.provider.send('evm_increaseTime', [3000]);
      await expect(pollenDAO.connect(user2).executeProposal(proposalId)).to.be.revertedWith('Not passed');
    });
    it('Should revert if the proposal has more no votes', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, false);
      await ethers.provider.send('evm_increaseTime', [3000]);
      await expect(pollenDAO.connect(user2).executeProposal(proposalId)).to.be.revertedWith('Not passed');
    });
    it('Should deregister the executor as an admin', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, true);
      await pollenDAO.connect(user2).voteProposal(proposalId, true);
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await ethers.provider.send('evm_increaseTime', [timeStamp + 1000000]);
      await pollenDAO.connect(user2).executeProposal(proposalId);

      const isAdmin = await pollenDAO.isAdmin(user2.address);
      expect(isAdmin).to.be.false;
    });
    it('Should correctly register the new module', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, true);
      await pollenDAO.connect(user2).voteProposal(proposalId, true);
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await ethers.provider.send('evm_increaseTime', [timeStamp + 1000000]);
      await pollenDAO.connect(user2).executeProposal(proposalId);

      await expect(pollenDAO.isRegisteredModule(mockModule.address, mockModuleSelectors));
    });
    it('Should emit ModuleAdded event', async () => {
      await pollenDAO.connect(user1).voteProposal(proposalId, true);
      await pollenDAO.connect(user2).voteProposal(proposalId, true);
      const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
      await ethers.provider.send('evm_increaseTime', [timeStamp + 1000000]);

      await expect(pollenDAO.connect(user2).executeProposal(proposalId))
        .to.emit(pollenDAO, 'ModuleAdded');
    });
  });
});
