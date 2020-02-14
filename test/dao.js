const AudacityDAO = artifacts.require('AudacityDAO');
const { expect } = require('chai');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');

contract('dao', function (accounts) {
    beforeEach(async function () {
        this.dao = await AudacityDAO.new('0x0000000000000000000000000000000000000000');
    });

    it('should fail when ETH sent to the DAO', function () {
        expectRevert(
            this.dao.send('1'),
            'revert'
        );
    });

    it('should fail when submitting an invest proposal with token address 0x0', function () {
        expectRevert(
            this.dao.submit(0, 0, '0x0000000000000000000000000000000000000000', 0, 0),
            'invalid token address'
        );
    });

    it('should fail when submitting an invest proposal with both token amount and DAO token amount 0', function () {
        expectRevert(
            this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 0, 0),
            'both token amount and DAO token amount zero'
        );
    });

    it('should create a new proposal when submitting an invest proposal', async function () {
        await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        const proposal = await this.dao.proposals(0);
        expect(proposal.proposalType).to.be.bignumber.equal('0');
        expect(proposal.tokenType).to.be.bignumber.equal('0');
        expect(proposal.tokenAddress).to.be.equal('0x0000000000000000000000000000000000000001');
        expect(proposal.tokenAmount).to.be.bignumber.equal('2');
        expect(proposal.daoTokenAmount).to.bignumber.be.equal('3');
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        expect(proposal.status).to.be.bignumber.equal('0');
        expect(await this.dao.proposalCount()).to.be.bignumber.equal('1');
    });

    it('should emit event when submitting an invest proposal', async function () {
        const receipt = await this.dao.submit(0, 0, '0x0000000000000000000000000000000000000001', 2, 3);
        expectEvent(
            receipt,
            'Submitted'
        );
    });
});
