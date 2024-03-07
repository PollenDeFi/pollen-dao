// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interface/IPollenDAO.sol";

contract LockedPollen is ERC20 {
    struct Lock {
        uint256 lockStart;
        uint256 lockEnd;
        uint256 amount;
        uint256 offset;
        uint256 claimable;
    }

    struct RewardCurve {
        uint256 rate;
        uint256 offsetX;
        uint256 offsetY;
        uint256 sumBias;
    }

    struct StakeInfo {
        uint256 offsetY;
    }

    uint256 private constant H_PRECISION = 1e24;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant MAX_LOCK_PERIOD = 1405 days;
    uint256 private constant MIN_LOCK_PERIOD = 90 days;
    uint256 public constant TOTAL_REWARD_PER_SECOND =
        (20_000_000 * 1e18) / uint256(1406 days);
    uint256 public constant MAX_REWARDS_FUNDS = 20_000_000 * 1e18;

    RewardCurve public rewardCurve;
    mapping(address => StakeInfo) public stakeInfo;
    mapping(address => Lock) public locks;
    address private immutable dao;
    address private immutable plnAddress;
    uint256 public totalLocked;

    event LockCreated(
        address indexed account,
        uint256 amount,
        uint256 lockEndTime
    );
    event LockIncreased(address indexed account, uint256 amount);
    event LockExtended(address indexed account, uint256 newLockEndTime);
    event UnLocked(address indexed account, uint256 amount, uint256 claimable);

    modifier onlyDAO() {
        require(msg.sender == dao, "Pollen: only callable by DAO contract");
        _;
    }

    constructor(address dao_, address plnAddress_)
        ERC20("Locked Pollen", "vePLN")
    {
        require(dao_ != address(0), "DAO address can't be Zero");
        dao = dao_;
        plnAddress = plnAddress_;
        rewardCurve = RewardCurve(
            TOTAL_REWARD_PER_SECOND,
            block.timestamp,
            0,
            0
        );
    }

    // External functions

    /// @notice lock PLN for a period of time and swap for vePLN
    /// @param amount amount of PLN to lock
    /// @param lockEnd end date for locking tokens
    function lock(uint256 amount, uint256 lockEnd) external {
        uint256 ts = block.timestamp;
        require(lockEnd >= ts + MIN_LOCK_PERIOD, "Period is too short");
        require(lockEnd <= ts + MAX_LOCK_PERIOD, "Period is too large");
        Lock storage userLock = locks[msg.sender];
        require(userLock.amount == 0, "User lock already exist");

        RewardCurve memory c;
        if (totalLocked != 0) {
            c = updateCurve();
        } else {
            c = rewardCurve;
            c.sumBias = 0;
            c.offsetX = ts;
        }
        rewardCurve = c;

        // user lock info
        userLock.offset = c.sumBias;
        userLock.amount = amount;
        userLock.lockStart = ts;
        userLock.lockEnd = lockEnd;

        totalLocked += amount;
        swap(msg.sender, amount);
        emit LockCreated(msg.sender, amount, lockEnd);
    }

    /// @notice update lock
    /// @param extraAmount amount to increase the lock by
    /// @param newLockEnd new end of the lock
    function updateLock(uint256 extraAmount, uint256 newLockEnd) external {
        increaseLock(extraAmount);
        extendLock(newLockEnd);
    }

    /// @notice unlock PLN and claims rewards
    function unlock() external {
        Lock storage uLock = locks[msg.sender];
        require(uLock.amount != 0, "Invalid lock");
        require(uLock.lockEnd <= block.timestamp, "Lock is active");

        RewardCurve memory c = updateCurve();
        rewardCurve = c;

        uint256 claimable = calculateClaims(
            c.sumBias,
            uLock.offset,
            uLock.amount,
            uLock.claimable
        );
        totalLocked -= uLock.amount;
        delete locks[msg.sender];

        uint256 balance = balanceOf(msg.sender);
        IPollenDAO(dao).mintRewards(msg.sender, claimable);
        ERC20(plnAddress).transfer(msg.sender, balance);
        _burn(msg.sender, balance);

        emit UnLocked(msg.sender, balance, claimable);
    }

    /// @notice Retrieve penalty from user account
    /// @param account account from which the tokens will be burned
    /// @param amount amount to retrieve by the dao
    function burn(address account, uint256 amount) external onlyDAO {
        _burn(account, amount);
        ERC20(plnAddress).transfer(dao, amount);
    }

    /// @notice claim pending rewards
    function claimRewards() external {
        Lock storage uLock = locks[msg.sender];
        require(uLock.amount != 0, "Invalid lock");

        RewardCurve memory c = updateCurve();
        rewardCurve = c;

        uint256 claimable = calculateClaims(
            c.sumBias,
            uLock.offset,
            uLock.amount,
            uLock.claimable
        );

        uLock.offset = c.sumBias;
        uLock.claimable = 0;
        IPollenDAO(dao).mintRewards(msg.sender, claimable);
    }

    // External functions that are view

    /// @notice getter for claimable rewards
    /// @param account user account
    /// @return the available claimable reward for the user
    function getAvailableRewards(address account)
        external
        view
        returns (uint256)
    {
        Lock storage uLock = locks[account];
        require(uLock.amount != 0, "Invalid lock");

        RewardCurve memory c = updateCurve();

        return
            calculateClaims(
                c.sumBias,
                uLock.offset,
                uLock.amount,
                uLock.claimable
            );
    }

    /// @notice return the voting power for an account
    /// @param account account to calculate voting power
    /// @return boostingRate
    function getBoostingRate(address account) public view returns (uint256) {
        Lock storage userLocks = locks[account];
        uint256 ts = block.timestamp;
        uint256 lockEnd = userLocks.lockEnd;
        if (lockEnd <= ts) return 0;
        uint256 boostingRate = (PRECISION * (lockEnd - ts)) / MAX_LOCK_PERIOD;
        return boostingRate;
    }

    //Public functions

    /// @notice updateLock Parameters if lock does not exist, it is created
    /// @param newLockEnd new end of the lock
    function extendLock(uint256 newLockEnd) public {
        uint256 ts = block.timestamp;
        Lock storage userLock = locks[msg.sender];
        require(userLock.amount != 0, "Invalid lock");
        require(userLock.lockEnd < newLockEnd, "Invalid period");
        require(newLockEnd <= ts + MAX_LOCK_PERIOD, "Period is too large");
        require(newLockEnd >= ts + MIN_LOCK_PERIOD, "Period is too short");
        userLock.lockEnd = newLockEnd;
        userLock.lockStart = ts;
        emit LockExtended(msg.sender, newLockEnd);
    }

    /// @notice updateLock amount
    /// @param amount new end of the lock
    function increaseLock(uint256 amount) public {
        uint256 ts = block.timestamp;
        Lock storage uLock = locks[msg.sender];
        require(amount > 0, "Cannot increase lock by zero");
        require(uLock.amount != 0, "Invalid lock");
        require(uLock.lockEnd > ts, "lock expired");

        RewardCurve memory c = updateCurve();
        rewardCurve = c;

        uint256 claimable = calculateClaims(
            c.sumBias,
            uLock.offset,
            uLock.amount,
            uLock.claimable
        );

        uLock.offset = c.sumBias;
        uLock.claimable = claimable;
        uLock.amount += amount;
        totalLocked += amount;
        swap(msg.sender, amount);
        emit LockIncreased(msg.sender, amount);
    }

    // Public functions that are view

    /// @notice return the voting power for an account
    /// @param account account to calculate voting power
    /// @return votingPower
    function getVotingPower(address account) public view returns (uint256) {
        Lock storage userLocks = locks[account];
        uint256 boostingRate = getBoostingRate(account);
        uint256 amount = userLocks.amount;
        uint256 votingPower = (amount * boostingRate) / PRECISION;
        return votingPower;
    }

    /// @notice get claimable account rewards
    /// @return rewards that are claimable
    function getClaimableRewards() external view returns (uint256) {
        Lock storage uLock = locks[msg.sender];
        RewardCurve memory c = updateCurve();
        return
            calculateClaims(
                c.sumBias,
                uLock.offset,
                uLock.amount,
                uLock.claimable
            );
    }

    // Internal functions

    /// @notice override method to perform checks before transferring locked pollen
    /// @param from from address
    /// @param to to address
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal virtual override {
        require(
            from == address(0) || to == address(0) || from == dao || to == dao,
            "vePLN can't be transfered"
        );
    }

    // Private functions

    /// @notice swap PLN by vePLN, PLN are taken from the sender
    /// @param account account that will receive the vePLN
    /// @param amount amount of PLN to swap
    function swap(address account, uint256 amount) private {
        _mint(account, amount);
        ERC20 pollen = ERC20(plnAddress);
        pollen.transferFrom(msg.sender, address(this), amount);
    }

    // Private functions that are view

    /// @notice returns updated reward curve params
    /// @return c the updated curve
    function updateCurve() private view returns (RewardCurve memory c) {
        uint256 ts = block.timestamp;
        c = rewardCurve;
        uint256 y = c.rate * (ts - c.offsetX);
        y = min(y, MAX_REWARDS_FUNDS - c.offsetY);
        c.offsetX = ts;
        c.sumBias += (y * H_PRECISION) / totalLocked;
        c.offsetY += y;
        return c;
    }

    // Private functions that are pure

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function calculateClaims(
        uint256 sumBias,
        uint256 offset,
        uint256 amount,
        uint256 currentClaims
    ) private pure returns (uint256) {
        return ((sumBias - offset) * amount) / H_PRECISION + currentClaims;
    }
}
