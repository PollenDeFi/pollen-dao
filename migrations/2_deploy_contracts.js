const AudacityDAO = artifacts.require("AudacityDAO");
const DAOToken = artifacts.require("DAOToken");

module.exports = async function(deployer) {
  await deployer.deploy(AudacityDAO);
  await deployer.deploy(DAOToken);
};
