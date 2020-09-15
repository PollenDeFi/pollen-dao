// SPDX-License-Identifier: MIT
pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";


/**
 * @dev `AggregatorV3Interface` by Chainlink
 * @dev Source: https://docs.chain.link/docs/price-feeds-api-reference
 */
interface IAggregatorV3 {
    /*
     * @dev Get the number of decimals present in the response value
     */
    function decimals() external view returns (uint8);

    /*
     * @dev Get the description of the underlying aggregator that the proxy points to
     */
    function description() external view returns (string memory);

    /*
     * @dev Get the version representing the type of aggregator the proxy points to
     */
    function version() external view returns (uint256);

    /**
     * @dev Get data from a specific round
     * @notice It raises "No data present" if there is no data to report
     * @notice Consumers are encouraged to check they're receiving fresh data
     * by inspecting the updatedAt and answeredInRound return values.
     * @notice The round id is made up of the aggregator's round ID with the phase ID
     * in the two highest order bytes (it ensures round IDs get larger as time moves forward)
     * @param roundId The round ID
     * @return roundId The round ID
     * @return answer The price
     * @return startedAt Timestamp of when the round started
     * (Only some AggregatorV3Interface implementations return meaningful values)
     * @return updatedAt Timestamp of when the round was updated (computed)
     * @return answeredInRound The round ID of the round in which the answer was computed
     * (Only some AggregatorV3Interface implementations return meaningful values)
     */
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );

    /**
     * @dev Get data from the last round
     * Should raise "No data present" if there is no data to report
     * @return roundId The round ID
     * @return answer The price
     * @return startedAt Timestamp of when the round started
     * @return updatedAt Timestamp of when the round was updated
     * @return answeredInRound The round ID of the round in which the answer was computed
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

interface IMockAggregatorV3 is IAggregatorV3 {
    /**
     * @dev Set mock data
     * (Can only be called by the owner)
     * @param roundId The round ID
     * @param answer The price
     * @param updatedAt Timestamp of when the round was updated
     */
    function setRoundData(uint80 roundId, int256 answer, uint256 updatedAt) external;
}

/**
 * @dev Mock price feed oracle that simulates `AggregatorV3Interface` by Chainlink
 */
contract MockPriceOracle is Initializable, OwnableUpgradeSafe, IMockAggregatorV3 {

    // roundId => uint256(uint32 updatedAt; int128 answer)
    mapping(uint80 => uint256) internal _rounds;

    string internal _description;
    uint32 internal _version;
    uint8 internal _decimals;

    uint80 internal _currentRound;

    /**
     * @notice Initializes the contract
     * @dev Sets the contract `owner` account to the deploying account
     */
    function initialize(uint32 version, uint8 decimals, string memory description) external
    initializer
    {
        __Ownable_init();
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
    function setRoundData(uint80 roundId, int256 answer, uint256 updatedAt) external
    override onlyOwner
    {
        require(
            (roundId > _currentRound) && (roundId <= MAX_ROUND_ID),
            "MockPriceOracle: invalid roundId"
        );
        _currentRound = roundId;
        _rounds[roundId] = packRound(answer, updatedAt);
    }

    /*
     * private and internal functions (and constants)
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
