// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PollenFaucet is Ownable {
    IERC20 public pollenToken;

    uint256 public tokenClaimLimit;

    constructor(address pollenToken_, uint256 tokenClaimLimit_) Ownable() {
        pollenToken = IERC20(pollenToken_);
        tokenClaimLimit = tokenClaimLimit_;
    }

    function claim() external {
        pollenToken.transfer(msg.sender, tokenClaimLimit);
    }

    function setTokenClaimLimit(uint256 tokenClaimLimit_) external onlyOwner {
        tokenClaimLimit = tokenClaimLimit_;
    }
}
