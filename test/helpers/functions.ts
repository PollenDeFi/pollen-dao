
import { BigNumber } from 'ethers';

export interface ExpectedReturn {
  isPositive: boolean
  return: BigNumber
}

export function randomBigNumber() {
  const hexString = Array(16)
    .fill(0)
    .map(() => Math.round(Math.random() * 0xF).toString(16))
    .join('');

  return BigNumber.from(`0x${hexString}`);
}

export function getExpectedPortfolioReturn(assetWeights: Array<number>, startingPrices: Array<number>, newPrices: Array<number>): ExpectedReturn {
  let sum = 0;
  newPrices.forEach((price, index) => {
    const change = price / startingPrices[index];
    sum += change * assetWeights[index];
  });
  const ret = sum - 100 < 0 ? -1 * (sum - 100) : sum - 100;
  const isPositive = ret < 0;
  return { isPositive, return: BigNumber.from(ret) };
}

export function getExpectedPortfolioReturnBN(initVal: BigNumber, currentVal: BigNumber, precision: BigNumber): ExpectedReturn {
  const isPositive = currentVal.gte(initVal);
  const returnVal = isPositive ? (currentVal.mul(precision).div(initVal).sub(precision)).mul(80).div(100) : BigNumber.from(precision).sub(currentVal.mul(precision).div(initVal));
  return { isPositive, return: returnVal };
}

export function getSelectors(intf: any): Array<string> {
  return Object.keys(intf.functions).map((item) => intf.getSighash(item));
}


function bnToFloat(num: BigNumber, decimals: number) {
  const bnDec = BigNumber.from(10 ** 10).mul(10 ** (decimals - 10));
  const wholeNum = num.div(bnDec);
}
