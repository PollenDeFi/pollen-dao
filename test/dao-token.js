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

    it('should fail when burning more tokens than balance', async function () {
        await this.pollen.mint(10);
        expectRevert(
            this.pollen.burn(11),
            'ERC20: burn amount exceeds balance.'
        );
        expectRevert(
            this.pollen.burn(3, { from: bob }),
            'ERC20: burn amount exceeds balance.'
        );
    });

    it('should decrease total supply and owner balance of tokens when burning', async function () {
        let totalSupply, balance, receipt;
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
        receipt = await this.pollen.burn(5);
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('8');
        balance = await this.pollen.balanceOf(deployer);
        expect(balance).to.be.bignumber.equal('5');
        expectEvent(
            receipt,
            'Transfer',
            {
                from: deployer,
                to: address0,
                value: new BN('5')
            }
        );
        receipt = await this.pollen.burn(3, { from: alice });
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('5');
        balance = await this.pollen.balanceOf(alice);
        expect(balance).to.be.bignumber.equal('0');
        expectEvent(
            receipt,
            'Transfer',
            {
                from: alice,
                to: address0,
                value: new BN('3')
            }
        );
    });
});
