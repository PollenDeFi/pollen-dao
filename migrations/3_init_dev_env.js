/* global artifacts, config, web3 */
const MockAssetToken = artifacts.require("MockAssetToken");
const MockPriceOracle = artifacts.require("MockPriceOracle");
const PollenDAO = artifacts.require("PollenDAO_v1");
const RateQuoter = artifacts.require("RateQuoter");

module.exports = function(deployer) {
    const e18 = '000000000000000000';
    const e7 = '0000000';

    deployer.then(async () => {
        if (
            !process.__userNamespace__ ||
            !process.__userNamespace__.options ||
            !process.__userNamespace__.options.network.startsWith("dev") ||
            process.__userNamespace__.initialized === true
        ) {
            return;
        }

        const { addresses } = process.__userNamespace__.instances;

        console.log('Deploying one mock asset token and two mock price feeds...');
        // (for simplicity, w/o proxies and `delegatecall`ing)
        const mockAssetToken = await MockAssetToken.new();
        await mockAssetToken.initialize('Mock Asset Token', 'MAT', '500' + e18);
        addresses.MockAssetToken = mockAssetToken.address;

        const mockPriceOracleP = await MockPriceOracle.new();
        await mockPriceOracleP.initialize( '2', '18', 'PLN / ETH');
        addresses.MockPriceOracleP = mockPriceOracleP.address;

        const mockPriceOracleA = await MockPriceOracle.new();
        await mockPriceOracleA.initialize('2', '8', 'MT2 / ETH');
        addresses.MockPriceOracleA = mockPriceOracleA.address;

        console.log('Recording prices with the price feeds...');
        const updatedAt = Number.parseInt(Date.now() / 1000);
        await mockPriceOracleP.setRoundData('1' /* roundId */, '3'+e18 /* answer */, updatedAt);
        await mockPriceOracleA.setRoundData('1' /* roundId */, '1'+e7 /* answer */, updatedAt);

        console.log('Registering the feeds with the quoter...');
        const rateQuoter = await RateQuoter.at(addresses.RateQuoter);
        await rateQuoter.addPriceFeeds([
            {
                feed: addresses.MockPriceOracleP,
                asset: addresses.Pollen,
                base: '0',
                side: '1',
                decimals: '18',
                maxDelaySecs: '600',
                priority: 0
            },
            {
                feed: addresses.MockPriceOracleA,
                asset: addresses.MockAssetToken,
                base: '0',
                side: '1',
                decimals: '8',
                maxDelaySecs: '600',
                priority: 0
            },
        ]);

        console.log('Register the mock asset and the quoter with the PollenDao...');
        const pollenDao = await PollenDAO.at(addresses.PollenDAO);
        await pollenDao.addAsset(addresses.MockAssetToken);
        await pollenDao.setPriceQuoter(addresses.RateQuoter);

        console.log(`All done.\n${JSON.stringify(addresses, null, 2)}`);
        process.__userNamespace__.initialized = true;
    });
}
