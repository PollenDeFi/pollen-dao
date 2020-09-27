/**
 * List of deployed Chainlink price feeds contracts (which implement `AggregatorV3Interface`)
 *
 * @namespace PriceFeedsList
 * @typedef Reading {answer: string, roundId: string, updatedAt: string}
 * @typedef AggregatorParams {
 *   name: string,
 *   network: string, address: string,
 *   decimals: string, description: string, version: string,
 *   sample?: Reading
 * }
 * @typedef AggregatorsParams {AggregatorParams[]}
 */

/** @type {AggregatorParams[]} */
const feeds = [
    {
        name: "ethUsd",
        network: "mainnet",
        address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        description: 'ETH / USD',
        decimals: '8',
        version: '2',
        sample: { roundId: '36893488147419108012', updatedAt: '1600239280', answer: '36476263531' }
    },
    {
        name: "compUsd",
        network: "mainnet",
        address: "0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5",
        description: 'COMP / USD',
        decimals: '8',
        version: '2',
        sample: { roundId: '18446744073709552971', updatedAt: '1600230458', answer: '15235076717' }
    },
    {
        name: "batEth",
        network: "mainnet",
        address: "0x0d16d4528239e9ee52fa531af613AcdB23D88c94",
        description: 'BAT / ETH',
        decimals: '18',
        version: '2',
        sample: { roundId: '36893488147419104436', updatedAt: '1600233046', answer: '684590468644475' }
    },
    {
        name: "daiEth",
        network: "mainnet",
        address: "0x773616E4d11A78F511299002da57A0a94577F1f4",
        description: 'DAI / ETH',
        decimals: '18',
        version: '2',
        sample: { roundId: '36893488147419106151', updatedAt: '1600239915', answer: '2787695793295230' }
    },
    {
        name: "lendEth",
        network: "mainnet",
        address: "0xc9dDB0E869d931D031B24723132730Ecf3B4F74d",
        description: 'LEND / ETH',
        decimals: '18',
        version: '2',
        sample: { roundId: '36893488147419106510', updatedAt: '1600243685', answer: '1691000000000000' }
    },
    {
        name: "linkEth",
        network: "mainnet",
        address: "0xDC530D9457755926550b59e8ECcdaE7624181557",
        description: 'LINK / ETH',
        decimals: '18',
        version: '2',
        sample: { roundId: '36893488147419106989', updatedAt: '1600243790', answer: '30581123317059065' }
    },
    {
        name: "mkrEth",
        network: "mainnet",
        address: "0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2",
        description: 'MKR / ETH',
        decimals: '18',
        version: '2',
        sample: { roundId: '36893488147419107327', updatedAt: '1600232734', answer: '1269041794549395500' }
    },
    {
        name: "snxEth",
        network: "mainnet",
        address: "0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c",
        description: 'SNX / ETH',
        decimals: '18',
        version: '2',
        sample: { roundId: '36893488147419105925', updatedAt: '1600240718', answer: '12044730000000000' }
    },
];

/**
 * @param {string|RegExp|null} name The `name` or RegExp for names of the feed(s)
 * (match all feeds, if set to `null`)
 * @param {string} network The network of the feed(s)
 * @returns {AggregatorParams[] | null} Params of the matching feed(s)
 */
function getFeeds(name, network) {
    return feeds.filter(e =>
        e.network === network &&
        ( name === null ? true : e.name.match(name) )
    );
}

module.exports = {
    getFeeds,
    feeds,
}
