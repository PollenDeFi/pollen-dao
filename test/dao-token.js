const Pollen = artifacts.require("Pollen");
import { expect } from 'chai';
import { address0 } from './dao/consts';
import { expectRevert, expectEvent, BN } from '@openzeppelin/test-helpers';

contract('pollen', function (accounts) {
    beforeEach(async function () {
        this.pollen = await Pollen.new();
    });

    it('should set the owner to be the account that created the token', async function () {
        const owner = await this.pollen.owner();
        expect(owner).to.be.equal(accounts[0]);
    });

    it('should fail when a non-owner accounts mints', function () {
        expectRevert(
            this.pollen.mint(0, {from: accounts[1]}),
            'Ownable: caller is not the owner'
        );
    });

    it('should create and transfer tokens to the owner account when minting', async function () {
        let totalSupply;
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('0');
        let balance;
        balance = await this.pollen.balanceOf(accounts[0]);
        expect(balance).to.be.bignumber.equal('0');
        const receipt = await this.pollen.mint(1);
        totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('1');
        balance = await this.pollen.balanceOf(accounts[0]);
        expect(balance).to.be.bignumber.equal('1');
        expectEvent(
            receipt,
            'Transfer'
        );
    });

    it('should decrease total supply of tokens when burning', async function () {
        let receipt;
        receipt = await this.pollen.mint(10);
        receipt = await this.pollen.burn(accounts[0], 3);
        const totalSupply = await this.pollen.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('7');
        expectEvent(
            receipt,
            'Transfer',
            {
                from: accounts[0],
                to: address0,
                value: new BN('3')
            }
        );
    });
});
