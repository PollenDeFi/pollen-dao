/* global artifacts, config, web3 */
const MockAssetToken = artifacts.require("MockAssetToken");
const MockPriceOracle = artifacts.require("MockPriceOracle");
const PollenDAO = artifacts.require("PollenDAO_v1");
const RateQuoter = artifacts.require("RateQuoter");

module.exports = function(deployer) {
    const e18 = '000000000000000000';

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

        console.log('Deploying two mock assets token and three mock price feeds...');
        // (for simplicity, w/o proxies and `delegatecall`ing)
        const mockAssetToken1 = await MockAssetToken.new();
        await mockAssetToken1.initialize('Mock Asset Token', 'MAT', '500' + e18);
        addresses.MockAssetToken = mockAssetToken1.address;

        const mockAssetToken2 = await MockAssetToken.new();
        await mockAssetToken2.initialize('Mock Asset Token2', 'MAT2', '500' + e18);
        addresses.MockAssetToken2 = mockAssetToken2.address;

        const mockPriceOracleP = await MockPriceOracle.new();
        await mockPriceOracleP.initialize( '2', '18', 'PLN / ETH');
        addresses.MockPriceOracleP = mockPriceOracleP.address;

        const mockPriceOracle1 = await MockPriceOracle.new();
        await mockPriceOracle1.initialize('2', '18', 'MAT1 / ETH');
        addresses.MockPriceOracle1 = mockPriceOracle1.address;

        const mockPriceOracle2 = await MockPriceOracle.new();
        await mockPriceOracle2.initialize('2', '18', 'MAT2 / ETH');
        addresses.MockPriceOracle2 = mockPriceOracle2.address;

        console.log('Recording prices with the price feeds...');
        const updatedAt = Number.parseInt(Date.now() / 1000);
        await mockPriceOracleP.setRoundData('1' /* roundId */, '20'+e18 /* answer */, updatedAt);
        await mockPriceOracle1.setRoundData('1' /* roundId */, '5'+e18 /* answer */, updatedAt);
        await mockPriceOracle2.setRoundData('1' /* roundId */, '4'+e18 /* answer */, updatedAt);

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
                feed: addresses.MockPriceOracle1,
                asset: addresses.MockAssetToken,
                base: '0',
                side: '1',
                decimals: '18',
                maxDelaySecs: '600',
                priority: 0
            },
            {
                feed: addresses.MockPriceOracle2,
                asset: addresses.MockAssetToken2,
                base: '0',
                side: '1',
                decimals: '18',
                maxDelaySecs: '600',
                priority: 0
            },
        ]);

        console.log('Register the mock asset and the quoter with the PollenDao...');
        const pollenDao = await PollenDAO.at(addresses.PollenDAO);
        await pollenDao.addAsset(addresses.MockAssetToken);
        await pollenDao.addAsset(addresses.MockAssetToken2);
        await pollenDao.setPriceQuoter(addresses.RateQuoter);

        console.log(`All done.\n${JSON.stringify(addresses, null, 2)}`);
        process.__userNamespace__.initialized = true;
    });
}
