// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title IPollen
/// @notice Pollen Token interface

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPollen is IERC20 {
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;
}
