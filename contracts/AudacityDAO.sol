pragma solidity >=0.6 <0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IAudacityDAO.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
* @title AudacityDAO Contract
* @notice The main Audacity DAO contract
* @dev TODO: Refactor function visibility
* @author gtlewis
* @author scorpion9979
*/
contract AudacityDAO is IAudacityDAO {
    /**
    * @notice Type for representing a token proposal status
    */
    enum ProposalStatus {Null, Submitted, Passed, Failed, Executed, Expired, Last}

    /**
    * @notice Type for representing a token proposal
    * @member proposalType The type of proposal (e.g., Invest, Divest)
    * @member tokenType The type of token (e.g., ERC20)
    * @member tokenAddress The address of the token
    * @member tokenAmount The amount of the token being proposed to invest/divest
    * @member daoTokenAmount The amount of the DAO token being proposed to pay/receive
    * @member yesVotes The total of yes votes for the proposal in DAO tokens
    * @member noVotes The total of no votes for the proposal in DAO tokens
    * @member votingExpiry The expiry timestamp for proposal voting
    * @member executionExpiry The expiry timestamp for proposal execution
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
    address private _daoTokenAddress;

    /**
    * @notice The proposals (private)
    */
    mapping(uint256 => Proposal) private _proposals;

    /**
    * @notice The count of proposals (private)
    */
    uint256 private _proposalCount;

    /**
    * @notice Constructor sets the DAO token address from the given address (public)
    * @param daoTokenAddress The address of the DAO token
    */
    constructor(address daoTokenAddress) public {
        _daoTokenAddress = daoTokenAddress;
        // TODO: transfer ownership of the DAO token to the DAO itself
        //IERC20(daoTokenAddress).transferOwnership(address(this));
    }

    /**
    * @notice Get a proposal at index (public)
    * @param proposalId The proposal ID
    */
    function getProposal(uint256 proposalId) public view returns(Proposal memory) {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");
        return _proposals[proposalId];
    }

    /**
    * @notice Get total proposal count (public)
    */
    function getProposalCount() public view returns(uint256) {
        return _proposalCount;
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
        // TODO: set proper voting expiry
        proposal.votingExpiry = now + 60000;
        // TODO: set proper execution expiry
        proposal.executionExpiry = proposal.votingExpiry + 60000;
        proposal.status = ProposalStatus.Submitted;

        _proposals[_proposalCount] = proposal;
        _proposalCount++;

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
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");

        resolveVote(proposalId);

        require(_proposals[proposalId].status == ProposalStatus.Submitted, "AudacityDAO: invalid proposal status");

        uint256 balance = IERC20(_daoTokenAddress).balanceOf(msg.sender);
        // TODO: very crude implementation for now, change to prevent multiple votes / allow changing votes
        if (vote) {
            _proposals[proposalId].yesVotes += balance;
        } else {
            _proposals[proposalId].noVotes += balance;
        }

        emit VotedOn(
            _proposals[proposalId].proposalType,
            _proposals[proposalId].tokenType,
            msg.sender,
            proposalId,
            vote
        );
    }

    /**
    * @notice Resolve a proposal vote (public)
    * @param proposalId The proposal ID
    */
    function resolveVote(uint256 proposalId) public override {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");

        if(_proposals[proposalId].status == ProposalStatus.Submitted && now >= _proposals[proposalId].votingExpiry) {
            // TODO: quorum
            if(_proposals[proposalId].yesVotes > _proposals[proposalId].noVotes) {
                _proposals[proposalId].status = ProposalStatus.Passed;

                emit Passed(
                    _proposals[proposalId].proposalType,
                    _proposals[proposalId].tokenType,
                    proposalId,
                    _proposals[proposalId].votingExpiry
                );
            } else {
                _proposals[proposalId].status = ProposalStatus.Failed;

                emit Failed(
                    _proposals[proposalId].proposalType,
                    _proposals[proposalId].tokenType,
                    proposalId,
                    _proposals[proposalId].votingExpiry
                );
            }
        }
    }

    /**
    * @notice Execute a proposal (external)
    * @param proposalId The proposal ID
    */
    function execute(uint256 proposalId) external override {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");

        resolveVote(proposalId);

        require(_proposals[proposalId].status == ProposalStatus.Passed, "AudacityDAO: invalid proposal status");

        if(now < _proposals[proposalId].executionExpiry) {
            // TODO: enforce only submitter can execute? if so, do here so anyone can expire a proposal
            _proposals[proposalId].status = ProposalStatus.Executed;
            // TODO: transfer the tokens here according to proposal type (mint if invest. payout if divest)

            emit Executed(
                _proposals[proposalId].proposalType,
                _proposals[proposalId].tokenType,
                msg.sender,
                proposalId
            );
        } else {
            _proposals[proposalId].status = ProposalStatus.Expired;

            emit Expired(
                _proposals[proposalId].proposalType,
                _proposals[proposalId].tokenType,
                proposalId,
                _proposals[proposalId].executionExpiry
            );
        }
    }

    // TODO: add isQuorumReached(proposalId) helper function (private or external)
    // TODO: add getTotalDAOTokenSupply() helper function (private or external)
}
