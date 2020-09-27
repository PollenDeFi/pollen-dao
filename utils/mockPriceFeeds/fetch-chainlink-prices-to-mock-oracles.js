#!/usr/bin/env node
/**
 @dev It reads price data from "source price feeds" and sends the same data to "mock (or 'destination') price feeds"

 Examples:

 # fetch price data for 'ETH / USD' from 'mainnet' to 'pln-chain'
 SRC_FEEDS=ethUsd DST_NETWORK="pln-chain" DST_RPC_URL="http://localhost:8555" fetch-chainlink-prices-to-mock-oracles.js

 # fetch few price feeds on default networks (from 'mainnet' to 'ropsten')
 SRC_FEEDS="ethUsd:compUsd:daiEth:lendEth:snxEth" ./scripts/fetch-chainlink-prices-to-mock-oracles.js

 # continuously update given feeds on default networks ('mainnet' to 'ropsten') with 600 seconds pause between updates
 INTERVAL_SECS=600 SRC_FEEDS="ethUsd:compUsd:daiEth:lendEth:snxEth" ./scripts/fetch-chainlink-prices-to-mock-oracles.js
 */

const Web3 = require("web3");
const {
    PriceFeed,
    priceFeeds: { getFeeds: getSrcFeeds },
    MockPriceFeed,
    mockPriceFeeds: { getFeeds: getDstFeeds }
} = require("./lib/chainlink");

const { log } = console;

/**
 * It reads following environmental params:
 * @param {string=} env.INTERVAL_SECS If provided, continuously update with this number of seconds between updates
 * @param {string=} env.SRC_FEEDS A name a price feed, or a column-delimited list of feeds names to process
 * (if omitted, all configured price feeds to be processed)
 * @param {string=} env.SRC_NETWORK The network of source price feeds (by default, 'mainnet')
 * @param {string=} env.DST_NETWORK The network of mock price feeds (by default, 'ropsten')
 * @param {string=} env.SRC_RPC_URL The URL of an RPC server to use for the network `SRC_NETWORK`
 * @param {string=} env.DST_RPC_URL The URL of an RPC server to use for the network `DST_NETWORK`
 * @param {string=} env.INFURA_KEY The key to use with Infura, if `SRC_RPC_URL` or `DST_RPC_URL` omitted
 * @param {string=} env.PRIVKEY The private key of an address to send transactions on the `DST_NETWORK` from
 * @param {string=} env.DEF_ADDR The address to send transactions on the `DST_NETWORK` from
 */
const paramsPromise = ((env) => {
    const srcNames = env.SRC_FEEDS ? env.SRC_FEEDS.split(":") : null;
    const srcNetwork = `${env.SRC_NETWORK || "mainnet"}`;
    const dstNetwork = `${env.DST_NETWORK || "ropsten"}`;
    const srcWeb3 = new Web3(env.SRC_RPC_URL || `https://${srcNetwork}.infura.io/v3/${env.INFURA_KEY}`);
    const dstWeb3 = new Web3(env.DST_RPC_URL || `https://${dstNetwork}.infura.io/v3/${env.INFURA_KEY}`);
    const params = { srcNetwork, srcWeb3, dstNetwork, dstWeb3, srcNames };

    if (!dstWeb3.eth.defaultAccount && env.PRIVKEY) {
        const pKey = env.PRIVKEY.startsWith("0x") ? env.PRIVKEY : "0x" + env.PRIVKEY;
        const fromAccount = dstWeb3.eth.accounts.privateKeyToAccount(pKey);
        dstWeb3.eth.accounts.wallet.add(fromAccount);
        dstWeb3.eth.defaultAccount = fromAccount.address;
    } else if(env.DEF_ADDR) {
        dstWeb3.eth.defaultAccount = env.DEF_ADDR;
    }

    params.doAction = env.INTERVAL_SECS
        ? (options) => continuouslyUpdateMockPriceFeeds(options, env.INTERVAL_SECS)
        : (options) => updateMockPriceFeeds(options);

    return dstWeb3.eth.defaultAccount
        ? Promise.resolve(params)
        : dstWeb3.eth.getAccounts().then((accounts) => {
            dstWeb3.eth.defaultAccount = accounts[0];
            return params;
        });
})(process.env);

return paramsPromise
    .then(params => params.doAction(params))
    .then(() => log(`[OK] DONE`))
    .catch((error) => { throw new Error(error); });

async function updateMockPriceFeeds({ srcNames, srcNetwork, srcWeb3, dstNetwork, dstWeb3 }) {
    const srcNamesArr = Array.isArray(srcNames)
        ? srcNames
        : getSrcFeeds(srcNames, srcNetwork).map(e => e.name);

    // process one by one (but not in parallel)
    return srcNamesArr.reduce(
        (promiseChain, srcName) => promiseChain.then(async () => {
            const srcFeed = new PriceFeed(getSrcFeeds(srcName, srcNetwork)[0], srcWeb3);
            const dstFeed = new MockPriceFeed(getDstFeeds(srcName, srcNetwork, dstNetwork)[0], dstWeb3);
            return updateMockPriceFeed(srcFeed, dstFeed)
        }),
        Promise.resolve(),
    );
}

async function continuouslyUpdateMockPriceFeeds(options, intervalSeconds) {
    for (;;) { // endless loop
        await updateMockPriceFeeds(options);
        await (new Promise((res) => setTimeout(() => res(), 1000 * intervalSeconds)));
    }
}

async function updateMockPriceFeed(srcFeed, dstFeed) {
    const { roundId, updatedAt, answer } = await srcFeed.readLatest();
    log(`${srcFeed.params.name}: ${JSON.stringify({ roundId, updatedAt, answer })}`);
    return dstFeed.write({ roundId, updatedAt, answer })
        .then((r) => console.log(`${dstFeed.params.name}: ${typeof r === "string" ? r : "updated"}`));
}
