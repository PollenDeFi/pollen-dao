import { expect } from 'chai';
import { expectEvent, expectRevert, time } from '@openzeppelin/test-helpers';
import { ProposalType, TokenType, ProposalStatus, Artifacts } from './consts';

contract('DAO contract instantiation', function ([deployer]) {
    beforeEach(async function () {
        this.dao = await Artifacts.PollenDAO.new(30, 120, 180, 240);
        const pollenAddress = await this.dao.getPollenAddress();
        this.pollen = await Artifacts.Pollen.at(pollenAddress);
        this.assetToken = await Artifacts.AssetToken.new('AssetToken', 'AST');
        this.assetToken.mint(999);
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

    it('should fail when ETH sent to the DAO', function () {
        expectRevert.unspecified(
            this.dao.send('1')
        );
    });

    it('should fail when constructor parameters invalid', function () {
        expectRevert(
            Artifacts.PollenDAO.new(101, 120, 180, 240),
            'invalid quorum'
        );
        expectRevert(
            Artifacts.PollenDAO.new(100, 60, 180, 240),
            'invalid voting expiry delay'
        );
        expectRevert(
            Artifacts.PollenDAO.new(100, 120, 60, 240),
            'invalid execution open delay'
        );
        expectRevert(
            Artifacts.PollenDAO.new(100, 120, 180, 60),
            'invalid execution expiry delay'
        );
    });

    it('should set the owner of the Pollen token to be the DAO', async function () {
        const owner = await this.pollen.owner();
        expect(owner).to.be.equal(this.dao.address);
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
