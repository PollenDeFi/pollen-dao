// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/// @title MockPriceFeed
/// @notice This mock of the Chainlink agregator for testing purposes
// https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol

contract MockPriceFeed {
    uint8 private _decimals;
    uint80 private _round = 42;
    int256 private _answer = 42;
    uint256 private _updatedAt = block.timestamp;

    constructor(uint8 _decimalsNum) {
        _decimals = _decimalsNum;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external pure returns (string memory) {
        return "mock price feed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function incrementRoundAndSetAnswer(int256 answer) external {
        _round++;
        _answer = answer;
        _updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 updatedAt) external {
        _updatedAt = updatedAt;
    }

    function getRoundData(uint80)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_round, _answer, 4200000, _updatedAt, _round);
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_round, _answer, 4200000, _updatedAt, _round);
    }
}
