const PollenDAO = artifacts.require("PollenDAO");
const AssetToken = artifacts.require("MockERC20");

module.exports = async function(deployer, network) {
  await deployer.deploy(PollenDAO);
  if (network == "ropsten" || network == "development") {
    await deployer.deploy(AssetToken, "AssetToken", "AST");
  }
};
