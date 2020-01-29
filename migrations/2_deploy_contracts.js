const InvestmentFundDao = artifacts.require("InvestmentFundDao");

module.exports = async function(deployer) {
  await deployer.deploy(InvestmentFundDao, "0x0000000000000000000000000000000000000000");
};
