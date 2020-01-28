const Dao = artifacts.require('InvestmentFundDao');

contract('dao', (accounts) => {
    beforeEach(async function () {
        this.dao = await Dao.new();
    });
});