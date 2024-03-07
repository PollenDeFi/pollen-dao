/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import {ILayerZeroReceiver} from "@layerzerolabs/lz-evm-sdk-v1-0.7/contracts/interfaces/ILayerZeroReceiver.sol";

interface IBridgeReceiver is ILayerZeroReceiver {
    /**
     * The event that is emitted when the message is received.
     * @param senderChainId The source endpoint identifier.
     * @param senderAndReceiverAddresses The source sending contract address from the source chain.
     * @param nonce The ordered message nonce.
     * @param payload The signed payload is the UA bytes has encoded to be sent.
     */
    event MessageSuccess(
        uint16 senderChainId,
        bytes senderAndReceiverAddresses,
        uint64 nonce,
        bytes payload
    );

    /**
     * The event that is emitted when the message is failed.
     * @param senderChainId The source endpoint identifier.
     * @param senderAndReceiverAddresses The source sending contract address from the source chain.
     * @param nonce The ordered message nonce.
     * @param payload The signed payload is the UA bytes has encoded to be sent.
     * @param reason The reason of failure.
     */
    event MessageFailed(
        uint16 senderChainId,
        bytes senderAndReceiverAddresses,
        uint64 nonce,
        bytes payload,
        bytes reason
    );

    /**
     * The event that is emitted when the message is retried.
     * @param senderChainId The source endpoint identifier.
     * @param senderAndReceiverAddresses The source sending contract address from the source chain.
     * @param nonce The ordered message nonce.
     * @param payload The signed payload is the UA bytes has encoded to be sent.
     */
    event RetryMessageSuccess(
        uint16 senderChainId,
        bytes senderAndReceiverAddresses,
        uint64 nonce,
        bytes payload
    );

    /**
     * DAO call this function to sets up bridge params.
     * @param senderChainId The source endpoint identifier.
     * @param sender The source sending contract address from the source chain.
     * @param receiverLzGateway The LZ gateway on the destination chain.
     */
    function setBridgeReceiverStorage(
        uint16 senderChainId,
        address sender,
        address receiverLzGateway
    ) external;

    /**
     * LayerZero endpoint call this function to check a transaction capabilities.
     * @param senderChainId The source endpoint identifier.
     * @param senderAndReceiverAddresses The source sending contract address from the source chain.
     * @param nonce The ordered message nonce.
     * @param payload The signed payload is the UA bytes has encoded to be sent.
     */
    function nonblockingLzReceive(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64 nonce,
        bytes memory payload
    ) external;

    /**
     * Retry to execute the blocked message.
     * @param senderChainId The source endpoint identifier.
     * @param senderAndReceiverAddresses The source sending contract address from the source chain.
     * @param nonce The ordered message nonce.
     * @param payload The signed payload is the UA bytes has encoded to be sent.
     */
    function retryMessage(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64 nonce,
        bytes memory payload
    ) external;
}
