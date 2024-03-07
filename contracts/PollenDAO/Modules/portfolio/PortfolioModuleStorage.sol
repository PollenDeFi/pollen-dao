// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title PortfolioStorage
/// @notice Storage contract for Portfolio module
/// @dev Defines data types and storage for asset management

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../lib/PortfolioAssetSet.sol";

contract PortfolioModuleStorage {
    bytes32 private constant PORTFOLIO_STORAGE_SLOT =
        keccak256("PollenDAO.portfolio.storage");

    uint256 internal constant MAX_SUM_WEIGHTS = 100;
    uint256 internal constant BASE_FUNDS = 1e18;
    uint256 internal constant MAX_AGE_QUOTE = 172800;
    uint256 internal constant TOKEN_PRECISION = 1e18;

    struct PortfolioInfo {
        uint256[] assetAmounts;
        mapping(bool => mapping(address => uint256)) balances;
        mapping(bool => mapping(address => uint256)) deposits;
        mapping(address => uint256) benchMarkRef;
        bool isOpen;
        bool initialized;
        uint256 lastRebalanceDate;
        uint256 totalDeposited;
        uint256 totalBalance;
        uint256 shortsVal; // initial value of the shoted assets
        bool[] isShort; // indicate if an asset of the portfolio is log(false) or shorted(true)
    }

    struct PortfolioStorage {
        PortfolioAssetSet.AssetSet assets;
        mapping(address => PortfolioInfo) portfolios;
        uint256 rebalanceMinPeriod;
        uint256 minBalancePollinator;
        uint256 maxDelegation;
        uint256 maxNumAssetsPerPortfolio;
        uint256 totalDelegated;
    }

    /* solhint-disable no-inline-assembly */
    function getPortfolioStorage()
        internal
        pure
        returns (PortfolioStorage storage ps)
    {
        bytes32 slot = PORTFOLIO_STORAGE_SLOT;
        assembly {
            ps.slot := slot
        }
    }
    /* solhint-enable no-inline-assembly */
}
