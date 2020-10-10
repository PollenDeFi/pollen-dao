// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./interfaces/IRateQuoter.sol";
import "./interfaces/chainlink/IAggregatorV3.sol";

/**
* @title RateQuoter Contract
* @notice The contract quoting exchange rates for asset tokens
* @author vkonst, scorpion9979
*/
contract RateQuoter is Initializable, OwnableUpgradeSafe, IRateQuoter {
    using SafeMath for uint8;
    using SafeMath for uint64;
    using SafeMath for uint128;
    using SafeMath for uint256;

    uint64 internal constant RATE_DECIMALS = 18;
    uint64 internal constant ONE_UNIT = 1e18;
    uint128 internal constant RATE_DELAY_MAX_SECS = 3600;

    /**
     * @dev Reserved for possible storage structure changes
     */
    uint256[49] private __gap;

    /// @dev Asset address to the feed
    mapping (address => PriceFeed) private _feeds;

    /// @inheritdoc IRateQuoter
    function initialize(PriceFeed[] memory priceFeeds) external override initializer {
        __Ownable_init();
        for(uint256 i=0; i<priceFeeds.length; i.add(1)) {
            _feeds[priceFeeds[i].asset] = priceFeeds[i];
            emit PriceFeedAdded(priceFeeds[i].asset, priceFeeds[i].feed);
        }
    }

    /// @inheritdoc IRateQuoter
    function quotePrice(address asset) external override returns (uint256 rate, uint256 timestamp) {
        // TODO: handle decimals, quote type (direct/indirect)
        // TODO: make it revert if the rate is older then the RATE_DELAY_MAX_SECS)
        // TODO: handle USD rates for some assets
        PriceFeed memory priceFeed = _feeds[asset];
        uint8 feedDecimals = IAggregatorV3(priceFeed.feed).decimals();
        (, int256 answer, , uint256 updatedAt, ) = IAggregatorV3(priceFeed.feed).latestRoundData();
        uint256 standardizedRate = uint256(answer).mul(10 ** RATE_DECIMALS.sub(feedDecimals));
        return (standardizedRate, updatedAt);
    }

        function addPriceFeed(PriceFeed memory priceFeed) external override onlyOwner {
            address asset = priceFeed.asset;
            address feed = priceFeed.feed;
            require(asset != address(0), "RateQuoter: invalid asset address");
            require(asset != address(0), "RateQuoter: invalid feed address");
            _feeds[asset] = priceFeed;
            emit PriceFeedAdded(asset, feed);
        }

        function getPriceFeedData(address asset) external override returns (PriceFeed memory) {
            return _feeds[asset];
        }
}
