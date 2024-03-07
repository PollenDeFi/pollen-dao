// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Leagues is ERC1155SupplyUpgradeable {
    struct LeagueInfo {
        string name;
        address admin;
        uint256 createdOn;
        uint256 nftPrice;
        uint256 maxSupply;
        bool claimed;
    }

    IERC20 public pln;
    uint256 private constant MIN_PLN_DEPOSIT = 10 * 1e18;
    uint256 private constant LOCK_PERIOD = 7 days;

    uint256 private leagueNonce;
    mapping(address => uint256) public admins;
    mapping(uint256 => LeagueInfo) public leagues;
    mapping(uint256 => mapping(address => bool)) public whiteListed;
    mapping(bytes32 => bool) public nameCheck;

    event NewLeague(address indexed admin, uint256 id, string name);
    event Invited(address indexed user, uint256 indexed leagueId);
    event JoinedLeague(address indexed user, uint256 indexed leagueId);
    event LeftLeague(address indexed user, uint256 leagueId);
    event TransferAdminRole(
        address indexed oldAdmin,
        address indexed newAdmin,
        uint256 leagueId
    );
    event MemberRemoved(address indexed user, uint256 indexed leagueId);

    // External functions

    /// @notice intializer for the upgradeable contract
    /// @param uri_ uri for the ERC1155 token
    /// @param plnAddress address of the pollen token contract
    function initialize(
        string memory uri_,
        address plnAddress
    ) external initializer {
        pln = IERC20(plnAddress);
        __ERC1155_init(uri_);
    }

    /// @notice allow users to create a league. A claimable deposit should be locked for some time
    /// @param name_ name that will be uset to represent the league
    function createLeague(
        string calldata name_,
        uint256 _nftPrice,
        uint256 maxSupply
    ) external {
        require(maxSupply > 0, "invalid supply");
        require(admins[msg.sender] == 0, "user is already admin");
        bytes32 nameHash = keccak256(abi.encode(name_));
        require(!nameCheck[nameHash], "League name already exist");
        nameCheck[nameHash] = true;
        pln.transferFrom(msg.sender, address(this), MIN_PLN_DEPOSIT);
        leagueNonce++;
        uint256 id = leagueNonce;
        leagues[id] = LeagueInfo(
            name_,
            msg.sender,
            block.timestamp,
            _nftPrice,
            maxSupply,
            false
        );
        admins[msg.sender] = id;
        _mint(msg.sender, id, 1, "");
        emit NewLeague(msg.sender, id, name_);
    }

    /// @notice allow admins to claim the deposit tokens after lock period expires
    function claimDeposit() external {
        uint256 id = admins[msg.sender];
        require(id != 0, "sender is not admin");
        require(
            leagues[id].createdOn < block.timestamp - LOCK_PERIOD,
            "Lock period active"
        );
        require(!leagues[id].claimed, "deposit already claimed");
        leagues[id].claimed = true;
        require(
            pln.transfer(msg.sender, MIN_PLN_DEPOSIT),
            "PLN transfer failed"
        );
    }

    // /// @notice admins can whitelist users to join a league;
    // /// @param users user that admin wants to invite
    // function invite(address[] calldata users) external {
    //     uint256 id = admins[msg.sender];
    //     require(id != 0, "Only admins can invite");
    //     for (uint256 i = 0; i < users.length; i++) {
    //         whiteListed[id][users[i]] = true;
    //         emit Invited(users[i], id);
    //     }
    // }
    /// @notice whitelisted users can join a league
    /// @param id league id that the user will join
    function joinLeague(uint256 id) external payable {
        //require(whiteListed[id][msg.sender], "User not approved to join");
        //whiteListed[id][msg.sender] = false;
        require(msg.value == leagues[id].nftPrice, "invalid amount");
        require(totalSupply(id) < leagues[id].maxSupply, "max supply reached");
        _mint(msg.sender, id, 1, "");
        (bool status, ) = payable(leagues[id].admin).call{value: msg.value}("");
        require(status, "Fee transfer failed");
        emit JoinedLeague(msg.sender, id);
    }

    // /// @notice allow user to leave a league
    // /// @param id league id
    // function leaveLeague(uint256 id) external {
    //     require(balanceOf(msg.sender, id) != 0, "Not a member");
    //     require(msg.sender != leagues[id].admin, "Admins cannot leave league");
    //     _burn(msg.sender, id, 1);
    //     emit LeftLeague(msg.sender, id);
    // }

    /// @notice allow admin to transfer admin role to a member of a league
    /// @param newAdmin new admin address
    function transferAdminRole(address newAdmin) external {
        require(msg.sender != newAdmin, "Invalid new admin");
        uint256 id = admins[msg.sender];
        require(
            leagues[id].createdOn < block.timestamp - LOCK_PERIOD,
            "Lock period active"
        );
        require(id != 0, "Only admins");
        require(admins[newAdmin] == 0, "delegate is already admin");
        require(balanceOf(newAdmin, id) != 0, "New admin is not a member");

        admins[msg.sender] = 0;
        admins[newAdmin] = id;
        leagues[id].admin = newAdmin;
        if (!leagues[id].claimed) {
            leagues[id].claimed = true;
            require(
                pln.transfer(msg.sender, MIN_PLN_DEPOSIT),
                "PLN transfer failed"
            );
        }
        emit TransferAdminRole(msg.sender, newAdmin, id);
    }

    /// @notice admin can remove users
    /// @param users users that will be removed from a league
    function removeMembers(address[] calldata users) external {
        uint256 id = admins[msg.sender];
        require(id != 0, "Only admins");
        for (uint256 i = 0; i < users.length; i++) {
            if (balanceOf(users[i], id) != 0) {
                _burn(users[i], id, 1);
                emit MemberRemoved(users[i], id);
            }
        }
    }

    // Public functions

    // Internal functions

    function _beforeTokenTransfer(
        address,
        address from,
        address to,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) internal virtual override {
        require(
            from == address(0) || to == address(0),
            "Token is not transferable"
        );
    }
}
