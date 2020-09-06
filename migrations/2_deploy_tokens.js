const Pollen = artifacts.require("Pollen");

module.exports = async function(deployer, network) {
  await deployer.deploy(Pollen);
};
