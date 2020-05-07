import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, VoterState, Artifacts } from './consts';

export const vote = () => contract('proposal voting', function ([deployer, bob, alice, carol]) {
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
        await this.daoToken.transfer(bob, 99, { from: deployer });
        await this.daoToken.transfer(alice, 1, { from: deployer });
        await this.assetToken.transfer(bob, 2, { from: deployer });
    });

    it('should fail when voting on proposal 0', function () {
        expectRevert(
            this.dao.voteOn(0, false, { from: bob }),
            'invalid proposal status'
        );
    });

    it('should fail when voting on a proposal that has not been submitted', function () {
        expectRevert(
            this.dao.voteOn(1, false, { from: bob }),
            'invalid proposal id'
        );
    });

    it('should fail when voting on a proposal that has been executed', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        await this.dao.execute(1, { from: bob });
        expectRevert(
            this.dao.voteOn(1, false),
            'invalid proposal status'
        );
    });

    it('should fail when voting on a proposal that has expired voting', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.voteOn(1, false, { from: bob }),
            'vote expired'
        );
    });

    it('should fail when voting on a proposal if voter has DAO token balance 0', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        expectRevert(
            this.dao.voteOn(1, false, { from: carol }),
            'no voting tokens'
        );
    });

    it('should automatically vote yes on submitter\'s own proposal', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
    });

    it('should increase yes votes by voter DAO token balance when voting yes', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        let receipt;
        receipt = await this.dao.voteOn(1, true, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(1, true, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

    it('should increase no votes by voter DAO token balance when voting no', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        let receipt;
        receipt = await this.dao.voteOn(1, false, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(1, false, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

    it('should prevent same voter from double voting yes', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        // automatic vote by submitter
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        //
        let receipt;
        // no increase on double voting yes
        receipt = await this.dao.voteOn(1, true, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // increase as usual when another account votes
        receipt = await this.dao.voteOn(1, true, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // no increase when that same other account double votes yes
        receipt = await this.dao.voteOn(1, true, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
    });

    it('should prevent same voter from double voting no', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        // automatic vote by submitter
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        //
        let receipt;
        // change vote from yes to no
        receipt = await this.dao.voteOn(1, false, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // prevent submitter from double voting no
        receipt = await this.dao.voteOn(1, false, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // increase as usual when another account votes
        receipt = await this.dao.voteOn(1, false, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // no increase when that same other account double votes no
        receipt = await this.dao.voteOn(1, false, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
    });

    it('should allow voter to change vote from yes to no', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal, vote;
        proposal = await this.dao.getProposal(1);
        vote = await this.dao.getVoterState(1, { from: bob });
        expect(vote).to.be.bignumber.equal(VoterState.VotedYes);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        // automatic vote by submitter
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        //
        let receipt;
        // change vote from yes to no
        receipt = await this.dao.voteOn(1, false, { from: bob });
        vote = await this.dao.getVoterState(1, { from: bob });
        expect(vote).to.be.bignumber.equal(VoterState.VotedNo);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // same behavior when another account votes
        vote = await this.dao.getVoterState(1, { from: alice });
        expect(vote).to.be.bignumber.equal(VoterState.Null);
        receipt = await this.dao.voteOn(1, true, { from: alice });
        vote = await this.dao.getVoterState(1, { from: alice });
        expect(vote).to.be.bignumber.equal(VoterState.VotedYes);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(new BN('1'));
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(1, false, { from: alice });
        vote = await this.dao.getVoterState(1, { from: alice });
        expect(vote).to.be.bignumber.equal(VoterState.VotedNo);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
    });

    it('should allow voter to change vote from no to yes', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal, vote;
        proposal = await this.dao.getProposal(1);
        vote = await this.dao.getVoterState(1, { from: bob });
        expect(vote).to.be.bignumber.equal(VoterState.VotedYes);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        // automatic vote by submitter
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        //
        let receipt;
        // change vote from yes to no
        receipt = await this.dao.voteOn(1, false, { from: bob });
        vote = await this.dao.getVoterState(1, { from: bob });
        expect(vote).to.be.bignumber.equal(VoterState.VotedNo);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // change vote from no to yes again
        receipt = await this.dao.voteOn(1, true, { from: bob });
        vote = await this.dao.getVoterState(1, { from: bob });
        expect(vote).to.be.bignumber.equal(VoterState.VotedYes);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
        // same behavior when another account votes
        vote = await this.dao.getVoterState(1, { from: alice });
        expect(vote).to.be.bignumber.equal(VoterState.Null);
        receipt = await this.dao.voteOn(1, false, { from: alice });
        vote = await this.dao.getVoterState(1, { from: alice });
        expect(vote).to.be.bignumber.equal(VoterState.VotedNo);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal(new BN('1'));
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(1, true, { from: alice });
        vote = await this.dao.getVoterState(1, { from: alice });
        expect(vote).to.be.bignumber.equal(VoterState.VotedYes);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        //
    });
});
