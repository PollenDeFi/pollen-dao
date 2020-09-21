// SPDX-License-Identifier: MIT
pragma solidity >=0.6 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";


/**
 * @title MockERC20
 * @dev A mock ERC20 token
 */
contract MockAssetToken is ERC20PresetMinterPauserUpgradeSafe {
    function initialize(string memory name, string memory symbol, uint256 amount) public {
        super.initialize(name, symbol);
        mint(msg.sender, amount);
    }
}
