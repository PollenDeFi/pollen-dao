pragma solidity >=0.6 <0.7.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";

/**
 * @title DAOToken
 * @dev The main token for the Audacity DAO
 * @author gtlewis
 * @author scorpion9979
 */
contract DAOToken is ERC20, ERC20Detailed, Ownable {
    /**
    * @notice Constructor sets the DAO token display values (public)
    */
    constructor() public ERC20Detailed("DAOToken", "DAOT", 18) {}
    
    /**
    * @notice Mint tokens to the owner account (external)
    * @param amount The amount of tokens to mint
    */
    function mint(uint256 amount) external onlyOwner
    {
        _mint(owner(), amount);
    }
}
