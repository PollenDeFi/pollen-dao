pragma solidity >=0.6 <0.7.0;
pragma experimental ABIEncoderV2;

import "./Pollen.sol";
import "./interfaces/IPollenDAO.sol";
import "./lib/AddressSet.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
* @title PollenDAO Contract
* @notice The main Pollen DAO contract
* @author gtlewis
* @author scorpion9979
*/
contract PollenDAO is IPollenDAO {
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
    * @member pollenAmount The amount of the Pollen being proposed to pay/receive
    * @member submitter The submitter of the proposal
    * @member snapshotId The id of snapshot storing balances and total supply during proposal submission
    * @member voters The addresses that voted on the proposal, default voter state is Null for new votes
    * @member yesVotes The total of yes votes for the proposal in Pollens
    * @member noVotes The total of no votes for the proposal in Pollens
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
        uint256 pollenAmount;
        address submitter;
        uint256 snapshotId;
        mapping(address => VoterState) voters;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votingExpiry;
        uint256 executionOpen;
        uint256 executionExpiry;
        ProposalStatus status;
    }

    /**
    * @notice The Pollen token contract instance (private)
    */
    Pollen private _pollen;

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
    * @notice Constructor deploys a new Pollen instance and becomes owner (public)
    * @param quorum The quorum required to pass a proposal vote in % points
    * @param votingExpiryDelay The number of seconds until voting expires after proposal submission
    * @param executionOpenDelay The number of seconds until execution opens after proposal voting expires
    * @param executionExpiryDelay The number of seconds until execution expires after proposal execution opens
    */
    constructor(uint256 quorum, uint256 votingExpiryDelay, uint256 executionOpenDelay, uint256 executionExpiryDelay) public {
        require(quorum <= 100, "PollenDAO: invalid quorum");
        // TODO: Define realistic min's and max's
        require(votingExpiryDelay > 60, "PollenDAO: invalid voting expiry delay");
        require(executionOpenDelay > 60, "PollenDAO: invalid execution open delay");
        require(executionExpiryDelay > 60, "PollenDAO: invalid execution expiry delay");

        _pollen = new Pollen();
        _quorum = quorum;
        _votingExpiryDelay = votingExpiryDelay;
        _executionOpenDelay = executionOpenDelay;
        _executionExpiryDelay = executionExpiryDelay;
    }

    /**
    * @notice Get the Pollen token contract address (external view)
    * @return The Pollen contract address
    */
    function getPollenAddress() external view returns(address) {
        return address(_pollen);
    }

    /**
    * @notice Get a proposal at index (external view)
    * @param proposalId The proposal ID
    * @return proposalType , assetTokenType , assetTokenAddress , assetTokenAmount
    * pollenAmount , submitter , yesVotes , noVotes , votingExpiry , executionOpen
    * executionExpiry , status
    */
    function getProposal(uint256 proposalId) external view returns(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount,
        address submitter,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 votingExpiry,
        uint256 executionOpen,
        uint256 executionExpiry,
        ProposalStatus status
    ) {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        Proposal memory proposal = _proposals[proposalId];
        return (
            proposal.proposalType,
            proposal.assetTokenType,
            proposal.assetTokenAddress,
            proposal.assetTokenAmount,
            proposal.pollenAmount,
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
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
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
    * @param pollenAmount The amount of Pollen to be paid/received
    */
    function submit(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount
    ) external override {
        require(proposalType < ProposalType.Last, "PollenDAO: invalid proposal type");
        require(assetTokenType < TokenType.Last, "PollenDAO: invalid asset token type");
        require(assetTokenAddress != address(0), "PollenDAO: invalid asset token address");
        require(assetTokenAddress != this.getPollenAddress(), "PollenDAO: invalid usage of Pollen as asset token");
        require(
            assetTokenAmount != 0 || pollenAmount != 0,
            "PollenDAO: both asset token amount and Pollen amount zero"
        );

        Proposal memory proposal;
        uint256 proposalId = _proposalCount;
        proposal.proposalType = proposalType;
        proposal.assetTokenType = assetTokenType;
        proposal.assetTokenAddress = assetTokenAddress;
        proposal.assetTokenAmount = assetTokenAmount;
        proposal.pollenAmount = pollenAmount;
        proposal.submitter = msg.sender;
        proposal.snapshotId = _pollen.snapshot();
        proposal.votingExpiry = proposalId == 0? now : now + _votingExpiryDelay;
        proposal.executionOpen = proposal.votingExpiry + _executionOpenDelay;
        proposal.executionExpiry = proposal.executionOpen + _executionExpiryDelay;
        proposal.status = ProposalStatus.Submitted;

        _proposals[proposalId] = proposal;
        _addVote(proposalId, msg.sender, true, _pollen.balanceOfAt(msg.sender, proposal.snapshotId));
        _proposalCount++;

        emit Submitted(
            proposalType,
            assetTokenType,
            assetTokenAddress,
            assetTokenAmount,
            pollenAmount,
            proposalId
        );
    }

    /**
    * @notice Vote on a proposal (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOn(uint256 proposalId, bool vote) external override {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        require(_proposals[proposalId].status == ProposalStatus.Submitted, "PollenDAO: invalid proposal status");
        require(now < _proposals[proposalId].votingExpiry, "PollenDAO: vote expired");

        uint256 balance = _pollen.balanceOfAt(msg.sender, _proposals[proposalId].snapshotId);
        require(balance > 0, "PollenDAO: no voting tokens");

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
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        require(_proposals[proposalId].status == ProposalStatus.Submitted, "PollenDAO: invalid proposal status");
        require(now >= _proposals[proposalId].votingExpiry, "PollenDAO: vote not expired");
        require((_proposals[proposalId].yesVotes + _proposals[proposalId].noVotes > _pollen.totalSupplyAt(_proposals[proposalId].snapshotId) * _quorum / 100) || proposalId == 0,
            "PollenDAO: vote did not reach quorum");
        require(_proposals[proposalId].yesVotes > _proposals[proposalId].noVotes || proposalId == 0, "PollenDAO: vote failed");
        require(now >= _proposals[proposalId].executionOpen, "PollenDAO: execution not open");
        require(now < _proposals[proposalId].executionExpiry, "PollenDAO: execution expired");
        require(_proposals[proposalId].submitter == msg.sender, "PollenDAO: only submitter can execute");

        if (_proposals[proposalId].proposalType == ProposalType.Invest) {
            IERC20(_proposals[proposalId].assetTokenAddress).transferFrom(msg.sender, address(this), _proposals[proposalId].assetTokenAmount);
            _pollen.mint(_proposals[proposalId].pollenAmount);
            _pollen.transfer(msg.sender, _proposals[proposalId].pollenAmount);
            assets.add(_proposals[proposalId].assetTokenAddress);
        } else if (_proposals[proposalId].proposalType == ProposalType.Divest) {
            _pollen.transferFrom(msg.sender, address(this), _proposals[proposalId].pollenAmount);
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
    * @notice Redeem Pollens for the relative proportion of each asset token held by the DAO (external)
    * @param pollenAmount The amount of Pollens to redeem
    */
    function redeem(uint256 pollenAmount) external override {
        require(pollenAmount != 0, "PollenDAO: can't redeem zero amount");

        uint256 totalSupply = _pollen.totalSupply();
        _pollen.transferFrom(msg.sender, address(this), pollenAmount);

        // TODO: cap the asset list to prevent unbounded loop
        for (uint256 i=0; i < assets.elements.length; i++) {
            if (assets.elements[i] != address(0)) {
                uint256 assetTokenAmount = (IERC20(assets.elements[i]).balanceOf(address(this)) * pollenAmount) / totalSupply;
                IERC20(assets.elements[i]).transfer(msg.sender, assetTokenAmount);
                if (IERC20(assets.elements[i]).balanceOf(address(this)) == 0) {
                   assets.remove(assets.elements[i]);
                }
            }
        }

        emit Redeemed(
            msg.sender,
            pollenAmount
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
