import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, ProposalStatus, address0, Artifacts } from './consts';

contract('proposal submission', function ([deployer, bob, alice]) {
    beforeEach(async function () {
        this.dao = await Artifacts.PollenDAO.new(30, 120, 180, 240, { from: deployer });
        const pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(pollenAddress);
        this.assetToken = await Artifacts.AssetToken.new('Artifacts.AssetToken', 'AST');
        this.assetToken.mint(999, { from: deployer });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, { from: deployer });
        const proposal = await this.dao.getProposal(0);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: deployer });
        await this.dao.execute(0, { from: deployer });
        await this.pollen.transfer(bob, 100, { from: deployer });
    });

    it('should fail when submitting a proposal with token address 0x0', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, address0, 0, 0, { from: bob }),
            'invalid asset token address'
        );
    });

    it('should fail when submitting a proposal with both token amount and Pollen amount 0', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 0, 0, { from: bob }),
            'both asset token amount and Pollen amount zero'
        );
    });

    it('should fail when submitting a proposal with an invalid proposal type', function () {
        expectRevert(
            this.dao.submit(ProposalType.Last, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob }),
            'invalid proposal type'
        );
    });

    it('should fail when submitting a proposal with an invalid token type', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.Last, this.assetToken.address, 2, 3, { from: bob }),
            'invalid asset token type'
        );
    });

    it('should fail when submitting a proposal with Pollen as an asset token', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.pollen.address, 2, 3, { from: bob }),
            'invalid usage of Pollen as asset token'
        );
    });

    it('should create a new proposal when submitting a proposal', async function () {
        const receipt = await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: bob });
        const proposal = await this.dao.getProposal(1);
        expect(proposal.proposalType).to.be.bignumber.equal(ProposalType.Invest);
        expect(proposal.assetTokenType).to.be.bignumber.equal(TokenType.ERC20);
        expect(proposal.assetTokenAddress).to.be.equal(this.assetToken.address);
        expect(proposal.assetTokenAmount).to.be.bignumber.equal('2');
        expect(proposal.pollenAmount).to.bignumber.be.equal('3');
        expect(proposal.submitter).to.be.equal(bob);
        const pollenBalance = await this.pollen.balanceOf(bob);
        expect(pollenBalance).to.be.bignumber.equal('100');
        expect(proposal.yesVotes).to.be.bignumber.equal(pollenBalance);
        expect(proposal.noVotes).to.be.bignumber.equal('0');
        const now = await time.latest();
        const votingExpiryDelay = await this.dao.getVotingExpiryDelay();
        expect(proposal.votingExpiry).to.be.bignumber.equal(now.add(votingExpiryDelay));
        const executionOpenDelay = await this.dao.getExecutionOpenDelay();
        expect(proposal.executionOpen).to.be.bignumber.equal(new BN(proposal.votingExpiry).add(executionOpenDelay));
        const executionExpiryDelay = await this.dao.getExecutionExpiryDelay();
        expect(proposal.executionExpiry).to.be.bignumber.equal(new BN(proposal.executionOpen).add(executionExpiryDelay));
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Submitted);
        expect(await this.dao.getProposalCount()).to.be.bignumber.equal('2');
        expectEvent(
            receipt,
            'Submitted'
        );
    });

    it('should add 0 votes when submitting a proposal from an account with 0 balance', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, { from: alice });
        const proposal = await this.dao.getProposal(1);
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
    });
});
