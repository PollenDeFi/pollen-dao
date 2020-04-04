pragma solidity >=0.6 <0.7.0;

import "../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

/**
 * @title MockERC20
 * @dev A mock ERC20 token
 * @author gtlewis
 * @author scorpion9979
 */
contract MockERC20 is ERC20, ERC20Detailed {
    /**
    * @notice Constructor sets token display values (public)
    */
    constructor(string memory name, string memory symbol) public ERC20Detailed(name, symbol, 18) {}

    /**
    * @notice Mint tokens to the sender (external)
    * @param amount The amount of tokens to mint
    */
    function mint(uint256 amount) external
    {
        _mint(msg.sender, amount);
    }
}
