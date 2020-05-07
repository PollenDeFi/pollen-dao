import { expect } from 'chai';
import { expectRevert, expectEvent, time, BN } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, Artifacts } from './consts';

contract('redeeming DAO tokens', function ([deployer, bob]) {
    beforeEach(async function () {
        this.dao = await Artifacts.AudacityDAO.new(30, 120, 180, 240, { from: deployer });
        const daoTokenAddress = await this.dao.getDaoTokenAddress();
        this.daoToken = await Artifacts.DAOToken.at(daoTokenAddress);
        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        this.assetToken.mint(999, { from: deployer });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100, { from: deployer });
        let proposal;
        proposal = await this.dao.getProposal(0);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2, { from: deployer });
        await this.dao.execute(0, { from: deployer });
        await this.daoToken.transfer(bob, 100, { from: deployer });
        this.assetToken2 = await Artifacts.AssetToken.new('AssetToken2', 'AST2', { from: bob });
        this.assetToken2.mint(99, { from: bob });
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken2.address, 10, 2, { from: bob });
        proposal = await this.dao.getProposal(1);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken2.approve(this.dao.address, 10, { from: bob });
        await this.dao.execute(1, { from: bob });
    });

    it('should fail when redeeming 0 DAO tokens', function () {
        expectRevert(
            this.dao.redeem(0, { from: bob }),
            'can\'t redeem zero amount'
        );
    });

    it('should fail when redeeming DAO tokens if the DAO token can not be transferred', async function () {
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        expectRevert.unspecified(
            this.dao.redeem(daoTokenBalance, { from: bob })
        );
    });

    it('should redeem all asset tokens when redeeming all DAO tokens', async function () {
        const daoTokenBalanceOfDao = await this.daoToken.balanceOf(this.dao.address);
        const daoTokenBalanceOfRedeemer = await this.daoToken.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        await this.daoToken.approve(this.dao.address, daoTokenBalanceOfRedeemer, { from: bob });
        const receipt = await this.dao.redeem(daoTokenBalanceOfRedeemer, { from: bob });
        const newDaoTokenBalanceOfDao = await this.daoToken.balanceOf(this.dao.address);
        const newDaoTokenBalanceOfRedeemer = await this.daoToken.balanceOf(bob);
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        expect(newDaoTokenBalanceOfDao).to.be.bignumber.equal(daoTokenBalanceOfDao.add(daoTokenBalanceOfRedeemer));
        expect(newDaoTokenBalanceOfRedeemer).to.be.bignumber.equal('0');
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal('0');
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao));
        expectEvent(
            receipt,
            'Redeemed'
        );
    });

    it('should redeem 50% of asset tokens when redeeming 50% of DAO tokens', async function () {
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        await this.daoToken.approve(this.dao.address, daoTokenBalance.div(new BN('2')), { from: bob });
        await this.dao.redeem(daoTokenBalance.div(new BN('2')), { from: bob });
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal(assetTokenBalanceOfDao.div(new BN('2')));
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao.div(new BN('2'))));
    });

    it('should redeem all asset tokens when redeeming all DAO tokens and the DAO is holding multiple assets', async function () {
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const assetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        await this.daoToken.approve(this.dao.address, daoTokenBalance, { from: bob });
        await this.dao.redeem(daoTokenBalance, { from: bob });
        const newAssetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const newAssetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const newAssetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const newAssetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        expect(newAssetTokenBalanceOfDao).to.be.bignumber.equal('0');
        expect(newAssetToken2BalanceOfDao).to.be.bignumber.equal('0');
        expect(newAssetTokenBalanceOfRedeemer).to.be.bignumber.equal(assetTokenBalanceOfRedeemer.add(assetTokenBalanceOfDao));
        expect(newAssetToken2BalanceOfRedeemer).to.be.bignumber.equal(assetToken2BalanceOfRedeemer.add(assetToken2BalanceOfDao));
    });

    it('should redeem 50% of asset tokens when redeeming 50% of DAO tokens and the DAO is holding multiple assets', async function () {
        const daoTokenBalance = await this.daoToken.balanceOf(bob);
        const assetTokenBalanceOfDao = await this.assetToken.balanceOf(this.dao.address);
        const assetToken2BalanceOfDao = await this.assetToken2.balanceOf(this.dao.address);
        const assetTokenBalanceOfRedeemer = await this.assetToken.balanceOf(bob);
        const assetToken2BalanceOfRedeemer = await this.assetToken2.balanceOf(bob);
        await this.daoToken.approve(this.dao.address, daoTokenBalance.div(new BN('2')), { from: bob });
        await this.dao.redeem(daoTokenBalance.div(new BN('2')), { from: bob });
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
