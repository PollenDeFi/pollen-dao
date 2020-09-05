const PollenDAO = artifacts.require("PollenDAO");

module.exports = async function(deployer) {
  const pollenDao = await PollenDAO.deployed();
  await pollenDao.initialize(30, 180, 180, 180);
};
