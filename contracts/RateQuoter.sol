// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import "./interfaces/IRateQuoter.sol";

/**
* @title RateQuoter Contract
* @notice The contract quoting exchange rates for asset tokens
* @author vkonst
*/
contract RateQuoter is Initializable, ContextUpgradeSafe, IRateQuoter {

    /// @dev Asset address to the feed
    mapping (address => PriceFeed) private assets;

    /// @inheritdoc IRateQuoter
    function initialize(PriceFeed[] calldata priceFeeds) external initializer {

    }

    /// @inheritdoc IRateQuoter
    function quotePrice(address asset) external returns (uint256 rate, uint256 timestamp) {
        return (ONE_UNIT, block.timestamp);
    }
}
