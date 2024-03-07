import chai from 'chai';
import { ethers, waffle } from 'hardhat';

import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
import { ILeagues, Leagues, LeaguesProxy, PollenToken } from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

describe('Leagues', function () {
  let snapshot: string;
  let leagues: ILeagues;
  let testPLN: PollenToken;
  let leaguesProxy: LeaguesProxy;
  const leagueURI = 'https://pollen.id/';
  const leagueName1 = 'Test League 1';
  const leagueName2 = 'Test League 2';
  const amount = ethers.utils.parseEther('100');
  const lockAmount = ethers.utils.parseEther('10');
  const leagueId1: BigNumber = BigNumber.from(1);
  const leagueId2: BigNumber = BigNumber.from(2);

  const [deployer, proxyAdmin, admin1, adminNew1, admin2, adminNew2, member1, member2, nonMember] =
    provider.getWallets();

  before(async () => {
    snapshot = await createSnapshot();
  });

  after(async () => {
    await revertToSnapshot(snapshot);
  });

  beforeEach(async () => {
    // Deploy Test Pollen Token
    const PollenToken = await ethers.getContractFactory('PollenToken');
    testPLN = (await PollenToken.deploy(deployer.address)) as PollenToken;
    await testPLN.deployed();

    // Deploy Leagues
    const Leagues = await ethers.getContractFactory('Leagues');
    const l = (await Leagues.deploy()) as ILeagues;
    await l.deployed();

    // Deploy Proxy
    const LeaguesProxy = await ethers.getContractFactory('LeaguesProxy');
    const leaguesProxy = (await LeaguesProxy.deploy(l.address, proxyAdmin.address, '0x')) as ILeagues;
    await leaguesProxy.deployed();

    leagues = (await ethers.getContractAt('ILeagues', leaguesProxy.address)) as ILeagues;
    await leagues.connect(deployer).initialize(leagueURI, testPLN.address);
  });

  describe('createLeague', function () {
    it('Should revert if PLN transfer failed because the amount exceeds balance', async () => {
      await expect(leagues.connect(admin1).createLeague(leagueName1)).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance'
      );
    });

    it('Should revert if PLN transfer failed because the amount exceeds allowance', async () => {
      await testPLN.connect(deployer).transfer(admin1.address, amount);
      await expect(leagues.connect(admin1).createLeague(leagueName1)).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance'
      );
    });

    it("Should succeed and emit 'NewLeague' event if non-admin account create a league with PLN balance", async function () {
      await (await testPLN.connect(admin1).approve(leagues.address, amount)).wait();
      await (await testPLN.connect(deployer).transfer(admin1.address, amount)).wait();

      const plnBalanceOfLeaguesBefore = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminBefore = await testPLN.balanceOf(admin1.address);

      await expect(leagues.connect(admin1).createLeague(leagueName1)).to.emit(leagues, 'NewLeague');

      const plnBalanceOfLeaguesAfter = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminAfter = await testPLN.balanceOf(admin1.address);

      expect(plnBalanceOfLeaguesAfter.sub(plnBalanceOfLeaguesBefore)).to.be.eq(lockAmount);
      expect(plnBalanceOfAdminBefore.sub(plnBalanceOfAdminAfter)).to.be.eq(lockAmount);

      const leaguesBalance = await leagues.balanceOf(admin1.address, leagueId1);
      expect(leaguesBalance.toNumber()).to.be.eq(1);
    });

    it('Should revert if admin account try to create another league', async () => {
      await (await testPLN.connect(admin1).approve(leagues.address, amount)).wait();
      await (await testPLN.connect(deployer).transfer(admin1.address, amount)).wait();
      await leagues.connect(admin1).createLeague(leagueName2);

      await expect(leagues.connect(admin1).createLeague(leagueName2)).to.be.revertedWith('user is already admin');
    });
  });

  describe('invite', function () {
    it('Should revert if non-admin account try to invite', async () => {
      await expect(leagues.connect(nonMember).invite([member1.address])).to.be.revertedWith('Only admins can invite');
    });

    it("Should succeed and emit 'Invited' events if admin account invite", async function () {
      await (await testPLN.connect(admin1).approve(leagues.address, amount)).wait();
      await (await testPLN.connect(deployer).transfer(admin1.address, amount)).wait();

      await leagues.connect(admin1).createLeague(leagueName1);
      await expect(leagues.connect(admin1).invite([member1.address])).to.emit(leagues, 'Invited');
    });
  });

  describe('joinLeague', function () {
    it('Should revert if non-invited account try to join', async () => {
      await expect(leagues.connect(nonMember).joinLeague(leagueId1)).to.be.revertedWith('User not approved to join');
    });

    it("Should succeed and emit 'JoinedLeague' event if invited account join", async function () {
      await (await testPLN.connect(admin1).approve(leagues.address, amount)).wait();
      await (await testPLN.connect(deployer).transfer(admin1.address, amount)).wait();

      await leagues.connect(admin1).createLeague(leagueName1);
      await leagues.connect(admin1).invite([member1.address]);

      await expect(leagues.connect(member1).joinLeague(leagueId1)).to.emit(leagues, 'JoinedLeague');

      const leaguesBalance = await leagues.balanceOf(member1.address, leagueId1);
      expect(leaguesBalance.toNumber()).to.be.eq(1);
    });

    it('Should revert if joined account try to join again', async () => {
      await expect(leagues.connect(member1).joinLeague(leagueId1)).to.be.revertedWith('User not approved to join');
    });
  });

  describe('leaveLeague', function () {
    it('Should revert if non-member account try to leave', async () => {
      await expect(leagues.connect(nonMember).leaveLeague(leagueId1)).to.be.revertedWith('Not a member');
    });

    it('Should revert if admin account try to leave', async () => {
      await (await testPLN.connect(admin1).approve(leagues.address, amount)).wait();
      await (await testPLN.connect(deployer).transfer(admin1.address, amount)).wait();

      await leagues.connect(admin1).createLeague(leagueName1);
      await expect(leagues.connect(admin1).leaveLeague(leagueId1)).to.be.revertedWith('Admins cannot leave league');
    });

    it("Should succeed and emit 'LeftLeague' event if member leave", async () => {
      await (await testPLN.connect(admin1).approve(leagues.address, amount)).wait();
      await (await testPLN.connect(deployer).transfer(admin1.address, amount)).wait();

      await leagues.connect(admin1).createLeague(leagueName1);
      await leagues.connect(admin1).invite([member1.address]);
      await leagues.connect(member1).joinLeague(leagueId1);

      await expect(leagues.connect(member1).leaveLeague(leagueId1)).to.emit(leagues, 'LeftLeague');
      const leaguesBalance = await leagues.balanceOf(member1.address, leagueId1);
      expect(leaguesBalance.toNumber()).to.be.eq(0);
    });

    it("Should succeed and emit 'LeftLeague' event if an admin trys leaving a league which the admin is only a member of", async () => {
      await testPLN.connect(deployer).transfer(adminNew1.address, amount);
      await testPLN.connect(adminNew1).approve(leagues.address, amount);

      await testPLN.connect(deployer).transfer(admin1.address, amount);
      await testPLN.connect(admin1).approve(leagues.address, amount);

      await leagues.connect(admin1).createLeague(leagueName1);
      await leagues.connect(adminNew1).createLeague(leagueName2);

      await leagues.connect(adminNew1).invite([admin1.address, member1.address]);
      await leagues.connect(admin1).joinLeague(leagueId2);
      await leagues.connect(member1).joinLeague(leagueId2);

      await expect(leagues.connect(admin1).leaveLeague(leagueId2)).to.emit(leagues, 'LeftLeague');
    });
  });

  describe('removeMembers', function () {
    beforeEach(async () => {
      await testPLN.connect(deployer).transfer(admin1.address, amount);
      await testPLN.connect(admin1).approve(leagues.address, amount);

      await leagues.connect(admin1).createLeague(leagueName1);
      await (await leagues.connect(admin1).invite([adminNew1.address, member1.address, member2.address])).wait();
      await (await leagues.connect(adminNew1).joinLeague(leagueId1)).wait();
      await (await leagues.connect(member1).joinLeague(leagueId1)).wait();
      await (await leagues.connect(member2).joinLeague(leagueId1)).wait();
    });

    it('Should revert if non-admin account try to remove members', async () => {
      // member, but not admin
      await expect(leagues.connect(adminNew1).removeMembers([member2.address])).to.be.revertedWith('Only admins');
      // not member and admin
      await expect(leagues.connect(nonMember).removeMembers([member2.address])).to.be.revertedWith('Only admins');
    });

    it("Should succeed and emit 'MemberRemoved' events if admin remove members", async function () {
      await expect(leagues.connect(admin1).removeMembers([member2.address])).to.emit(leagues, 'MemberRemoved');

      const leaguesBalance = await leagues.balanceOf(member2.address, leagueId1);
      expect(leaguesBalance.toNumber()).to.be.eq(0);
    });
  });

  describe('claimDeposit', function () {
    beforeEach(async () => {
      await testPLN.connect(deployer).transfer(admin1.address, amount);
      await testPLN.connect(admin1).approve(leagues.address, amount);
    });

    it('Should revert if non-admin account try to claim', async () => {
      // member, but not admin
      await expect(leagues.connect(member1).claimDeposit()).to.be.revertedWith('sender is not admin');
      // not member and admin
      await expect(leagues.connect(nonMember).claimDeposit()).to.be.revertedWith('sender is not admin');
    });

    it('Should revert if lock period is active', async () => {
      await leagues.connect(admin1).createLeague(leagueName1);
      await expect(leagues.connect(admin1).claimDeposit()).to.be.revertedWith('Lock period active');
    });

    it('Should succeed if lock period expired', async function () {
      await leagues.connect(admin1).createLeague(leagueName1);
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);

      const plnBalanceOfLeaguesBefore = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminBefore = await testPLN.balanceOf(admin1.address);

      await (await leagues.connect(admin1).claimDeposit()).wait();

      const plnBalanceOfLeaguesAfter = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminAfter = await testPLN.balanceOf(admin1.address);

      expect(plnBalanceOfLeaguesBefore.sub(plnBalanceOfLeaguesAfter)).to.be.eq(lockAmount);
      expect(plnBalanceOfAdminAfter.sub(plnBalanceOfAdminBefore)).to.be.eq(lockAmount);
    });

    it('Should revert if deposit already claimed', async () => {
      await leagues.connect(admin1).createLeague(leagueName1);
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
      await leagues.connect(admin1).claimDeposit();

      await expect(leagues.connect(admin1).claimDeposit()).to.be.revertedWith('deposit already claimed');
    });
  });

  describe('disable transfer', function () {
    it('Should revert if lock period is active', async () => {
      await expect(
        leagues.connect(admin1).safeTransferFrom(admin1.address, nonMember.address, leagueId1, 1, [])
      ).to.be.revertedWith('Token is not transferable');
    });
  });

  describe('transferAdminRole', function () {
    beforeEach(async () => {
      await (await testPLN.connect(deployer).transfer(admin2.address, amount)).wait();
      await (await testPLN.connect(admin2).approve(leagues.address, amount)).wait();
    });

    it('Should revert if non-admin account try to transfer admin role', async () => {
      await expect(leagues.connect(admin2).createLeague(leagueName1)).to.emit(leagues, 'NewLeague');

      await (await leagues.connect(admin2).invite([adminNew2.address])).wait();
      await (await leagues.connect(adminNew2).joinLeague(leagueId1)).wait();
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);

      // member, but not admin
      await expect(leagues.connect(member1).transferAdminRole(adminNew1.address)).to.be.revertedWith('Only admins');
      // not member and admin
      await expect(leagues.connect(nonMember).transferAdminRole(adminNew1.address)).to.be.revertedWith('Only admins');
    });

    it('Should revert if try to transfer admin role to admin of other league', async () => {
      await expect(leagues.connect(admin2).createLeague(leagueName1)).to.emit(leagues, 'NewLeague');

      await (await leagues.connect(admin2).invite([adminNew2.address])).wait();
      await (await leagues.connect(adminNew2).joinLeague(leagueId1)).wait();
      await testPLN.connect(deployer).transfer(admin1.address, amount);
      await testPLN.connect(admin1).approve(leagues.address, amount);

      await leagues.connect(admin1).createLeague(leagueName1);
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);

      await expect(leagues.connect(admin1).transferAdminRole(admin2.address)).to.be.revertedWith(
        'delegate is already admin'
      );
    });

    it("Should succeed and emit 'TransferAdminRole' event, but no changes in PLN balance if admin transfer admin role after claimed", async function () {
      const plnBalanceOfLeaguesBefore = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminBefore = await testPLN.balanceOf(admin2.address);

      await expect(leagues.connect(admin2).createLeague(leagueName1)).to.emit(leagues, 'NewLeague');

      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);

      await expect(leagues.connect(admin2).transferAdminRole(adminNew1.address)).to.emit(leagues, 'TransferAdminRole');

      const plnBalanceOfLeaguesAfter = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminAfter = await testPLN.balanceOf(admin2.address);

      expect(plnBalanceOfLeaguesBefore).to.be.eq(plnBalanceOfLeaguesAfter);
      expect(plnBalanceOfAdminAfter).to.be.eq(plnBalanceOfAdminBefore);
    });

    it('Should revert if lock period is active', async () => {
      await expect(leagues.connect(admin2).createLeague(leagueName1)).to.emit(leagues, 'NewLeague');
      await expect(leagues.connect(admin2).transferAdminRole(adminNew2.address)).to.be.revertedWith(
        'Lock period active'
      );
    });

    it("Should succeed, emit 'TransferAdminRole' event and PLN balance should be changed if admin transfer admin role before claimed", async function () {
      await expect(leagues.connect(admin2).createLeague(leagueName1)).to.emit(leagues, 'NewLeague');
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);

      const plnBalanceOfLeaguesBefore = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminBefore = await testPLN.balanceOf(admin2.address);

      await expect(leagues.connect(admin2).transferAdminRole(adminNew2.address)).to.emit(leagues, 'TransferAdminRole');

      const plnBalanceOfLeaguesAfter = await testPLN.balanceOf(leagues.address);
      const plnBalanceOfAdminAfter = await testPLN.balanceOf(admin2.address);

      expect(plnBalanceOfLeaguesBefore.sub(plnBalanceOfLeaguesAfter)).to.be.eq(lockAmount);
      expect(plnBalanceOfAdminAfter.sub(plnBalanceOfAdminBefore)).to.be.eq(lockAmount);
    });
  });
  describe('Proxy', async () => {
    let mockLeagues: ILeagues;
    beforeEach(async () => {
      const MockLeagues = await ethers.getContractFactory('MockLeagues');
      mockLeagues = (await MockLeagues.deploy()) as ILeagues;
      await mockLeagues.deployed();

      await testPLN.connect(deployer).transfer(admin1.address, amount);
      await testPLN.connect(admin1).approve(leagues.address, amount);

      await testPLN.connect(deployer).transfer(admin2.address, amount);
      await testPLN.connect(admin2).approve(leagues.address, amount);
    });

    it('Should revert if proxy admin calls a logic method', async () => {
      await expect(leagues.connect(proxyAdmin).removeMembers([member2.address])).to.revertedWith(
        'TransparentUpgradeableProxy: admin cannot fallback to proxy target'
      );
    });

    it('Should emit Upgraded when contract is upgraded', async () => {
      await expect(leagues.connect(proxyAdmin).upgradeTo(mockLeagues.address)).to.emit(leagues, 'Upgraded');
    });

    it('Should call mockLeagues contract after upgrading to it', async () => {
      await expect(leagues.connect(proxyAdmin).upgradeTo(mockLeagues.address)).to.emit(leagues, 'Upgraded');
      await expect(leagues.connect(admin1).createLeague('mock')).to.emit(leagues, 'LeftLeague');
    });

    it('Should persist state after upgrading contract', async () => {
      await leagues.connect(admin1).createLeague(leagueName1);
      await leagues.connect(admin2).createLeague(leagueName2);

      await expect(leagues.connect(proxyAdmin).upgradeTo(mockLeagues.address)).to.emit(leagues, 'Upgraded');

      const league1 = await leagues.leagues(1);
      expect(league1.name).to.equal('Test League 1');

      const league2 = await leagues.leagues(2);
      expect(league2.name).to.equal('Test League 2');
    });
  });
});
