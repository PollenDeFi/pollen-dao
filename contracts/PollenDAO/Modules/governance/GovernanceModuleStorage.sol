// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

contract GovernanceModuleStorage {
    bytes32 private constant GOVERNANCE_STORAGE_SLOT =
        keccak256("PollenDAO.Governance.storage");

    uint256 internal constant QUORUM_BASE_PERCENT = 1000;
    struct Proposal {
        address submitter;
        address executer;
        uint128 yes;
        uint128 no;
        uint128 quorum;
        uint64 expires;
        uint64 timeLock;
        bool executed;
    }

    struct GovernanceStorage {
        uint256 proposalCount;
        mapping(uint256 => mapping(address => uint256)) voted; // proposal id=> user => amount voted
        mapping(uint256 => Proposal) proposals;
        uint256 quorum;
        uint256 votingPeriod;
        uint256 timeLock;
    }

    /* solhint-disable no-inline-assembly */
    function getGovernanceStorage()
        internal
        pure
        returns (GovernanceStorage storage ms)
    {
        bytes32 slot = GOVERNANCE_STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
