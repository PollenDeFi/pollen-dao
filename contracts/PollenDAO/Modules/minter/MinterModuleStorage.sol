// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

contract MinterModuleStorage {
    bytes32 private constant MINTER_STORAGE_SLOT =
        keccak256("PollenDAO.minter.storage");

    uint256 internal constant TIME_LIMIT_200M = 1673458433;

    struct IssuanceInfo {
        uint256 maxTime; // max time where this rate is valid
        uint256 offsetX; // starting time point for this rate
        uint256 offsetY; // latest max amount of tokens possible in the previous period
        uint256 rate; // issuance rate
    }

    struct MinterStorage {
        IssuanceInfo[] schedule;
        uint256 maxNumWithdrawals;
        uint256 rewardMultiplier;
        uint256 penaltyMultiplier;
        uint256 boostingScale;
        uint256 totalStakingRewards;
    }

    /* solhint-disable no-inline-assembly */
    function getMinterStorage()
        internal
        pure
        returns (MinterStorage storage ms)
    {
        bytes32 slot = MINTER_STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
