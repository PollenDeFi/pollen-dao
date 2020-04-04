const AudacityDAO = artifacts.require("AudacityDAO");
const AssetToken = artifacts.require("MockERC20");

module.exports = async function(deployer, network) {
  await deployer.deploy(AudacityDAO);
  if (network == "ropsten" || network == "development") {
    await deployer.deploy(AssetToken, "AssetToken", "AST");
  }
};
