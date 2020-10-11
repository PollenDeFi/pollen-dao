/**
 * List of __MOCK__ Chainlink price feeds contracts (emulating `AggregatorV3Interface`)
 *
 * @namespace MockPriceFeedsList
 * @typedef SourceAggregatorParams {import('./chainlinkPriceFeedsList').AggregatorParams}
 * @typedef AggregatorParams {name: string, network: string, address?: string, source: SourceAggregatorParams}
 * @typedef AggregatorsParams {AggregatorParams[]}
 */

const { getFeeds: getSrc } = require("./chainlinkPriceFeedsList");

/** @type {AggregatorsParams} */
const feeds = [
    { name: "r:plnEth",  network: "ropsten", address: "0x382975824786BF53e5Ad4726b51F89959218d0Ec", source: getSrc("plnEth",  "mainnet")[0] },
    { name: "r:ethUsd",  network: "ropsten", address: "0x71271d853A665758b8E81bE8cd54B9a54877321e", source: getSrc("ethUsd",  "mainnet")[0] },
    { name: "r:compUsd", network: "ropsten", address: "0xC9e417fbF07019b7cCDA6f83D0bc6073F5B4819E", source: getSrc("compUsd", "mainnet")[0] },
    { name: "r:batEth",  network: "ropsten", address: "0x06a3dD64A3dF8FF45a29cE17BAC8ddD5B74b834c", source: getSrc("batEth",  "mainnet")[0] },
    { name: "r:daiEth",  network: "ropsten", address: "0x6f4a9e4057A99De37537acC02968B2B2c8e575B4", source: getSrc("daiEth",  "mainnet")[0] },
    { name: "r:lendEth", network: "ropsten", address: "0xeE44558Ef55f4f7890ED66cd89d4367051e0cF9d", source: getSrc("lendEth", "mainnet")[0] },
    { name: "r:linkEth", network: "ropsten", address: "0xc78A1B93Fa50A58f89f2be2f2160FDA51a4141F4", source: getSrc("linkEth", "mainnet")[0] },
    { name: "r:mkrEth",  network: "ropsten", address: "0x75064F1347FB6196EF8f6B53120630281ba6cb35", source: getSrc("mkrEth",  "mainnet")[0] },
    { name: "r:snxEth",  network: "ropsten", address: "0x87199Ffc02BD459331E1422bbaC1A171262e5744", source: getSrc("snxEth",  "mainnet")[0] },

    { name: "p:ethUsd",  network: "pln-chain", address: "0xcCD9C9c3BBf5939423909e9F8EC86a5d3F5f1198", source: getSrc("ethUsd",  "mainnet")[0] },
    { name: "p:daiEth",  network: "pln-chain", address: "", source: getSrc("daiEth",  "mainnet")[0] },
    { name: "p:lendEth", network: "pln-chain", address: "", source: getSrc("lendEth", "mainnet")[0] },
    { name: "p:snxEth" , network: "pln-chain", address: "", source: getSrc("snxEth" , "mainnet")[0] },
];

/**
 * @param {string|RegExp|null} srcName The `name` or RegExp for names of the source feed(s)
 * (match all feeds, if set to `null`)
 * @param {string} srcNetwork The network of the source feed(s)
 * @param {string} dstNetwork The network of the mock feed(s)
 * @returns {AggregatorParams[] | null} Params of the matching mock feed(s)
 */
function getFeeds(srcName, srcNetwork, dstNetwork) {
    return feeds.filter(e =>
        e.network === dstNetwork &&
        e.source.network === srcNetwork &&
        ( srcName === null ? true : e.source.name.match(srcName) )
    );
}

module.exports = {
    getFeeds,
    feeds,
};
