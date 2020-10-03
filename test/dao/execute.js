/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { ProposalType, TokenType, Artifacts } from './consts';

contract('proposal execution', function ([deployer, , bob, alice, carol]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);
        const pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(pollenAddress);

        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        await this.dao.addAsset(this.assetToken.address);
        await this.assetToken.mint(deployer, 999, { from: deployer });

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: deployer });

        const proposalId = 0;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        await this.assetToken.approve(this.dao.address, 2, { from: deployer });
        await this.dao.execute(0, { from: deployer });
        await this.pollen.transfer(bob, 100, { from: deployer });
        await this.assetToken.transfer(bob, 2, { from: deployer });
    });

    beforeEach(async function () {
        this.snapshot = await createSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(this.snapshot);
    });

    it('should fail when executing a proposal that has not been submitted', async function () {
        await expectRevert(
            this.dao.execute(1),
            'invalid proposal id'
        );
    });

    it('should fail when executing a proposal that has already been executed', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        await this.dao.execute(1, { from: bob });
        await expectRevert(
            this.dao.execute(1, { from: bob }),
            'invalid proposal status'
        );
    });

    it('should fail when executing a proposal that has not yet expired voting', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        await expectRevert(
            this.dao.execute(1),
            'vote not expired'
        );
    });

    it('should fail when executing a proposal that has not reached voting quorum', async function () {
        const quorum = await this.dao.getQuorum();
        await this.pollen.transfer(alice, new BN('100').sub(quorum), { from: bob });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await expectRevert(
            this.dao.execute(1),
            'vote did not reach quorum'
        );
    });

    it('should succeed when executing a proposal if yes votes plus no votes exceed quorum', async function () {
        const quorum = await this.dao.getQuorum();
        await this.pollen.transfer(alice, new BN('100').sub(quorum), { from: bob });
        await this.pollen.transfer(carol, '1', { from: alice });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        await this.dao.voteOn(1, false, { from: carol });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        const receipt = await this.dao.execute(1, { from: bob });
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should fail when executing a proposal that has failed voting', async function () {
        await this.pollen.transfer(alice, '51', { from: bob });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        await this.dao.voteOn(1, false, { from: alice });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await expectRevert(
            this.dao.execute(1),
            'vote failed'
        );
    });

    it('should fail when executing a proposal that is not open for execution', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.votingExpiry);
        await expectRevert(
            this.dao.execute(1),
            'execution not open'
        );
    });

    it('should fail when executing a proposal that has expired execution', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionExpiry);
        await expectRevert(
            this.dao.execute(1),
            'execution expired'
        );
    });

    it('should fail when executing a proposal from an account that is not the submitter', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await expectRevert(
            this.dao.execute(1, { from: alice }),
            'only submitter can execute'
        );
    });

    it('should fail when executing an invest proposal if the asset token can not be transferred', async function () {
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await expectRevert.unspecified(
            this.dao.execute(1)
        );
    });

    it('should fail when executing a divest proposal if the Pollen token can not be transferred', async function () {
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await expectRevert.unspecified(
            this.dao.execute(1)
        );
    });

    it('should transfer tokens when executing an invest proposal', async function () {
        const initialAssetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        const initialPollenBalance = await this.pollen.balanceOf(bob);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: bob });
        const receipt = await this.dao.execute(1, { from: bob });
        const newAssetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(newAssetTokenBalance).to.be.bignumber.equal(initialAssetTokenBalance.add(new BN('2')));
        const newPollenBalance = await this.pollen.balanceOf(bob);
        expect(newPollenBalance).to.be.bignumber.equal(initialPollenBalance.add(new BN('3')));
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should burn Pollen tokens when executing a divest proposal', async function () {
        const initialAssetTokenBalance = await this.assetToken.balanceOf(bob);
        const initialPollenBalance = await this.pollen.balanceOf(bob);
        const initialPollenSupply = await this.pollen.totalSupply();
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 2, 3, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await this.pollen.approve(this.dao.address, 3, { from: bob });
        const receipt = await this.dao.execute(1, { from: bob });
        const newAssetTokenBalance = await this.assetToken.balanceOf(bob);
        expect(newAssetTokenBalance).to.be.bignumber.equal(initialAssetTokenBalance.add(new BN('2')));
        const newPollenBalance = await this.pollen.balanceOf(bob);
        expect(newPollenBalance).to.be.bignumber.equal(initialPollenBalance.sub(new BN('3')));
        const newPollenSupply = await this.pollen.totalSupply();
        expect(newPollenSupply).to.be.bignumber.equal(initialPollenSupply.sub(new BN('3')));
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([this.assetToken.address]);
        expectEvent(
            receipt,
            'Executed'
        );
    });

    it('should continue to hold a partially divested asset', async function () {
        await this.dao.submit(ProposalType.Divest, TokenType.ERC20, this.assetToken.address, 1, 2, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        const proposalId = 1;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        await time.increaseTo(proposal.executionOpen);
        await this.pollen.approve(this.dao.address, 2, { from: bob });
        await this.dao.execute(1, { from: bob });
    });
});
