pragma solidity >=0.4.21 <0.7.0;

/**
* @title IInvestmentFundDao Interface
* @notice Interface for the Investment Fund Dao
* @dev TODO - add other ERC token types and abstract
* @author gtlewis
*/
interface IInvestmentFundDao {

    /**
    * @notice Submit a proposal to invest in an ERC20 token (external)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to invest in
    * @param daoTokenAmount The amount of DAO token to pay
    */
    function submitInvestErc20Proposal(address tokenAddress, uint256 tokenAmount, uint256 daoTokenAmount) external;

    /**
    * @notice Submit a proposal to divest of an ERC20 token (external)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to divest
    * @param daoTokenAmount The amount of DAO token to receive
    */
    function submitDivestErc20Proposal(address tokenAddress, uint256 tokenAmount, uint256 daoTokenAmount) external;

    /**
    * @notice Vote on a proposal to invest in an ERC20 token (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOnInvestErc20Proposal(uint256 proposalId, bool vote) external;

    /**
    * @notice Vote on a proposal to divest of an ERC20 token (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOnDivestErc20Proposal(uint256 proposalId, bool vote) external;

    /**
    * @notice Execute a proposal to invest in an ERC20 token (external)
    * @param proposalId The proposal ID
    */
    function executeInvestErc20Proposal(uint256 proposalId) external;

    /**
    * @notice Execute a proposal to divest of an ERC20 token (external)
    * @param proposalId The proposal ID
    */
    function executeDivestErc20Proposal(uint256 proposalId) external;

    /**
     * @notice Event emitted when a proposal to invest in an ERC20 token is submitted
     */
    event InvestErc20ProposalSubmitted(address tokenAddress, uint256 tokenAmount, uint256 daoTokenAmount);

    /**
     * @notice Event emitted when a proposal to divest of an ERC20 token is submitted
     */
    event DivestErc20ProposalSubmitted(address tokenAddress, uint256 tokenAmount, uint256 daoTokenAmount);

    /**
     * @notice Event emitted when a proposal to invest in an ERC20 token is voted on
     */
    event InvestErc20ProposalVotedOn(address voter, uint256 proposalId, bool vote);

    /**
     * @notice Event emitted when a proposal to divest of an ERC20 token is voted on
     */
    event DivestErc20ProposalVotedOn(address voter, uint256 proposalId, bool vote);

    /**
     * @notice Event emitted when a proposal to invest in an ERC20 token is executed
     */
    event InvestErc20ProposalExecuted(address executor, uint256 proposalId);

    /**
     * @notice Event emitted when a proposal to divest of an ERC20 token is executed
     */
    event DivestErc20ProposalExecuted(address executor, uint256 proposalId);
}
