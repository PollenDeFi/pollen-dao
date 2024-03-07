// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import {ILayerZeroEndpoint} from "@layerzerolabs/lz-evm-sdk-v1-0.7/contracts/interfaces/ILayerZeroEndpoint.sol";

import {IPollen} from "../../../interface/IPollen.sol";
import {IBridgeSender} from "../../../interface/IBridgeSender.sol";
import {PollenDAO, PollenDAOStorage} from "../../PollenDAO.sol";

contract BridgeSender is IBridgeSender, PollenDAOStorage {
    address public pollenDAO;

    uint16 public receiverChainId;
    address public receiver;
    address public senderLzGateway;

    /**
     * @param pollenDAO_ The Pollen DAO contract address.
     * @param receiverChainId_ The destination endpoint identifier.
     * @param receiver_ The contract address on the destination chain.
     * @param senderLzGateway_ The LZ gateway on the spurce chain.
     */
    constructor(
        address pollenDAO_,
        uint16 receiverChainId_,
        address receiver_,
        address senderLzGateway_
    ) {
        pollenDAO = pollenDAO_;
        receiverChainId = receiverChainId_;
        receiver = receiver_;
        senderLzGateway = senderLzGateway_;
    }

    function burnAndBridgePollen(uint256 amount) external payable override {
        require(amount > 0, "Invalid amount");

        IBridgeSender(pollenDAO).burnPollen(msg.sender, amount);

        sendMessageToMint(msg.sender, amount);
    }

    function burnPollen(address user, uint256 amount) external override {
        DAOStorage storage ds = getPollenDAOStorage();

        IPollen token = IPollen(ds.pollenToken);

        token.transferFrom(user, address(this), amount);

        token.burn(amount);
    }

    function sendMessageToMint(address user, uint256 amount) internal {
        bytes memory receiverAndSenderAddresses_ = abi.encodePacked(
            receiver,
            address(this)
        );

        bytes memory payload_ = abi.encode(user, amount);

        ILayerZeroEndpoint(senderLzGateway).send{value: msg.value}(
            receiverChainId, // communicator LayerZero chainId
            receiverAndSenderAddresses_, // send to this address to the communicator
            payload_, // bytes payload
            payable(user), // refund address
            address(0x0), // future parameter
            bytes("") // adapterParams (see "Advanced Features")
        );

        emit TokensBridged(user, amount);
    }
}
