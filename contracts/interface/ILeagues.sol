/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title ILeagues
/// @notice Leagues interface


interface ILeagues {
  event ApprovalForAll ( address account, address operator, bool approved );
  event Invited ( address user, uint256 leagueId );
  event JoinedLeague ( address user, uint256 leagueId );
  event LeftLeague ( address user, uint256 leagueId );
  event MemberRemoved ( address user, uint256 leagueId );
  event NewLeague ( address admin, uint256 id, string name );
  event TransferAdminRole ( address oldAdmin, address newAdmin, uint256 leagueId );
  event TransferBatch ( address operator, address from, address to, uint256[] ids, uint256[] values );
  event TransferSingle ( address operator, address from, address to, uint256 id, uint256 value );
  event URI ( string value, uint256 id );
  function admins ( address ) external view returns ( uint256 );
  function balanceOf ( address account, uint256 id ) external view returns ( uint256 );
  function balanceOfBatch ( address[] calldata accounts, uint256[] calldata ids ) external view returns ( uint256[] memory );
  function claimDeposit (  ) external;
  function createLeague ( string calldata name_, uint256 _nftPrice, uint256 maxSupply ) external;
  function exists ( uint256 id ) external view returns ( bool );
  function initialize ( string calldata uri_, address plnAddress ) external;
  function isApprovedForAll ( address account, address operator ) external view returns ( bool );
  function joinLeague ( uint256 id ) external;
  function leagues ( uint256 ) external view returns ( string memory name, address admin, uint256 createdOn, uint256 nftPrice, uint256 maxSupply, bool claimed );
  function nameCheck ( bytes32 ) external view returns ( bool );
  function pln (  ) external view returns ( address );
  function removeMembers ( address[] calldata users ) external;
  function safeBatchTransferFrom ( address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data ) external;
  function safeTransferFrom ( address from, address to, uint256 id, uint256 amount, bytes calldata data ) external;
  function setApprovalForAll ( address operator, bool approved ) external;
  function supportsInterface ( bytes4 interfaceId ) external view returns ( bool );
  function totalSupply ( uint256 id ) external view returns ( uint256 );
  function transferAdminRole ( address newAdmin ) external;
  function uri ( uint256 ) external view returns ( string memory );
  function whiteListed ( uint256, address ) external view returns ( bool );
  event AdminChanged ( address previousAdmin, address newAdmin );
  event BeaconUpgraded ( address beacon );
  event Upgraded ( address implementation );
  function admin (  ) external returns ( address admin_ );
  function changeAdmin ( address newAdmin ) external;
  function implementation (  ) external returns ( address implementation_ );
  function upgradeTo ( address newImplementation ) external;
  function upgradeToAndCall ( address newImplementation, bytes calldata data ) external;
}
