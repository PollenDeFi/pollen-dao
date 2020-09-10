/* global after, afterEach, artifacts, before, beforeEach, contract, describe, it, web3 */
const Pollen = artifacts.require("Pollen_v1");
import { expect } from 'chai';
import { expectRevert, expectEvent } from '@openzeppelin/test-helpers';

contract('Pollen (implementation)', function (accounts) {
    before(async function () {
        this.pollen = await Pollen.new();
        await this.pollen.initialize();
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
});
