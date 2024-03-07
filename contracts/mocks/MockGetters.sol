/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "../PollenDAO/PollenDAOStorage.sol";

/// @title MockGetters
/// @notice This mock that extend Getters contract functionalities for testing purposes

contract MockGetters is PollenDAOStorage {
    function isRegisteredModule(
        address implementation,
        bytes4[] calldata selectors
    ) external view returns (bool) {
        DAOStorage storage ds = getPollenDAOStorage();
        for (uint256 i = 0; i < selectors.length; i++) {
            if (ds.implementations[selectors[i]] == implementation) {
                return true;
            }
        }
        return false;
    }

    function isAdmin(address user) external view returns (bool) {
        DAOStorage storage ds = getPollenDAOStorage();
        return ds.admin[user];
    }
}
