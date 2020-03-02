const DAOToken = artifacts.require("DAOToken");
const AudacityDAO = artifacts.require('AudacityDAO');
const { expect } = require('chai');
const { expectRevert, expectEvent, time, BN } = require('@openzeppelin/test-helpers');

contract('dao', function (accounts) {
    beforeEach(async function () {
        this.dao = await AudacityDAO.new();
        this.daoToken = await DAOToken.new();
        await this.dao.setDaoTokenAddress(this.daoToken.address);
        // TODO: remove and mint from first proposal instead
        await this.daoToken.mint(100);
    });

    it('should fail when ETH sent to the DAO', function () {
        expectRevert.unspecified(
            this.dao.send('1')
        );
    });

    it('should set the owner of the DAO Token to be the DAO', async function () {
        const owner = await this.daoToken.owner();
        // TODO: expect(owner).to.be.equal(this.dao.address);
    });

    it('should fail if any non-DAO account sets the DAO Token address', function () {
        // TODO: expectRevert(
            //this.dao.setDaoTokenAddress(this.daoToken.address),
            //'TODO'
        //);
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

    it('should fail when voting on a proposal that has been executed', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        await this.dao.voteOn(0, true);
        const proposal= await this.dao.getProposal(0);
        await time.increaseTo(proposal.votingExpiry);
        await this.dao.execute(0);
        expectRevert(
            this.dao.voteOn(0, false),
            'invalid proposal status'
        );
    });

    it('should fail when voting on a proposal that has expired voting', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        const proposal= await this.dao.getProposal(0);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.voteOn(0, false),
            'vote expired'
        );
    });

    it('should fail when voting on a proposal if voter has DAO token balance 0', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        expectRevert(
            this.dao.voteOn(0, false, {from: accounts[1]}),
            'no voting tokens'
        );
    });

    it('should increase yes votes by voter DAO token balance when voting yes', async function () {
        await this.daoToken.transfer(accounts[1], 1);
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal= await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        let receipt;
        receipt = await this.dao.voteOn(0, true);
        const daoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(0, true, {from: accounts[1]});
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

    it('should increase no votes by voter DAO token balance when voting no', async function () {
        await this.daoToken.transfer(accounts[1], 1);
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        let proposal;
        proposal= await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        let receipt;
        receipt = await this.dao.voteOn(0, false);
        const daoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(0, false, {from: accounts[1]});
        proposal = await this.dao.getProposal(0);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

//===== EXECUTE =====

    it('should fail when executing a proposal that has not been submitted', function () {
        expectRevert(
            this.dao.execute(0),
            'invalid proposal id'
        );
    });

    it('should fail when executing a proposal that has already been executed', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        await this.dao.voteOn(0, true);
        const proposal= await this.dao.getProposal(0);
        await time.increaseTo(proposal.votingExpiry);
        await this.dao.execute(0);
        expectRevert(
            this.dao.execute(0),
            'invalid proposal status'
        );
    });

    it('should fail when executing a proposal that has not yet expired voting', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        expectRevert(
            this.dao.execute(0),
            'vote not expired'
        );
    });

    it('should fail when executing a proposal that has failed voting', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        const proposal= await this.dao.getProposal(0);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.execute(0),
            'vote failed'
        );
    });

    it('should fail when executing a proposal that has expired execution', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        await this.dao.voteOn(0, true);
        const proposal = await this.dao.getProposal(0);
        await time.increaseTo(proposal.executionExpiry);
        expectRevert(
            this.dao.execute(0),
            'execution expired'
        );
    });

    it('should transfer tokens when executing a proposal', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        await this.dao.voteOn(0, true);
        let proposal;
        proposal = await this.dao.getProposal(0);
        await time.increaseTo(proposal.votingExpiry);
        const receipt = await this.dao.execute(0);
        // TODO: token transfer check
        proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal('2');
        expectEvent(
            receipt,
            'Executed'
        );
    });
});
