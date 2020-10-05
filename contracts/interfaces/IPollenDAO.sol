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
    * @notice Type for representing a token proposal status
    */
    enum ProposalStatus {Null, Submitted, Executed, Last}

    /**
    * @notice Type for representing the state of a vote on a proposal
    */
    enum VoterState {Null, VotedYes, VotedNo}

    /**
    * @notice Type for representing a token type
    */
    enum TokenType {ERC20, Last}

    /**
    * @notice Returns the current version of the DAO (external)
    * @return The current version of the Pollen DAO
    */
    function version() external pure returns (string memory);

    /**
    * @notice Get the Pollen token contract address (external view)
    * @return The Pollen contract address
    */
    function getPollenAddress() external view returns(address);

    /**
    * @notice Get a proposal's data at index (external view)
    * @param proposalId The proposal ID
    * @return proposalType , assetTokenType , assetTokenAddress , assetTokenAmount
    * pollenAmount , descriptionCid, submitter , snapshotId , yesVotes , noVotes , status
    */
    function getProposalData(uint256 proposalId) external view returns(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount,
        string memory descriptionCid,
        address submitter,
        uint256 snapshotId,
        uint256 yesVotes,
        uint256 noVotes,
        ProposalStatus status
    );

    /**
    * @notice Get a proposal's voting and execution timestamps at index (external view)
    * @param proposalId The proposal ID
    * @return votingExpiry , executionOpen , executionExpiry
    */
    function getProposalTimestamps(uint256 proposalId) external view returns(
        uint256 votingExpiry,
        uint256 executionOpen,
        uint256 executionExpiry
    );

    /**
    * @notice Get the state of a voter on a specified proposal (external view)
    * @param proposalId The proposal ID
    * @return The state of the vote
    */
    function getVoterState(uint256 proposalId) external view returns(VoterState);

    /**
    * @notice Get total proposal count (external view)
    * @return The total proposal count
    */
    function getProposalCount() external view returns(uint256);

    /**
    * @notice Get the assets that the DAO holds (external view)
    * @return The set of asset token addresses
    */
    function getAssets() external view returns (address[] memory);

    /**
    * @notice Get the voting expiry delay (external view)
    * @return The number of seconds until voting expires after proposal submission
    */
    function getVotingExpiryDelay() external view returns(uint256);

    /**
    * @notice Get the exection open delay (external view)
    * @return The number of seconds until execution opens after proposal voting expires
    */
    function getExecutionOpenDelay() external view returns(uint256);

    /**
    * @notice Get the exection expiry delay (external view)
    * @return The number of seconds until execution expires after proposal exection opens
    */
    function getExecutionExpiryDelay() external view returns(uint256);

    /**
    * @notice Get the quorum required to pass a proposal vote (external view)
    * @return The quorum in % points
    */
    function getQuorum() external view returns(uint256);

    /**
    * @notice Submit a proposal (external)
    * @param proposalType The type of proposal (e.g., Invest, Divest)
    * @param assetTokenType The type of the asset token (e.g., ERC20)
    * @param assetTokenAddress The address of the asset token
    * @param assetTokenAmount The minimum (on invest) or exact (on divest) amount of the asset token to receive/pay
    * @param pollenAmount The exact (on invest) or minimum (on divest) amount of Pollen to be paid/received
    */
    function submit(
        ProposalType proposalType,
        TokenType assetTokenType,
        address assetTokenAddress,
        uint256 assetTokenAmount,
        uint256 pollenAmount,
        string memory descriptionCid
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
    * @notice Add an asset to supported assets (external)
    * (only the owner may call)
    * @param asset The address of the asset to be added
    */
    function addAsset(address asset) external;

    /**
    * @notice Remove an asset from supported assets (external)
    * (only the owner may call)
    * @param asset The address of the asset to be removed
    */
    function removeAsset(address asset) external;

    /**
    * @notice Set a new address to be the owner (external)
    * (only the owner may call)
    * @param newOwner The address of the new owner
    */
    function setOwner(address newOwner) external;

    /**
     * @notice Event emitted when an asset gets added to supported assets
     */
    event assetAdded(address indexed asset);

    /**
     * @notice Event emitted when an asset gets removed from supported assets
     */
    event assetRemoved(address indexed asset);

    /**
     * @notice Event emitted when a proposal is submitted
     */
    event Submitted(
        uint256 proposalId,
        ProposalType proposalType,
        address submitter,
        uint256 snapshotId
    );

    /**
     * @notice Event emitted when a proposal is voted on
     */
    event VotedOn(
        uint256 proposalId,
        address voter,
        bool vote
    );

    /**
     * @notice Event emitted when a proposal is executed
     */
    event Executed(
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
