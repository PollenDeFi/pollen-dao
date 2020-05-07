const DAOToken = artifacts.require("DAOToken");
import { expect } from 'chai';
import { expectRevert, expectEvent } from '@openzeppelin/test-helpers';

contract('daoToken', function (accounts) {
    beforeEach(async function () {
        this.daoToken = await DAOToken.new();
    });

    it('should set the owner to be the account that created the token', async function () {
        const owner = await this.daoToken.owner();
        expect(owner).to.be.equal(accounts[0]);
    });

    it('should fail when a non-owner accounts mints', function () {
        expectRevert(
            this.daoToken.mint(0, {from: accounts[1]}),
            'Ownable: caller is not the owner'
        );
    });

    it('should create and transfer tokens to the owner account when minting', async function () {
        let totalSupply;
        totalSupply = await this.daoToken.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('0');
        let balance;
        balance = await this.daoToken.balanceOf(accounts[0]);
        expect(balance).to.be.bignumber.equal('0');
        const receipt = await this.daoToken.mint(1);
        totalSupply = await this.daoToken.totalSupply();
        expect(totalSupply).to.be.bignumber.equal('1');
        balance = await this.daoToken.balanceOf(accounts[0]);
        expect(balance).to.be.bignumber.equal('1');
        expectEvent(
            receipt,
            'Transfer'
        );
    });
});
