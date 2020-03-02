const DAOToken = artifacts.require("DAOToken");
const AudacityDAO = artifacts.require("AudacityDAO");

module.exports = async function(deployer) {
  await deployer.deploy(DAOToken);
  await deployer.deploy(AudacityDAO, DAOToken.address);
};
