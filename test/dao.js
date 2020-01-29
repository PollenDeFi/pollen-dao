const Dao = artifacts.require('InvestmentFundDao');
const truffleAssert = require('truffle-assertions');

contract('dao', (accounts) => {
    let dao;

    beforeEach(async function () {
        dao = await Dao.new("0x0000000000000000000000000000000000000000");
    });

    it("should fail when ETH sent to the DAO", async () => {
        truffleAssert.reverts(
            dao.send("1"),
            "revert"
        );
    });

    it("should fail when submitting an invest proposal with token address 0x0", async () => {
        truffleAssert.reverts(
            dao.submitInvestErc20Proposal("0x0000000000000000000000000000000000000000", 0, 0),
            "invalid token address"
        );
    });

    it("should fail when submitting an invest proposal with both token amount and DAO token amount 0", async () => {
        truffleAssert.reverts(
            dao.submitInvestErc20Proposal("0x0000000000000000000000000000000000000001", 0, 0),
            "both token amount and DAO token amount zero"
        );
    });

    it("should create a new proposal when submitting an invest proposal", async () => {
        truffleAssert.passes(
            dao.submitInvestErc20Proposal("0x0000000000000000000000000000000000000001", 2, 3)
        );
        const proposal = await dao.investERC20Proposals(0);
        assert.equal(proposal.tokenAddress, "0x0000000000000000000000000000000000000001");
        assert.equal(proposal.tokenAmount, "2");
        assert.equal(proposal.daoTokenAmount, "3");
        assert.equal(proposal.yesVotes, "0");
        assert.equal(proposal.noVotes, "0");
        assert.equal(proposal.status, "0");
        assert.equal(await dao.investERC20ProposalCount(), "1");
    });

    it("should emit event when submitting an invest proposal", async () => {
        truffleAssert.eventEmitted(
            await dao.submitInvestErc20Proposal("0x0000000000000000000000000000000000000001", 2, 3),
            "InvestErc20ProposalSubmitted"
        );
    });
});
