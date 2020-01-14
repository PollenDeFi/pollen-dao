pragma solidity 0.5.12;

import { IInvestmentFundDao } from "./interfaces/IInvestmentFundDao.sol";

/**
* @title InvestmentFundDao Contract
* @notice The main Investment Fund Dao contract
* @dev TODO - abstract ACIF token to governance token
* @dev TODO - prevent double voting
* @author gtlewis
*/
contract InvestmentFundDao is IInvestmentFundDao {

    /**
     * @notice Type for representing a token proposal
     * @member tokenAddress the address of the token
     * @member tokenAmount The amount of the token being proposed to invest/divest
     * @member amifAmount The amount of the AMIF token being proposed to pay/receive
     * @member yesVotes The total of yes votes for the proposal in AMIF tokens
     * @member noVotes The total of no votes for the proposal in AMIF tokens
     * @member status The status of the proposal
     */
    struct TokenProposal {
        address tokenAddress;
        uint256 tokenAmount;
        uint256 amifAmount;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 status;
    }

    /**
     * @notice Type for representing a proposal to withdraw AMIF
     * @member amount The amount of the token being proposed to withdraw
     * @member yesVotes The total of yes votes for the proposal in AMIF tokens
     * @member noVotes The total of no votes for the proposal in AMIF tokens
     * @member status The status of the proposal
     */
    struct WithdrawAmifProposal {
        uint256 amount;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 status;
    }

    // TODO: implement interface functions using below state
    mapping (uint256 => TokenProposal) private investERC20Proposals;
    mapping (uint256 => TokenProposal) private divestERC20Proposals;
    mapping (uint256 => WithdrawAmifProposal) private withdrawAmifProposals;
}
