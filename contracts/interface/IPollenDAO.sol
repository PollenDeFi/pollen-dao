/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title IPollenDAO
/// @notice Pollen DAO interface

struct Portfolio {
  uint256[] assetAmounts;
  uint8[] weights;
  uint256 initialValue;
  bool open;
}

struct IssuanceInfo {
  uint256 maxTime; 
  uint256 offsetX;
  uint256 offsetY; 
  uint256 rate; 
}

interface IPollenDAO {
  function mockFunction ( address ) external pure returns ( uint256 );
  function isAdmin ( address user ) external view returns ( bool );
  function isRegisteredModule ( address implementation, bytes4[] calldata selectors ) external view returns ( bool );
  function getProposal ( uint256 id ) external view returns ( address, address, uint256, uint256 );
  function getQuorum (  ) external view returns ( uint256 );
  function getTimeLock (  ) external view returns ( uint256 );
  function getVotingPeriod (  ) external view returns ( uint256 );
  function hasUserVoted ( address user, uint256 id ) external view returns ( bool );
  function getRate (  ) external view returns ( uint256 );
  event MessageFailed ( uint16 senderChainId, bytes senderAndReceiverAddresses, uint64 nonce, bytes payload, bytes reason );
  event MessageSuccess ( uint16 senderChainId, bytes senderAndReceiverAddresses, uint64 nonce, bytes payload );
  event RetryMessageSuccess ( uint16 senderChainId, bytes senderAndReceiverAddresses, uint64 nonce, bytes payload );
  function lzReceive ( uint16 senderChainId, bytes calldata senderAndReceiverAddresses, uint64 nonce, bytes calldata payload ) external;
  function nonblockingLzReceive ( uint16 senderChainId, bytes calldata senderAndReceiverAddresses, uint64 nonce, bytes calldata payload ) external;
  function retryMessage ( uint16 senderChainId, bytes calldata senderAndReceiverAddresses, uint64 nonce, bytes calldata payload ) external;
  function setBridgeReceiverStorage ( uint16 senderChainId, address sender, address receiverLzGateway ) external;
  event TokensBridged ( address sender, uint256 amount );
  function burnAndBridgePollen ( uint256 amount ) external;
  function burnPollen ( address user, uint256 amount ) external;
  function pollenDAO (  ) external view returns ( address );
  function receiver (  ) external view returns ( address );
  function receiverChainId (  ) external view returns ( uint16 );
  function senderLzGateway (  ) external view returns ( address );
  event ClaimedTokens ( address account, uint256 proposalId, uint256 amount );
  event NewProposal ( address submitter, address executer, uint256 id );
  event QuorumChanged ( uint256 newQuorum );
  event TimeLockChanged ( uint256 newTimeLock );
  event Voted ( address voter, uint256 proposalId, bool vote, uint256 amount );
  event VotingPeriodChanged ( uint256 newVotingPeriod );
  function executeProposal ( uint256 id ) external;
  function setQuorum ( uint256 supplyPercent ) external;
  function setTimeLock ( uint256 timeLock ) external;
  function setVotingPeriod ( uint256 votingPeriod ) external;
  function submitProposal ( address executer ) external;
  function voteProposal ( uint256 id, bool voteType ) external;
  event IssuanceScheduleSet (  );
  event WithdrawWithPenalty ( address portfolio, address user, uint256 amount, uint256 penalty, uint256 delegateFee, bool tokenType );
  event WithdrawWithReward ( address portfolio, address user, uint256 amount, uint256 reward, uint256 delegateFee, bool tokenType );
  function calculateMaxAllocation (  ) external view returns ( uint256 );
  function closeAndWithdraw ( uint256 amount, bool tokenType ) external;
  function getBoostingScale (  ) external view returns ( uint256 );
  function getRewardRate ( address owner, uint256 currentValue ) external view returns ( uint256 rate );
  function initializeIssuanceInfo ( IssuanceInfo[] calldata schedule ) external;
  function mintRewards ( address account, uint256 amount ) external;
  function preprocessWithdrawal ( address owner, bool tokenType ) external view returns ( uint256 currentValue, uint256 deposited, uint256 balance, uint256 r, bool isPositive, uint256 benchMarkVal );
  function setBoostingScale ( uint256 _newBoostingScale ) external;
  function setMaxNumberWithdrawls ( uint256 _newMaxWithdrawls ) external;
  function withdraw ( address owner, uint256 amount, bool tokenType ) external;
  function withdrawMany ( address[] calldata owners, uint256[] calldata amounts, bool tokenType ) external;
  function withdrawRewards ( address owner, bool tokenType ) external;
  function withdrawRewardsMany ( address[] calldata owners, bool tokenType ) external;
  event AssetAdded ( address asset );
  event AssetRemoved ( address asset );
  event BenchmarkPortfolioCreated ( address creator, uint256[] weights );
  event Delegated ( address delegator, address delegatee, uint256 amount, bool tokenType );
  event PortfolioBalanceLimitsSet ( uint256 minBalancePolinator, uint256 maxDelegation );
  event PortfolioClosed ( address creator );
  event PortfolioCreated ( address creator, uint256 amount, uint256[] weights, bool tokenType );
  event PortfolioRebalanced ( address creator, uint256[] weights, uint256 portfolioValue, uint256 benchMarkValue, uint256 amount, bool tokenType );
  event PortfolioReopened ( address creator, uint256 amount, uint256[] weights );
  event RebalancePeriodSet ( uint256 rebalanceMinPeriod );
  event maxNumAssetsSet ( uint256 maxNumAssets );
  function addAsset ( address asset ) external;
  function createBenchMarkPortfolio ( uint256[] calldata weights ) external;
  function createPortfolio ( uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType ) external;
  function delegatePollen ( address delegate, uint256 amount, bool tokenType ) external;
  function getAssets (  ) external view returns ( address[] memory assets );
  function getBenchMarkValue (  ) external view returns ( uint256 );
  function getPortfolio ( address owner, address delegator ) external view returns ( uint256[] memory assetAmounts, uint256 balance, uint256 depositPLN, uint256 depositVePLN, bool isOpen, uint256 benchMarkRef, uint256 shortsValue, bool[] memory isShort );
  function getPortfolioValue ( uint256[] calldata assetAmounts, uint256[] calldata prices, bool[] calldata isShort, uint256 shortsValue ) external pure returns ( uint256 value );
  function getPrices ( uint256[] calldata isValidAsset, address[] calldata assets ) external view returns ( uint256[] memory prices );
  function getTotalReward ( address delegator, address[] calldata owners, bool tokenType ) external view returns ( uint256[] memory pReturns, uint256[] memory rewards, bool[] memory isPositive );
  function multiDelegatePollen ( address[] calldata delegates, uint256[] calldata amounts, bool tokenType ) external;
  function rebalanceBenchMarkPortfolio ( uint256[] calldata weights ) external;
  function rebalancePortfolio ( uint256[] calldata weights, bool[] calldata isShort, uint256 amount, bool tokenType ) external;
  function removeAsset ( address asset ) external;
  function setLimitPortfolioBalance ( uint256 minBalancePollinator, uint256 maxDelegation ) external;
  function setMaxNumberOfAssetsPerPortfolio ( uint256 maxNumAssets ) external;
  function setRebalancePeriod ( uint256 rebalanceMinPeriod ) external;
  event PriceFeedAdded ( address asset, address feed, uint8 rateBase );
  event PriceFeedRemoved ( address asset, uint8 rateBase );
  function addPriceFeed ( uint8 rateBase, address asset, address feed ) external;
  function addPriceFeeds ( uint8[] calldata rateBase, address[] calldata asset, address[] calldata feed ) external;
  function getFeed ( uint8 rateBase, address asset ) external view returns ( address priceFeed );
  function quotePrice ( uint8 rateBase, address asset ) external view returns ( uint256 rate, uint256 updatedAt );
  function removePriceFeed ( uint8 rateBase, address asset ) external;
  event AdminRoleTransferred ( address previousAdmin, address newAdmin );
  event ModuleAdded ( address moduleAddr, bytes4[] selectors );
  event ModuleRemoved ( address moduleAddr, bytes4[] selectors );
  event ModuleUpdated ( address newImplementation, address oldImplementation, bytes4[] newSelectors, bytes4[] oldSelectors );
  event PollenTokenSet ( address pollenTokenAddr, address vePollenTokenAddr );
  function addModule ( address implementation, bytes4[] calldata selectors ) external;
  function pollenToken (  ) external view returns ( address plnTokenAddress );
  function renounceAdminRole (  ) external;
  function setPollenTokens ( address pollenToken_, address vePollenToken_ ) external;
  function transferAdminRole ( address newAdmin ) external;
  function updateModule ( address newImplementation, address oldImplementation, bytes4[] calldata newSelectors, bytes4[] calldata oldSelectors ) external;
}
