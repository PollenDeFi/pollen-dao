pragma solidity >=0.6 <0.7.0;
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

/**
 * @title AudacityToken
 * @dev The main token for the Audacity DAO
 * @author gtlewis
 * @author scorpion9979
 */
contract AudacityToken is ERC20Detailed, ERC20Pausable {
    // TODO: implement a minting mechanism

    constructor() public ERC20Detailed("Audacity", "AUD", 18) {}
}
