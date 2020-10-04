pragma solidity >=0.6 <0.7.0;
pragma experimental ABIEncoderV2;

/**
* @title IRateQuoter Interface
* @author vkonst
*/
interface IRateQuoter {

    /// @dev Only "Spot" for now
    enum RateTypes { Spot, Fixed }
    /// @dev if a rate is quoted against USD or ETH
    enum RateBase { Usd, Eth }
    /**
     * @dev if a rate is expressed in a number of ...
     * the base currency units for one quoted currency unit (i.e. "Direct"),
     * or quoted currency units per one base currency unit (i.e. "Indirect")
     */
    enum RateSide { Direct, Indirect }

    struct PriceFeed {
        address feed;
        address asset;
        RateBase base;
        RateSide side;
        uint8 decimals;
        uint16 maxDelaySecs;
        // 0 - highest; default for now, as only one feed for an asset supported
        uint8 priority;
    }

    /**
     * @notice Initializes the contract and sets the token name and symbol.
     * Registers the deployer as the contract `owner`. Can be called once only.
     */
    function initialize(PriceFeed[] memory priceFeeds) external;

    /**
     * @dev Return latest price from the feed highest priority with default decimals
     * (it reverts if the rate is older then the RATE_DELAY_MAX_SECS)
     */
    function quotePrice(address asset) external returns (uint256 rate, uint256 timestamp);

// TODO: Extend the IRateQuoter to support the following specs
//    function addPriceFeed(
//        address asset,
//        address feed,
//        RateBase base,
//        RateSide side,
//        uint256 decimals,
//        uint256 maxDelay
//    ) external ;
//
//    function quotePriceExtended(
//        address asset,
//        address feed,
//        RateBase base,
//        RateSide side,
//        uint256 decimals,
//        uint256 maxDelay,
//        bool forceUpdate
//    ) external returns (uint256 rate, uint256 timestamp);
//
//    function getPriceFeedData(uint256 feedId) external returns (
//        address asset,
//        address feed,
//        RateBase base,
//        RateSide side,
//        uint256 decimals,
//        uint256 maxDelay
//    );
//
//    function removePriceFeed(uint256 feedId) external;
//
//    /**
//     * @dev
//     */
//    event PriceFeedAdded(uint256 feedId);
//
//    /**
//     * @dev
//     */
//    event PriceFeedRemoved(uint256 feedId);
}
