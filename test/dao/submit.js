/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { ProposalType, TokenType, ProposalStatus, address0, Artifacts } from './consts';

const { addresses } = process.__userNamespace__.instances;

contract('proposal submission', function ([deployer, bob, alice]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);
        const pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(pollenAddress);
        this.assetToken = await Artifacts.AssetToken.at(addresses.MockAssetToken);
        this.rateQuoter = await Artifacts.RateQuoter.at(addresses.RateQuoter);

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: deployer });
        const proposalId = 0;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        const {rate: pollenRate} = await this.rateQuoter.quotePrice.call(this.pollen.address);
        const {rate: assetTokenRate} = await this.rateQuoter.quotePrice.call(this.assetToken.address);
        const assetTokenAmount = (pollenRate.mul(new BN('1000000')).div(assetTokenRate)).mul(new BN('100')).div(new BN('1000000'));

        await this.assetToken.approve(this.dao.address, assetTokenAmount, { from: deployer });
        
        await this.dao.execute(0, { from: deployer });
        expect(await this.assetToken.balanceOf(this.dao.address)).to.be.bignumber.equal(assetTokenAmount);
        await this.pollen.transfer(bob, 100, { from: deployer });
    });

    beforeEach(async function () {
        this.snapshot = await createSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(this.snapshot);
    });
    it('should fail when submitting a proposal with token address 0x0', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, address0, 0, 0, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob }),
            'invalid token address'
        );
    });

    it('should fail when submitting a proposal with both token amount and Pollen amount 0', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 0, 0, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob }),
            'both amounts are zero'
        );
    });

    it('should fail when submitting a proposal with an invalid proposal type', function () {
        expectRevert(
            this.dao.submit(ProposalType.Last, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob }),
            'invalid proposal type'
        );
    });

    it('should fail when submitting a proposal with an invalid token type', function () {
        expectRevert(
            this.dao.submit(ProposalType.Invest, TokenType.Last, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob }),
            'invalid asset type'
        );
    });

    describe('if Polen token was accidentally added to the list of asset tokens', function () {
        it('should fail when submitting a proposal with Pollen as an asset token', async function () {
            await this.dao.addAsset(this.pollen.address, { from: deployer });
            await expectRevert(
                this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.pollen.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob }),
                'PLN can\'t be an asset'
            )
        });
    });

    it('should create a new proposal when submitting a proposal', async function () {
        const receipt = await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        expect(proposal.proposalType).to.be.bignumber.equal(ProposalType.Invest);
        expect(proposal.assetTokenType).to.be.bignumber.equal(TokenType.ERC20);
        expect(proposal.assetTokenAddress).to.be.equal(this.assetToken.address);
        expect(proposal.assetTokenAmount).to.be.bignumber.equal('2');
        expect(proposal.pollenAmount).to.bignumber.be.equal('3');
        expect(proposal.descriptionCid).to.be.equal('QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC');
        expect(proposal.submitter).to.be.equal(bob);
        expect(proposal.snapshotId).to.be.bignumber.equal('2');
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
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: alice });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        expect(proposal.yesVotes).to.be.bignumber.equal('0');
        expect(proposal.noVotes).to.be.bignumber.equal('0');
    });

    it('should emit accurate proposal data in submission events', async function () {
        const bobsReceipt = await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const alicesReceipt = await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 350, 755, 'Qmep6YpPDkAwiKi8r3uq6QEpdw1Led2vDWdF6AnQSAYVse', { from: alice });
        expectEvent(
            bobsReceipt,
            'Submitted', {
                proposalId: new BN('1'),
                proposalType: ProposalType.Divest,
                submitter: bob,
                snapshotId: new BN('2')
            }
        );
        expectEvent(
            alicesReceipt,
            'Submitted', {
                proposalId: new BN('2'),
                proposalType: ProposalType.Invest,
                submitter: alice,
                snapshotId: new BN('3')
            }
        );
    });
});
