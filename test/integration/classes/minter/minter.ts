import { BigNumber as BN } from 'ethers';
import { BASE_18, BASE_25, ISSUANCE_SCHEDULE, } from '../../../helpers/constants';
import { calcValue, getRewardRate, getBoostRate, calcExpectedPortfolioWithdraw, getExpectedPortfolioReturnBN } from '../../../helpers/calculations';
import { IntegrationManager, Pollinator, PollinatorPortfolio } from '../';
import { isPositive } from '../../../helpers/helpers';


export class MinterClass {
  // object classes
  Manager: IntegrationManager
  constructor(manager: IntegrationManager) {
    this.Manager = manager;
  }


  // *** MINTER ***
  mintInflationReimburse(pollinator: Pollinator, amount: BN) {
    this.Manager.PollenClass.mint(pollinator.address, amount);
  }
  /**
   * 
   * @param portfolio 
   * @param currentValue see `calcValue()` 
   * @returns 
   */
  getAllowedInflation(portfolio: PollinatorPortfolio, currentValue: BN) {
    const schedule = this.Manager.getIssuanceSchedule();
    const totalDelegated = this.Manager.PortfolioClass.getTotalDelegated();
    const pollenTotalSupply = this.Manager.PollenClass.getTotalSupply();
    const reserved = this.Manager.LockedPollenClass.inflationInfo.reserved;
    const currentTime = this.Manager.getCurrentTime();
    return getRewardRate(schedule, currentValue, portfolio.totalDeposited, portfolio.totalBalance, totalDelegated, pollenTotalSupply, reserved, currentTime);
  }
  /**
   * @info fully off-chain calculation
   * @param pollinator 
   * @returns the current boost rate for a pollinator, returns 0 if they do not have any locked pollen
   */
  getLockBoostRate(pollinator: Pollinator) {
    const LockedPollenClass = this.Manager.LockedPollenClass;
    const lock = LockedPollenClass.locks[pollinator.address];
    const totalSupply = this.Manager.LockedPollenClass.getTotalSupply();
    const currentTime = this.Manager.getCurrentTime();
    if(!lock || !lock.amount) return 0;
    return getBoostRate(currentTime, lock.lockEnd, lock.amount, totalSupply);
  }

  /**
   * @info check full return for portfolio (PLN && vePLN)
   * @param portfolio 
   * @param pollinator 
   * @returns the inflation and lock boost accounted returns for a single portfolio at the time the function is called
   */
  checkTotalPriceReturnForPortfolio(portfolio: PollinatorPortfolio, pollinator: Pollinator)  {
    const prices = this.Manager.getPrices();
    // calc off-chain rewards
    const prevBalance = portfolio.balances['false'][pollinator.address].add(portfolio.balances['true'][pollinator.address]);
    const plnDeposits = portfolio.deposits['false'][pollinator.address];
    const vePlnDeposits = portfolio.deposits['true'][pollinator.address];
    const totalDeposits= plnDeposits.add(vePlnDeposits);
    const prevValue = totalDeposits.mul(BASE_25).div(prevBalance);
    const currentValue = calcValue(portfolio.assetAmounts, prices);
    let ret: BN;
    let isPositive: boolean;
    if (currentValue >= prevValue) {
      ret = currentValue.mul(BASE_25).div(prevBalance).sub(BASE_25);
      isPositive = true;
    } else {
      ret = BASE_25.sub(currentValue.mul(BASE_25).div(prevBalance));
      isPositive = false;
    }
    const rewards = ret.mul(totalDeposits).div(BASE_25);
    return {
      return: ret,
      rewards,
      isPositive}; 
  }

  /**
   * @info check return for portfolio for given token (PLN/vePLN)
   * @param portfolio 
   * @param pollinator 
   * @returns the inflation and lock boost accounted returns for a pollinator 
   *          in a single portfolio for a the given token (PLN/vePLN) at the time the function is called
   */
  checkPriceReturnForPortfolio(portfolio: PollinatorPortfolio, pollinator: Pollinator, tokenType: boolean)  {
    const prices = this.Manager.getPrices();
    const lock = this.Manager.LockedPollenClass.locks[pollinator.address];
    let lockEnd: BN | undefined;
    let lockAmount: BN | undefined;
    let vePlnTotalLocked: BN | undefined;
    if(lock){
      lockEnd = lock.lockEnd;
      lockAmount = lock.amount;
      vePlnTotalLocked = this.Manager.LockedPollenClass.getTotalSupply();
    }
    const currentTimestamp = this.Manager.getCurrentTime();
    // calc off-chain rewardss
    const prevBalance = portfolio.balances[tokenType.toString()][pollinator.address] || BN.from(0);
    const deposited = portfolio.deposits[tokenType.toString()][pollinator.address] || BN.from(0);
    if(deposited.isZero()) return {
      isPositive: true,
      return: deposited
    };
    const prevValue = deposited.mul(BASE_18).div(prevBalance);
    const currentValue = calcValue(portfolio.assetAmounts, prices);
    let ret = (prevBalance.mul(currentValue).div(deposited)).sub(BASE_18);
    // get benchmark adjusted rewards
    ret = this.calcBenchmarkAdjustedReturn(portfolio, pollinator, ret);
    let isPositive = true;
    let boost = BN.from(0);
    if(tokenType && lock && lockEnd && lockAmount && vePlnTotalLocked && currentTimestamp) boost = getBoostRate(currentTimestamp, lockEnd, lockAmount, vePlnTotalLocked);
    let factor = 1;
    let boostMultiplier: BN;
    if (ret.isNegative()) {
      factor = -1;
      boostMultiplier = BASE_18.add(boost);
      ret = ret.mul(boostMultiplier).div(BASE_18).mul(factor);
      isPositive = false;
    } else {
      boostMultiplier = BASE_18.add(boost.mul(factor));
      ret = ret.mul(boostMultiplier).div(BASE_18);
    }
    return {isPositive, return: ret};
  }

  private calcBenchmarkAdjustedReturn(portfolio: PollinatorPortfolio, pollinator: Pollinator, ret: BN) {
    const prevRef = portfolio.benchmarkRef[pollinator.address];
    if(!prevRef) throw 'Minter: benchmark was never initialized for pollinator';
    const currentBenchmark = this.Manager.PortfolioClass.getBenchmarkValue();
    const benchmarkReturn =  currentBenchmark.sub(prevRef).mul(BASE_18).div(prevRef);
    const adjReturn = ret.sub(benchmarkReturn);
    let isPositive = true;
    if(adjReturn.isNegative()) isPositive = false;
    return adjReturn;
  }

  getWithdrawAmount(portfolio: PollinatorPortfolio, pollinator: Pollinator, amount: BN, tokenType: boolean) {
    const rewards = this.checkPriceReturnForPortfolio(portfolio, pollinator, tokenType);
    if(!rewards.isPositive) return {
      ownerRewards: undefined,
      pollinatorRewards: rewards.return.mul(amount).div(BASE_18),
      isRewards: rewards.isPositive
    };
    const currentTime = this.Manager.getCurrentTime();
    const adjustedRewards = calcExpectedPortfolioWithdraw(
      this.Manager.getIssuanceSchedule(),
      calcValue(portfolio.assetAmounts, this.Manager.getPrices()),
      portfolio.totalDeposited,
      portfolio.totalBalance,
      this.Manager.PortfolioClass.getTotalDelegated(),
      this.Manager.PollenClass.getTotalSupply(),
      this.Manager.LockedPollenClass.inflationInfo.reserved,
      currentTime,
      amount,
      rewards.return
    );
    let ownerRewards: BN | undefined;
    let pollinatorRewards: BN | undefined;
    // no delegator fee
    if(portfolio.ownerAddress === pollinator.address) {
      pollinatorRewards = adjustedRewards;
    } else { //delegator fee
      const portfolioFee = adjustedRewards.mul(20).div(100);
      ownerRewards = portfolioFee;
      pollinatorRewards = adjustedRewards.mul(80).div(100);
    }
    return {
      ownerRewards,
      pollinatorRewards,
      isRewards: rewards.isPositive
    };
  }
  
}