const AudacityDAO = artifacts.require("AudacityDAO");
const AssetToken = artifacts.require("MockERC20");

module.exports = async function(deployer, network) {
  await deployer.deploy(AudacityDAO, 30, 180, 180, 180);
  if (network == "ropsten" || network == "development") {
    await deployer.deploy(AssetToken, "AssetToken", "AST");
  }
};
