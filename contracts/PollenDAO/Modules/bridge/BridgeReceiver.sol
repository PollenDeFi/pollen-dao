// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import {IPollen} from "../../../interface/IPollen.sol";
import {IBridgeReceiver} from "../../../interface/IBridgeReceiver.sol";
import {PollenDAOStorage} from "../../PollenDAO.sol";
import {BridgeReceiverModuleStorage} from "./BridgeReceiverModuleStorage.sol";

contract BridgeReceiver is
    IBridgeReceiver,
    PollenDAOStorage,
    BridgeReceiverModuleStorage
{
    function setBridgeReceiverStorage(
        uint16 senderChainId,
        address sender,
        address receiverLzGateway
    ) external override onlyAdmin {
        BridgeReceiverStorage storage brs = getBridgeReceiverStorage();

        brs.senderChainId = senderChainId;
        brs.sender = sender;
        brs.receiverLzGateway = receiverLzGateway;
    }

    function lzReceive(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64 nonce,
        bytes memory payload
    ) external override {
        BridgeReceiverStorage storage brs = getBridgeReceiverStorage();
        require(msg.sender == brs.receiverLzGateway, "Invalid gateway");

        _blockingLzReceive(
            senderChainId,
            senderAndReceiverAddresses,
            nonce,
            payload
        );
    }

    function nonblockingLzReceive(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64 nonce,
        bytes memory payload
    ) public override {
        require(msg.sender == address(this), "Invalid caller");

        _nonblockingLzReceive(
            senderChainId,
            senderAndReceiverAddresses,
            nonce,
            payload
        );
    }

    function retryMessage(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64 nonce,
        bytes memory payload
    ) public override {
        BridgeReceiverStorage storage brs = getBridgeReceiverStorage();

        bytes32 payloadHash = brs.failedMessages[senderChainId][
            senderAndReceiverAddresses
        ][nonce];
        require(payloadHash != bytes32(0), "No stored message");
        require(keccak256(payload) == payloadHash, "Invalid payload");

        _nonblockingLzReceive(
            senderChainId,
            senderAndReceiverAddresses,
            nonce,
            payload
        );

        delete brs.failedMessages[senderChainId][senderAndReceiverAddresses][
            nonce
        ];

        emit RetryMessageSuccess(
            senderChainId,
            senderAndReceiverAddresses,
            nonce,
            payload
        );
    }

    function _blockingLzReceive(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64 nonce,
        bytes memory payload
    ) private {
        try
            IBridgeReceiver(address(this)).nonblockingLzReceive(
                senderChainId,
                senderAndReceiverAddresses,
                nonce,
                payload
            )
        {
            emit MessageSuccess(
                senderChainId,
                senderAndReceiverAddresses,
                nonce,
                payload
            );
        } catch (bytes memory reason) {
            BridgeReceiverStorage storage brs = getBridgeReceiverStorage();

            brs.failedMessages[senderChainId][senderAndReceiverAddresses][
                    nonce
                ] = keccak256(payload);

            emit MessageFailed(
                senderChainId,
                senderAndReceiverAddresses,
                nonce,
                payload,
                reason
            );
        }
    }

    function _nonblockingLzReceive(
        uint16 senderChainId,
        bytes memory senderAndReceiverAddresses,
        uint64,
        bytes memory payload
    ) private {
        BridgeReceiverStorage storage brs = getBridgeReceiverStorage();
        require(senderChainId == brs.senderChainId, "Invalid sender chain ID");

        address sender;
        assembly {
            sender := mload(add(senderAndReceiverAddresses, 20))
        }
        require(sender == brs.sender, "Invalid sender address");

        (address user, uint256 amount) = abi.decode(
            payload,
            (address, uint256)
        );

        DAOStorage storage ds = getPollenDAOStorage();
        IPollen token = IPollen(ds.pollenToken);

        token.mint(user, amount);
    }
}
