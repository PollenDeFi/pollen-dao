import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, VoterState, Artifacts } from './consts';

contract('proposal voting', function ([deployer, bob, alice, carol, dave]) {
    beforeEach(async function () {
        this.dao = await Artifacts.AudacityDAO.new(30, 120, 180, 240, { from: deployer });
        const daoTokenAddress = await this.dao.getDaoTokenAddress();
        this.daoToken = await Artifacts.DAOToken.at(daoTokenAddress);
        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        this.assetToken.mint(999, { from: deployer });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 102, { from: deployer });
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

    // Using Snapshots:

    it('should prevent same voter with different balance from double voting no', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);

        // automatic vote by submitter
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');

        // change vote from yes to no
        let receipt = await this.dao.voteOn(1, false, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );

        // no increase on double voting no with increased balance
        await this.daoToken.transfer(bob, 1, { from: deployer });
        await this.dao.voteOn(1, false, { from: bob });
        proposal = await this.dao.getProposal(1);

        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
    });

    it('should prevent same voter with different balance from double voting yes', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        let proposal;
        proposal = await this.dao.getProposal(1);
        const daoTokenBalance = await this.daoToken.balanceOf(bob);

        // automatic vote by submitter
        expect(daoTokenBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');

        // no increase on double voting yes with increased balance
        await this.daoToken.transfer(bob, 1, { from: deployer });
        await this.dao.voteOn(1, true, { from: bob });
        proposal = await this.dao.getProposal(1);

        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
    });

    it('should prevent double voting by token shuffling', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const firstBalance = await this.daoToken.balanceOf(bob);
        const proposal = await this.dao.getProposal(1);

        expect(firstBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(firstBalance);

        await this.daoToken.transfer(carol, firstBalance, { from: bob });

        let secondBalance = await this.daoToken.balanceOf(carol);

        expect(secondBalance).to.be.bignumber.equal(firstBalance);
        await expectRevert(
            this.dao.voteOn(1, true, { from: carol }),
            'no voting tokens'
        );
    });

    it('should not increase votes when shuffling tokens and changing vote', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const firstBalance = await this.daoToken.balanceOf(bob);

        expect(firstBalance).to.be.bignumber.greaterThan('0');

        await this.dao.voteOn(1, false, { from: alice }),
            await this.daoToken.transfer(alice, firstBalance, { from: bob });
        await this.dao.voteOn(1, true, { from: alice });

        const proposal = await this.dao.getProposal(1);

        expect(proposal.yesVotes).to.be.bignumber.equal(firstBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
    });

    it('should prevent double voting by token shuffling across multiple accounts including non-empty', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const firstBalance = await this.daoToken.balanceOf(bob);
        let proposal;
        proposal = await this.dao.getProposal(1);

        expect(firstBalance).to.be.bignumber.greaterThan('0');
        expect(proposal.yesVotes).to.be.bignumber.equal(firstBalance);

        // voting from an originally non-empty account after sending it tokens from submitter
        const alicesBalanceBefore = await this.daoToken.balanceOf(alice);
        expect(alicesBalanceBefore).to.be.bignumber.greaterThan('0');
        await this.daoToken.transfer(alice, new BN('20'), { from: bob });
        const alicesBalanceAfter = await this.daoToken.balanceOf(alice);
        expect(alicesBalanceAfter).to.be.bignumber.equal(alicesBalanceBefore.add(new BN('20')));
        await this.dao.voteOn(1, true, { from: alice });

        // voting from an originally empty account after sending it tokens from submitter
        await this.daoToken.transfer(carol, new BN('30'), { from: bob });
        const carolsBalance = await this.daoToken.balanceOf(carol);
        expect(carolsBalance).to.be.bignumber.equal('30');
        await expectRevert(
            this.dao.voteOn(1, true, { from: carol }),
            'no voting tokens'
        );

        // voting from an originally empty account after sending it tokens from non-submitter
        await this.daoToken.transfer(dave, new BN('1'), { from: deployer });
        const davesBalanceBefore = await this.daoToken.balanceOf(dave);
        expect(davesBalanceBefore).to.be.bignumber.equal('1');
        await expectRevert(
            this.dao.voteOn(1, true, { from: dave }),
            'no voting tokens'
        );

        // vote again from same account after sending it tokens from submitter
        await this.daoToken.transfer(dave, new BN('9'), { from: bob });
        const davesBalanceAfter = await this.daoToken.balanceOf(dave);
        expect(davesBalanceAfter).to.be.bignumber.equal(davesBalanceBefore.add(new BN('9')));
        await expectRevert(
            this.dao.voteOn(1, true, { from: dave }),
            'no voting tokens'
        );

        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(firstBalance.add(alicesBalanceBefore));

        // Change votes from yes to no gradually
        await this.dao.voteOn(1, false, { from: bob });
        proposal = await this.dao.getProposal(1);
        expect(proposal.noVotes).to.be.bignumber.equal(firstBalance);

        await this.dao.voteOn(1, false, { from: alice });
        proposal = await this.dao.getProposal(1);
        expect(proposal.noVotes).to.be.bignumber.equal(firstBalance.add(alicesBalanceBefore));

        await expectRevert(
            this.dao.voteOn(1, false, { from: carol }),
            'no voting tokens'
        );
        await expectRevert(
            this.dao.voteOn(1, false, { from: dave }),
            'no voting tokens'
        );

        proposal = await this.dao.getProposal(1);
        expect(proposal.noVotes).to.be.bignumber.equal(firstBalance.add(alicesBalanceBefore));
    });
});