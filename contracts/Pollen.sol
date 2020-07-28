pragma solidity >=0.6 <0.7.0;

import "../node_modules/@openzeppelin/contracts/drafts/ERC20Snapshot.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";

/**
 * @title Pollen
 * @dev The main token for the Pollen DAO
 * @author gtlewis
 * @author scorpion9979
 */
contract Pollen is ERC20Snapshot, ERC20Detailed, Ownable {
    /**
    * @notice Constructor sets the Pollen display values (public)
    */
    constructor() public ERC20Detailed("Pollen", "PLN", 18) {}

    /**
    * @notice Mint tokens to the owner account (external)
    * @param amount The amount of tokens to mint
    */
    function mint(uint256 amount) external onlyOwner
    {
        _mint(owner(), amount);
    }

    // TODO: make external and use the internal _snapshot() implementation for V3.0.0
    /**
    * @notice Creates a new snapshot and returns its snapshot id (public)
    */
    function snapshot() public override onlyOwner returns (uint256)
    {
        return super.snapshot();
    }
}
