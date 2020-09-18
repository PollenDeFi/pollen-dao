// SPDX-License-Identifier: MIT
pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "../interfaces/IAggregatorV3.sol";

interface IMockAggregatorV3 is IAggregatorV3 {

    /**
     * @return The address that may change updater
     */
    function getOwner() external view  returns (address);

    /**
     * @return The address that may update price data
     */
    function getUpdater() external view  returns (address);

    /**
     * @dev Change the updater
     * @param updater The address that may update price data
     */
    function changeUpdater(address updater) external;

    /**
     * @dev Set mock data
     * (Can only be called by the updater)
     * @param roundId The round ID
     * @param answer The price
     * @param updatedAt Timestamp of when the round was updated
     */
    function setRoundData(uint80 roundId, int256 answer, uint256 updatedAt) external;

    /**
     * @dev Initializes the contract
     * @notice It sets the caller address as the owner and the updater
     * @param version The version representing the type of aggregator the proxy points to
     * @param decimals The number of decimals present in the response value
     * @param description The description of the underlying aggregator that the proxy points to
     */
    function initialize(
        uint32 version,
        uint8 decimals,
        string memory description
    ) external;
}

/**
 * @dev Mock price feed oracle that simulates `AggregatorV3Interface` by Chainlink
 */
contract MockPriceOracle is Initializable, IMockAggregatorV3 {

    string private _description;
    uint32 private _version;
    uint8 private _decimals;

    address private _owner;
    address private _updater;
    uint80 internal _currentRound;

    // roundId => uint256(uint32 updatedAt; int128 answer)
    mapping(uint80 => uint256) internal _rounds;

    /// @inheritdoc IMockAggregatorV3
    function initialize(
        uint32 version,
        uint8 decimals,
        string memory description
    ) external override initializer
    {
        _owner = msg.sender;
        _updater = msg.sender;
        _version = version;
        _decimals = decimals;
        _description = description;
    }

    /// @inheritdoc IAggregatorV3
    function getRoundData(uint80 _roundId) public view virtual override returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        roundId = _roundId;
        (answer, updatedAt) = unpackRound(_rounds[roundId]);
        answeredInRound = roundId;
        startedAt = updatedAt;
    }

    /// @inheritdoc IAggregatorV3
    function latestRoundData() public view virtual override returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return getRoundData(_currentRound);
    }

    /// @inheritdoc IAggregatorV3
    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    /// @inheritdoc IAggregatorV3
    function version() external view override returns (uint256) {
        return _version;
    }

    /// @inheritdoc IAggregatorV3
    function description() external view override returns (string memory) {
        return _description;
    }

    /// @inheritdoc IMockAggregatorV3
    function getOwner() external view override returns (address) {
        return _owner;
    }

    /// @inheritdoc IMockAggregatorV3
    function getUpdater() external view override returns (address) {
        return _updater;
    }

    /// @inheritdoc IMockAggregatorV3
    function changeUpdater(address updater) external override {
        require(msg.sender == _owner, "MockPriceOracle: caller is not the owner");
        require(updater != address(0), "MockPriceOracle: invalid updater address");
        _updater = updater;
    }

    /// @inheritdoc IMockAggregatorV3
    function setRoundData(uint80 roundId, int256 answer, uint256 updatedAt) external
    override
    {
        require(msg.sender == _updater, "MockPriceOracle: caller is not the updater");
        require(
            (roundId != 0) && (roundId <= MAX_ROUND_ID),
            "MockPriceOracle: roundId out of range"
        );
        require((roundId >= _currentRound), "MockPriceOracle: roundId must be incremental");

        if (roundId != _currentRound) {
            _currentRound = roundId;
            _rounds[roundId] = packRound(answer, updatedAt);
        } else {
            (int256 oldAnswer, uint256 oldUpdatedAt) = unpackRound(_rounds[_currentRound]);
            require(oldAnswer == answer, "MockPriceOracle: mismatching answer");
            require(oldUpdatedAt == updatedAt, "MockPriceOracle: mismatching updatedAt");
        }
    }

    /*
     * private functions and constants
     */

    uint256 constant private OFFSET = 128;
    uint256 constant private MAX_ROUND_ID = 2**80 - 1;
    uint256 constant private MAX_UPDATED_AT = 2**32 - 1;
    uint256 constant private MAX_ANSWER = 2**128 - 1;

    // Pack `updatedAt` and `answer` into uint256 (uin64 _gap, uint32 updatedAt, int128 answer)
    function packRound(int256 answer, uint256 updatedAt) private pure returns (uint256) {
        require(
            updatedAt <= MAX_UPDATED_AT && updatedAt <= MAX_ANSWER,
            "MockPriceOracle: too big value(s)"
        );
        return (updatedAt << OFFSET) | uint256(answer);
    }

    // Unpack `updatedAt` and `answer` from uint256
    function unpackRound(uint256 round) private pure returns (int256 answer, uint256 updatedAt) {
        require(round > 0, "No data present");
        updatedAt = (uint256(round) >> OFFSET) & MAX_UPDATED_AT;
        answer = int256(round & MAX_ANSWER);
    }
}
