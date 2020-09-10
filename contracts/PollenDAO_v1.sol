// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.6 <0.7.0;

import "./interfaces/IPollenDAO.sol";
import "./interfaces/IPollen.sol";
import "./lib/AddressSet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

/**
* @title PollenDAO Contract
* @notice The main Pollen DAO contract
* @author gtlewis
* @author scorpion9979
*/
contract PollenDAO_v1 is Initializable, IPollenDAO {
    using AddressSet for AddressSet.Set;

    /**
    * @notice Type for representing a token proposal
    * @member proposalType The type of proposal (e.g., Invest, Divest)
    * @member assetTokenType The type of the asset token (e.g., ERC20)
    * @member assetTokenAddress The address of the asset token
    * @member assetTokenAmount The amount of the asset token being proposed to invest/divest
    * @member pollenAmount The amount of the Pollen being proposed to pay/receive
    * @member descriptionCid The IPFS CID hash of the proposal description text
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
        string descriptionCid;
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
    * @dev The Pollen token contract instance (private)
    */
    IPollen private _pollen;

    /**
    * @dev The proposals (private)
    */
    mapping(uint256 => Proposal) private _proposals;

    /**
    * @dev The count of proposals (private)
    */
    uint256 private _proposalCount;

    /**
    * @dev The set of assets that the DAO holds (private)
    */
    AddressSet.Set private assets;

    /**
    * @dev The quorum required to pass a proposal vote in % points (private)
    */
    uint256 private _quorum;

    /**
    * @dev The number of seconds until voting expires after proposal submission (private)
    */
    uint256 private _votingExpiryDelay;

    /**
    * @dev The number of seconds until execution opens after proposal voting expires (private)
    */
    uint256 private _executionOpenDelay;

    /**
    * @dev The number of seconds until execution expires after proposal execution opens (private)
    */
    uint256 private _executionExpiryDelay;

    /**
    * @notice Initializer deploys a new Pollen instance and becomes owner of Pollen token (public)
    * @param pollen Address ot the Pollen token contract instance
    * @param quorum The quorum required to pass a proposal vote in % points
    * @param votingExpiryDelay The number of seconds until voting expires after proposal submission
    * @param executionOpenDelay The number of seconds until execution opens after proposal voting expires
    * @param executionExpiryDelay The number of seconds until execution expires after proposal execution opens
    */
    function initialize(
        address pollen,
        uint256 quorum,
        uint256 votingExpiryDelay,
        uint256 executionOpenDelay,
        uint256 executionExpiryDelay
    ) public initializer {
        require(quorum <= 100, "PollenDAO: invalid quorum");
        // TODO: Define realistic min's and max's
        require(votingExpiryDelay > 60, "PollenDAO: invalid voting expiry delay");
        require(executionOpenDelay > 60, "PollenDAO: invalid execution open delay");
        require(executionExpiryDelay > 60, "PollenDAO: invalid execution expiry delay");

        _pollen = IPollen(pollen);
        // _pollen.initialize();
        _quorum = quorum;
        _votingExpiryDelay = votingExpiryDelay;
        _executionOpenDelay = executionOpenDelay;
        _executionExpiryDelay = executionExpiryDelay;
    }

    /// @inheritdoc IPollenDAO
    function version() public pure override returns (string memory) {
        return "v1";
    }

    /// @inheritdoc IPollenDAO
    function getPollenAddress() external view override returns(address) {
        return address(_pollen);
    }

    /// @inheritdoc IPollenDAO
    function getProposalData(uint256 proposalId) external view override returns(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount,
        string memory descriptionCid,
        address submitter,
        uint256 snapshotId,
        uint256 yesVotes,
        uint256 noVotes,
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
            proposal.descriptionCid,
            proposal.submitter,
            proposal.snapshotId,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.status
        );
    }

    /// @inheritdoc IPollenDAO
    function getProposalTimestamps(uint256 proposalId) external view override returns(
        uint256 votingExpiry,
        uint256 executionOpen,
        uint256 executionExpiry
    ) {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        Proposal memory proposal = _proposals[proposalId];
        return (
            proposal.votingExpiry,
            proposal.executionOpen,
            proposal.executionExpiry
        );
    }

    /// @inheritdoc IPollenDAO
    function getVoterState(uint256 proposalId) external view override returns(VoterState) {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        return (_proposals[proposalId].voters[msg.sender]);
    }

    /// @inheritdoc IPollenDAO
    function getProposalCount() external view override returns(uint256) {
        return _proposalCount;
    }

    /// @inheritdoc IPollenDAO
    function getAssets() external view override returns (address[] memory) {
        return assets.elements;
    }

    /// @inheritdoc IPollenDAO
    function getVotingExpiryDelay() external view override returns(uint256) {
        return _votingExpiryDelay;
    }

    /// @inheritdoc IPollenDAO
    function getExecutionOpenDelay() external view override returns(uint256) {
        return _executionOpenDelay;
    }

    /// @inheritdoc IPollenDAO
    function getExecutionExpiryDelay() external view override returns(uint256) {
        return _executionExpiryDelay;
    }

    /// @inheritdoc IPollenDAO
    function getQuorum() external view override returns(uint256) {
        return _quorum;
    }

    /// @inheritdoc IPollenDAO
    function submit(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount,
        string memory descriptionCid
    ) external override {
        // TODO: validate IPFS CID format for descriptionCid
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
        proposal.descriptionCid = descriptionCid;
        proposal.submitter = msg.sender;
        proposal.snapshotId = _pollen.snapshot();
        proposal.votingExpiry = proposalId == 0? now : now + _votingExpiryDelay;
        proposal.executionOpen = proposal.votingExpiry + _executionOpenDelay;
        proposal.executionExpiry = proposal.executionOpen + _executionExpiryDelay;
        proposal.status = ProposalStatus.Submitted;

        _proposals[proposalId] = proposal;
        _addVote(proposalId, msg.sender, true, _pollen.balanceOfAt(msg.sender, proposal.snapshotId));
        _proposalCount++;
        // NOTE: this is the max stack size, can't add more event params
        // TODO: find a way to insert initial yesVotes (submitter's own vote) into event params
        emit Submitted(
            proposalId,
            proposalType,
            msg.sender,
            proposal.snapshotId
        );
    }

    /// @inheritdoc IPollenDAO
    function voteOn(uint256 proposalId, bool vote) external override {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        require(_proposals[proposalId].status == ProposalStatus.Submitted, "PollenDAO: invalid proposal status");
        require(now < _proposals[proposalId].votingExpiry, "PollenDAO: vote expired");

        uint256 balance = _pollen.balanceOfAt(msg.sender, _proposals[proposalId].snapshotId);
        require(balance > 0, "PollenDAO: no voting tokens");

        _addVote(proposalId, msg.sender, vote, balance);

        emit VotedOn(
            proposalId,
            msg.sender,
            vote
        );
    }

    /// @inheritdoc IPollenDAO
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
            proposalId
        );
    }

    /// @inheritdoc IPollenDAO
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
