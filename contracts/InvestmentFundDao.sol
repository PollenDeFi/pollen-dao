pragma solidity >=0.4.21 <0.7.0;

import { IInvestmentFundDao } from "./interfaces/IInvestmentFundDao.sol";

/**
* @title InvestmentFundDao Contract
* @notice The main Investment Fund Dao contract
* @dev TODO - prevent double voting
* @dev TODO - proposal voting time expiry
* @dev TODO - proposal execution time expiry
* @author gtlewis
*/
contract InvestmentFundDao is IInvestmentFundDao {

    enum ProposalStatus {Submitted, Passed, Failed, Executed, Expired}

    /**
     * @notice Type for representing a token proposal
     * @member tokenAddress the address of the token
     * @member tokenAmount The amount of the token being proposed to invest/divest
     * @member daoTokenAmount The amount of the DAO token being proposed to pay/receive
     * @member yesVotes The total of yes votes for the proposal in AMIF tokens
     * @member noVotes The total of no votes for the proposal in AMIF tokens
     * @member status The status of the proposal
     */
    struct Proposal {
        address tokenAddress;
        uint256 tokenAmount;
        uint256 daoTokenAmount;
        uint256 yesVotes;
        uint256 noVotes;
        ProposalStatus status;
    }

    /**
    * @notice The DAO token address (private)
    */
    address private daoTokenAddress;

    /**
    * @notice The proposals to invest in ERC20 tokens (public)
    */
    mapping(uint256 => Proposal) public investERC20Proposals;

    /**
    * @notice The count of proposals to invest in ERC20 tokens (public)
    */
    uint256 public investERC20ProposalCount;

    /**
    * @notice The proposals to divest of ERC20 tokens (public)
    */
    mapping(uint256 => Proposal) public divestERC20Proposals;

    /**
    * @notice The count of proposals to divest of ERC20 tokens (public)
    */
    uint256 public divestERC20ProposalCount;

    /**
     * @notice constructor sets the DAO token address from the given address (public)
     * @param daoTokenAddress_ The address of the DAO token
     */
    constructor(address daoTokenAddress_) public {
        daoTokenAddress = daoTokenAddress_;
    }

    /**
    * @notice Submit a proposal to invest in an ERC20 token (external)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to invest in
    * @param daoTokenAmount The amount of DAO token to pay
    */
    function submitInvestErc20Proposal(address tokenAddress, uint256 tokenAmount, uint256 daoTokenAmount) external {
        require(tokenAddress != address(0), "invalid token address");
        require(tokenAmount != 0 || daoTokenAmount != 0, "both token amount and DAO token amount zero");

        Proposal memory proposal;
        proposal.tokenAddress = tokenAddress;
        proposal.tokenAmount = tokenAmount;
        proposal.daoTokenAmount = daoTokenAmount;
        proposal.status = ProposalStatus.Submitted;

        investERC20Proposals[investERC20ProposalCount] = proposal;
        investERC20ProposalCount++;

        emit InvestErc20ProposalSubmitted(tokenAddress, tokenAmount, daoTokenAmount);
    }

    /**
    * @notice Submit a proposal to divest of an ERC20 token (external)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to divest
    * @param daoTokenAmount The amount of DAO token to receive
    */
    function submitDivestErc20Proposal(address tokenAddress, uint256 tokenAmount, uint256 daoTokenAmount) external {
        // TODO: implement

        emit DivestErc20ProposalSubmitted(tokenAddress, tokenAmount, daoTokenAmount);
    }

    /**
    * @notice Vote on a proposal to invest in an ERC20 token (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOnInvestErc20Proposal(uint256 proposalId, bool vote) external {
        // TODO: implement

        emit InvestErc20ProposalVotedOn(msg.sender, proposalId, vote);
    }

    /**
    * @notice Vote on a proposal to divest of an ERC20 token (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOnDivestErc20Proposal(uint256 proposalId, bool vote) external {
        // TODO: implement

        emit DivestErc20ProposalVotedOn(msg.sender, proposalId, vote);
    }

    /**
    * @notice Execute a proposal to invest in an ERC20 token (external)
    * @param proposalId The proposal ID
    */
    function executeInvestErc20Proposal(uint256 proposalId) external {
        // TODO: implement

        emit InvestErc20ProposalExecuted(msg.sender, proposalId);
    }

    /**
    * @notice Execute a proposal to divest of an ERC20 token (external)
    * @param proposalId The proposal ID
    */
    function executeDivestErc20Proposal(uint256 proposalId) external {
        // TODO: implement

        emit DivestErc20ProposalExecuted(msg.sender, proposalId);
    }

   // TODO: add isQuorumReached(proposalId) helper function (private or external)
   // TODO: add getTotalDAOTokenSupply() helper function (private or external)
}
