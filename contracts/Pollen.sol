pragma solidity >=0.6 <0.7.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Snapshot.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Pollen
 * @dev The main token for the Pollen DAO
 * @author gtlewis
 * @author scorpion9979
 */
contract Pollen is ERC20, ERC20Snapshot, Ownable {
    /**
    * @notice Constructor sets the Pollen display values (public)
    */
    constructor() public ERC20("Pollen", "PLN") {}

    /**
    * @notice Mint tokens to the owner account (external)
    * @param amount The amount of tokens to mint
    */
    function mint(uint256 amount) external onlyOwner
    {
        _mint(owner(), amount);
    }

    /**
    * @notice Burn tokens of the owner account (external)
    * @param amount The amount of allowed tokens to burn
    */
    function burn(address account, uint256 amount) external onlyOwner
    {
        _burn(account, amount);
    }

    /**
    * @notice Creates a new snapshot and returns its snapshot id (public)
    */
    function snapshot() external onlyOwner returns (uint256)
    {
        return super._snapshot();
    }

    /**
    * @dev Necessary function overrides for OpenZeppelin ^0.3.0 migration to Solidity 0.6.x
    */
    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Snapshot) virtual {
        return super._burn(account, amount);
    }

    function _mint(address account, uint256 amount) internal override(ERC20, ERC20Snapshot) virtual {
        return super._mint(account, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override(ERC20, ERC20Snapshot) virtual {
        return super._transfer(sender, recipient, amount);
    }
}
