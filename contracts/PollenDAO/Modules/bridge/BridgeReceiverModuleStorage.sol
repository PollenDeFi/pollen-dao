// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

contract BridgeReceiverModuleStorage {
    bytes32 private constant BRIDGE_RECEIVER_STORAGE_SLOT =
        keccak256("PollenDAO.receiver.bridge.storage");

    struct BridgeReceiverStorage {
        uint16 senderChainId;
        address sender;
        address receiverLzGateway;
        mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) failedMessages;
    }

    /* solhint-disable no-inline-assembly */
    function getBridgeReceiverStorage()
        internal
        pure
        returns (BridgeReceiverStorage storage ms)
    {
        bytes32 slot = BRIDGE_RECEIVER_STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
