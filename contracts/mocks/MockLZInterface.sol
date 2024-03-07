/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import {LZEndpointMock} from "@layerzerolabs/solidity-examples/contracts/lzApp/mocks/LZEndpointMock.sol";

/// @title MockLZInterface
/// @notice This is a mock contract for LayerZero interface

contract MockLZInterface is LZEndpointMock {
    constructor(uint16 destId) LZEndpointMock(destId) {}
}
