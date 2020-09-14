// SPDX-License-Identifier: MIT

pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Snapshot.sol";

/**
 * @title Pollen
 * @dev The main token for the Pollen DAO
 * @author gtlewis
 * @author scorpion9979
 * @author vkonst
 */
contract Pollen_v1 is OwnableUpgradeSafe, ERC20SnapshotUpgradeSafe {

    /**
     * @dev Reserved for possible storage structure changes
     */
    uint256[50] private __gap;

    /**
     * @notice Initializes the contract and sets the Pollen token name and symbol (external)
     * @dev Sets the contract `owner` account to the deploying account
     */
    function initialize() external initializer
    {
        __Ownable_init();
        __ERC20_init_unchained("Pollen", "PLN");
        __ERC20Snapshot_init_unchained();
    }

    /**
     * @notice Mints tokens to the owner account (external)
     * @param amount The amount of tokens to mint
     * Requirements: the caller must be the owner
     * See {ERC20-_mint}.
     */
    function mint(uint256 amount) external onlyOwner
    {
        _mint(_msgSender(), amount);
    }

    /**
     * @notice Destroys `amount` tokens from the caller (external)
     * @param amount The amount of tokens to mint
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) external
    {
        _burn(_msgSender(), amount);
    }

    /**
     * @notice Destroys `amount` tokens from `account`, deducting from the caller's allowance
     * Requirements: the caller must have allowance for `accounts`'s tokens of at least `amount`
     */
    function burnFrom(address account, uint256 amount) external {
        uint256 decreasedAllowance = allowance(account, _msgSender())
            .sub(amount, "Pollen: burn amount exceeds allowance");

        _approve(account, _msgSender(), decreasedAllowance);
        _burn(account, amount);
    }

    /**
     * @notice Creates a new snapshot and returns its snapshot id (external)
     * Requirements: the caller must be the owner
     */
    function snapshot() external onlyOwner returns (uint256)
    {
        return super._snapshot();
    }
}
