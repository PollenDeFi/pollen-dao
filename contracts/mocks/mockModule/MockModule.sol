// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

import "../../PollenDAO/PollenDAOStorage.sol";
import "./MockModuleStorage.sol";

/// @title MockModule
/// @notice This mock of a module for testing purposes

contract MockModule is PollenDAOStorage, MockModuleStorage {
    function mockFunction(address) external pure returns (uint256) {
        return 0;
    }
}
