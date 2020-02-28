const AudacityToken = artifacts.require("AudacityToken");
const AudacityDAO = artifacts.require('AudacityDAO');
const { expect } = require('chai');
const { expectRevert, expectEvent, time, BN } = require('@openzeppelin/test-helpers');

// TODO: use {from: accounts[index]} to split function calling among accounts
// TODO: mint tokens for accounts to add better voting tests

contract('dao', function (accounts) {
    beforeEach(async function () {
        this.daoToken = await AudacityToken.new();
        this.dao = await AudacityDAO.new(this.daoToken.address);
    });

    it('should fail when ETH sent to the DAO', function () {
        expectRevert.unspecified(
            this.dao.send('1')
        );
    });

//===== SUBMIT =====

    it('should fail when submitting a proposal with token address 0x0', function () {
        expectRevert(
            this.dao.submit(0, 0, '0x0000000000000000000000000000000000000000', 0, 0),
            'invalid token address'
        );
    });

    it('should fail when submitting a proposal with both token amount and DAO token amount 0', function () {
        expectRevert(
            this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 0, 0),
            'both token amount and DAO token amount zero'
        );
    });

    it('should fail when submitting a proposal with an invalid proposal type', function () {
        expectRevert(
            this.dao.submit(2, 0, '0x0000000000000000000000000000000000000001', 2, 3),
            'invalid proposal type'
        );
    });

    it('should fail when submitting a proposal with an invalid token type', function () {
        expectRevert(
            this.dao.submit(0, 1, '0x0000000000000000000000000000000000000001', 2, 3),
            'invalid token type'
        );
    });

    it('should create a new proposal when submitting a proposal', async function () {
        const receipt = await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        const proposal = await this.dao.getProposal(0);
        expect(proposal.proposalType).to.be.bignumber.equal('0');
        expect(proposal.tokenType).to.be.bignumber.equal('0');
        expect(proposal.tokenAddress).to.be.equal('0x0000000000000000000000000000000000000001');
        expect(proposal.tokenAmount).to.be.bignumber.equal('2');
        expect(proposal.daoTokenAmount).to.bignumber.be.equal('3');
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        const now = await time.latest();
        const expiryDelay = new BN('60000');
        expect(proposal.votingExpiry).to.be.bignumber.equal(now.add(expiryDelay));
        expect(proposal.executionExpiry).to.be.bignumber.equal(now.add(expiryDelay).add(expiryDelay));
        expect(proposal.status).to.be.bignumber.equal('1');
        expect(await this.dao.getProposalCount()).to.be.bignumber.equal('1');
        expectEvent(
            receipt,
            'Submitted'
        );
    });

//===== VOTE ON =====

    it('should fail when voting on a proposal that has not been submitted', function () {
        expectRevert(
            this.dao.voteOn(0, false),
            'invalid proposal id'
        );
    });

    it('should be able to vote on a proposal: yes votes', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        const receipt = await this.dao.voteOn(0, true);
        const tokenBalance = await this.daoToken.balanceOf(accounts[0]);
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal(tokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

    it('should be able to vote on a proposal: no votes', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        const receipt = await this.dao.voteOn(0, false);
        const tokenBalance = await this.daoToken.balanceOf(accounts[0]);
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(tokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

    // TODO: make test green
    it('should be able to resolve voting on a proposal once voting expires: passed', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('1');
        await this.dao.voteOn(0, true);
        await time.increaseTo(proposal.votingExpiry);
        const receipt = await this.dao.resolveVote(0);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('2');
        expectEvent(
            receipt,
            'Passed'
        );
    });

    it('should be able to resolve voting on a proposal once voting expires: failed', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('1');
        await this.dao.voteOn(0, false);
        await time.increaseTo(proposal.votingExpiry);
        const receipt = await this.dao.resolveVote(0);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('3');
        expectEvent(
            receipt,
            'Failed'
        );
    });

    // TODO: make test green
    it('should resolve voting when trying to vote after voting expiry period', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('1');
        await this.dao.voteOn(0, true);
        await time.increaseTo(proposal.votingExpiry);
        const receipt = await this.dao.voteOn(0, true);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('2');
        expectEvent(
            receipt,
            'Passed'
        );
    });

    it('should not be able to resolve voting before voting period is over', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('1');
        await this.dao.voteOn(0, true);
        await this.dao.resolveVote(0);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('1');
    });

    // TODO: make test green
    it('should be able to execute a proposal', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        await this.dao.voteOn(0, true);
        await time.increaseTo(proposal.votingExpiry);
        await this.dao.resolveVote(0)
        const receipt = await this.dao.execute(0);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('4');
        expectEvent(
            receipt,
            'Executed'
        );
    });

    // TODO: make test green
    it('should be able to execute a proposal without explicitly calling to resolve voting', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        await this.dao.voteOn(0, true);
        await time.increaseTo(proposal.votingExpiry);
        const receipt = await this.dao.execute(0);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('4');
        expectEvent(
            receipt,
            'Executed'
        );
    });

    // TODO: make test green
    it('should cause a proposal to expire when trying to execute beyond execution expiry period', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal = await this.dao.getProposal(0);
        await this.dao.voteOn(0, true);
        await time.increaseTo(proposal.executionExpiry);
        await this.dao.resolveVote(0)
        const receipt = await this.dao.execute(0);
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('5');
        expectEvent(
            receipt,
            'Expired'
        );
    });

    it('should fail to execute a failed proposal', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        const proposal = await this.dao.getProposal(0);
        await this.dao.voteOn(0, false);
        await time.increaseTo(proposal.votingExpiry);
        await this.dao.resolveVote(0)
        expectRevert(
            this.dao.execute(0),
            'invalid proposal status'
        );
    });

    it('should fail to execute a proposal before voting expires', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        const proposal = await this.dao.getProposal(0);
        await this.dao.voteOn(0, true);
        await this.dao.resolveVote(0)
        expectRevert(
            this.dao.execute(0),
            'invalid proposal status'
        );
    });
});
