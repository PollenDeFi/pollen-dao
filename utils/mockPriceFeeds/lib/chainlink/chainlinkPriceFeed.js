/**
 * Chainlink price feeds contract (supporting `AggregatorV3Interface`)
 *
 * @namespace PriceFeed
 * @typedef {import('./chainlinkPriceFeedsList.js').Reading}
 * @typedef {import('./chainlinkPriceFeedsList.js').AggregatorParams}
 */

const abi = require("./aggregatorV3InterfaceABI");

module.exports = class {

    /**
     * @param {AggregatorParams} aggregatorParams
     * @param web3: any
     */
    constructor(aggregatorParams, web3) {
        this.web3 = web3;
        this.params = aggregatorParams;
        if (!web3.utils.isAddress(this.params.address)) {
            throw new Error(`Invalid aggregator address (${this.params.address})`);
        }

        this.instance = new web3.eth.Contract(abi, this.params.address);
    }

    async checkParams() {
        return Promise.all(
            [ "version", "decimals", "description" ].map(
                key => this.instance.methods[key].call()
                    .then( res => res === this.params[key]
                        ? res
                        : Promise.reject(`Mismatching price feed param "${key} (${res} != ${this.params[key]})"`)
                    )
            ));
    }

    /**
     * @param roundId {String}
     * @return {Promise<Reading>}
     */
    async readRound(roundId) {
        return this.sanitizeReading(await this.instance.methods.getRoundData(roundId).call());
    }

    /** @return {Promise<Reading>} */
    async readLatest() {
        return this.sanitizeReading(await this.instance.methods.latestRoundData().call());
    }

    /**
     * @private
     * @param {Reading} reading
     */
    sanitizeReading(reading) {
        return ["answer", "roundId", "updatedAt"].reduce((res, key) => {
            if ( !this.web3.utils.toBN(reading[key]) ) {
                throw new Error(`Unexpected price reading: "${key}" is not a number (${reading[key]})`);
            }
            res[key] = `${reading[key]}`;
            return res;
        }, {});
    }
}
