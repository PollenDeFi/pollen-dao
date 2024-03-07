// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title PollenDAO Quoter
/// @author Jaime Delgado
/// @notice module to get price of assets
/// @dev This contract function's can be called only by the admin

import "../../PollenDAOStorage.sol";
import "./QuoterModuleStorage.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Quoter is PollenDAOStorage, QuoterModuleStorage {
    uint256 private constant RATE_DECIMALS = 18;

    /// @dev emit event when a price feed is added
    event PriceFeedAdded(
        address indexed asset,
        address feed,
        RateBase rateBase
    );

    /// @dev emits an event when a price feed is removed
    event PriceFeedRemoved(address indexed asset, RateBase rateBase);

    // External functions

    /// @notice add a feed for a rateBase and asset
    /// @param rateBase base currency for the price
    /// @param asset asset to be priced
    /// @param feed address of the chainlink feed
    function addPriceFeed(
        RateBase rateBase,
        address asset,
        address feed
    ) external onlyAdmin {
        _addPriceFeed(rateBase, asset, feed);
    }

    /// @notice add feeds for assets
    /// @param rateBase base currency for the price
    /// @param asset asset to be priced
    /// @param feed address of the chainlink feed
    function addPriceFeeds(
        RateBase[] calldata rateBase,
        address[] calldata asset,
        address[] calldata feed
    ) external onlyAdmin {
        for (uint256 i = 0; i < asset.length; i++) {
            _addPriceFeed(rateBase[i], asset[i], feed[i]);
        }
    }

    /// @notice remove a feed
    /// @param rateBase base currency for the price
    /// @param asset asset to be priced
    function removePriceFeed(RateBase rateBase, address asset)
        external
        onlyAdmin
    {
        QuoterStorage storage qs = getQuoterStorage();
        require(
            qs.priceFeeds[rateBase][asset] != address(0),
            "Quoter: feed not found"
        );
        qs.priceFeeds[rateBase][asset] = address(0);
        emit PriceFeedRemoved(asset, rateBase);
    }

    // External functions that are view

    /// @notice getter for price feed address
    /// @param rateBase the base for the quote (USD, ETH)
    /// @param asset asset
    /// @return priceFeed price feed address
    function getFeed(RateBase rateBase, address asset)
        external
        view
        returns (address priceFeed)
    {
        QuoterStorage storage qs = getQuoterStorage();
        priceFeed = qs.priceFeeds[rateBase][asset];
    }

    // Public functions

    // Public functions that are view

    /// @notice get a price for an asset
    /// @param rateBase base currency for the price
    /// @param asset asset to be priced
    /// @return rate
    /// @return updatedAt
    function quotePrice(RateBase rateBase, address asset)
        public
        view
        returns (uint256 rate, uint256 updatedAt)
    {
        QuoterStorage storage qs = getQuoterStorage();
        address feed = qs.priceFeeds[rateBase][asset];
        require(feed != address(0), "Quoter: asset doesn't have feed");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed);
        uint8 decimals = priceFeed.decimals();
        int256 answer;
        (, answer, , updatedAt, ) = priceFeed.latestRoundData();
        rate = decimals == RATE_DECIMALS
            ? uint256(answer)
            : uint256(answer) * (10**uint256(RATE_DECIMALS - decimals));
    }

    // Internal functions

    /// @notice add a feed for a rateBase and asset
    /// @param rateBase base currency for the price
    /// @param asset asset to be priced
    /// @param feed address of the chainlink feed
    function _addPriceFeed(
        RateBase rateBase,
        address asset,
        address feed
    ) internal {
        require(asset != address(0), "Quoter: asset cannot be zero address");
        require(feed != address(0), "Quoter: feed cannot be zero address");
        QuoterStorage storage qs = getQuoterStorage();
        qs.priceFeeds[rateBase][asset] = feed;
        emit PriceFeedAdded(asset, feed, rateBase);
    }
}
