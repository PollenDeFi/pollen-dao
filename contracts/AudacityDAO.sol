pragma solidity >=0.6 <0.7.0;

import "./interfaces/IAudacityDAO.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
* @title AudacityDAO Contract
* @notice The main Audacity DAO contract
* @dev TODO - prevent double voting
* @author gtlewis
* @author scorpion9979
*/
contract AudacityDAO is IAudacityDAO {
    enum ProposalStatus {Null, Submitted, Passed, Failed, Executed, Expired, Last}

    /**
     * @notice Type for representing a token proposal
     * @member proposalType The type of proposal (e.g., Invest, Divest)
     * @member tokenType The type of token (e.g., ERC20)
     * @member tokenAddress The address of the token
     * @member tokenAmount The amount of the token being proposed to invest/divest
     * @member daoTokenAmount The amount of the DAO token being proposed to pay/receive
     * @member yesVotes The total of yes votes for the proposal in AMIF tokens
     * @member noVotes The total of no votes for the proposal in AMIF tokens
     * @member votingExpiry The expiry timestamp for proposal voting.
     * @member executionExpiry The expiry timestamp for proposal execution.
     * @member status The status of the proposal
     */
    struct Proposal {
        ProposalType proposalType;
        TokenType tokenType;
        address tokenAddress;
        uint256 tokenAmount;
        uint256 daoTokenAmount;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votingExpiry;
        uint256 executionExpiry;
        ProposalStatus status;
    }

    /**
    * @notice The DAO token address (private)
    */
    address private daoTokenAddress;

    /**
    * @notice The proposals (public)
    * @dev TODO - make private and add getter instead
    */
    mapping(uint256 => Proposal) public proposals;

    /**
    * @notice The count of proposals (public)
    * @dev TODO - make private and add getter instead
    */
    uint256 public proposalCount;

    /**
     * @notice constructor sets the DAO token address from the given address (public)
     * @param daoTokenAddress_ The address of the DAO token
     */
    constructor(address daoTokenAddress_) public {
        daoTokenAddress = daoTokenAddress_;
        // TODO: transfer ownership of the DAO token to the DAO itself
        //IERC20(daoTokenAddress).transferOwnership(address(this));
    }

    /**
    * @notice Submit a proposal (external)
    * @param proposalType The type of proposal (e.g., Invest, Divest)
    * @param tokenType The type of token (e.g., ERC20)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to invest/divest
    * @param daoTokenAmount The amount of DAO token to be paid/received
    */
    function submit(
        ProposalType proposalType,
        TokenType tokenType,
        address tokenAddress,
        uint256 tokenAmount,
        uint256 daoTokenAmount
    ) external override {
        require(proposalType < ProposalType.Last, "AudacityDAO: invalid proposal type");
        require(tokenType < TokenType.Last, "AudacityDAO: invalid token type");
        require(tokenAddress != address(0), "AudacityDAO: invalid token address");
        require(
            tokenAmount != 0 || daoTokenAmount != 0,
            "AudacityDAO: both token amount and DAO token amount zero"
        );

        Proposal memory proposal;
        proposal.proposalType = proposalType;
        proposal.tokenType = tokenType;
        proposal.tokenAddress = tokenAddress;
        proposal.tokenAmount = tokenAmount;
        proposal.daoTokenAmount = daoTokenAmount;
        proposal.status = ProposalStatus.Submitted;

        proposals[proposalCount] = proposal;
        proposalCount++;

        emit Submitted(
            proposalType,
            tokenType,
            tokenAddress,
            tokenAmount,
            daoTokenAmount
        );
    }

    /**
    * @notice Vote on a proposal (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOn(uint256 proposalId, bool vote) external override {
        // TODO: add tests
        Proposal memory proposal = proposals[proposalId];
        require(proposalId < proposalCount, "AudacityDAO: invalid proposal id");
        require(proposal.status == ProposalStatus.Submitted, "AudacityDAO: invalid proposal status");

        uint256 balance = IERC20(daoTokenAddress).balanceOf(msg.sender);
        // TODO: very crude implementation for now, change to allow multiple votes / changing votes
        if(now < proposal.votingExpiry) {
            if (vote) {
                proposal.yesVotes += balance;
            } else {
                proposal.noVotes += balance;
            }

            emit VotedOn(
                proposal.proposalType,
                proposal.tokenType,
                msg.sender,
                proposalId,
                vote
            );
        } else {
            proposal.status = ProposalStatus.Expired;

            emit Expired(
                proposal.proposalType,
                proposal.tokenType,
                proposalId
            );
        }
    }

    /**
    * @notice Execute a proposal (external)
    * @param proposalId The proposal ID
    */
    function execute(uint256 proposalId) external override {
        // TODO: very crude implementation for now
        Proposal memory proposal = proposals[proposalId];
        require(proposalId < proposalCount, "AudacityDAO: invalid proposal id");
        require(proposal.status == ProposalStatus.Passed, "AudacityDAO: invalid proposal status");

        if(now < proposal.executionExpiry) {
            proposal.status = ProposalStatus.Executed;

            emit Executed(
                proposal.proposalType,
                proposal.tokenType,
                msg.sender,
                proposalId
            );
        } else {
            proposal.status = ProposalStatus.Expired;

            emit Expired(
                proposal.proposalType,
                proposal.tokenType,
                proposalId
            );
        }
    }

    // TODO: add isQuorumReached(proposalId) helper function (private or external)
    // TODO: add getTotalDAOTokenSupply() helper function (private or external)

}
