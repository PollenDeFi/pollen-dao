/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

interface IBridgeSender {
    /**
     * The event that is emitted when the message is sended.
     * @param sender The source sender address.
     * @param amount The amount of token to bridge.
     */
    event TokensBridged(address sender, uint256 amount);

    /**
     * The function to bridge token to the destination chain.
     * @param amount The amount of token to burn and bridge.
     */
    function burnAndBridgePollen(uint256 amount) external payable;

    /**
     * The function to burn token.
     * Do NOT call this function if you want to bridge token.
     * @dev address(this) - DAO caller address from the delegatecall
     * @param user The user address to burn token.
     * @param amount The amount of token to burn.
     */
    function burnPollen(address user, uint256 amount) external;
}
