/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { ProposalType, TokenType, Artifacts } from './consts';

const { addresses } = process.__userNamespace__.instances;

contract('redeeming Pollens', function ([deployer, bob]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);
        const pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(pollenAddress);
        this.assetToken = await Artifacts.AssetToken.at(addresses.MockAssetToken);
        this.assetToken2 = await Artifacts.AssetToken.at(addresses.MockAssetToken2);
        this.rateQuoter = await Artifacts.RateQuoter.at(addresses.RateQuoter);

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: deployer });

        let proposal, proposalId;
        proposalId = 0;
        proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        const {rate: pollenRate} = await this.rateQuoter.quotePrice.call(this.pollen.address);
        const {rate: assetTokenRate} = await this.rateQuoter.quotePrice.call(this.assetToken.address);
        const assetTokenAmount = (pollenRate.mul(new BN('1000000')).div(assetTokenRate)).mul(new BN('100')).div(new BN('1000000'));

        await this.assetToken.approve(this.dao.address, assetTokenAmount, { from: deployer });
        await this.dao.execute(0, { from: deployer });
        
        await this.pollen.transfer(bob, 100, { from: deployer });
        await this.assetToken2.transfer(bob, 10, { from: deployer});

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken2.address, 10, 2, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: bob });
        proposalId = 1;
        proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        expect(await this.pollen.totalSupply()).to.be.bignumber.equal(new BN(100));
        expect(await this.pollen.balanceOf(this.dao.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.pollen.balanceOf(bob)).to.be.bignumber.equal(new BN(100));
        expect(await this.assetToken.balanceOf(this.dao.address)).to.be.bignumber.equal(assetTokenAmount);
        expect(await this.assetToken2.balanceOf(this.dao.address)).to.be.bignumber.equal(new BN(0));
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

    it('should burn Pollen tokens when redeeming', async function () {
        const pollenTotalSupply = await this.pollen.totalSupply();
        const pollenBalanceOfRedeemer = await this.pollen.balanceOf(bob);
        await this.pollen.approve(this.dao.address, pollenBalanceOfRedeemer, { from: bob });
        await this.dao.redeem(pollenBalanceOfRedeemer, { from: bob });
        const newPollenTotalSupply = await this.pollen.totalSupply();
        expect(newPollenTotalSupply).to.be.bignumber.equal(pollenTotalSupply.sub(pollenBalanceOfRedeemer));
    });

    describe('when holding a single asset', function () {
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
            expect(newPollenBalanceOfDao).to.be.bignumber.equal(pollenBalanceOfDao);
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
            const pollenRedeemed = pollenBalance.div(new BN('2'));
            await this.pollen.approve(this.dao.address, pollenRedeemed, { from: bob });
            await this.dao.redeem(pollenRedeemed, { from: bob });
            const newPollenBalance = await this.pollen.balanceOf(bob);
            const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
            const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
            expect(newPollenBalance).to.be.bignumber.equal(pollenBalance.sub(pollenRedeemed));
            expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal(assetTokenBalanceOfDao.div(new BN('2')));
            expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao.div(new BN('2'))));
        });
    });

    describe('when holding multiple assets', function () {
        before(async function () {
            const {rate: pollenRate} = await this.rateQuoter.quotePrice.call(this.pollen.address);
            const {rate: assetTokenRate} = await this.rateQuoter.quotePrice.call(this.assetToken2.address);
            const assetTokenAmount = (pollenRate.mul(new BN('1000000')).div(assetTokenRate)).mul(new BN('2')).div(new BN('1000000'));

            await this.assetToken2.approve(this.dao.address, assetTokenAmount, { from: bob });
            await this.dao.execute(1, { from: bob });
            expect(await this.pollen.totalSupply()).to.be.bignumber.equal(new BN(102));
            expect(await this.pollen.balanceOf(this.dao.address)).to.be.bignumber.equal(new BN(0));
            expect(await this.assetToken2.balanceOf(this.dao.address)).to.be.bignumber.equal(assetTokenAmount);
        });

        beforeEach(async function () {
            this.snapshot2 = await createSnapshot();
        });

        afterEach(async function () {
            await revertToSnapshot(this.snapshot2);
        });

        it('should redeem all asset tokens when redeeming all Pollens', async function () {
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

        it('should redeem 50% of asset tokens when redeeming 50% of Pollens', async function () {
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
});
