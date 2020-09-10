// SPDX-License-Identifier: MIT

pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";


/**
* @title IPollen Interface
* @author vkonst
*/
interface IPollen is IERC20 {

    /**
     * @dev Emitted when a snapshot identified by `id` is created.
     */
    event Snapshot(uint256 id);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract and sets the token name and symbol.
     * Registers the deployer as the contract `owner`. Can be called once only.
     */
    function initialize() external;

    /**
     * @dev Mints tokens to the owner account.
     * Can only be called by the owner.
     * @param amount The amount of tokens to mint
     */
    function mint(uint256 amount) external;

    /**
     * @dev Destroys `amount` tokens from the caller.
     * @param amount The amount of tokens to mint
     */
    function burn(uint256 amount) external;

    /**
     * @dev Creates a new snapshot and returns its snapshot id.
     * Can only be called by the owner.
     */
    function snapshot() external returns (uint256);

    /**
     * @dev Retrieves the balance of `account` at the time `snapshotId` was created.
     */
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);

    /**
     * @dev Retrieves the total supply at the time `snapshotId` was created.
     */
    function totalSupplyAt(uint256 snapshotId) external view returns(uint256);

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() external view returns (address);

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the owner.
     */
    function transferOwnership(address newOwner) external;

    /**
     * @dev Leaves the contract without owner.
     * Can only be called by the owner.
     * It will not be possible to call `onlyOwner` functions anymore.
     */
    function renounceOwnership() external;
}
