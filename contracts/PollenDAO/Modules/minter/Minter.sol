// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "../../../interface/IPollen.sol";
import "../../../interface/ILockedPollen.sol";
import "../../PollenDAOStorage.sol";
import "./MinterModuleStorage.sol";
import "../portfolio/PortfolioModuleStorage.sol";
import "../portfolio/Portfolio.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Minter is
    PollenDAOStorage,
    PortfolioModuleStorage,
    MinterModuleStorage
{
    /// @notice emited when the issuance rate is modified
    event IssuanceScheduleSet();

    /// @notice emited when a user withdraw from a portfolio
    event WithdrawWithReward(
        address indexed portfolio,
        address indexed user,
        uint256 amount,
        uint256 reward,
        uint256 delegateFee,
        bool tokenType
    );

    event WithdrawWithPenalty(
        address indexed portfolio,
        address indexed user,
        uint256 amount,
        uint256 penalty,
        uint256 delegateFee,
        bool tokenType
    );

    // External functions

    /// @notice initializes the issuance rate and duration
    /// @param schedule issuance schedule Array of type IssuanceInfo for the minter
    function initializeIssuanceInfo(IssuanceInfo[] calldata schedule)
        external
        onlyAdmin
    {
        MinterStorage storage ms = getMinterStorage();
        uint256 n = ms.schedule.length;
        require(n == 0, "Already initialized");
        for (uint256 i = 0; i < schedule.length; i++) {
            ms.schedule.push(schedule[i]);
        }
        emit IssuanceScheduleSet();
    }

    /// @notice sets scaller for boosting
    /// @param _newBoostingScale new scaling value
    function setBoostingScale(uint256 _newBoostingScale) external onlyAdmin {
        MinterStorage storage ms = getMinterStorage();
        ms.boostingScale = _newBoostingScale;
    }

    function getBoostingScale() external view returns (uint256) {
        MinterStorage storage ms = getMinterStorage();
        return ms.boostingScale;
    }

    /// @notice sets maximum number of withdrawals per transaction
    /// @param _newMaxWithdrawls new max number of withdrawals
    function setMaxNumberWithdrawls(uint256 _newMaxWithdrawls)
        external
        onlyAdmin
    {
        MinterStorage storage ms = getMinterStorage();
        ms.maxNumWithdrawals = _newMaxWithdrawls;
    }

    /// @notice allows user to close a portfolio and withdraw funds from it
    /// @param amount amount to be withdrawn
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function closeAndWithdraw(uint256 amount, bool tokenType) external {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[msg.sender];

        require(p.isOpen, "Portfolio must be open");

        uint256[] memory weights = new uint256[](p.assetAmounts.length);
        weights[0] = MAX_SUM_WEIGHTS;
        bool[] memory isShort = new bool[](weights.length);

        (bool success, ) = address(this).delegatecall(
            abi.encodeWithSignature(
                "rebalancePortfolio(uint256[],bool[],uint256,bool)",
                weights,
                isShort,
                0,
                tokenType
            )
        );
        require(success, "Rebalancing not succeeded");
        _withdraw(msg.sender, amount, tokenType);
    }

    /// @notice allows user to withdraw funds from a portfolio
    /// @param owner address of the owner of the portfolio (could be self or a delegation)
    /// @param amount amount of specified tokenType to be withdrawn
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function withdraw(
        address owner,
        uint256 amount,
        bool tokenType
    ) external {
        _withdraw(owner, amount, tokenType);
    }

    /// TODO: consider optimization of gas
    /// @notice allows user to withdraw funds from multiple portfolios
    /// @param owners addresses of portfolio owners (could be self or a delegation)
    /// @param amounts amounts to be withdrawn from each portfolio
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function withdrawMany(
        address[] calldata owners,
        uint256[] calldata amounts,
        bool tokenType
    ) external {
        uint256 n = owners.length;
        require(n == amounts.length, "Invalid length parameters");
        MinterStorage storage ms = getMinterStorage();
        require(n <= ms.maxNumWithdrawals, "Exceeds max number of withdrawls");
        for (uint256 i = 0; i < n; i++) {
            _withdraw(owners[i], amounts[i], tokenType);
        }
    }

    /// @notice allows user to withdraw rewards from a portfolio
    /// @param owner address of the owner of the portfolio (could be self or a delegation)
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function withdrawRewards(address owner, bool tokenType) external {
        _withdrawProfit(owner, tokenType);
    }

    /// TODO: consider gas optimization
    /// @notice allows user to withdraw rewards from multiple portfolios
    /// @param owners addresses of portfolio owners (could be self or a delegation)
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function withdrawRewardsMany(address[] calldata owners, bool tokenType)
        external
    {
        uint256 n = owners.length;
        MinterStorage storage ms = getMinterStorage();
        require(n <= ms.maxNumWithdrawals, "Exceeds max number of withdrawls");
        for (uint256 i = 0; i < n; i++) {
            _withdrawProfit(owners[i], tokenType);
        }
    }

    /// @notice mint tokens for staking rewards
    /// @param account account that will receive the reimburse
    /// @param amount amount to mint
    function mintRewards(address account, uint256 amount) external {
        DAOStorage storage ds = getPollenDAOStorage();
        require(msg.sender == ds.vePollenToken, "only vePLN contract");
        MinterStorage storage ms = getMinterStorage();

        uint256 maxTotalRewards = ILockedPollen(ds.vePollenToken)
            .MAX_REWARDS_FUNDS();
        if (ms.totalStakingRewards + amount > maxTotalRewards) {
            amount = maxTotalRewards - ms.totalStakingRewards;
            if (amount == 0) return;
        }
        ms.totalStakingRewards += amount;
        IPollen token = IPollen(ds.pollenToken);
        token.mint(account, amount);
    }

    // Internal functions

    /// @notice process payment with penalties
    /// @param penalty amount of tokens penalized
    /// @param amount amount of tokens to be withdrawn
    /// @param portfolioOwner address of the portfolio owner
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function processPenalty(
        uint256 penalty,
        uint256 amount,
        address portfolioOwner,
        bool tokenType
    ) internal {
        DAOStorage storage ds = getPollenDAOStorage();
        MinterStorage storage ms = getMinterStorage();
        address tokenAddress = tokenType ? ds.vePollenToken : ds.pollenToken;
        penalty = penalty - (penalty * ms.penaltyMultiplier) / 100;

        if (tokenType) {
            ILockedPollen token = ILockedPollen(tokenAddress);
            token.burn(address(this), penalty);
            token.transfer(msg.sender, amount - penalty);
        } else {
            IPollen token = IPollen(tokenAddress);
            token.burn(penalty);
            token.transfer(msg.sender, amount - penalty);
        }

        emit WithdrawWithPenalty(
            portfolioOwner,
            msg.sender,
            amount,
            penalty,
            0,
            tokenType
        );
    }

    // Private functions

    /// @notice private function that allows user to withdraw funds from a portfolio
    /// @param owner address of the owner of the portfolio (could be self or a delegation)
    /// @param amount amount to withdraw
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function _withdraw(
        address owner,
        uint256 amount,
        bool tokenType
    ) private {
        (
            uint256 currentValue,
            uint256 deposited,
            uint256 balance,
            uint256 r,
            bool isPositive,

        ) = preprocessWithdrawal(owner, tokenType);
        require(deposited >= amount, "Insufficient balance");
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[owner];
        if (owner == msg.sender) {
            require(!p.isOpen, "Should close portfolio first");
        }

        if (isPositive) {
            uint256 reward = (r * amount) / PRECISION;
            uint256 rewardRate = getRewardRate(owner, currentValue);
            reward = (reward * rewardRate) / PRECISION;
            processReward(reward, amount, owner, tokenType);
        } else {
            uint256 penalty = (r * amount) / PRECISION;
            processPenalty(penalty, amount, owner, tokenType);
        }

        if (amount == deposited) {
            p.balances[tokenType][msg.sender] = 0;
            p.deposits[tokenType][msg.sender] = 0;
            p.totalDeposited -= deposited;
            p.totalBalance -= balance;
            ps.totalDelegated -= deposited;
        } else {
            p.balances[tokenType][msg.sender] -=
                (amount * balance) /
                (deposited);
            p.deposits[tokenType][msg.sender] -= amount;
            p.totalDeposited -= amount;
            p.totalBalance -= (amount * balance) / (deposited);
            ps.totalDelegated -= amount;
        }
    }

    /// @notice private function that allows user to withdraw funds from a portfolio
    /// @param owner address of the owner of the portfolio (could be self or a delegation)
    /// @param tokenType boolean indicating type of token, false for PLN, true for vePLN
    function _withdrawProfit(address owner, bool tokenType) private {
        (
            uint256 currentValue,
            uint256 deposited,
            uint256 balance,
            uint256 r,
            bool isPositive,
            uint256 benchMarkVal
        ) = preprocessWithdrawal(owner, tokenType);

        require(isPositive, "Porfolio returns are negative");
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[owner];
        p.balances[tokenType][msg.sender] =
            (deposited * PRECISION) /
            (currentValue);
        p.totalBalance =
            p.totalBalance +
            (deposited * PRECISION) /
            (currentValue) -
            balance;
        p.benchMarkRef[msg.sender] = benchMarkVal;
        uint256 reward = (r * deposited) / PRECISION;
        uint256 rewardRate = getRewardRate(owner, currentValue);
        reward = (reward * rewardRate) / PRECISION;
        processReward(reward, 0, owner, tokenType);
    }

    /// @notice process payment of rewards
    /// @param reward amount of tokens rewarded
    /// @param amount amount of tokens to be withdrawn
    /// @param portfolioOwner address of the portfolio owner
    /// @param tokenType boolean false for selecting PLN, true for selecting vePLN
    function processReward(
        uint256 reward,
        uint256 amount,
        address portfolioOwner,
        bool tokenType
    ) private {
        DAOStorage storage ds = getPollenDAOStorage();

        IPollen pln = IPollen(ds.pollenToken);
        if (portfolioOwner == msg.sender) {
            pln.mint(msg.sender, reward);
            emit WithdrawWithReward(
                portfolioOwner,
                msg.sender,
                amount,
                reward,
                0,
                tokenType
            );
        } else {
            pln.mint(msg.sender, (reward * 80) / 100);
            pln.mint(portfolioOwner, (reward * 20) / 100);
            emit WithdrawWithReward(
                portfolioOwner,
                msg.sender,
                amount,
                (reward * 80) / 100,
                (reward * 20) / 100,
                tokenType
            );
        }

        if (amount > 0) {
            tokenType
                ? ILockedPollen(ds.vePollenToken).transfer(msg.sender, amount)
                : pln.transfer(msg.sender, amount);
        }
    }

    // Private functions that are view

    /// @notice returns the current reward rate
    /// @dev it equals 1 if the global return is smaller than the allocation.
    /// allocation is determined by the total amount delegated to the portfolio
    /// such that the more a portfolio gets delegated the more the allocation is
    /// @param owner owner of the portfolio
    /// @param currentValue uint256 value of the portfolio
    /// @return rate the uint256 reward rate
    function getRewardRate(address owner, uint256 currentValue)
        public
        view
        returns (uint256 rate)
    {
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[owner];

        uint256 maxAllocation;
        maxAllocation = calculateMaxAllocation();
        uint256 ratio = (PRECISION * p.totalDeposited) / ps.totalDelegated;
        uint256 allocation = (ratio * maxAllocation) / PRECISION;
        uint256 value = ((currentValue * p.totalBalance) / PRECISION);
        uint256 globalReturn = value >= p.totalDeposited
            ? value - p.totalDeposited
            : 0;
        if (globalReturn <= allocation) {
            rate = PRECISION;
        } else {
            rate = (allocation * PRECISION) / globalReturn;
        }
    }

    function getIssuanceCurve() private view returns (uint256) {
        MinterStorage storage ms = getMinterStorage();

        IssuanceInfo[] storage sc = ms.schedule;
        uint256 n = sc.length;
        uint256 y = 0;
        uint256 ts = block.timestamp;
        for (uint256 i = 0; i < n; i++) {
            if (sc[i].maxTime <= ts) {
                y = i;
                break;
            }
        }
        return (sc[y].rate * (ts - sc[y].offsetX) + sc[y].offsetY);
    }

    /***
    @notice returns the current maximum allowed Pollen available
    @dev accounts for the max supply from the issuance schedule,
        the current PLN supply, and the reserved PLN according to inflation protection 
        defined in LockedPollen */
    function calculateMaxAllocation() public view returns (uint256) {
        DAOStorage storage ds = getPollenDAOStorage();
        MinterStorage storage ms = getMinterStorage();
        uint256 maxSupply = getIssuanceCurve();
        uint256 plnTotalSupply = IPollen(ds.pollenToken).totalSupply();
        return maxSupply - (plnTotalSupply - ms.totalStakingRewards);
    }

    /// @notice preprocesses withdrawals
    /// @param owner address of the owner of the portfolio
    /// @param tokenType address of the owner of the portfolio
    /// @return currentValue portfolio current value
    /// @return deposited amount deposited in portfolio
    function preprocessWithdrawal(address owner, bool tokenType)
        public
        view
        returns (
            uint256 currentValue,
            uint256 deposited,
            uint256 balance,
            uint256 r,
            bool isPositive,
            uint256 benchMarkVal
        )
    {
        DAOStorage storage ds = getPollenDAOStorage();
        MinterStorage storage ms = getMinterStorage();
        PortfolioStorage storage ps = getPortfolioStorage();
        PortfolioInfo storage p = ps.portfolios[owner];
        balance = p.balances[tokenType][msg.sender];
        deposited = p.deposits[tokenType][msg.sender];
        require(deposited > 0, "User deposit is zero");

        Portfolio portfolio = Portfolio(address(this));
        currentValue = portfolio.getPortfolioValue(
            p.assetAmounts,
            portfolio.getPrices(p.assetAmounts, ps.assets.elements),
            p.isShort,
            p.shortsVal
        );
        int256 precision = int256(PRECISION);
        int256 r_ = int256((balance * currentValue) / deposited);
        int256 bmEndVal = int256(portfolio.getBenchMarkValue());
        {
            int256 bmInitVal = int256(p.benchMarkRef[msg.sender]);
            r_ =
                (r_ - precision) -
                (((bmEndVal - bmInitVal) * precision) / bmInitVal);
        }

        //ILockedPollen vePLN = ILockedPollen(ds.vePollenToken);
        int256 boost = tokenType
            ? int256(
                ILockedPollen(ds.vePollenToken).getBoostingRate(msg.sender)
            )
            : int256(0);

        boost = (boost * int256(ms.boostingScale)) / precision;
        int256 factor = r_ > 0 ? int256(1) : int256(-1);
        r_ = (r_ * (precision + factor * boost)) / precision;
        if (factor < 0) {
            r_ = r_ >= 0 ? int256(0) : -r_;
            isPositive = false;
        } else {
            isPositive = true;
        }
        r = uint256(r_);
        benchMarkVal = uint256(bmEndVal);
    }
}
