const Pollen = artifacts.require("Pollen");
import { expect } from 'chai';
import { address0 } from './dao/consts';
import { expectRevert, expectEvent, BN } from '@openzeppelin/test-helpers';

contract('pollen', function ([deployer, bob, alice]) {
    beforeEach(async function () {
        this.pollen = await Pollen.new();
    });

    it('should set the owner to be the account that created the token', async function () {
        const owner = await this.pollen.owner();
        expect(owner).to.be.equal(deployer);
    });

    it('should fail when a non-owner accounts mints', function () {
        expectRevert(
            this.pollen.mint(0, {from: bob}),
            'Ownable: caller is not the owner'
        );
    });

    it('should create and transfer tokens to the owner account when minting', async function () {
        let totalSupply;
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('0');
        let balance;
        balance = await this.pollen.balanceOf(deployer);
        expect(balance).to.be.bignumber.equal('0');
        const receipt = await this.pollen.mint(1);
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('1');
        balance = await this.pollen.balanceOf(deployer);
        expect(balance).to.be.bignumber.equal('1');
        expectEvent(
            receipt,
            'Transfer'
        );
    });

    it('should fail when a non-owner accounts burns owner tokens', async function () {
        await this.pollen.mint(10);
        expectRevert(
            this.pollen.burn(3, { from: bob }),
            'Ownable: caller is not the owner'
        );
    });

    it('should fail when a owner tries to burn more tokens than available', async function () {
        await this.pollen.mint(10);
        expectRevert(
            this.pollen.burn(11),
            'ERC20: burn amount exceeds balance.'
        );
    });

    it('should decrease total supply of tokens when burning', async function () {
        let totalSupply, balance;
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('0');
        balance = await this.pollen.balanceOf(deployer);
        expect(balance).to.be.bignumber.equal('0');
        await this.pollen.mint(13);
        await this.pollen.transfer(alice, 3);
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('13');
        balance = await this.pollen.balanceOf(deployer);
        expect(balance).to.be.bignumber.equal('10');
        const receipt = await this.pollen.burn(3);
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('10');
        balance = await this.pollen.balanceOf(deployer);
        expect(balance).to.be.bignumber.equal('7');
        expectEvent(
            receipt,
            'Transfer',
            {
                from: deployer,
                to: address0,
                value: new BN('3')
            }
        );
    });
});
