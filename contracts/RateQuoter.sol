// SPDX-License-Identifier: MIT
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
    using SafeMath for uint256;

    uint8 internal constant RATE_DECIMALS = 18;
    uint128 internal constant RATE_DELAY_MAX_SECS = 3600;

    /**
     * @dev Reserved for possible storage structure changes
     */
    uint256[49] private __gap;

    /// @dev Asset address to the feed
    mapping (address => PriceFeed) private _feeds;

    /// @inheritdoc IRateQuoter
    function initialize() external override initializer {
        __Ownable_init();
    }

    /// @inheritdoc IRateQuoter
    function quotePrice(address asset) external override returns (uint256 rate, uint256 updatedAt) {
        // TODO: handle decimals, quote type (direct/indirect)
        // TODO: make it revert if the rate is older then the RATE_DELAY_MAX_SECS)
        // TODO: handle USD rates for some assets
        PriceFeed memory priceFeed = _feeds[asset];
        ( , int256 answer, , uint256 _updatedAt, ) = IAggregatorV3(priceFeed.feed).latestRoundData();
        updatedAt = _updatedAt;
        rate = priceFeed.decimals == RATE_DECIMALS
            ? uint256(answer)
            : (
                RATE_DECIMALS > priceFeed.decimals
                    ? uint256(answer).mul(10 ** uint256(RATE_DECIMALS - priceFeed.decimals))
                    : uint256(answer).div(10 ** uint256(priceFeed.decimals - RATE_DECIMALS))
            );
    }

    /// @inheritdoc IRateQuoter
    function getPriceFeedData(address asset) external view override returns (PriceFeed memory) {
        return _feeds[asset];
    }

    /// @inheritdoc IRateQuoter
    function addPriceFeed(PriceFeed memory priceFeed) external override onlyOwner {
        _addPriceFeed(priceFeed);
    }

    /// @inheritdoc IRateQuoter
    function addPriceFeeds(PriceFeed[] memory priceFeeds) external override onlyOwner {
        for(uint256 i=0; i<priceFeeds.length; i++) {
            _addPriceFeed(priceFeeds[i]);
        }
    }

    /// @inheritdoc IRateQuoter
    function removePriceFeed(address asset) external override onlyOwner {
        require(_feeds[asset].asset != address(0), "RateQuoter: feed not found");

        _feeds[asset] = PriceFeed(address(0), address(0), RateBase.Usd, QuoteType.Direct, 0, 0, 0);
        emit PriceFeedRemoved(asset);
    }

    function _addPriceFeed(PriceFeed memory priceFeed) internal {
        address asset = priceFeed.asset;
        address feed = priceFeed.feed;
        require(asset != address(0), "RateQuoter: invalid asset address");
        require(asset != address(0), "RateQuoter: invalid feed address");
        uint8 decimals = IAggregatorV3(feed).decimals();
        require(priceFeed.decimals == decimals, "RateQuoter: invalid feed decimals");

        _feeds[asset] = priceFeed;
        emit PriceFeedAdded(asset, feed);
    }
}
