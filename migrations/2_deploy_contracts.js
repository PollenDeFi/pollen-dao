const AudacityDAO = artifacts.require("AudacityDAO");
const AssetToken = artifacts.require("MockERC20");

module.exports = async function(deployer) {
  await deployer.deploy(AudacityDAO);
  await deployer.deploy(AssetToken);
};
