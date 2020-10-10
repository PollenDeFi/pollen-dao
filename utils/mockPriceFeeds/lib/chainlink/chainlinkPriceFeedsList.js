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
        name: "plnEth",
        network: "mainnet",
        address: "",
        description: 'PLN / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '0xe88B849FD0109e5d9A943A42EED98c5507c32E01',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        }
    },
    {
        name: "ethUsd",
        network: "mainnet",
        address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        description: 'ETH / USD',
        decimals: '8',
        version: '2',
        uniswapPair: {
            base: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
            quote: '0xBAdE0A1a1eF3a2B5F0EEdc61aB68DF820be91E04',
        },
        sample: { roundId: '36893488147419108012', updatedAt: '1600239280', answer: '36476263531' }
    },
    {
        name: "compUsd",
        network: "mainnet",
        address: "0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5",
        description: 'COMP / USD',
        decimals: '8',
        version: '2',
        uniswapPair: {
            base: '0xA147fEE90e1A2D8C8C3Cd7F14Dd399E0f67A084e',
            quote: '0xBAdE0A1a1eF3a2B5F0EEdc61aB68DF820be91E04',
        },
        sample: { roundId: '18446744073709552971', updatedAt: '1600230458', answer: '15235076717' }
    },
    {
        name: "batEth",
        network: "mainnet",
        address: "0x0d16d4528239e9ee52fa531af613AcdB23D88c94",
        description: 'BAT / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '0x0c681619c589c0beaa01f693d018c817e11C5426',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        },
        sample: { roundId: '36893488147419104436', updatedAt: '1600233046', answer: '684590468644475' }
    },
    {
        name: "daiEth",
        network: "mainnet",
        address: "0x773616E4d11A78F511299002da57A0a94577F1f4",
        description: 'DAI / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '0xBAdE0A1a1eF3a2B5F0EEdc61aB68DF820be91E04',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        },
        sample: { roundId: '36893488147419106151', updatedAt: '1600239915', answer: '2787695793295230' }
    },
    {
        name: "lendEth",
        network: "mainnet",
        address: "0xc9dDB0E869d931D031B24723132730Ecf3B4F74d",
        description: 'LEND / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '0x7F8896f4CccC705fe68926DbCf6b41258E0b37EA',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        },
        sample: { roundId: '36893488147419106510', updatedAt: '1600243685', answer: '1691000000000000' }
    },
    {
        name: "linkEth",
        network: "mainnet",
        address: "0xDC530D9457755926550b59e8ECcdaE7624181557",
        description: 'LINK / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '0x701FBb83C0cb7de531E86F04B6D1A4c03793fFc6',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        },
        sample: { roundId: '36893488147419106989', updatedAt: '1600243790', answer: '30581123317059065' }
    },
    {
        name: "mkrEth",
        network: "mainnet",
        address: "0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2",
        description: 'MKR / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        },
        sample: { roundId: '36893488147419107327', updatedAt: '1600232734', answer: '1269041794549395500' }
    },
    {
        name: "snxEth",
        network: "mainnet",
        address: "0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c",
        description: 'SNX / ETH',
        decimals: '18',
        version: '2',
        uniswapPair: {
            base: '0x867a63140EE5Ce0958016130ecF4aD1e096fb1cc',
            quote: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
        },
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
