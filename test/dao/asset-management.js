/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { createSnapshot, revertToSnapshot } from '../helpers/blockchain';
import { getProxy } from '../helpers/oz-sdk';
import { ProposalType, TokenType, ProposalStatus, address0, Artifacts } from './consts';

contract('asset management', function ([deployer, bob, alice]) {
    before(async function () {
        const [{ address: daoAddress }]= await getProxy("PollenDAO");
        this.dao = await Artifacts.PollenDAO.at(daoAddress);

        this.assetToken0 = await Artifacts.AssetToken.new('Artifacts.AssetToken0', 'AST0');
        this.assetToken1 = await Artifacts.AssetToken.new('Artifacts.AssetToken1', 'AST1');
    });

    beforeEach(async function () {
        this.snapshot = await createSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(this.snapshot);
    });

    it('deployer should be able to add assets', async function () {
        let assets;
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([]);
        await this.dao.addAsset(this.assetToken0.address);
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([this.assetToken0.address]);
        await this.dao.addAsset(this.assetToken1.address);
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([this.assetToken0.address,this.assetToken1.address]);
    });

    it('deployer should not be able to add invalid assets', async function () {
        await expectRevert(
            this.dao.addAsset(address0, { from: deployer }),
            'invalid asset address'
        );
    });

    it('deployer should be able to add already-existing assets', async function () {
        await this.dao.addAsset(this.assetToken0.address);
        await expectRevert(
            this.dao.addAsset(this.assetToken0.address, { from: deployer }),
            'asset already exists in DAO assets'
        );
    });

    it('non-deployer should not be able to add assets', async function () {
        await expectRevert(
            this.dao.addAsset(this.assetToken0.address, { from: bob }),
            'caller is not the contract deployer'
        );
    });

    it('deployer should be able to remove existing assets', async function () {
        let assets;
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([]);
        await this.dao.addAsset(this.assetToken0.address);
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([this.assetToken0.address]);
        await this.dao.addAsset(this.assetToken1.address);
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([this.assetToken0.address,this.assetToken1.address]);

        await this.dao.removeAsset(this.assetToken1.address);
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([this.assetToken0.address, address0]);
        await this.dao.removeAsset(this.assetToken0.address);
        assets = await this.dao.getAssets();
        expect(assets).to.deep.equal([address0, address0]);
    });

    it('deployer should not be able to remove invalid assets', async function () {
        await expectRevert(
            this.dao.removeAsset(address0, { from: deployer }),
            'invalid asset address'
        );
    });

    it('deployer should not be able to remove non-existing assets', async function () {
        await expectRevert(
            this.dao.removeAsset(this.assetToken0.address, { from: deployer }),
            'asset does not exist in DAO assets'
        );
    });

    it('non-deployer should not be able to remove assets', async function () {
        await expectRevert(
            this.dao.removeAsset(this.assetToken0.address, { from: bob }),
            'caller is not the contract deployer'
        );
    });
});
