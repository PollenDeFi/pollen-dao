// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6 <0.7.0;

import "./interfaces/IPollenDAO.sol";
import "./interfaces/IPollen.sol";
import "./interfaces/IRateQuoter.sol";
import "./lib/AddressSet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";


/**
* @title PollenDAO Contract
* @notice The main Pollen DAO contract
* @author gtlewis, scorpion9979, vkonst
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

    /**
     * @dev Reserved for possible storage structure changes
     */
    uint256[49] private __gap;

    address private _owner;

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

    IRateQuoter private _rateQuoter;

    modifier onlyOwner() {
        require(_owner == msg.sender, "PollenDAO: unauthorised call");
        _;
    }

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
    ) external initializer {
        __ReentrancyGuard_init_unchained();

        _owner = msg.sender;
        _pollen = IPollen(pollen);
        _setParams(quorum, votingExpiryDelay, executionOpenDelay, executionExpiryDelay);
    }

    /// @inheritdoc IPollenDAO
    function version() external pure override returns (string memory) {
        return "v1";
    }

    /// @inheritdoc IPollenDAO
    function getPollenAddress() external view override returns(address) {
        return _getPollenAddress();
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
        require(assetTokenType < TokenType.Last, "PollenDAO: invalid asset type");
        _revertZeroAddress(assetTokenAddress);
        require(_assets.contains(assetTokenAddress), "PollenDAO: unsupported asset");
        require(
            assetTokenAddress != _getPollenAddress(),
            "PollenDAO: PLN can't be an asset"
        );
        require(
            assetTokenAmount != 0 || pollenAmount != 0,
            "PollenDAO: both amounts are zero"
        );

        uint256 proposalId = _proposalCount;
        uint256 votingExpiry = proposalId == 0 ? now : now + _votingExpiryDelay;
        uint256 executionOpen = proposalId == 0 ? votingExpiry : votingExpiry + _executionOpenDelay;

        Proposal memory proposal = Proposal(
            proposalType,
            assetTokenType,
            assetTokenAddress,
            assetTokenAmount,
            pollenAmount,
            descriptionCid,
            msg.sender,
            _pollen.snapshot(),
            // voters omitted (as it's mapping)
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
        Proposal memory proposal = _proposals[proposalId];

        require(
            proposal.status == ProposalStatus.Submitted,
            "PollenDAO: invalid proposal status"
        );
        require(now >= proposal.votingExpiry, "PollenDAO: vote not expired");
        require(
            (
                proposal.yesVotes.add(proposal.noVotes) >
                _pollen.totalSupplyAt(proposal.snapshotId).mul(_quorum).div(100)
            ) || proposalId == 0,
            "PollenDAO: vote did not reach quorum"
        );
        require(
            proposal.yesVotes > proposal.noVotes || proposalId == 0,
            "PollenDAO: vote failed"
        );
        require(now >= proposal.executionOpen, "PollenDAO: execution not open");
        require(
            now < proposal.executionExpiry || proposalId == 0,
            "PollenDAO: execution expired"
        );
        require(
            proposal.submitter == msg.sender,
            "PollenDAO: only submitter can execute"
        );

        IERC20 asset = IERC20(proposal.assetTokenAddress);

        (uint256 assetRate, ) = _rateQuoter.quotePrice(proposal.assetTokenAddress);
        (uint256 plnRate, ) = _rateQuoter.quotePrice(_getPollenAddress());
        // [ETH/PLN] / [ETH/ASSET] = [ASSET/PLN]
        uint256 rate = plnRate.mul(1e4).div(assetRate);

        if (proposal.proposalType == ProposalType.Invest) {
            // [PLN] * [ASSET/PLN] = [ASSET]
            uint256 assetTokenAmount = proposal.pollenAmount.mul(rate).div(1e4);
            if (proposal.assetTokenAmount > assetTokenAmount) {
                assetTokenAmount = proposal.assetTokenAmount;
            }

            // OK to send Pollen first as long as the asset received in the end
            _pollen.mint(proposal.pollenAmount);
            _pollen.transfer(msg.sender, proposal.pollenAmount);
            asset.safeTransferFrom(
                msg.sender,
                address(this), assetTokenAmount
            );
            emit Executed(proposalId, assetTokenAmount);
        }
        else if (proposal.proposalType == ProposalType.Divest) {
            // [ASSET] / [ASSET/PLN] = PLN
            uint256 pollenAmount = proposal.assetTokenAmount.mul(1e4).div(rate);

            if (proposal.pollenAmount > pollenAmount) {
                pollenAmount = proposal.pollenAmount;
            }

            // OK to send assets first as long as Pollen received in the end
            asset.safeTransfer(msg.sender, proposal.assetTokenAmount);
            _pollen.burnFrom(msg.sender, pollenAmount);

            emit Executed(proposalId, pollenAmount);
        } else {
            revert("unsupported proposal type");
        }

        _proposals[proposalId].status = ProposalStatus.Executed;
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
                if (assetBalance == 0) {
                    continue;
                }
                uint256 assetTokenAmount = assetBalance.mul(pollenAmount).div(totalSupply);
                asset.transfer(
                    msg.sender,
                    assetTokenAmount > assetBalance ? assetBalance : assetTokenAmount
                );
            }
        }

        emit Redeemed(
            msg.sender,
            pollenAmount
        );
    }

    /// @inheritdoc IPollenDAO
    function addAsset(address asset) external override onlyOwner {
        _revertZeroAddress(asset);
        require(!_assets.contains(asset), "PollenDAO: already added");
        require(_assets.add(asset));
        emit assetAdded(asset);
    }

    /// @inheritdoc IPollenDAO
    function removeAsset(address asset) external override onlyOwner {
        _revertZeroAddress(asset);
        require(_assets.contains(asset), "PollenDAO: unknown asset");
        require(IERC20(asset).balanceOf(address(this)) == 0, "PollenDAO: asset has balance");
        require(_assets.remove(asset));
        emit assetRemoved(asset);
    }

    /// @inheritdoc IPollenDAO
    function setOwner(address newOwner) external override onlyOwner {
        require(newOwner != address(0), "PollenDAO: invalid owner address");
        address oldOwner = _owner;
        _owner = newOwner;
        emit NewOwner(newOwner, oldOwner);
    }

    /// @inheritdoc IPollenDAO
    function setParams(
        uint256 quorum,
        uint256 votingExpiryDelay,
        uint256 executionOpenDelay,
        uint256 executionExpiryDelay
    ) external override onlyOwner {
        _setParams(quorum, votingExpiryDelay, executionOpenDelay, executionExpiryDelay);
    }

    /// @inheritdoc IPollenDAO
    function setPriceQuoter(address newQuoter) external override onlyOwner {
        require(newQuoter != address(0), "PollenDAO: quoter  address");
        address oldQuoter = address(_rateQuoter);
        _rateQuoter= IRateQuoter(newQuoter);
        emit NewPriceQuoter(newQuoter, oldQuoter);
    }

    function _getPollenAddress() private view returns(address) {
        return address(_pollen);
    }

    function _setParams(
        uint256 quorum,
        uint256 votingExpiryDelay,
        uint256 executionOpenDelay,
        uint256 executionExpiryDelay
    ) internal {
        require(quorum <= 100, "PollenDAO: invalid quorum");
        // TODO: Define realistic min's and max's
        require(
            votingExpiryDelay > 60 && votingExpiryDelay < maxDelay,
            "PollenDAO: invalid voting expiry"
        );
        require(
            executionOpenDelay > 60 && executionOpenDelay < maxDelay,
            "PollenDAO: invalid exec open"
        );
        require(
            executionExpiryDelay > 60 && executionExpiryDelay < maxDelay,
            "PollenDAO: invalid exec expiry"
        );

        _quorum = quorum;
        _votingExpiryDelay = votingExpiryDelay;
        _executionOpenDelay = executionOpenDelay;
        _executionExpiryDelay = executionExpiryDelay;
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

    function _revertZeroAddress(address _address) private pure {
        require(_address != address(0), "PollenDAO: invalid token address");
    }
}
