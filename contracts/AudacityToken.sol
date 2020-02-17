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
    // TODO: remove msg.sender from minter role and add DAO contract address instead
    constructor() ERC20Detailed('Audacity', 'AUD', 18) public {
    }
}