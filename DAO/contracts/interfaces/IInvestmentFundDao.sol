pragma solidity 0.5.12;

/**
* @title IInvestmentFundDao Interface
* @notice Interface for the Investment Fund Dao
* @dev TODO - abstract ACIF token to governance token
* @dev TODO - add other ERC token types and abstract
* @author gtlewis
*/
interface IInvestmentFundDao {

    /**
    * @notice Submit a proposal to invest in an ERC20 token (external)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to invest in
    * @param amifAmount The amount of AMIF to pay
    */
    function submitInvestErc20Proposal(address tokenAddress, uint256 tokenAmount, uint256 amifAmount) external;

    /**
    * @notice Submit a proposal to divest an ERC20 token (external)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to divest
    * @param amifAmount The amount of AMIF to receive
    */
    function submitDivestErc20Proposal(address tokenAddress, uint256 tokenAmount, uint256 AmifAmount) external;

    /**
    * @notice Vote on a proposal to invest in an ERC20 token (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOnInvestErc20Proposal(uint256 proposalId, bool vote) external;

    /**
    * @notice Vote on a proposal to divest an ERC20 token (external)
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
    * @notice Execute a proposal to divest an ERC20 token (external)
    * @param proposalId The proposal ID
    */
    function executeDivestErc20Proposal(uint256 proposalId) external;

    /**
     * @notice Event emitted when a proposal to invest in an ERC20 token is submitted
     */
    event InvestErc20ProposalSubmitted(Types.Erc20Proposal erc20Proposal);

    /**
     * @notice Event emitted when a proposal to divest an ERC20 token is submitted
     */
    event DivestErc20ProposalSubmitted(Types.Erc20Proposal erc20Proposal);

    /**
     * @notice Event emitted when a proposal to invest in an ERC20 token is voted on
     */
    event InvestErc20ProposalVotedOn(address voter, uint256 proposalId, bool vote);

    /**
     * @notice Event emitted when a proposal to divest an ERC20 token is voted on
     */
    event DivestErc20ProposalVotedOn(address voter, uint256 proposalId, bool vote);

    /**
     * @notice Event emitted when a proposal to invest in an ERC20 token is executed
     */
    event InvestErc20ProposalExecuted(uint256 proposalId);

    /**
     * @notice Event emitted when a proposal to divest an ERC20 token is executed
     */
    event DivestErc20ProposalExecuted(uint256 proposalId);
}
