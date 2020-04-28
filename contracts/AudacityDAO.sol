pragma solidity >=0.6 <0.7.0;
pragma experimental ABIEncoderV2;

import "./DAOToken.sol";
import "./interfaces/IAudacityDAO.sol";
import "./lib/AddressSet.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
* @title AudacityDAO Contract
* @notice The main Audacity DAO contract
* @author gtlewis
* @author scorpion9979
*/
contract AudacityDAO is IAudacityDAO {
    using AddressSet for AddressSet.Set;

    /**
    * @notice Type for representing a token proposal status
    */
    enum ProposalStatus {Null, Submitted, Executed, Last}

    /**
    * @notice Type for representing the state of a vote on a proposal
    */
    enum VoterState {Null, VotedYes, VotedNo}

    /**
    * @notice Type for representing a token proposal
    * @member proposalType The type of proposal (e.g., Invest, Divest)
    * @member assetTokenType The type of the asset token (e.g., ERC20)
    * @member assetTokenAddress The address of the asset token
    * @member assetTokenAmount The amount of the asset token being proposed to invest/divest
    * @member daoTokenAmount The amount of the DAO token being proposed to pay/receive
    * @member submitter The submitter of the proposal
    * @member voters The addresses that voted on the proposal, default voter state is Null for new votes
    * @member yesVotes The total of yes votes for the proposal in DAO tokens
    * @member noVotes The total of no votes for the proposal in DAO tokens
    * @member votingExpiry The expiry timestamp for proposal voting
    * @member executionOpen The starting timestamp for proposal execution
    * @member executionExpiry The expiry timestamp for proposal execution
    * @member status The status of the proposal
    */
    struct Proposal {
        ProposalType proposalType;
        TokenType assetTokenType;
        address assetTokenAddress;
        uint256 assetTokenAmount;
        uint256 daoTokenAmount;
        address submitter;
        mapping(address => VoterState) voters;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votingExpiry;
        uint256 executionOpen;
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
    * @notice The set of assets that the DAO holds (private)
    */
    AddressSet.Set private assets;

    /**
    * @notice The quorum required to pass a proposal vote in % points (private)
    */
    uint256 private _quorum;

    /**
    * @notice The number of seconds until voting expires after proposal submission (private)
    */
    uint256 private _votingExpiryDelay;

    /**
    * @notice The number of seconds until execution opens after proposal voting expires (private)
    */
    uint256 private _executionOpenDelay;

    /**
    * @notice The number of seconds until execution expires after proposal execution opens (private)
    */
    uint256 private _executionExpiryDelay;

    /**
    * @notice Constructor deploys a new DAO token instance and becomes owner (public)
    * @param quorum The quorum required to pass a proposal vote in % points
    * @param votingExpiryDelay The number of seconds until voting expires after proposal submission
    * @param executionOpenDelay The number of seconds until execution opens after proposal voting expires
    * @param executionExpiryDelay The number of seconds until execution expires after proposal execution opens
    */
    constructor(uint256 quorum, uint256 votingExpiryDelay, uint256 executionOpenDelay, uint256 executionExpiryDelay) public {
        require(quorum <= 100, "AudacityDAO: invalid quorum");
        // TODO: Define realistic min's and max's
        require(votingExpiryDelay > 60, "AudacityDAO: invalid voting expiry delay");
        require(executionOpenDelay > 60, "AudacityDAO: invalid execution open delay");
        require(executionExpiryDelay > 60, "AudacityDAO: invalid execution expiry delay");

        _daoToken = new DAOToken();
        _quorum = quorum;
        _votingExpiryDelay = votingExpiryDelay;
        _executionOpenDelay = executionOpenDelay;
        _executionExpiryDelay = executionExpiryDelay;
    }

    /**
    * @notice Get the DAO token contract address (external view)
    * @return The DAO token contract address
    */
    function getDaoTokenAddress() external view returns(address) {
        return address(_daoToken);
    }

    /**
    * @notice Get a proposal at index (external view)
    * @param proposalId The proposal ID
    * @return proposalType , assetTokenType , assetTokenAddress , assetTokenAmount
    * daoTokenAmount , submitter , yesVotes , noVotes , votingExpiry , executionOpen
    * executionExpiry , status
    */
    function getProposal(uint256 proposalId) external view returns(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 daoTokenAmount,
        address submitter,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 votingExpiry,
        uint256 executionOpen,
        uint256 executionExpiry,
        ProposalStatus status
    ) {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");
        Proposal memory proposal = _proposals[proposalId];
        return (
            proposal.proposalType,
            proposal.assetTokenType,
            proposal.assetTokenAddress,
            proposal.assetTokenAmount,
            proposal.daoTokenAmount,
            proposal.submitter,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.votingExpiry,
            proposal.executionOpen,
            proposal.executionExpiry,
            proposal.status
        );
    }

    /**
    * @notice Get the state of a voter on a specified proposal (external view)
    * @param proposalId The proposal ID
    * @return The state of the vote
    */
    function getVoterState(uint256 proposalId) external view returns(VoterState) {
        require(proposalId < _proposalCount, "AudacityDAO: invalid proposal id");
        return (_proposals[proposalId].voters[msg.sender]);
    }

    /**
    * @notice Get total proposal count (external view)
    * @return The total proposal count
    */
    function getProposalCount() external view returns(uint256) {
        return _proposalCount;
    }

    /**
    * @notice Get the assets that the DAO holds (external view)
    * @return The set of asset token addresses
    */
    function getAssets() external view returns (address[] memory) {
        return assets.elements;
    }

    /**
    * @notice Get the voting expiry delay (external view)
    * @return The number of seconds until voting expires after proposal submission
    */
    function getVotingExpiryDelay() external view returns(uint256) {
        return _votingExpiryDelay;
    }

    /**
    * @notice Get the exection open delay (external view)
    * @return The number of seconds until execution opens after proposal voting expires
    */
    function getExecutionOpenDelay() external view returns(uint256) {
        return _executionOpenDelay;
    }

    /**
    * @notice Get the exection expiry delay (external view)
    * @return The number of seconds until execution expires after proposal exection opens
    */
    function getExecutionExpiryDelay() external view returns(uint256) {
        return _executionExpiryDelay;
    }

    /**
    * @notice Get the quorum required to pass a proposal vote (external view)
    * @return The quorum in % points
    */
    function getQuorum() external view returns(uint256) {
        return _quorum;
    }

    /**
    * @notice Submit a proposal (external)
    * @param proposalType The type of proposal (e.g., Invest, Divest)
    * @param assetTokenType The type of the asset token (e.g., ERC20)
    * @param assetTokenAddress The address of the asset token
    * @param assetTokenAmount The amount of the asset token to invest/divest
    * @param daoTokenAmount The amount of DAO token to be paid/received
    */
    function submit(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 daoTokenAmount
    ) external override {
        require(proposalType < ProposalType.Last, "AudacityDAO: invalid proposal type");
        require(assetTokenType < TokenType.Last, "AudacityDAO: invalid asset token type");
        require(assetTokenAddress != address(0), "AudacityDAO: invalid asset token address");
        require(
            assetTokenAmount != 0 || daoTokenAmount != 0,
            "AudacityDAO: both asset token amount and DAO token amount zero"
        );

        Proposal memory proposal;
        proposal.proposalType = proposalType;
        proposal.assetTokenType = assetTokenType;
        proposal.assetTokenAddress = assetTokenAddress;
        proposal.assetTokenAmount = assetTokenAmount;
        proposal.daoTokenAmount = daoTokenAmount;
        proposal.submitter = msg.sender;
        proposal.votingExpiry = _proposalCount == 0? now : now + _votingExpiryDelay;
        proposal.executionOpen = proposal.votingExpiry + _executionOpenDelay;
        proposal.executionExpiry = proposal.executionOpen + _executionExpiryDelay;
        proposal.status = ProposalStatus.Submitted;

        _proposals[_proposalCount] = proposal;
        _addVote(_proposalCount, msg.sender, true, _daoToken.balanceOf(msg.sender));
        _proposalCount++;

        emit Submitted(
            proposalType,
            assetTokenType,
            assetTokenAddress,
            assetTokenAmount,
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

        _addVote(proposalId, msg.sender, vote, balance);

        emit VotedOn(
            _proposals[proposalId].proposalType,
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
        require((_proposals[proposalId].yesVotes + _proposals[proposalId].noVotes > _daoToken.totalSupply() * _quorum / 100) || proposalId == 0,
            "AudacityDAO: vote did not reach quorum");
        require(_proposals[proposalId].yesVotes > _proposals[proposalId].noVotes || proposalId == 0, "AudacityDAO: vote failed");
        require(now >= _proposals[proposalId].executionOpen, "AudacityDAO: execution not open");
        require(now < _proposals[proposalId].executionExpiry, "AudacityDAO: execution expired");
        require(_proposals[proposalId].submitter == msg.sender, "AudacityDAO: only submitter can execute");

        if (_proposals[proposalId].proposalType == ProposalType.Invest) {
            IERC20(_proposals[proposalId].assetTokenAddress).transferFrom(msg.sender, address(this), _proposals[proposalId].assetTokenAmount);
            _daoToken.mint(_proposals[proposalId].daoTokenAmount);
            _daoToken.transfer(msg.sender, _proposals[proposalId].daoTokenAmount);
            assets.add(_proposals[proposalId].assetTokenAddress);
        } else if (_proposals[proposalId].proposalType == ProposalType.Divest) {
            _daoToken.transferFrom(msg.sender, address(this), _proposals[proposalId].daoTokenAmount);
            IERC20(_proposals[proposalId].assetTokenAddress).transfer(msg.sender, _proposals[proposalId].assetTokenAmount);
            if (IERC20(_proposals[proposalId].assetTokenAddress).balanceOf(address(this)) == 0) {
                assets.remove(_proposals[proposalId].assetTokenAddress);
            }
            // TODO: implement the payout
        }

        _proposals[proposalId].status = ProposalStatus.Executed;

        emit Executed(
            _proposals[proposalId].proposalType,
            msg.sender,
            proposalId
        );
    }

    /**
    * @notice _addVote (private)
    * @param proposalId The proposal ID
    * @param voter The voter address
    * @param vote The yes/no vote
    * @param amount The amount of tokens voting
    */
    function _addVote(uint256 proposalId, address voter, bool vote, uint256 amount) private {
        // TODO: basic implementation for now, change to prevent multiple votes / allow changing votes
        // if voter had already voted on the proposal, and if so what his vote was.
        VoterState voterState = _proposals[proposalId].voters[voter];

        // allows to change old vote
        if (voterState == VoterState.VotedYes) {
            _proposals[proposalId].yesVotes -= amount;
        } else if (voterState == VoterState.VotedNo) {
            _proposals[proposalId].noVotes -= amount;
        }

        if (vote) {
            _proposals[proposalId].yesVotes += amount;
            _proposals[proposalId].voters[voter] = VoterState.VotedYes;
        } else {
            _proposals[proposalId].noVotes += amount;
            _proposals[proposalId].voters[voter] = VoterState.VotedNo;
        }
    }
}
