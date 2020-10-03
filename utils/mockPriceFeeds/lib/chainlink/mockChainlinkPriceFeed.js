/**
 * __MOCK__ price feeds contract (emulating Chainlink `AggregatorV3Interface`)
 *
 * @namespace MockPriceFeed
 * @typedef {import('./chainlinkPriceFeedsList.js').Reading}
 * @typedef {import('./mockChainlinkPriceFeedsList').AggregatorParams}
 */

const abi = require("./mockAggregatorV3InterfaceABI");

module.exports = class {

    /**
     * @param {AggregatorParams} aggregatorParams
     * @param web3: any
     */
    constructor(aggregatorParams, web3) {
        this.web3 = web3;
        this.params = aggregatorParams;
        if (!web3.utils.isAddress(this.params.address)) {
            throw new Error(`Invalid mock aggregator address (${this.params.address})`);
        }

        this.instance = new web3.eth.Contract(abi, this.params.address);
    }

    async checkParams() {
        return Promise.all(
            [ "version", "decimals", "description" ].map(
                key => this.instance.methods[key].call()
                    .then( res => res === this.params.source[key]
                        ? res
                        : Promise.reject(
                            `Mismatching price feed param "${key} (${res} != ${this.params.source[key]})"`
                        )
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
     * Send (write) new data to the contract
     * (it does not re-send known data)
     * @param reading {Reading} data to send
     * @param opts {{from?: string, gas: string}} Params to send a transaction with
     */
    async write(reading, opts = {gas: "100000"}) {
        if (!opts.from) { opts.from = this.web3.eth.defaultAccount; }
        const { answer, updatedAt } = this.sanitizeReading(reading)
        const {
            roundId: latestRoundId
        } = await this.readLatest().catch(()=>({}));

        let roundId = latestRoundId + 1;

        return this.instance.methods.setRoundData(roundId, answer, updatedAt).send(opts);
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
