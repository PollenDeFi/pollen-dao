import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, ProposalStatus, address0, Artifacts } from './consts';

contract('proposal execution', function ([deployer, bob, alice, carol]) {
    beforeEach(async function () {
        this.dao = await Artifacts.AudacityDAO.new(30, 120, 180, 240, { from: deployer });
        const daoTokenAddress = await this.dao.getDaoTokenAddress();
        this.daoToken = await Artifacts.DAOToken.at(daoTokenAddress);
        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        this.assetToken.mint(999, { from: deployer });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, { from: deployer });
        const proposal = await this.dao.getProposal(0);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: deployer });
        await this.dao.execute(0, { from: deployer });
        await this.daoToken.transfer(bob, 100, { from: deployer });
        await this.assetToken.transfer(bob, 2, { from: deployer });
    });

    it('should fail when executing a proposal that has not been submitted', function () {
        expectRevert(
            this.dao.execute(1),
            'invalid proposal id'
        );
    });

    it('should fail when executing a proposal that has already been executed', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        await this.dao.execute(1, { from: bob });
        expectRevert(
            this.dao.execute(1, { from: bob }),
            'invalid proposal status'
        );
    });

    it('should fail when executing a proposal that has not yet expired voting', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        expectRevert(
            this.dao.execute(1),
            'vote not expired'
        );
    });

    it('should fail when executing a proposal that has not reached voting quorum', async function () {
        const quorum = await this.dao.getQuorum();
        await this.daoToken.transfer(alice, new BN('100').sub(quorum), { from: bob });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        expectRevert(
            this.dao.execute(1),
            'vote did not reach quorum'
        );
    });

    it('should succeed when executing a proposal if yes votes plus no votes exceed quorum', async function () {
        const quorum = await this.dao.getQuorum();
        await this.daoToken.transfer(alice, new BN('100').sub(quorum), { from: bob });
        await this.daoToken.transfer(carol, '1', { from: alice });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        await this.dao.voteOn(1, false, { from: carol });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        const receipt = await this.dao.execute(1, { from: bob });
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should fail when executing a proposal that has failed voting', async function () {
        await this.daoToken.transfer(alice, '51', { from: bob });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        await this.dao.voteOn(1, false, { from: alice });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        expectRevert(
            this.dao.execute(1),
            'vote failed'
        );
    });

    it('should fail when executing a proposal that is not open for execution', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.execute(1),
            'execution not open'
        );
    });

    it('should fail when executing a proposal that has expired execution', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionExpiry);
        expectRevert(
            this.dao.execute(1),
            'execution expired'
        );
    });

    it('should fail when executing a proposal from an account that is not the submitter', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        expectRevert(
            this.dao.execute(1, { from: alice }),
            'only submitter can execute'
        );
    });

    it('should fail when executing an invest proposal if the asset token can not be transferred', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        expectRevert.unspecified(
            this.dao.execute(1)
        );
    });

    it('should fail when executing a divest proposal if the DAO token can not be transferred', async function () {
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        expectRevert.unspecified(
            this.dao.execute(1)
        );
    });

    it('should transfer tokens when executing an invest proposal', async function () {
        const initialAssetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        const initialDaoTokenBalance = await this.daoToken.balanceOf(bob);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        const receipt = await this.dao.execute(1, { from: bob });
        const newAssetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(newAssetTokenBalance).to.be.bignumber.equal(initialAssetTokenBalance.add(new BN('2')));
        const newDaoTokenBalance = await this.daoToken.balanceOf(bob);
        expect(newDaoTokenBalance).to.be.bignumber.equal(initialDaoTokenBalance.add(new BN('3')));
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([this.assetToken.address]);
        proposal = await this.dao.getProposal(1);
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should transfer tokens when executing a divest proposal', async function () {
        const initialAssetTokenBalance = await this.assetToken.balanceOf(bob);
        const initialDaoTokenBalance = await this.daoToken.balanceOf(this.dao.address);
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.daoToken.approve(this.dao.address, 3, { from: bob });
        const receipt = await this.dao.execute(1, { from: bob });
        const newAssetTokenBalance = await this.assetToken.balanceOf(bob);
        expect(newAssetTokenBalance).to.be.bignumber.equal(initialAssetTokenBalance.add(new BN('2')));
        const newDaoTokenBalance = await this.daoToken.balanceOf(this.dao.address);
        expect(newDaoTokenBalance).to.be.bignumber.equal(initialDaoTokenBalance.add(new BN('3')));
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([address0]);
        proposal = await this.dao.getProposal(1);
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should continue to hold a partially divested asset', async function () {
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 1, 2, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.daoToken.approve(this.dao.address, 2, { from: bob });
        await this.dao.execute(1, { from: bob });
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([this.assetToken.address]);
    });
});
