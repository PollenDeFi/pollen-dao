/* global artifacts, config, web3 */
const { readFileSync } = require("fs");
const path = require("path");
const { ConfigManager, files: { NetworkFile }, network: { NetworkController }} = require("@openzeppelin/cli");

const currentSession = JSON.parse(readFileSync(path.resolve(__dirname, "../../.openzeppelin/.session")).toString());

let cachedProxies;

module.exports = {
    currentSession,
    getProxy,
}

/**
 * @param contract {string=}
 * @param address {string=}
 * @param network {string=}
 * @return {Promise<Object[]>}
 */
async function getProxy (contract= "", address= "", network = currentSession.network) {
    const proxies = cachedProxies
        ? await Promise.resolve(cachedProxies)
        : await readProxiesFromOzNetworkFile(network);

    return proxies.filter(e =>
        (contract ? e.contract === contract : true) &&
        (address ? e.address.toLowerCase() === address.toLowerCase() : true)
    );
}

async function readProxiesFromOzNetworkFile(network) {
    const options = await ConfigManager.initNetworkConfiguration({ network: network });
    const controller = new NetworkController(options);
    const pack = controller.projectFile.data.name;
    const version = controller.projectVersion;
    const networkFile = new NetworkFile(controller.projectFile, options.network);
    return networkFile.getProxies({}).filter(e => e.package === pack && e.version === version);
}
