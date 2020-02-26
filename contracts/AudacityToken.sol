pragma solidity >=0.6 <0.7.0;
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

/**
 * @title AudacityToken
 * @dev The main token for the Audacity DAO
 * @author gtlewis
 * @author scorpion9979
 */
contract AudacityToken is ERC20Detailed, ERC20Capped, ERC20Pausable {
    // TODO: modify _initialSupply and _maxSupply
    // TODO: implement a public minting mechanism
    uint256 private _initialSupply = 10_000e18;
    uint256 private _maxSupply = 100_000_000_000e18;

    constructor()
        public
        ERC20Detailed("Audacity", "AUD", 18)
        ERC20Capped(_maxSupply)
    {
        _mint(_msgSender(), _initialSupply);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual
        override(ERC20Capped, ERC20Pausable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
