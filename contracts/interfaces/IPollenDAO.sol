pragma solidity >=0.6 <0.7.0;

/**
* @title IPollenDAO Interface
* @notice Interface for the Pollen DAO
* @author gtlewis
* @author scorpion9979
*/
interface IPollenDAO {
    /**
    * @notice Type for representing a proposal type
    */
    enum ProposalType {Invest, Divest, Last}

    /**
    * @notice Type for representing a token type
    */
    enum TokenType {ERC20, Last}

    /**
    * @notice Submit a proposal (external)
    * @param proposalType The type of proposal (e.g., Invest, Divest)
    * @param assetTokenType The type of the asset token (e.g., ERC20)
    * @param assetTokenAddress The address of the asset token
    * @param assetTokenAmount The amount of the asset token to invest/divest
    * @param pollenAmount The amount of Pollen to be paid/received
    */
    function submit(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount
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
    * @notice Redeem Pollens for asset tokens (external)
    * @param pollenAmount The amount of Pollens to redeem
    */
    function redeem(uint256 pollenAmount) external;

    /**
     * @notice Event emitted when a proposal is submitted
     */
    event Submitted(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount,
        uint256 proposalId
    );

    /**
     * @notice Event emitted when a proposal is voted on
     */
    event VotedOn(
        ProposalType proposalType,
        address voter,
        uint256 proposalId,
        bool vote
    );

    /**
     * @notice Event emitted when a proposal is executed
     */
    event Executed(
        ProposalType proposalType,
        address executor,
        uint256 proposalId
    );

    /**
     * @notice Event emitted when Pollens are redeemed
     */
    event Redeemed(
        address sender,
        uint256 pollenAmount
    );
}
