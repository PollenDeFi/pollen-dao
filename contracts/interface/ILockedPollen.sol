// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ILockedPollen
/// @notice Locked Pollen Token interface

interface ILockedPollen is IERC20 {
    struct InflationInfo {
        uint256 reserved;
        uint256 supply;
    }

    function lock(
        address account,
        uint256 amount,
        uint256 lockEnd
    ) external;

    function MAX_REWARDS_FUNDS() external view returns (uint256);

    function increaseLock(address account, uint256 amount) external;

    function extendLock(uint256 newLockEnd) external;

    function unlock() external;

    function getVotingPower(address account) external view returns (uint256);

    function getBoostingRate(address account) external view returns (uint256);

    function burn(address account, uint256 amount) external;

    function inflationInfo() external view returns (InflationInfo calldata);
}
