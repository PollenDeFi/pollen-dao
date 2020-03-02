pragma solidity >=0.6 <0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IAudacityDAO.sol";
import "./DAOToken.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";

/**
* @title AudacityDAO Contract
* @notice The main Audacity DAO contract
* @author gtlewis
* @author scorpion9979
*/
contract AudacityDAO is IAudacityDAO {
    /**
    * @notice Type for representing a token proposal status
    */
    enum ProposalStatus {Null, Submitted, Executed, Last}

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
    * @notice The DAO token contract instance (private)
    */
    DAOToken private _daoToken;

    /**
    * @notice The proposals (private)
    */
    mapping(uint256 => Proposal) private _proposals;

    /**
    * @notice The count of proposals (private)
    */
    uint256 private _proposalCount;

    /**
    * @notice Constructor deploys a new DAO token instance and becomes owner (public)
    */
    constructor() public {
        _daoToken = new DAOToken();
    }

    /**
    * @notice Get the DAO token contract address (external view)
    */
    function getDaoTokenAddress() external view returns(address) {
        return address(_daoToken);
    }

    /**
    * @notice Get a proposal at index (external view)
    * @param proposalId The proposal ID
    */
    function getProposal(uint256 proposalId) external view returns(Proposal memory) {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");
        return _proposals[proposalId];
    }

    /**
    * @notice Get total proposal count (external view)
    */
    function getProposalCount() external view returns(uint256) {
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
        proposal.votingExpiry = _proposalCount == 0? now : now + 60000;
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
        require(_proposals[proposalId].status == ProposalStatus.Submitted, "AudacityDAO: invalid proposal status");
        require(now < _proposals[proposalId].votingExpiry, "AudacityDAO: vote expired");

        uint256 balance = _daoToken.balanceOf(msg.sender);
        require(balance > 0, "AudacityDAO: no voting tokens");

        // TODO: crude implementation for now, change to prevent multiple votes / allow changing votes
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
    * @notice Execute a proposal (external)
    * @param proposalId The proposal ID
    */
    function execute(uint256 proposalId) external override {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");
        require(_proposals[proposalId].status == ProposalStatus.Submitted, "AudacityDAO: invalid proposal status");
        require(now >= _proposals[proposalId].votingExpiry, "AudacityDAO: vote not expired");
        // TODO: require quorum
        require(_proposals[proposalId].yesVotes > _proposals[proposalId].noVotes || proposalId == 0, "AudacityDAO: vote failed");
        require(now < _proposals[proposalId].executionExpiry, "AudacityDAO: execution expired");
        // TODO: require only submitter can execute?

        // TODO: transfer the tokens here according to proposal type (mint if invest. payout if divest)
        if (_proposals[proposalId].proposalType == ProposalType.Invest) {
            // TODO: for now, just mint and transfer the tokens requested for no payment
            _daoToken.mint(_proposals[proposalId].daoTokenAmount);
            _daoToken.transfer(msg.sender, _proposals[proposalId].daoTokenAmount);
        }

        _proposals[proposalId].status = ProposalStatus.Executed;

        emit Executed(
            _proposals[proposalId].proposalType,
            _proposals[proposalId].tokenType,
            msg.sender,
            proposalId
        );
    }
}
