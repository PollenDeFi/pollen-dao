/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "../PollenDAO/Modules/minter/MinterModuleStorage.sol";

/// @title MockMinterGetters
/// @notice This mock that extend Getters contract functionalities for testing purposes

contract MockMinterGetters is MinterModuleStorage {
    function getRate() external view returns (uint256) {
        MinterStorage storage ms = getMinterStorage();
        return ms.schedule[0].rate;
    }
}
