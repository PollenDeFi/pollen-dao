// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

/// @title MockModuleStorage
/// @notice This mock of a module storage for testing purposes

contract MockModuleStorage {
    bytes32 private constant MOCK_MODULE_STORAGE_SLOT =
        keccak256("PollenDAO.mockModule.storage");

    struct MockStorage {
        uint256 mockVariable;
    }

    /* solhint-disable no-inline-assembly */
    function getMockStorage() internal pure returns (MockStorage storage ms) {
        bytes32 slot = MOCK_MODULE_STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
