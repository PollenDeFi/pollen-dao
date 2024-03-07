// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title Portfolio
/// @notice Portfolio module for Pollen DAO
/// @dev Contains asset management logic

import "../../../interface/IPollen.sol";
import "./PortfolioModuleStorage.sol";
import "../../PollenDAOStorage.sol";
import "../../../lib/PortfolioAssetSet.sol";
import "../quoter/Quoter.sol";
import "../quoter/QuoterModuleStorage.sol";
import "../minter/Minter.sol";

//import "hardhat/console.sol";

contract Portfolio is
    PollenDAOStorage,
    PortfolioModuleStorage,
    QuoterModuleStorage
{
    using PortfolioAssetSet for PortfolioAssetSet.AssetSet;

    /// @dev emitted when an asset gets added to the Asset Set
    event AssetAdded(address indexed asset);

    /// @dev emitted when an asset gets removed from the Asset Set
    event AssetRemoved(address indexed asset);

    /// @dev emitted when a portfolio is created
    event PortfolioCreated(
        address indexed creator,
        uint256 amount,
        uint256[] weights,
        bool tokenType
    );

    /// @dev emitted when a benchmark portfolio is created
    event BenchmarkPortfolioCreated(address indexed creator, uint256[] weights);

    /// @dev emitted when a portfolio is reopened
    event PortfolioReopened(
        address indexed creator,
        uint256 amount,
        uint256[] weights
    );

    /// @dev emitted when a portfolio is rebalanced
    event PortfolioRebalanced(
        address indexed creator,
        uint256[] weights,
        uint256 portfolioValue,
        uint256 benchMarkValue,
        uint256 amount,
        bool tokenType
    );

    /// @dev emitted when a portfolio is closed during rebalancing
    event PortfolioClosed(address indexed creator);

    /// @dev emitted when somone delegates PLN
    event Delegated(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount,
        bool tokenType
    );

    /// @dev emited when rebalance period is modified by admin
    event RebalancePeriodSet(uint256 rebalanceMinPeriod);

    /// @dev emited when the portfolio balance limits are set
    event PortfolioBalanceLimitsSet(
        uint256 minBalancePolinator,
        uint256 maxDelegation
    );

    /// @dev emited when the max number of assets per portfolio
    event maxNumAssetsSet(uint256 maxNumAssets);

    // External functions

    /// @notice set the minimum amount of time between rebalances
    /// @dev Only callable by ProxyAdmin
    /// @param rebalanceMinPeriod time in seconds between rebalances (minimum)
    function setRebalancePeriod(uint256 rebalanceMinPeriod) external onlyAdmin {
        PortfolioStorage storage ps = getPortfolioStorage();
        ps.rebalanceMinPeriod = rebalanceMinPeriod;
        emit RebalancePeriodSet(rebalanceMinPeriod);
    }

    /// @notice set the minimum amount of time between rebalances
    /// @dev Only callable by ProxyAdmin
    /// @param minBalancePollinator min balance that a polinator should keep
    /// @param maxDelegation amx amount to be delegated to a portfolio
    function setLimitPortfolioBalance(
        uint256 minBalancePollinator,
        uint256 maxDelegation
    ) external onlyAdmin {
        PortfolioStorage storage ps = getPortfolioStorage();
        ps.minBalancePollinator = minBalancePollinator;
        ps.maxDelegation = maxDelegation;
        emit PortfolioBalanceLimitsSet(minBalancePollinator, maxDelegation);
    }

    /// @notice sets the maximum number of possible assets per portfolio
    /// @param maxNumAssets new max number of assets
    function setMaxNumberOfAssetsPerPortfolio(uint256 maxNumAssets)
        external
        onlyAdmin
    {
        PortfolioStorage storage ps = getPortfolioStorage();
        ps.maxNumAssetsPerPortfolio = maxNumAssets;
        emit maxNumAssetsSet(maxNumAssets);
    }

    /// @notice adds an asset to the DAO's Asset Set
    /// @dev Only callable by ProxyAdmin
    /// @dev Asset must not already be in the Asset Set
    /// @param asset address of the asset to add
    function addAsset(address asset) external onlyAdmin {
        PortfolioStorage storage ps = getPortfolioStorage();
        require(asset != address(0), "Asset cannot be zero address");
        require(!ps.assets.contains(asset), "Asset already in set");
        ps.assets.add(asset);
        emit AssetAdded(asset);
    }

    /// @notice removes an asset for the DAO's Asset Set
    /// @dev Only callable by ProxyAdmin
    /// @dev Asset must already be in the Asset Set
    /// @param asset address of the asset to remove
    function removeAsset(address asset) external onlyAdmin {
        require(asset != address(0), "Asset cannot be zero address");
        PortfolioStorage storage ps = getPortfolioStorage();
        require(ps.assets.contains(asset), "Asset not in set");
        ps.assets.remove(asset);
        emit AssetRemoved(asset);
    }

    /// @notice _createPortfolio
    function createBenchMarkPortfolio(uint256[] calldata weights)
        external
        onlyAdmin
    {
        bool[] memory isShort = new bool[](weights.length);
        _createPortfolio(address(this), 0, weights, isShort, false);
        emit BenchmarkPortfolioCreated(address(this), weights);
    }

    /// @notice allows user to create a portfolio
    /// @dev weights array length has to equal the size of the Asset Set, with 0s where weight for an asset is 0
    /// @param amount the amount of PLN the user wants to send in
    /// @param weights array of relative weights of portfolio assets
    /// @param tokenType uint8 false for selecting PLN, true for selecting vePLN
    function createPortfolio(
        uint256 amount,
        uint256[] calldata weights,
        bool[] calldata isShort,
        bool tokenType
    ) external {
        PortfolioStorage storage ps = getPortfolioStorage();
        require(
            amount != 0 && amount >= ps.minBalancePollinator,
            "Insufficient amount"
        );
        _createPortfolio(msg.sender, amount, weights, isShort, tokenType);

        DAOStorage storage ds = getPollenDAOStorage();
        address tokenAddress = tokenType ? ds.vePollenToken : ds.pollenToken;
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        emit PortfolioCreated(msg.sender, amount, weights, tokenType);
    }

    /// @notice allows user to rebalance a portfolio
    /// @param weights array of relative weights of portfolio assets
    /// @param amount ammount to add to the portfolio
    /// @param tokenType boolean false for selecting PLN, true for selecting vePLN
    function rebalancePortfolio(
        uint256[] calldata weights,
        bool[] calldata isShort,
        uint256 amount,
        bool tokenType
    ) external {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[msg.sender];
        DAOStorage storage ds = getPollenDAOStorage();

        require(p.initialized, "Portfolio not initialized");
        uint256 deposited = p.deposits[true][msg.sender] +
            p.deposits[false][msg.sender];
        require(ps.minBalancePollinator <= deposited + amount, "low balance");
        require(
            p.deposits[tokenType][msg.sender] > 0 || amount > 0,
            "Zero balance"
        );
        require(
            ps.rebalanceMinPeriod + p.lastRebalanceDate < block.timestamp,
            "Too early to rebalance"
        );
        (
            uint256 value,
            uint256[] memory assetAmounts,
            uint256 shortsValues
        ) = calculateRebalanceValues(msg.sender, weights, isShort);

        p.assetAmounts = assetAmounts;
        p.isOpen = weights[0] != MAX_SUM_WEIGHTS ? true : false;
        p.lastRebalanceDate = block.timestamp;
        p.shortsVal = shortsValues;

        if (amount > 0) {
            updateUserPortfolioInfo(
                p,
                value,
                amount,
                getBenchMarkValue(),
                tokenType
            );
            ps.totalDelegated += amount;

            address tokenAddress = tokenType
                ? ds.vePollenToken
                : ds.pollenToken;
            IERC20(tokenAddress).transferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        if (!p.isOpen) {
            emit PortfolioClosed(msg.sender);
        }
        emit PortfolioRebalanced(
            msg.sender,
            weights,
            value,
            p.benchMarkRef[msg.sender],
            amount,
            tokenType
        );
    }

    /// @notice allows user to rebalance a portfolio
    /// @param weights array of relative weights of portfolio assets
    function rebalanceBenchMarkPortfolio(uint256[] calldata weights)
        external
        onlyAdmin
    {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[msg.sender];

        require(p.initialized, "Portfolio not initialized");
        require(weights[0] != MAX_SUM_WEIGHTS, "BenchMark cant be USD-ref");
        require(
            ps.rebalanceMinPeriod + p.lastRebalanceDate < block.timestamp,
            "Too early to rebalance"
        );

        bool[] memory isShort = new bool[](weights.length);

        (
            uint256 value,
            uint256[] memory assetAmounts,

        ) = calculateRebalanceValues(address(this), weights, isShort);

        p.assetAmounts = assetAmounts;
        p.lastRebalanceDate = block.timestamp;

        emit PortfolioRebalanced(
            address(this),
            weights,
            value,
            value,
            0,
            false
        );
    }

    /// @notice allows user to track the portfolio of another user
    /// @param delegate address of the user to follow
    /// @param amount amount to stake with the portfolio
    /// @param tokenType boolean false for selecting PLN, true for selecting vePLN
    function delegatePollen(
        address delegate,
        uint256 amount,
        bool tokenType
    ) external {
        _delegatePollen(delegate, amount, tokenType);
        DAOStorage storage ds = getPollenDAOStorage();
        address tokenAddress = tokenType ? ds.vePollenToken : ds.pollenToken;
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
    }

    /// @notice allows user to track the portfolio of another user
    /// @param delegates addresses of the users to follow
    /// @param amounts amounts to stake with the portfolios
    /// @param tokenType boolean false for selecting PLN, true for selecting vePLN
    function multiDelegatePollen(
        address[] calldata delegates,
        uint256[] calldata amounts,
        bool tokenType
    ) external {
        require(
            delegates.length == amounts.length,
            "Invalid length parameters"
        );
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < delegates.length; i++) {
            _delegatePollen(delegates[i], amounts[i], tokenType);
            totalAmount += amounts[i];
        }
        DAOStorage storage ds = getPollenDAOStorage();
        address tokenAddress = tokenType ? ds.vePollenToken : ds.pollenToken;
        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            totalAmount
        );
    }

    // External functions that are view

    /// @return assets returns the entire set of whitelisted assets
    function getAssets() external view returns (address[] memory assets) {
        PortfolioStorage storage ps = getPortfolioStorage();
        assets = new address[](ps.assets.numWhitelistedAssets);
        for (uint256 i = 0; i < ps.assets.numWhitelistedAssets; i++) {
            if (ps.assets.isWhitelisted[ps.assets.elements[i]])
                assets[i] = ps.assets.elements[i];
        }
    }

    /// TODO?: should return the bench mark value of on the last rebalance
    /// @param owner address of portfolio creator
    /// @param delegator address of portfolio delegator
    /// @return assetAmounts portfolio asset amounts for a given owner
    /// @return balance total balance of the msg.sender
    /// @return depositPLN total deposit of the delegator in PLN
    /// @return depositVePLN total deposit of the delegator in vePLN
    /// @return isOpen if the portfolio is open
    function getPortfolio(address owner, address delegator)
        external
        view
        returns (
            uint256[] memory assetAmounts,
            uint256 balance,
            uint256 depositPLN,
            uint256 depositVePLN,
            bool isOpen,
            uint256 benchMarkRef,
            uint256 shortsValue,
            bool[] memory isShort
        )
    {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[owner];

        assetAmounts = p.assetAmounts;
        balance = p.balances[true][delegator] + p.balances[false][delegator];
        depositPLN = p.deposits[false][delegator];
        depositVePLN = p.deposits[true][delegator];
        isOpen = p.isOpen;
        benchMarkRef = p.benchMarkRef[delegator];
        isShort = p.isShort;
        shortsValue = p.shortsVal;
    }

    /// @notice Calculate current total reward and penalty
    /// @param delegator owner of delegated amount
    /// @param owners portfolio owners
    /// @return pReturns of each portfolio
    /// @return rewards / penalty of each portfolio
    /// @return isPositive whether the portfolio return is positive or negative
    function getTotalReward(
        address delegator,
        address[] calldata owners,
        bool tokenType
    )
        external
        view
        returns (
            uint256[] memory pReturns,
            uint256[] memory rewards,
            bool[] memory isPositive
        )
    {
        PortfolioStorage storage ps = getPortfolioStorage();
        pReturns = new uint256[](owners.length);
        rewards = new uint256[](owners.length);
        isPositive = new bool[](owners.length);

        for (uint256 i = 0; i < owners.length; i++) {
            PortfolioInfo storage p = ps.portfolios[owners[i]];

            uint256[] memory assetPrices = getPrices(
                p.assetAmounts,
                ps.assets.elements
            );

            uint256 currentValue = getPortfolioValue(
                p.assetAmounts,
                assetPrices,
                p.isShort,
                p.shortsVal
            );

            uint256 balance = p.balances[tokenType][delegator];
            uint256 deposited = p.deposits[tokenType][delegator];
            uint256 initVal = (deposited * PRECISION) / balance;

            if (currentValue >= initVal) {
                pReturns[i] =
                    ((PRECISION * currentValue) / initVal) -
                    PRECISION;
                isPositive[i] = true;
                if (delegator != owners[i]) {
                    pReturns[i] = (pReturns[i] * 80) / 100;
                }
            } else {
                pReturns[i] =
                    PRECISION -
                    ((PRECISION * currentValue) / initVal);
                isPositive[i] = false;
            }
            rewards[i] = (pReturns[i] * deposited) / PRECISION;
        }
    }

    // Public functions

    // Public functions that are view

    /// @notice gets prices of each asset in a portfolio
    /// @dev reverts if last asset update is older than 3 hours
    /// @param isValidAsset array with value != 0 for assets in the portfolio
    /// @param assets list of assets in Pollen DAO
    /// @return prices of each asset
    function getPrices(uint256[] memory isValidAsset, address[] memory assets)
        public
        view
        returns (uint256[] memory prices)
    {
        prices = new uint256[](isValidAsset.length);
        Quoter quoter = Quoter(address(this));
        for (uint256 i = 0; i < isValidAsset.length; i++) {
            /// special case when the portfolio is "closed"
            if (i == 0) {
                prices[i] = TOKEN_PRECISION;
                continue;
            }

            if (isValidAsset[i] != 0) {
                (uint256 price, uint256 updatedAt) = quoter.quotePrice(
                    RateBase.Usd,
                    assets[i]
                );

                // Reverts if price feed update is older than 48 hours
                // solhint-disable-next-line not-rely-on-time
                require(
                    block.timestamp - updatedAt < MAX_AGE_QUOTE,
                    "Price feed is too old"
                );
                prices[i] = price;
            }
        }
    }

    // Public functions that are pure

    /// @notice gets portfolio value
    /// @param assetAmounts assets amounts
    /// @param prices prices for the assets
    /// @return value portfolio value
    function getPortfolioValue(
        uint256[] memory assetAmounts,
        uint256[] memory prices,
        bool[] memory isShort,
        uint256 shortsValue
    ) public pure returns (uint256 value) {
        uint256 lVal = 0;
        uint256 sVal = 0;
        for (uint256 i = 0; i < assetAmounts.length; i++) {
            if (assetAmounts[i] == 0) continue;

            /// First asset is always usd (value = 1)
            if (i == 0) {
                lVal += assetAmounts[i];
                continue;
            }

            if (isShort[i]) {
                sVal += (prices[i] * assetAmounts[i]) / 10**18;
            } else {
                lVal += (prices[i] * assetAmounts[i]) / 10**18;
            }
        }

        uint256 delta;
        if (shortsValue < sVal) {
            delta = sVal - shortsValue;
            value = delta > shortsValue ? lVal : lVal + shortsValue - delta;
        } else {
            delta = shortsValue - sVal;
            value = lVal + shortsValue + delta;
        }
    }

    /// @notice returns a 2 element weighted average where the values are weighted by `amount_#`
    /// @dev used to get the weighted average of the benchmark portfolio during deposits where `value_#`
    ///     denoted the previous and current benchmark references, and `amount_#` denotes the deposits
    /// @return amount_1 amount that will be deposited (used for weighting)
    function getWeightedAverage(
        uint256 amount_1,
        uint256 amount_2,
        uint256 value_1,
        uint256 value_2
    ) private pure returns (uint256) {
        // calc weights
        uint256 total = amount_1 + amount_2;
        return ((amount_2 * value_2) + (amount_1 * value_1)) / total;
    }

    // Private functions

    /// @notice allows user to create a portfolio
    /// @dev weights array length has to equal the size of the Asset Set, with 0s where weight for an asset is 0
    /// @param account account that will own the portfolio
    /// @param amount the amount of PLN the user wants to send in
    /// @param weights array of relative weights of portfolio assets
    /// @param tokenType uint8 false for selecting PLN, true for selecting vePLN
    function _createPortfolio(
        address account,
        uint256 amount,
        uint256[] memory weights,
        bool[] memory isShort,
        bool tokenType
    ) private {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[account];
        require(!p.initialized, "Portfolio has been initialized");

        isValidWeightsAndAssets(weights);
        uint256[] memory assetPrices = getPrices(weights, ps.assets.elements);
        (
            uint256[] memory assetAmounts,
            uint256 shortsValue
        ) = getPortfolioAmounts(
                weights,
                BASE_FUNDS,
                assetPrices,
                ps.assets.elements,
                isShort
            );

        p.assetAmounts = assetAmounts;
        p.balances[tokenType][account] = amount;
        p.deposits[tokenType][account] = amount;
        p.isShort = isShort;
        p.shortsVal = shortsValue;
        p.benchMarkRef[account] = getBenchMarkValue();
        p.isOpen = true;
        p.initialized = true;
        p.lastRebalanceDate = block.timestamp;
        p.totalDeposited = amount;
        p.totalBalance = amount;
        ps.totalDelegated += amount;
    }

    /// @notice allows user to track the portfolio of another user
    /// @param delegate address of the user to follow
    /// @param amount amount to stake with the portfolio
    /// @param tokenType boolean false for selecting PLN, true for selecting vePLN
    function _delegatePollen(
        address delegate,
        uint256 amount,
        bool tokenType
    ) private {
        require(delegate != address(0), "invalid delegate");
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[delegate];

        uint256 delegated = p.totalDeposited +
            amount -
            p.deposits[tokenType][delegate];
        require(ps.maxDelegation >= delegated, "Delegation max exceeded");

        uint256[] memory prices = getPrices(p.assetAmounts, ps.assets.elements);
        uint256 value = getPortfolioValue(
            p.assetAmounts,
            prices,
            p.isShort,
            p.shortsVal
        );

        updateUserPortfolioInfo(
            p,
            value,
            amount,
            getBenchMarkValue(),
            tokenType
        );
        ps.totalDelegated += amount;

        emit Delegated(msg.sender, delegate, amount, tokenType);
    }

    // Private functions that are view

    /// @notice returns the current value of the bench mark
    /// @return benchmark value
    function getBenchMarkValue() public view returns (uint256) {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage bmp = ps.portfolios[address(this)];

        uint256[] memory assetPrices = getPrices(
            bmp.assetAmounts,
            ps.assets.elements
        );

        uint256 bmVal = getPortfolioValue(
            bmp.assetAmounts,
            assetPrices,
            bmp.isShort,
            bmp.shortsVal
        );
        return bmVal;
    }

    function updateUserPortfolioInfo(
        PortfolioInfo storage p,
        uint256 portfolioValue,
        uint256 depositAmount,
        uint256 currentBenchmarkRef,
        bool tokenType
    ) internal {
        // get weighted average
        uint256 userTotalDeposits = p.deposits[true][msg.sender] +
            p.deposits[false][msg.sender];
        require(
            userTotalDeposits + depositAmount > 0,
            "User has no deposits, and is not depositing"
        );
        uint256 newBenchmarkRef = getWeightedAverage(
            depositAmount,
            userTotalDeposits,
            currentBenchmarkRef,
            p.benchMarkRef[msg.sender]
        );

        // update storage
        p.balances[tokenType][msg.sender] +=
            (depositAmount * PRECISION) /
            portfolioValue;
        p.deposits[tokenType][msg.sender] += depositAmount;
        p.benchMarkRef[msg.sender] = newBenchmarkRef;
        p.totalDeposited += depositAmount;
        p.totalBalance += (depositAmount * PRECISION) / portfolioValue;
    }

    /// @notice verifies if an array of weights is valid
    /// @notice verifies if total assets in the portfolio does not exceeds maximum number of assets
    /// @dev edge case: TODO: check this situation
    ///      Created a portfolio with max number of assets.
    ///      Updated max number to a smaller number.
    ///      Rebalance portfolio and keep old max number of assets.
    /// @param weights array of weights
    function isValidWeightsAndAssets(uint256[] memory weights) private view {
        PortfolioStorage storage ps = getPortfolioStorage();
        require(
            weights.length == ps.assets.elements.length,
            "Weights length must equal that of whitelisted assets"
        );

        uint256 totalWeightsSum = 0;
        uint256 totalAssets = 0;

        for (uint256 i = 0; i < weights.length; i++) {
            if (
                !ps.assets.isWhitelisted[ps.assets.elements[i]] &&
                weights[i] != 0
            ) {
                revert("Weight must be 0 for a delisted asset");
            }
            if (weights[i] == 0) continue;
            totalWeightsSum += weights[i];
            totalAssets++;
        }

        require(totalWeightsSum == 100, "Weights should sum up to 100");
        require(
            totalAssets <= ps.maxNumAssetsPerPortfolio,
            "Exceeds max number of assets"
        );
    }

    /// @notice helper that return parameters necessary to rebalance
    /// @param account to calculate the rebalance value
    /// @param weights weights of the assets
    /// @return value portfolio value
    /// @return assetAmounts
    function calculateRebalanceValues(
        address account,
        uint256[] memory weights,
        bool[] memory isShort
    )
        private
        view
        returns (
            uint256 value,
            uint256[] memory assetAmounts,
            uint256 shortsValue
        )
    {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[account];

        isValidWeightsAndAssets(weights);
        uint256[] memory assetPrices = getPrices(
            p.assetAmounts,
            ps.assets.elements
        );

        value = getPortfolioValue(
            p.assetAmounts,
            assetPrices,
            p.isShort,
            p.shortsVal
        );
        assetPrices = getPrices(weights, ps.assets.elements);
        (assetAmounts, shortsValue) = getPortfolioAmounts(
            weights,
            value,
            assetPrices,
            ps.assets.elements,
            isShort
        );
    }

    // Private functions that are pure

    /// @notice calculates the portfolio asset amounts
    /// @param weights array of asset weights
    /// @param baseFunds base
    /// @param assetPrices prices of assets
    /// @param assets assets array
    /// @return array of assets
    function getPortfolioAmounts(
        uint256[] memory weights,
        uint256 baseFunds,
        uint256[] memory assetPrices,
        address[] memory assets,
        bool[] memory isShort
    ) private pure returns (uint256[] memory, uint256) {
        uint256[] memory assetAmounts = new uint256[](assets.length);
        uint256 shortsValue = 0;
        for (uint256 i = 0; i < assets.length; i++) {
            if (weights[i] == 0 || assetPrices[i] == 0) continue;
            assetAmounts[i] =
                (weights[i] * baseFunds * (TOKEN_PRECISION)) /
                (assetPrices[i] * MAX_SUM_WEIGHTS);
            if (isShort[i]) {
                shortsValue += (weights[i] * baseFunds) / MAX_SUM_WEIGHTS;
            }
        }
        return (assetAmounts, shortsValue);
    }

    /// @notice calculates the current value of the short positions
    function getShortsValue(
        uint256[] memory assetAmounts,
        uint256[] memory assetPrices,
        bool[] memory isShort
    ) private pure returns (uint256) {
        uint256 shortsValue = 0;
        for (uint256 i = 0; i < assetAmounts.length; i++) {
            if (assetAmounts[i] == 0 || assetPrices[i] == 0) continue;
            if (isShort[i]) {
                shortsValue += assetAmounts[i] * assetPrices[i];
            }
        }
        return shortsValue;
    }
}
