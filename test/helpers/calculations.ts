import { BigNumber as BN } from 'ethers';
import { BASE_18, BASE_WEIGHTS, MAX_LOCK_PERIOD } from './constants';

const ONE_YEAR = 3600 * 24 * 365;

interface ExpectedReturn {
  isPositive: boolean
  return: number
}

interface ExpectedReturnBN {
  isPositive: boolean
  return: BN
}

interface ExpectedReturnBN {
  isPositive: boolean
  return: BN
}

interface IssuanceSchedule {
  maxTime: BN
  offsetX: BN
  offsetY: BN
  rate: BN
}

export function getExpectedPortfolioReturn
(
  assetWeights: Array<number>,
  startingPrices: Array<number>,
  newPrices: Array<number>): ExpectedReturn {
  let sum = 0;
  newPrices.forEach((price, index) => {
    const change = price / startingPrices[index];
    sum += change * assetWeights[index];
  });
  const ret = sum - 100 < 0 ? -1 * (sum - 100) : sum - 100;
  const isPositive = ret < 0;
  return { isPositive, return: ret };
}

export function getExpectedPortfolioReturnBN
(
  boostScale: BN,
  assetWeights: Array<BN>,
  startingPrices: Array<BN>,
  newPrices: Array<BN>,
  benchmarkReturn: BN,
  currentTimestamp?: BN,
  vePlnTotalLocked?: BN,
  lockAmount?: BN,
  lockEnd?: BN): ExpectedReturnBN {
  if ((lockAmount || lockEnd || vePlnTotalLocked) && !(lockAmount && lockEnd && vePlnTotalLocked)) {
    throw 'must use lockEnd parameter when getting vePLN return';
  }
  let sum = BN.from(0);
  newPrices.forEach((price, index) => {
    const change = price.mul(BASE_18).div(startingPrices[index]);
    sum = sum.add(change.mul(assetWeights[index]).div(BASE_WEIGHTS));
  });

  let ret = sum.sub(BASE_18).sub(benchmarkReturn);
  const isPositive = true;
  let boost = BN.from(0);
  if (lockEnd && lockAmount && vePlnTotalLocked && currentTimestamp) boost = getBoostRate(currentTimestamp, lockEnd, lockAmount, vePlnTotalLocked);
  let factor = boostScale;
  let boostMultiplier: BN;
  if (ret.isNegative()) {
    factor = boostScale.mul(-1);
    boostMultiplier = BASE_18.add(boost.mul(factor));
    ret = BASE_18.add(ret.mul(boostMultiplier).div(BASE_18));
  } else {
    boostMultiplier = BASE_18.add(boost.mul(factor));
    ret = ret.mul(boostMultiplier).div(BASE_18);
  }
  return { isPositive, return: ret };
}

/**
 * @info the value of a portfolio is the sum of the current asset amounts
 * @param assetAmounts the asset amounts are the "allocations" of each asset
 * @param prices array of current USD prices of each asset
 * @returns the USD index value of the portfolio
 */
export function calcValue(assetAmounts: BN[], prices: BN[]) {
  let index = 0;
  let sum = BN.from(0);
  for (const assetAmount of assetAmounts) {
    if (!assetAmount.isZero()) {
      if (index == 0) {
        sum = sum.add(assetAmount);
      } else {
        const value = assetAmount.mul(prices[index]).div(BASE_18);
        sum = sum.add(value);
      }
    }
    index += 1;
  }
  return sum;
}

export function calcValueWithShorts(assetAmounts: BN[], prices: BN[], isShort: boolean[], shortsValue: BN) {
  let index = 0;
  let sVal = BN.from(0);
  let lVal = BN.from(0);
  let delta : BN;
  for (const assetAmount of assetAmounts) {
    if (!assetAmount.isZero()) {
      if (index == 0) {
        lVal = lVal.add(assetAmount);
      } else {
        const value = assetAmount.mul(prices[index]).div(BASE_18);
        if (isShort[index]){
          sVal = sVal.add(value);
        } else {
          lVal = lVal.add(value);
        }
      }
    }
    index += 1;
  }
  if (shortsValue.lt(sVal)) {
    delta = sVal.sub(shortsValue);
    return delta.gt(shortsValue) ? lVal : lVal.add(shortsValue).sub(delta);
  } else {
    delta = shortsValue.sub(sVal);
    return lVal.add(shortsValue).add(delta);
  }
}

// get reward rate based on allowed inflation
export function getRewardRate(
  issuanceSchedule: IssuanceSchedule[],
  currentValue: BN,
  portfolioTotalDeposited: BN,
  portfolioTotalBalance: BN,
  pollenTotalDelegated: BN,
  pollenTotalSupply: BN,
  reservedPln: BN,
  currentTimestamp: BN) {
  let currentIndex = 0;
  issuanceSchedule.forEach((schedule, index) => {
    if (schedule.maxTime.lte(currentTimestamp)) {
      currentIndex = index;
    }
  });
  const s = issuanceSchedule[currentIndex];
  const maxAllocation = (s.rate.mul(currentTimestamp.sub(s.offsetX)).add(s.offsetY)).sub(reservedPln).sub(pollenTotalSupply);
  const portfolioRatio = portfolioTotalDeposited.mul(BASE_18).div(pollenTotalDelegated);
  const portfolioAllocation = portfolioRatio.mul(maxAllocation).div(BASE_18);
  const globalReturn = currentValue.mul(portfolioTotalBalance).div(BASE_18).sub(portfolioTotalDeposited);
  if (globalReturn.lte(portfolioAllocation)) {
    return BASE_18;
  } else {
    return portfolioAllocation.mul(BASE_18).div(globalReturn);
  }
}
export function getBoostRate(currentTimestamp: BN, lockEnd: BN, lockAmount: BN, totalVePlnLocked: BN) {
  const votingPower = getVotingPower(currentTimestamp, lockEnd, lockAmount);
  const boostingRate = votingPower.mul(BASE_18).div(totalVePlnLocked);
  return boostingRate;
}

export function getVotingPower(currentTimestamp: BN, lockEnd: BN, lockAmount: BN) {
  const boost = BASE_18.mul(lockEnd.sub(currentTimestamp)).div(MAX_LOCK_PERIOD);
  const votingPower = (lockAmount.mul(boost)).div(BASE_18);
  return votingPower;
}

export function calcExpectedPortfolioWithdraw
( //reward rate parameters
  issuanceSchedule: IssuanceSchedule[],
  currentValue: BN,
  portfolioTotalDeposited: BN,
  portfolioTotalBalance: BN,
  pollenTotalDelegated: BN,
  pollenTotalSupply: BN,
  reservedPollen: BN,
  currentTimestamp: BN,
  // withdraw parameters
  amount: BN, // amount to withdraw
  expectedReturn: BN, // get from `getExpectedPortfolioReturnBN`
) {
  const rewardRate = getRewardRate(
    issuanceSchedule,
    currentValue,
    portfolioTotalDeposited,
    portfolioTotalBalance,
    pollenTotalDelegated,
    pollenTotalSupply,
    reservedPollen,
    currentTimestamp);
  const reward = expectedReturn.mul(amount).div(BASE_18);
  return reward.mul(rewardRate).div(BASE_18);

}

export function getBenchmarkReturn(benchmarkWeights: Array<number>, initPrices: Array<BN>, endPrices: Array<BN>) {
  {
    let sum = BN.from(0);
    endPrices.forEach((price, index) => {
      const change = price.mul(BASE_18).div(initPrices[index]);
      sum = sum.add(change.mul(benchmarkWeights[index]).div(100));
    });
    const ret = sum.sub(BASE_18);
    const isPositive = ret.lte(0);
    return ret;
  }
}

export function calcWeightedAverage(amountInit: BN, amountNew: BN, valueInit: BN, valueNew: BN) {
  const total = amountInit.add(amountNew);
  // weights
  const weightInit = amountInit.mul(BASE_18).div(total);
  const weightNew = amountNew.mul(BASE_18).div(total);
  // weighted values
  const wvInit = amountInit.mul(valueInit);
  const wvNew = amountNew.mul(valueNew);
  return wvInit.add(wvNew).div(total);
}

