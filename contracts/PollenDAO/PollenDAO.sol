// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "./PollenDAOStorage.sol";

contract PollenDAO is PollenDAOStorage {
    /// Admin role transferred
    event AdminRoleTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );

    /// @dev emitted when the address of the PollenToken has been set
    event PollenTokenSet(address pollenTokenAddr, address vePollenTokenAddr);

    /// @dev Emitted when a module has been added
    event ModuleAdded(address indexed moduleAddr, bytes4[] selectors);

    /// @dev Emitted when a module is removed
    event ModuleRemoved(address indexed moduleAddr, bytes4[] selectors);

    /// @dev Emitted when a module has been upgraded
    event ModuleUpdated(
        address indexed newImplementation,
        address indexed oldImplementation,
        bytes4[] newSelectors,
        bytes4[] oldSelectors
    );

    constructor() {
        _setAdmin(ZERO_ADDRESS, msg.sender);
    }

    /// @notice pass a call to a module
    /* solhint-disable no-complex-fallback, payable-fallback, no-inline-assembly */
    fallback() external {
        DAOStorage storage ds = getPollenDAOStorage();
        address implementation = ds.implementations[msg.sig];
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(
                gas(),
                implementation,
                0,
                calldatasize(),
                0,
                0
            )
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    /* solhint-enable no-complex-fallback, payable-fallback, no-inline-assembly */

    // External functions

    /// @notice Transfers admin role of the contract to a new account (`newAdmin`)
    /// @param newAdmin new PollenDAO admin
    function transferAdminRole(address newAdmin) external onlyAdmin {
        require(newAdmin != ZERO_ADDRESS, "newAdmin cannot be zero address");
        _setAdmin(msg.sender, newAdmin);
    }

    /// @notice Transfers admin role of the contract to zero address
    function renounceAdminRole() external onlyAdmin {
        _setAdmin(msg.sender, ZERO_ADDRESS);
    }

    /// @notice Sets the address of the PollenToken, to be used throughout the protocol
    /// @param pollenToken_ address of PLN
    /// @param vePollenToken_ address of vePLN
    function setPollenTokens(address pollenToken_, address vePollenToken_)
        external
        onlyAdmin
    {
        require(pollenToken_ != ZERO_ADDRESS, "PLN cannot be zero address");
        require(vePollenToken_ != ZERO_ADDRESS, "vePLN cannot be zero address");
        DAOStorage storage ds = getPollenDAOStorage();
        ds.pollenToken = pollenToken_;
        ds.vePollenToken = vePollenToken_;
        emit PollenTokenSet(pollenToken_, vePollenToken_);
    }

    /// @notice upgrade module
    /// @dev oldImplementation should be registered
    /// @param newImplementation address of the module to register
    /// @param oldImplementation address of the module to remove
    /// @param newSelectors new function signatures list
    /// @param oldSelectors old function signatures list
    function updateModule(
        address newImplementation,
        address oldImplementation,
        bytes4[] calldata newSelectors,
        bytes4[] calldata oldSelectors
    ) external onlyAdmin {
        removeModule(oldImplementation, oldSelectors);
        addModule(newImplementation, newSelectors);
        emit ModuleUpdated(
            newImplementation,
            oldImplementation,
            newSelectors,
            oldSelectors
        );
    }

    // External functions that are view

    /// @return plnTokenAddress address of PollenToken
    function pollenToken() external view returns (address plnTokenAddress) {
        DAOStorage storage ds = getPollenDAOStorage();
        return ds.pollenToken;
    }

    // Public functions

    /// @notice Adds a new module
    /// @dev function selector should not have been registered.
    /// @param implementation address of the implementation
    /// @param selectors selectors of the implementation contract
    function addModule(address implementation, bytes4[] calldata selectors)
        public
        onlyAdmin
    {
        DAOStorage storage ds = getPollenDAOStorage();
        for (uint256 i = 0; i < selectors.length; i++) {
            require(
                ds.implementations[selectors[i]] == ZERO_ADDRESS,
                "Selector already registered"
            );
            ds.implementations[selectors[i]] = implementation;
        }
        bytes32 hash = keccak256(abi.encode(selectors));
        ds.selectorsHash[implementation] = hash;
        emit ModuleAdded(implementation, selectors);
    }

    // Private functions
    /// @notice sets the admin of PollenDAO
    /// @param newAdmin new PollenDAO admin
    /// @param oldAdmin old PollenDAO admin
    function _setAdmin(address oldAdmin, address newAdmin) private {
        DAOStorage storage ds = getPollenDAOStorage();
        ds.admin[newAdmin] = true;
        ds.admin[oldAdmin] = false;
        emit AdminRoleTransferred(oldAdmin, newAdmin);
    }

    /// @notice Adds a new module and supported functions
    /// @dev function selector should not exist.
    /// @param implementation implementation address
    /// @param selectors function signatures
    function removeModule(address implementation, bytes4[] calldata selectors)
        private
        onlyAdmin
    {
        DAOStorage storage ds = getPollenDAOStorage();
        bytes32 hash = keccak256(abi.encode(selectors));
        require(
            ds.selectorsHash[implementation] == hash,
            "Invalid selector list"
        );

        for (uint256 i = 0; i < selectors.length; i++) {
            ds.implementations[selectors[i]] = ZERO_ADDRESS;
        }
        emit ModuleRemoved(implementation, selectors);
    }
}
