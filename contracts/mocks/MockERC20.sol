/// SPDX-License-Identifier: GNU General Public License v3.0

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice This mock of an ERC20 token for testing purposes

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /// mints `amount` to `to`
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
