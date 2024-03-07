// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "../../../interface/IPollen.sol";
import "../../../interface/ILockedPollen.sol";
import "../../PollenDAOStorage.sol";
import "./GovernanceModuleStorage.sol";

contract Governance is PollenDAOStorage, GovernanceModuleStorage {
    event NewProposal(address indexed submitter, address executer, uint256 id);
    event Voted(
        address indexed voter,
        uint256 proposalId,
        bool vote,
        uint256 amount
    );
    event ClaimedTokens(
        address indexed account,
        uint256 proposalId,
        uint256 amount
    );
    event QuorumChanged(uint256 newQuorum);
    event TimeLockChanged(uint256 newTimeLock);
    event VotingPeriodChanged(uint256 newVotingPeriod);

    // External functions

    /// @notice Set Quorum
    /// @param supplyPercent minimum rate to have quorum (3 decimal points)
    function setQuorum(uint256 supplyPercent) external onlyAdmin {
        require(
            supplyPercent <= QUORUM_BASE_PERCENT && supplyPercent != 0,
            "Invalid percentage"
        );
        GovernanceStorage storage gs = getGovernanceStorage();
        gs.quorum = supplyPercent;
        emit QuorumChanged(supplyPercent);
    }

    /// @notice Set Quorum
    /// @param timeLock time that the execution is delayed after the vote ends
    function setTimeLock(uint256 timeLock) external onlyAdmin {
        GovernanceStorage storage gs = getGovernanceStorage();
        gs.timeLock = timeLock;
        emit TimeLockChanged(timeLock);
    }

    /// @notice Set voting period
    /// @param votingPeriod determines how long the voting last
    function setVotingPeriod(uint256 votingPeriod) external onlyAdmin {
        GovernanceStorage storage gs = getGovernanceStorage();
        gs.votingPeriod = votingPeriod;
        emit VotingPeriodChanged(votingPeriod);
    }

    /// @notice submit new proposal
    /// @param executer address of the contract that executes the proposal
    function submitProposal(address executer) external {
        GovernanceStorage storage gs = getGovernanceStorage();
        DAOStorage storage ds = getPollenDAOStorage();
        require(gs.timeLock != 0, "TimeLock not set");
        require(gs.votingPeriod != 0, "Voting period not set");
        require(gs.quorum != 0, " Quorum not set");

        ILockedPollen vePLN = ILockedPollen(ds.vePollenToken);
        uint256 supply = vePLN.totalSupply();

        uint256 id = gs.proposalCount;
        Proposal memory proposal = Proposal({
            submitter: msg.sender,
            executer: executer,
            yes: 0,
            no: 0,
            quorum: uint128((gs.quorum * supply) / QUORUM_BASE_PERCENT),
            expires: uint64(block.timestamp + gs.votingPeriod),
            timeLock: uint64(block.timestamp + gs.votingPeriod + gs.timeLock),
            executed: false
        });

        gs.proposals[id] = proposal;
        gs.proposalCount++;
        emit NewProposal(msg.sender, executer, id);
    }

    /// @notice Vote an active proposal
    /// @param id id of the proposal
    /// @param voteType true for yes, false for no
    function voteProposal(uint256 id, bool voteType) external {
        DAOStorage storage ds = getPollenDAOStorage();
        GovernanceStorage storage gs = getGovernanceStorage();
        ILockedPollen vePLN = ILockedPollen(ds.vePollenToken);

        uint256 votingPower = vePLN.getVotingPower(msg.sender);

        require(gs.voted[id][msg.sender] == 0, "User has voted already");

        require(gs.proposals[id].expires > block.timestamp, "Proposal expired");

        if (voteType) {
            gs.proposals[id].yes += uint128(votingPower);
        } else {
            gs.proposals[id].no += uint128(votingPower);
        }
        gs.voted[id][msg.sender] += votingPower;

        emit Voted(msg.sender, id, voteType, votingPower);
    }

    /// @notice executes a proposal that passed
    /// @param id proposal id
    function executeProposal(uint256 id) external {
        DAOStorage storage ds = getPollenDAOStorage();
        GovernanceStorage storage gs = getGovernanceStorage();
        Proposal storage proposal = gs.proposals[id];
        require(!proposal.executed, "Proposal has been executed");
        require(proposal.expires < block.timestamp, "Voting active");
        require(proposal.timeLock < block.timestamp, "Time lock active");
        require(
            proposal.yes > proposal.no && proposal.yes > proposal.quorum,
            "Not passed"
        );
        address executer = proposal.executer;
        ds.admin[executer] = true;
        (bool success, ) = executer.call(abi.encodeWithSignature("execute()"));
        ds.admin[executer] = false;
        require(success, "Proposal execution failed");
        proposal.executed = true;
    }
}
