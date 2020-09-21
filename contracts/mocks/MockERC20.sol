// SPDX-License-Identifier: MIT
pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";


/**
 * @title MockERC20
 * @dev A mock ERC20 token
 * @author gtlewis
 * @author scorpion9979
 */
contract MockERC20 is ERC20PresetMinterPauserUpgradeSafe {

    constructor(string memory name, string memory symbol) public {
        initialize(name, symbol);
    }

    /// @dev the caller must have the `MINTER_ROLE`
    function mint(uint256 amount) public {
        super.mint(msg.sender, amount);
    }
}
