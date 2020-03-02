const AudacityDAO = artifacts.require("AudacityDAO");

module.exports = async function(deployer) {
  await deployer.deploy(AudacityDAO);
};
