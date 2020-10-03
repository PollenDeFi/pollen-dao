// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6 <0.7.0;

import "./interfaces/IPollenDAO.sol";
import "./interfaces/IPollen.sol";
import "./lib/AddressSet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";


/**
* @title PollenDAO Contract
* @notice The main Pollen DAO contract
* @author gtlewis
* @author scorpion9979
*/
contract PollenDAO_v1 is Initializable, ReentrancyGuardUpgradeSafe, IPollenDAO {
    using AddressSet for AddressSet.Set;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /**
    * @notice Type for representing a token proposal
    * @member proposalType The type of proposal (e.g., Invest, Divest)
    * @member assetTokenType The type of the asset token (e.g., ERC20)
    * @member assetTokenAddress The address of the asset token
    * @member assetTokenAmount The minimum (or exact) amount of the asset token being proposed to invest (or divest)
    * @member pollenAmount The exact (or minimum) amount of the Pollen being proposed to pay (or receive)
    * @member descriptionCid The IPFS CID hash of the proposal description text
    * @member submitter The submitter of the proposal
    * @member snapshotId The id of the snapshot storing balances during proposal submission
    * @member voters Addresses which voted on the proposal
    * @member yesVotes The total of yes votes for the proposal in Pollens
    * @member noVotes The total of no votes for the proposal in Pollens
    * @member votingExpiry The expiry timestamp for proposal voting
    * @member executionOpen The starting timestamp for proposal execution
    * @member executionExpiry The expiry timestamp for proposal execution
    * @member status The status of the proposal
    */
    // TODO: optimize slot usage after the Proposal struct gets finalized
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

    uint constant maxDelay = 60 * 60 * 24 * 365;

    address private _deployer;

    modifier onlyDeployer() {
        require(_deployer == msg.sender, "PollenDAO: caller is not the contract deployer");
        _;
    }

    /**
     * @dev Reserved for possible storage structure changes
     */
    uint256[49] private __gap;

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
    AddressSet.Set private _assets;

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
    * @param executionOpenDelay The number of seconds until execution opens after voting expires
    * @param executionExpiryDelay The number of seconds until execution expires after it opens
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
        require(
            votingExpiryDelay > 60 && votingExpiryDelay < maxDelay,
            "PollenDAO: invalid voting expiry delay"
        );
        require(
            executionOpenDelay > 60 && executionOpenDelay < maxDelay,
            "PollenDAO: invalid execution open delay"
        );
        require(
            executionExpiryDelay > 60 && executionExpiryDelay < maxDelay,
            "PollenDAO: invalid execution expiry delay"
        );

        __ReentrancyGuard_init_unchained();
        
        _deployer = msg.sender;
        _pollen = IPollen(pollen);
        _quorum = quorum;
        _votingExpiryDelay = votingExpiryDelay;
        _executionOpenDelay = executionOpenDelay;
        _executionExpiryDelay = executionExpiryDelay;
    }

    /// @inheritdoc IPollenDAO
    function version() external pure override returns (string memory) {
        return "v1";
    }

    /// @inheritdoc IPollenDAO
    function getPollenAddress() external view override returns(address) {
        return address(_pollen);
    }

    /// @inheritdoc IPollenDAO
    function addAsset(address asset) external override onlyDeployer {
        require(asset != address(0), 'PollenDAO: invalid asset address');
        require(!_assets.contains(asset), 'PollenDAO: asset already exists in DAO assets');
        _assets.add(asset);
    }

    /// @inheritdoc IPollenDAO
    function removeAsset(address asset) external override onlyDeployer {
        require(asset != address(0), 'PollenDAO: invalid asset address');
        require(_assets.contains(asset), 'PollenDAO: asset does not exist in DAO assets');
        _removeAssetFromAssetsIfNeeded(asset);
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
        return _assets.elements;
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
        require(
            assetTokenAddress != this.getPollenAddress(),
            "PollenDAO: invalid usage of Pollen as asset token"
        );
        require(
            assetTokenAmount != 0 || pollenAmount != 0,
            "PollenDAO: both asset token amount and Pollen amount zero"
        );

        uint256 proposalId = _proposalCount;
        uint256 votingExpiry = proposalId == 0 ? now : now + _votingExpiryDelay;
        uint256 executionOpen = votingExpiry + _executionOpenDelay;

        Proposal memory proposal = Proposal(
            proposalType,
            assetTokenType,
            assetTokenAddress,
            assetTokenAmount,
            pollenAmount,
            descriptionCid,
            msg.sender,
            _pollen.snapshot(),
            // voters (mapping) is omitted,
            0, // yesVotes
            0, // noVotes,
            votingExpiry,
            executionOpen,
            executionOpen + _executionExpiryDelay,
            ProposalStatus.Submitted
        );
        _proposals[proposalId] = proposal;
        _proposalCount = uint256(proposalId) + 1;

        emit Submitted(
            proposalId,
            proposalType,
            msg.sender,
            proposal.snapshotId
        );

        _addVote(
            proposalId, msg.sender, true, _pollen.balanceOfAt(msg.sender, proposal.snapshotId)
        );
    }

    /// @inheritdoc IPollenDAO
    function voteOn(uint256 proposalId, bool vote) external override {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        require(
            _proposals[proposalId].status == ProposalStatus.Submitted,
            "PollenDAO: invalid proposal status"
        );
        require(now < _proposals[proposalId].votingExpiry, "PollenDAO: vote expired");

        uint256 balance = _pollen.balanceOfAt(msg.sender, _proposals[proposalId].snapshotId);
        require(balance > 0, "PollenDAO: no voting tokens");

        _addVote(proposalId, msg.sender, vote, balance);
    }

    /// @inheritdoc IPollenDAO
    function execute(uint256 proposalId) external override nonReentrant {
        require(proposalId < _proposalCount, "PollenDAO: invalid proposal id");
        require(
            _proposals[proposalId].status == ProposalStatus.Submitted,
            "PollenDAO: invalid proposal status"
        );
        require(now >= _proposals[proposalId].votingExpiry, "PollenDAO: vote not expired");
        require(
            (
                _proposals[proposalId].yesVotes.add(_proposals[proposalId].noVotes) >
                _pollen.totalSupplyAt(_proposals[proposalId].snapshotId).mul(_quorum).div(100)
            ) || proposalId == 0,
            "PollenDAO: vote did not reach quorum"
        );
        require(
            _proposals[proposalId].yesVotes > _proposals[proposalId].noVotes || proposalId == 0,
            "PollenDAO: vote failed"
        );
        require(now >= _proposals[proposalId].executionOpen, "PollenDAO: execution not open");
        require(now < _proposals[proposalId].executionExpiry, "PollenDAO: execution expired");
        require(
            _proposals[proposalId].submitter == msg.sender,
            "PollenDAO: only submitter can execute"
        );

        IERC20 asset = IERC20(_proposals[proposalId].assetTokenAddress);
        if (_proposals[proposalId].proposalType == ProposalType.Invest) {
            asset.safeTransferFrom(
                msg.sender,
                address(this), _proposals[proposalId].assetTokenAmount
            );
            _pollen.mint(_proposals[proposalId].pollenAmount);
            _pollen.transfer(msg.sender, _proposals[proposalId].pollenAmount);
        } else if (_proposals[proposalId].proposalType == ProposalType.Divest) {
            asset.safeTransfer(msg.sender, _proposals[proposalId].assetTokenAmount);
            _pollen.burnFrom(msg.sender, _proposals[proposalId].pollenAmount);
            _removeAssetFromAssetsIfNeeded(address(asset));
        }

        _proposals[proposalId].status = ProposalStatus.Executed;

        emit Executed(
            proposalId
        );
    }

    /// @inheritdoc IPollenDAO
    function redeem(uint256 pollenAmount) external override nonReentrant {
        require(pollenAmount != 0, "PollenDAO: can't redeem zero amount");

        uint256 totalSupply = _pollen.totalSupply();
        _pollen.burnFrom(msg.sender, pollenAmount);

        // TODO: cap the asset list to prevent unbounded loop
        for (uint256 i=0; i < _assets.elements.length; i++) {
            IERC20 asset = IERC20(_assets.elements[i]);
            if (address(asset) != address(0)) {
                uint256 assetBalance = asset.balanceOf(address(this));
                uint256 assetTokenAmount = assetBalance.mul(pollenAmount).div(totalSupply);
                asset.transfer(
                    msg.sender,
                    assetTokenAmount > assetBalance ? assetBalance : assetTokenAmount
                );
                _removeAssetFromAssetsIfNeeded(address(asset));
            }
        }

        emit Redeemed(
            msg.sender,
            pollenAmount
        );
    }

    /**
    * @dev _addVote (private)
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
            _proposals[proposalId].yesVotes = _proposals[proposalId].yesVotes.sub(amount);
        } else if (voterState == VoterState.VotedNo) {
            _proposals[proposalId].noVotes = _proposals[proposalId].noVotes.sub(amount);
        }

        if (vote) {
            _proposals[proposalId].yesVotes = _proposals[proposalId].yesVotes.add(amount);
            _proposals[proposalId].voters[voter] = VoterState.VotedYes;
        } else {
            _proposals[proposalId].noVotes = _proposals[proposalId].noVotes.add(amount);
            _proposals[proposalId].voters[voter] = VoterState.VotedNo;
        }

        emit VotedOn(proposalId, voter, vote);
    }

    function _removeAssetFromAssetsIfNeeded(address asset) internal {
        if (IERC20(asset).balanceOf(address(this)) == 0) {
            _assets.remove(asset);
        }
    }
}
