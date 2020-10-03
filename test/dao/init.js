/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectEvent, expectRevert, time } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { Artifacts, ProposalType, TokenType, ProposalStatus } from './consts';

contract('DAO contract instantiation', function ([deployer]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);
        this.pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(this.pollenAddress);

        this.tempDao = await Artifacts["PollenDAO-Implementation"].new();

        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        await this.dao.addAsset(this.assetToken.address);
        await this.assetToken.mint(deployer, 999, { from: deployer });

        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, 'QmUpbbXcmpcXvfnKGSLocCZGTh3Qr8vnHxW5o8heRG6wDC');

        const proposalId = 0;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));

        await time.increaseTo(proposal.executionOpen);

        await this.assetToken.approve(this.dao.address, 2);
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

    it('should have executed proposal 0 and received 2 asset tokens and minted and sent 100 Pollens', async function () {
        const proposalId = 0;
        const proposal = _.merge(await this.dao.getProposalData(proposalId), await this.dao.getProposalTimestamps(proposalId));
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        const assetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(assetTokenBalance).to.be.bignumber.equal('2');
        let pollenBalance;
        pollenBalance = await this.pollen.balanceOf(this.dao.address);
        expect(pollenBalance).to.be.bignumber.equal('0');
        pollenBalance = await this.pollen.balanceOf(deployer);
        expect(pollenBalance).to.be.bignumber.equal('100');
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([this.assetToken.address]);
    });
});
