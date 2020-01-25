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
    struct Proposal {
        address tokenAddress;
        uint256 tokenAmount;
        uint256 amifAmount;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 status;
    }

    // TODO: add constructor that set the Amif token address

    // TODO: implement interface functions using below state

    mapping(uint256 => Proposal) private investERC20Proposals;
    uint256 public investERC20ProposalCount;

    mapping(uint256 => Proposal) private divestERC20Proposals;
    uint256 public divestERC20ProposalCount;

   // TODO: add getProposal(proposalId) function (external)
   // TODO: add isQuorumReached(proposalId) helper function (private or external)
   // TODO: add getTotalAmifSupply() helper function (private or external)
}
