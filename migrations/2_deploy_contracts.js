const AudacityToken = artifacts.require("AudacityToken");
const AudacityDAO = artifacts.require("AudacityDAO");

module.exports = async function(deployer) {
  await deployer.deploy(AudacityToken);
  await deployer.deploy(AudacityDAO, AudacityToken.address);
};
