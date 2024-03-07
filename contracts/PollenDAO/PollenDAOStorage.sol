// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

contract PollenDAOStorage {
    bytes32 internal constant POLLENDAO_STORAGE_SLOT =
        keccak256("PollenDAO.storage");

    uint256 internal constant PRECISION = 1e18;
    address internal constant ZERO_ADDRESS =
        0x0000000000000000000000000000000000000000;

    struct DAOStorage {
        mapping(address => bool) admin;
        address pollenToken;
        address vePollenToken;
        mapping(bytes4 => address) implementations;
        mapping(address => bytes32) selectorsHash;
    }

    modifier onlyAdmin() {
        DAOStorage storage ds = getPollenDAOStorage();
        require(ds.admin[msg.sender], "Admin access required");
        _;
    }

    /* solhint-disable no-inline-assembly */
    function getPollenDAOStorage()
        internal
        pure
        returns (DAOStorage storage ms)
    {
        bytes32 slot = POLLENDAO_STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
