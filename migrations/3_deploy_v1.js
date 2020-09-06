const { scripts, ConfigManager } = require("@openzeppelin/cli");
const { add, push, create } = scripts;
const Pollen = artifacts.require("Pollen");

async function deploy(options, token) {
  // Register v1 of PollenDAO in the zos project
  add({ contractsData: [{ name: "PollenDAO_v1", alias: "PollenDAO" }] });
  // Push implementation contracts to the network
  await push(options);
  const pollen = await Pollen.deployed();
  // Create an instance of PollenDAO, setting initial values
  await create(Object.assign({ contractAlias: "PollenDAO", methodName: "initialize", methodArgs: [pollen.address, 30, 180, 180, 180] }, options));
}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    const { network, txParams } = await ConfigManager.initNetworkConfiguration({ network: networkName })
    await deploy({ network, txParams })
  })
}
