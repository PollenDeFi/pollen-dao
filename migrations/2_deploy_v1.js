/* global artifacts, config, web3 */
const { scripts, ConfigManager, files: { NetworkFile }, network: { NetworkController }} = require("@openzeppelin/cli");
const { add, create, push } = scripts;
const IPollen = artifacts.require("IPollen");

/**
 * @dev The script:
 * - reads expected contract addresses from the optional 'networks.<name>.contracts' property of the truffle config
 * - reads "deployed" contract addresses from the @openzeppelin/cli "networkFile" (note .openzeppelin/*.json)
 * - deploys and initializes missing contracts only (or all contracts if "reupload" set)
 * - if "expected" addresses defined, ensures the "expected" and "deployed" addresses matches
 *
 * Always save (commit) the "networkFile(s)" for public networks (.openzeppelin/mainnet|ropsten.json')
 * Clear the (old) "networkFile" for ganache network ('rm -f .openzeppelin/dev*.json') before (re-)starting ganache
 */

module.exports = function(deployer, networkName) {
  deployer.then(async () => {
    const options = await ConfigManager.initNetworkConfiguration({ network: networkName });
    const { network, txParams } = options;

    // custom params from truffle config (from 'networks[<networkName> section]'
    const { contracts = {}, reupload = false, force = false } = config.network_config;
    /** @const {ExpectedAddresses} expectedAddrs */
    const expectedAddrs = Object.assign({proxies: {}, implementations: {}}, contracts);
    if (!expectedAddrs.proxies) expectedAddrs.proxies = {};
    if (!expectedAddrs.implementations) expectedAddrs.implementations = {};

    await migrate({ network, txParams, reupload, force }, expectedAddrs);
  })
}

/**
 * @typedef {Object} ExpectedAddresses
 * @property {String} [proxyAdmin]
 * @property {Object} [proxies]
 * @property {String} [proxies.Pollen]
 * @property {String} [proxies.PollenDAO]
 * @property {Object} [implementations]
 * @property {string} [implementations.Pollen]
 * @property {string} [implementations.PollenDAO]
 *
 * @param {ExpectedAddresses} expectedAddrs
 */
async function migrate(options, expectedAddrs) {
  const packageContracts = [
    { name: "Pollen_v1", alias: "Pollen" },
    { name: "PollenDAO_v1", alias: "PollenDAO" },
  ];
  const getContractCreateParams = (alias, instances) => ({
    contractAlias: packageContracts.find(e => e.alias === alias).alias,
    methodName: "initialize",
    methodArgs: alias !== "PollenDAO" ? [] : [ instances.proxies.Pollen.address, 30, 180, 180, 180 ],
  });

  // Register contracts in the Openzeppelin-SDK project
  add({ contractsData: packageContracts });
  // If not already done, deploy implementations
  await push(options);


  const controller = new NetworkController(options);
  const packageName = controller.projectFile.data.name;
  const version = controller.projectVersion;
  const instances = {
    proxies: { all: readProxiesFromOzNetworkFile(options) },
    implementations: readImplementationsFromOzNetworkFile(options),
  };

  // process contracts one by one (but not in parallel)
  await packageContracts.reduce(
    (promiseChain, { alias }) => promiseChain.then(
      async () => {
        console.log(t`${alias} implementation found: ${instances.implementations[alias].address}`);
        throwUnmatchedAddr(
            expectedAddrs.implementations[alias], instances.implementations[alias].address, `${alias} impl`
        );

        [ instances.proxies[alias] ] = findProxy(instances.proxies.all, alias, expectedAddrs.proxies[alias]);
        if ( !options.reupload && instances.proxies[alias] ) {
          console.log(t`${alias} proxy re-used: ${instances.proxies[alias].address}`);
        } else {
          const proxy = await create(Object.assign(getContractCreateParams(alias, instances), options));
          [ instances.proxies[alias] ] = findProxy(readProxiesFromOzNetworkFile(options), alias, proxy.options.address);
          console.log(t`${alias} proxy deployed: ${instances.proxies[alias].address}`);
        }
        throwUnmatchedAddr(
          instances.implementations[alias].address, instances.proxies[alias].implementation, `${alias} proxy.impl`
        );
        throwUnmatchedAddr(expectedAddrs.proxyAdmin, instances.proxies[alias].admin, `${alias} admin`);
      }
    ),
    Promise.resolve(),
  );

  const { address: proxyAdmin = "" } = readProxyAdminFromOzNetworkFile(options);
  console.log(t`${"ProxyAdmin"} instance found: ${proxyAdmin}`);
  throwUnmatchedAddr(expectedAddrs.proxyAdmin, proxyAdmin, "ProxyAdmin");

  // Ensure PollenDAO is the owner of Pollen
  const pollen = new web3.eth.Contract(IPollen.abi, instances.proxies.Pollen.address);
  const pollenOwner = await pollen.methods.owner().call();
  if ( pollenOwner === instances.proxies.PollenDAO.address ) {
    console.log(t`${"Pollen"} owner found: ${pollenOwner}`);
  } else {
    throwUnmatchedAddr(options.txParams.from, pollenOwner, "Pollen owner");
    await pollen.methods.transferOwnership(instances.proxies.PollenDAO.address)
        .send(options.txParams);
    console.log(t`${"Pollen"} owner has been set: ${instances.proxies.PollenDAO.address}`);
    throwUnmatchedAddr(
        instances.proxies.PollenDAO.address,
        await pollen.methods.owner().call(),
        "Pollen owner"
    );
  }

  if (process.env.DEBUG === "NAMESPACE") process.__userNamespace__ = Object.assign(
    process.__userNamespace__ || {}, {
      artifacts,
      instances,
      controller,
      networkFile: getOzNetworkFile(controller.projectFile, options.network),
      options,
      pollen,
      proxyAdmin,
    }
  );

  function getOzNetworkFile (projectFile, networkNick) {
    return new NetworkFile(projectFile, networkNick);
  }

  function readProxyAdminFromOzNetworkFile (
      options,
      networkFile = getOzNetworkFile(controller.projectFile, options.network),
  ) {
    return networkFile.proxyAdmin || {};
  }

  function readImplementationsFromOzNetworkFile (
      options,
      networkFile = getOzNetworkFile(controller.projectFile, options.network),
  ) {
    return networkFile.contracts || {};
  }

  function readProxiesFromOzNetworkFile (
      options,
      networkFile = getOzNetworkFile(controller.projectFile, options.network),
  ) {
    const contracts = networkFile.getProxies({});
    return contracts.filter(e => e.package === packageName && e.version === version);
  }

  function findProxy (proxies, contract, address) {
    return proxies.filter(e =>
        e.contract === contract &&
        (address ? e.address.toLowerCase() === address.toLowerCase() : true)
    );
  }

  function throwUnmatchedAddr(expected, actual, alias = '') {
    if (!web3.utils.isAddress(actual))
      throw new Error(`Invalid ethereum address (${alias} actual): ${actual || "empty"}`);

    if (!expected) return;

    if (expected && expected.toLowerCase() !== actual.toLowerCase())
      throw new Error(`Unexpected address ${alias ? "(" + alias + ")" : ""}: ${actual} != ${expected}`);
  }
}

function t(strings, alias, address) {
  return (`${alias}${strings.join('')}`).padEnd(32) + address;
}
