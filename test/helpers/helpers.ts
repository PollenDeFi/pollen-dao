
import { BigNumber as BN } from 'ethers';

export function getCurrentTimestamp() {
  return BN.from((new Date().getTime()).toString().slice(0, -3));  
}

export function randomBigNumber() {
  const hexString = Array(16)
    .fill(0)
    .map(() => Math.round(Math.random() * 0xF).toString(16))
    .join('');

  return BN.from(`0x${hexString}`);
}

export function isPositive(bn: BN) {
  return !(bn.isNegative() || bn.isZero());
}

export function interpolate(time1: BN, time2: BN, val1: BN): BN {
  return time2.mul(val1).div(time1);
}
