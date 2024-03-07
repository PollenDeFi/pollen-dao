// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

/// @title PortfolioAssetSet Library
/// @notice Library for representing a set of addresses whitelisted for PollenDAO
library PortfolioAssetSet {
    /// @notice Type for representing a set of addresses
    /// @member elements The elements of the set, contains address 0x0 for deleted elements
    /// @member indexes A mapping of the address to the index in the set, counted from 1 (rather than 0)
    struct AssetSet {
        address[] elements;
        mapping(address => bool) exists;
        mapping(address => bool) isWhitelisted;
        uint256 numWhitelistedAssets;
    }

    // Internal functions

    /// @notice Add an element to the set (internal)
    /// @param self The set
    /// @param value The element to add
    /// @return False if the element is already in the set or is address 0x0
    function add(AssetSet storage self, address value) internal returns (bool) {
        if (self.isWhitelisted[value]) return false;

        if (!self.exists[value]) {
            self.elements.push(value);
            self.exists[value] = true;
        }

        self.isWhitelisted[value] = true;
        self.numWhitelistedAssets++;

        return true;
    }

    /// @notice Remove an element from the set (internal)
    /// @param self The set
    /// @param value The element to remove
    /// @return False if the element is not in the set
    function remove(AssetSet storage self, address value)
        internal
        returns (bool)
    {
        if (!self.exists[value] || !self.isWhitelisted[value]) return false;

        self.isWhitelisted[value] = false;

        self.numWhitelistedAssets--;
        return true;
    }

    // Internal functions that are view

    /// @notice Returns true if an element is in the set (internal view)
    /// @param self The set
    /// @param value The element
    /// @return True if the element is in the set
    function contains(AssetSet storage self, address value)
        internal
        view
        returns (bool)
    {
        return self.exists[value] && self.isWhitelisted[value];
    }
}
