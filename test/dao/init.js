/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectEvent, expectRevert, time, BN } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { Artifacts, ProposalType, TokenType, ProposalStatus } from './consts';

const { addresses } = process.__userNamespace__.instances;

contract('DAO contract instantiation', function ([deployer]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);
        this.pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(this.pollenAddress);
        this.assetToken = await Artifacts.AssetToken.at(addresses.MockAssetToken);
        this.assetToken2 = await Artifacts.AssetToken.at(addresses.MockAssetToken2);
        this.rateQuoter = await Artifacts.RateQuoter.at(addresses.RateQuoter);
        this.tempDao = await Artifacts["PollenDAO-Implementation"].new();

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC', { from: deployer });

        const proposalId = 0;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        const {rate: pollenRate} = await this.rateQuoter.quotePrice.call(this.pollen.address);
        const {rate: assetTokenRate} = await this.rateQuoter.quotePrice.call(this.assetToken.address);
        const assetTokenAmount = (pollenRate.mul(new BN('1000000')).div(assetTokenRate)).mul(new BN('100')).div(new BN('1000000'));

        await this.assetToken.approve(this.dao.address, assetTokenAmount);
        const receipt = await this.dao.execute(0);
        expectEvent(
            receipt,
            'Executed'
        );
    });

    beforeEach(async function () {
        this.snapshot = await createSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(this.snapshot);
    });

    it('should fail when ETH sent to the DAO', function () {
        expectRevert.unspecified(
            this.dao.send('1')
        );
    });

    describe("given valid init params", function () {
        it('does not revert', async function () {
            await this.tempDao.initialize(this.pollenAddress, 30, 180, 180, 180);
        });
    });

    describe("given invalid init params", function () {
        it('reverts on invalid quorum', async function () {
            await expectRevert(
                this.tempDao.initialize(this.pollenAddress, 101, 120, 180, 240),
                'invalid quorum'
            );
            await expectRevert(
                this.tempDao.initialize(this.pollenAddress, 100, 60, 180, 240),
                'invalid voting expiry'
            );
            await expectRevert(
                this.tempDao.initialize(this.pollenAddress, 100, 120, 60, 240),
                'invalid exec open'
            );
            await expectRevert(
                this.tempDao.initialize(this.pollenAddress, 100, 120, 180, 60),
                'invalid exec expiry'
            );
        });
    });

    it('should set the owner of the Pollen token to be the DAO', async function () {
        const owner = await this.pollen.owner();
        expect(owner).to.be.equal(this.dao.address);
    });

    it('should return the correct version of the DAO', async function () {
        const version = await this.dao.version();
        expect(version).to.be.equal("v1");
    });

    it('should have executed proposal 0 and received 400 asset tokens and minted and sent 100 Pollens', async function () {
        const proposalId = 0;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        const assetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(assetTokenBalance).to.be.bignumber.equal('400');
        let pollenBalance;
        pollenBalance = await this.pollen.balanceOf(this.dao.address);
        expect(pollenBalance).to.be.bignumber.equal('0');
        pollenBalance = await this.pollen.balanceOf(deployer);
        expect(pollenBalance).to.be.bignumber.equal('100');
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([this.assetToken.address, this.assetToken2.address]);
    });
});
