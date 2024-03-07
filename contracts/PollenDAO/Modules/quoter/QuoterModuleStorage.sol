// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title Quoter storage contract
/// @author Jaime Delgado
/// @notice define the storage required by the quoter module
/// @dev This contract must be inherited by modules that require access to variables defined here

contract QuoterModuleStorage {
    bytes32 private constant QUOTER_STORAGE_SLOT =
        keccak256("PollenDAO.quoter.storage");

    enum RateBase {
        Usd,
        Eth
    }

    struct QuoterStorage {
        // Maps RateBase and asset to priceFeed
        mapping(RateBase => mapping(address => address)) priceFeeds;
    }

    /* solhint-disable no-inline-assembly */
    function getQuoterStorage()
        internal
        pure
        returns (QuoterStorage storage ms)
    {
        bytes32 slot = QUOTER_STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
