/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { ProposalType, TokenType, Artifacts } from './consts';

contract('redeeming Pollens', function ([deployer, bob]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);
        const pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(pollenAddress);

        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        await this.assetToken.mint(deployer, 999, { from: deployer });
        this.assetToken2 = await Artifacts.AssetToken.new('AssetToken2', 'AST2', { from: bob });
        await this.assetToken2.mint(deployer, 99, { from: bob });
        await this.assetToken2.transfer(bob, 99, { from: deployer });

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: deployer });

        let proposal, proposalId;
        proposalId = 0;
        proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        await this.assetToken.approve(this.dao.address, 2, { from: deployer });
        await this.dao.execute(0, { from: deployer });
        await this.pollen.transfer(bob, 100, { from: deployer });

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken2.address, 10, 2, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        proposalId = 1;
        proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        await this.assetToken2.approve(this.dao.address, 10, { from: bob });
        await this.dao.execute(1, { from: bob });
    });

    beforeEach(async function () {
        this.snapshot = await createSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(this.snapshot);
    });
    it('should fail when redeeming 0 Pollens', async function () {
        await expectRevert(
            this.dao.redeem(0, { from: bob }),
            'can\'t redeem zero amount'
        );
    });

    it('should fail when redeeming Pollens if the Pollen token can not be transferred', async function () {
        const pollenBalance = await this.pollen.balanceOf(bob);
        await expectRevert.unspecified(
            this.dao.redeem(pollenBalance, { from: bob })
        );
    });

    it('should redeem all asset tokens when redeeming all Pollens', async function () {
        const pollenBalanceOfDao = await this.pollen.balanceOf(this.dao.address);
        const pollenBalanceOfRedeemer = await this.pollen.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        await this.pollen.approve(this.dao.address, pollenBalanceOfRedeemer, { from: bob });
        const receipt = await this.dao.redeem(pollenBalanceOfRedeemer, { from: bob });
        const newPollenBalanceOfDao = await this.pollen.balanceOf(this.dao.address);
        const newPollenBalanceOfRedeemer = await this.pollen.balanceOf(bob);
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        expect(newPollenBalanceOfDao).to.be.bignumber.equal(pollenBalanceOfDao.add(pollenBalanceOfRedeemer));
        expect(newPollenBalanceOfRedeemer).to.be.bignumber.equal('0');
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal('0');
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao));
        expectEvent(
            receipt,
            'Redeemed'
        );
    });

    it('should redeem 50% of asset tokens when redeeming 50% of Pollens', async function () {
        const pollenBalance = await this.pollen.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        await this.pollen.approve(this.dao.address, pollenBalance.div(new BN('2')), { from: bob });
        await this.dao.redeem(pollenBalance.div(new BN('2')), { from: bob });
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal(assetTokenBalanceOfDao.div(new BN('2')));
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao.div(new BN('2'))));
    });

    it('should redeem all asset tokens when redeeming all Pollens and the DAO is holding multiple assets', async function () {
        const pollenBalance = await this.pollen.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const assetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        await this.pollen.approve(this.dao.address, pollenBalance, { from: bob });
        await this.dao.redeem(pollenBalance, { from: bob });
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const newAssetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal('0');
        expect(newAssetToken2BalanceOfDao).to.be.bignumber.equal('0');
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao));
        expect(newAssetToken2BalanceOfRedeemer).to.be.bignumber.equal(assetToken2BalanceOfRedeemer.add(assetToken2BalanceOfDao));
    });

    it('should redeem 50% of asset tokens when redeeming 50% of Pollens and the DAO is holding multiple assets', async function () {
        const pollenBalance = await this.pollen.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const assetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        await this.pollen.approve(this.dao.address, pollenBalance.div(new BN('2')), { from: bob });
        await this.dao.redeem(pollenBalance.div(new BN('2')), { from: bob });
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const newAssetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal(assetTokenBalanceOfDao.div(new BN('2')));
        expect(newAssetToken2BalanceOfDao).to.be.bignumber.equal(assetToken2BalanceOfDao.div(new BN('2')));
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao.div(new BN('2'))));
        expect(newAssetToken2BalanceOfRedeemer).to.be.bignumber.equal(assetToken2BalanceOfRedeemer.add(assetToken2BalanceOfDao.div(new BN('2'))));
    });
});
