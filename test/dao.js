const Dao = artifacts.require('InvestmentFundDao');
const { expect } = require('chai');
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');

contract('dao', (accounts) => {
    beforeEach(async function () {
        this.dao = await Dao.new('0x0000000000000000000000000000000000000000');
    });

    it('should fail when ETH sent to the DAO', async () => {
        expectRevert(
            this.dao.send('1'),
            'revert'
        );
    });

    it('should fail when submitting an invest proposal with token address 0x0', async () => {
        expectRevert(
            this.dao.submitInvestErc20Proposal('0x0000000000000000000000000000000000000000', 0, 0),
            'invalid token address'
        );
    });

    it('should fail when submitting an invest proposal with both token amount and DAO token amount 0', async () => {
        expectRevert(
            this.dao.submitInvestErc20Proposal('0x0000000000000000000000000000000000000001', 0, 0),
            'both token amount and DAO token amount zero'
        );
    });

    it('should create a new proposal when submitting an invest proposal', async () => {
        await this.dao.submitInvestErc20Proposal('0x0000000000000000000000000000000000000001', 2, 3);
        const proposal = await dao.investERC20Proposals(0);
        expect(proposal.tokenAddress).to.be.equal('0x0000000000000000000000000000000000000001');
        expect(proposal.tokenAmount).to.be.equal('2');
        expect(proposal.daoTokenAmount).to.be.equal('3');
        expect(proposal.yesVotes).to.be.equal('0');
        expect(proposal.noVotes).to.be.equal('0');
        expect(proposal.status).to.be.equal('0');
        expect(await this.dao.investERC20ProposalCount()).to.be.equal('1');
    });

    it('should emit event when submitting an invest proposal', async () => {
        const receipt = await this.dao.submitInvestErc20Proposal('0x0000000000000000000000000000000000000001', 2, 3);
        expectEvent(
            receipt,
            'InvestErc20ProposalSubmitted'
        );
    });
});
