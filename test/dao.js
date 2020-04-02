const AudacityDAO = artifacts.require('AudacityDAO');
const DAOToken = artifacts.require("DAOToken");
const AssetToken = artifacts.require("MockERC20");
const { expect } = require('chai');
const { expectRevert, expectEvent, time, BN } = require('@openzeppelin/test-helpers');

const ProposalType = { Invest: '0', Divest: '1', Last: '2' }
const TokenType = { ERC20: '0', Last: '1' }
const ProposalStatus = { Null: '0', Submitted: '1', Executed: '2', Last: '3' }

contract('dao', function (accounts) {
    beforeEach(async function () {
        this.dao = await AudacityDAO.new();
        const daoTokenAddress = await this.dao.getDaoTokenAddress();
        this.daoToken = await DAOToken.at(daoTokenAddress);
        this.assetToken = await AssetToken.new();
        this.assetToken.mint(999);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100);
        await this.assetToken.approve(this.dao.address, 2);
        await this.dao.execute(0);
    });

    it('should fail when ETH sent to the DAO', function () {
        expectRevert.unspecified(
            this.dao.send('1')
        );
    });

    it('should set the owner of the DAO Token to be the DAO', async function () {
        const owner = await this.daoToken.owner();
        expect(owner).to.be.equal(this.dao.address);
    });

    it('should have executed proposal 0 and received 2 asset tokens and minted and sent 100 DAO tokens', async function () {
        const proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        const assetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(assetTokenBalance).to.be.bignumber.equal('2');
        let daoTokenBalance;
        daoTokenBalance = await this.daoToken.balanceOf(this.dao.address);
        expect(daoTokenBalance).to.be.bignumber.equal('0');
        daoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        expect(daoTokenBalance).to.be.bignumber.equal('100');
    });

    //===== SUBMIT =====

    it('should fail when submitting a proposal with token address 0x0', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, '0x0000000000000000000000000000000000000000', 0, 0),
            'invalid asset token address'
        );
    });

    it('should fail when submitting a proposal with both token amount and DAO token amount 0', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 0, 0),
            'both asset token amount and DAO token amount zero'
        );
    });

    it('should fail when submitting a proposal with an invalid proposal type', function () {
        expectRevert(
            this.dao.submit(ProposalType.Last, TokenType.ERC20, this.assetToken.address, 2, 3),
            'invalid proposal type'
        );
    });

    it('should fail when submitting a proposal with an invalid token type', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.Last, this.assetToken.address, 2, 3),
            'invalid asset token type'
        );
    });

    it('should create a new proposal when submitting a proposal', async function () {
        const receipt = await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        const proposal = await this.dao.getProposal(1);
        expect(proposal.proposalType).to.be.bignumber.equal(ProposalType.Invest);
        expect(proposal.assetTokenType).to.be.bignumber.equal(TokenType.ERC20);
        expect(proposal.assetTokenAddress).to.be.equal(this.assetToken.address);
        expect(proposal.assetTokenAmount).to.be.bignumber.equal('2');
        expect(proposal.daoTokenAmount).to.bignumber.be.equal('3');
        expect(proposal.submitter).to.be.equal(accounts[0]);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        const now = await time.latest();
        const expiryDelay = new BN('60000');
        expect(proposal.votingExpiry).to.be.bignumber.equal(now.add(expiryDelay));
        expect(proposal.executionExpiry).to.be.bignumber.equal(now.add(expiryDelay).add(expiryDelay));
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Submitted);
        expect(await this.dao.getProposalCount()).to.be.bignumber.equal('2');
        expectEvent(
            receipt,
            'Submitted'
        );
    });

    //===== VOTE ON =====

    it('should fail when voting on proposal 0', function () {
        expectRevert(
            this.dao.voteOn(0, false),
            'invalid proposal status'
        );
    });

    it('should fail when voting on a proposal that has not been submitted', function () {
        expectRevert(
            this.dao.voteOn(1, false),
            'invalid proposal id'
        );
    });

    it('should fail when voting on a proposal that has been executed', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        const proposal= await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        await this.assetToken.approve(this.dao.address, 2);
        await this.dao.execute(1);
        expectRevert(
            this.dao.voteOn(1, false),
            'invalid proposal status'
        );
    });

    it('should fail when voting on a proposal that has expired voting', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        const proposal= await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.voteOn(1, false),
            'vote expired'
        );
    });

    it('should fail when voting on a proposal if voter has DAO token balance 0', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        expectRevert(
            this.dao.voteOn(1, false, {from: accounts[1]}),
            'no voting tokens'
        );
    });

    it('should increase yes votes by voter DAO token balance when voting yes', async function () {
        await this.daoToken.transfer(accounts[1], 1);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        let proposal;
        proposal= await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        let receipt;
        receipt = await this.dao.voteOn(1, true);
        const daoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(1, true, {from: accounts[1]});
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal(daoTokenBalance.add(new BN('1')));
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'VotedOn'
        );
    });

    it('should increase no votes by voter DAO token balance when voting no', async function () {
        await this.daoToken.transfer(accounts[1], 1);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        let proposal;
        proposal= await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        let receipt;
        receipt = await this.dao.voteOn(1, false);
        const daoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal(daoTokenBalance);
        expectEvent(
            receipt,
            'VotedOn'
        );
        receipt = await this.dao.voteOn(1, false, {from: accounts[1]});
        proposal = await this.dao.getProposal(1);
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
            this.dao.execute(1),
            'invalid proposal id'
        );
    });

    it('should fail when executing a proposal that has already been executed', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        const proposal= await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        await this.assetToken.approve(this.dao.address, 2);
        await this.dao.execute(1);
        expectRevert(
            this.dao.execute(1),
            'invalid proposal status'
        );
    });

    it('should fail when executing a proposal that has not yet expired voting', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        expectRevert(
            this.dao.execute(1),
            'vote not expired'
        );
    });

    it('should fail when executing a proposal that has failed voting', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        const proposal= await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.execute(1),
            'vote failed'
        );
    });

    it('should fail when executing a proposal that has expired execution', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionExpiry);
        expectRevert(
            this.dao.execute(1),
            'execution expired'
        );
    });

    it('should fail when executing a proposal from an account that is not the submitter', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert(
            this.dao.execute(1, {from: accounts[1]}),
            'only submitter can execute'
        );
    });

    it('should fail when executing an invest proposal if the asset token can not be transferred', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert.unspecified(
            this.dao.execute(1)
        );
    });

    it('should fail when executing a divest proposal if the DAO token can not be transferred', async function () {
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        const proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        expectRevert.unspecified(
            this.dao.execute(1)
        );
    });

    it('should transfer tokens when executing an invest proposal', async function () {
        const initialAssetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        const initialDaoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        let proposal;
        proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        await this.assetToken.approve(this.dao.address, 2);
        const receipt = await this.dao.execute(1);
        const newAssetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(newAssetTokenBalance).to.be.bignumber.equal(initialAssetTokenBalance.add(new BN('2')));
        const newDaoTokenBalance = await this.daoToken.balanceOf(accounts[0]);
        expect(newDaoTokenBalance).to.be.bignumber.equal(initialDaoTokenBalance.add(new BN('3')));
        proposal = await this.dao.getProposal(1);
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should transfer tokens when executing a divest proposal', async function () {
        const initialAssetTokenBalance = await this.assetToken.balanceOf(accounts[0]);
        const initialDaoTokenBalance = await this.daoToken.balanceOf(this.dao.address);
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3);
        await this.dao.voteOn(1, true);
        let proposal;
        proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.votingExpiry);
        await this.daoToken.approve(this.dao.address, 3);
        const receipt = await this.dao.execute(1);
        const newAssetTokenBalance = await this.assetToken.balanceOf(accounts[0]);
        expect(newAssetTokenBalance).to.be.bignumber.equal(initialAssetTokenBalance.add(new BN('2')));
        const newDaoTokenBalance = await this.daoToken.balanceOf(this.dao.address);
        expect(newDaoTokenBalance).to.be.bignumber.equal(initialDaoTokenBalance.add(new BN('3')));
        proposal = await this.dao.getProposal(1);
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        expectEvent(
            receipt,
            'Executed'
        );
    });
});
