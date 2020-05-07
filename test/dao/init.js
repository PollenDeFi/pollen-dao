import { expect } from 'chai';
import { expectRevert, time } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, ProposalStatus, Artifacts } from './consts';

contract('DAO contract instantiation', function ([deployer]) {
    beforeEach(async function () {
        this.dao = await Artifacts.AudacityDAO.new(30, 120, 180, 240);
        const daoTokenAddress = await this.dao.getDaoTokenAddress();
        this.daoToken = await Artifacts.DAOToken.at(daoTokenAddress);
        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        this.assetToken.mint(999);
        await this.dao.submit(ProposalType.Invest, TokenType.ERC20, this.assetToken.address, 2, 100);
        const proposal = await this.dao.getProposal(0);
        await time.increaseTo(proposal.executionOpen);
        await this.assetToken.approve(this.dao.address, 2);
        await this.dao.execute(0);
    });

    it('should fail when ETH sent to the DAO', function () {
        expectRevert.unspecified(
            this.dao.send('1')
        );
    });

    it('should fail when constructor parameters invalid', function () {
        expectRevert(
            Artifacts.AudacityDAO.new(101, 120, 180, 240),
            'invalid quorum'
        );
        expectRevert(
            Artifacts.AudacityDAO.new(100, 60, 180, 240),
            'invalid voting expiry delay'
        );
        expectRevert(
            Artifacts.AudacityDAO.new(100, 120, 60, 240),
            'invalid execution open delay'
        );
        expectRevert(
            Artifacts.AudacityDAO.new(100, 120, 180, 60),
            'invalid execution expiry delay'
        );
    });

    it('should set the owner of the DAO Token to be the DAO', async function () {
        const owner = await this.daoToken.owner();
        expect(owner).to.be.equal(this.dao.address);
    });

    it('should have executed proposal 0 and received 2 asset tokens and minted and sent 100 DAO tokens', async function () {
        const proposal = await this.dao.getProposal(0);
        expect(proposal.status).to.be.bignumber.equal(ProposalStatus.Executed);
        const assetTokenBalance = await this.assetToken.balanceOf(this.dao.address);
        expect(assetTokenBalance).to.be.bignumber.equal('2');
        let daoTokenBalance;
        daoTokenBalance = await this.daoToken.balanceOf(this.dao.address);
        expect(daoTokenBalance).to.be.bignumber.equal('0');
        daoTokenBalance = await this.daoToken.balanceOf(deployer);
        expect(daoTokenBalance).to.be.bignumber.equal('100');
        const assets = await this.dao.getAssets();
        expect(assets).to.be.eql([this.assetToken.address]);
    });
});
