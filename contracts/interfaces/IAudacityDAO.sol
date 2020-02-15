pragma solidity >=0.6 <0.7.0;

/**
* @title IAudacityDAO Interface
* @notice Interface for the Audacity DAO
* @dev TODO - add other ERC token types and abstract
* @author gtlewis
* @author scorpion9979
*/

enum ProposalType {Invest, Divest, Last}
enum TokenType {ERC20, Last}

interface IAudacityDAO {
    /**
    * @notice Submit a proposal (external)
    * @param proposalType The type of proposal (e.g., Invest, Divest)
    * @param tokenType The type of token (e.g., ERC20)
    * @param tokenAddress The address of the token
    * @param tokenAmount The amount of the token to invest/divest
    * @param daoTokenAmount The amount of DAO token to be paid/received
    */
    function submit(
        ProposalType proposalType,
        TokenType tokenType,
        address tokenAddress,
        uint256 tokenAmount,
        uint256 daoTokenAmount
    ) external;

    /**
    * @notice Vote on a proposal (external)
    * @param proposalId The proposal ID
    * @param vote The yes/no vote
    */
    function voteOn(uint256 proposalId, bool vote) external;

    /**
    * @notice Execute a proposal (external)
    * @param proposalId The proposal ID
    */
    function execute(uint256 proposalId) external;

    /**
     * @notice Event emitted when a proposal is submitted
     */
    event Submitted(
        ProposalType proposalType,
        TokenType tokenType,
        address tokenAddress,
        uint256 tokenAmount,
        uint256 daoTokenAmount
    );

    /**
     * @notice Event emitted when a proposal is voted on
     */
    event VotedOn(
        ProposalType proposalType,
        TokenType tokenType,
        address voter,
        uint256 proposalId,
        bool vote
    );

    /**
     * @notice Event emitted when a proposal is executed
     */
    event Executed(
        ProposalType proposalType,
        TokenType tokenType,
        address executor,
        uint256 proposalId
    );
}
