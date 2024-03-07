/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "../PollenDAO/Modules/governance/GovernanceModuleStorage.sol";

/// @title MockGovGetters
/// @notice This mock that extend Getters contract functionalities for testing purposes

contract MockGovGetters is GovernanceModuleStorage {
    function getQuorum() public view returns (uint256) {
        GovernanceStorage storage gs = getGovernanceStorage();
        return gs.quorum;
    }

    function getTimeLock() public view returns (uint256) {
        GovernanceStorage storage gs = getGovernanceStorage();
        return gs.timeLock;
    }

    function getVotingPeriod() public view returns (uint256) {
        GovernanceStorage storage gs = getGovernanceStorage();
        return gs.votingPeriod;
    }

    function getProposal(uint256 id)
        public
        view
        returns (
            address,
            address,
            uint256,
            uint256
        )
    {
        GovernanceStorage storage gs = getGovernanceStorage();
        return (
            gs.proposals[id].submitter,
            gs.proposals[id].executer,
            gs.proposals[id].yes,
            gs.proposals[id].no
        );
    }

    function hasUserVoted(address user, uint256 id) public view returns (bool) {
        GovernanceStorage storage gs = getGovernanceStorage();
        if (gs.voted[id][user] > 0) return true;
        return false;
    }
}
