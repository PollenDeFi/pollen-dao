// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

/**
 * @title DataTypes
 * @dev Definition of shared types
 */
library DataTypes {
    /// @notice Type for representing a proposal type
    enum ProposalType {
        Invest,
        Divest
    }

    /// @notice Type for representing a proposal status
    enum ProposalStatus {
        Null,
        Submitted,
        Executed,
        Rejected,
        Passed,
        Pended,
        Expired
    }

    /// @notice Current (mutable) params of a proposal
    struct ProposalState {
        ProposalStatus status;
        uint88 yesVotes;
        uint88 noVotes;
    }

    /// @notice Voting params a proposal (immutable)
    struct ProposalParams {
        uint32 votingOpen;
        uint32 votingExpiry;
        uint32 executionOpen;
        uint32 executionExpiry;
        uint88 passVotes;
    }

    /// @notice Original terms of a proposal (immutable)
    struct ProposalTerms {
        ProposalType proposalType;
        uint256 votingTermsId;
        address submitter;
        address executor;
        address assetTokenAddress;
        uint256 assetTokenAmount;
    }

    /// @notice State, terms and parameters of a proposal
    struct Proposal {
        ProposalState state;
        ProposalParams params;
        ProposalTerms terms;
    }

    /// @notice Voting terms
    struct VotingTerms {
        // If new proposals may be submitted with this terms
        bool isEnabled;
        // If Vesting Pools are excluded from voting and quorum
        bool isExclPools;
        // The quorum required to pass a proposal vote in % points
        uint8 quorum;
        // Seconds after proposal submission until voting expires
        uint32 votingExpiryDelay;
        // Seconds after proposal voting expires until execution opens
        uint32 executionOpenDelay;
        // Seconds after proposal execution opens until execution expires
        uint32 executionExpiryDelay;
        // Seconds since execution opens when only the `executor` may execute
        // (has no effect for a proposal with the `executor` set to zero)
        uint32 restrictExecPeriod;
        // Maximum value of a proposal, in % points of the portfolio
        // (unlimited if zero)
        uint8 maxImpact;
    }
}
