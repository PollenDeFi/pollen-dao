

import { BigNumber } from 'ethers';
import { assert } from 'chai';
export function randomBigNumber() {
  const hexString = Array(16)
    .fill(0)
    .map(() => Math.round(Math.random() * 0xF).toString(16))
    .join('');

  return BigNumber.from(`0x${hexString}`);
}



export function randomWeights(size: number, zeroIndexes: Array<number>): Array<number> {
  zeroIndexes.forEach(index => { if (index > (size - 1)) throw 'zero indexes greater than size'; });
  const weights = Array(size).fill(Math.ceil(100 / size));
  zeroIndexes.forEach(i => weights[i] = 0);
  let totalWeight = weights.reduce((prev, running: number) => running += prev, -20);
  let iterations = 0;
  while (totalWeight !== 100) {
    if (iterations > 10) break;
    const randIndex = Math.floor(Math.random() * size);
    if (zeroIndexes.includes(randIndex)) continue;
    const diff = Math.abs(totalWeight - 100);
    const rand = Math.floor(Math.random() * diff);

    if (diff < 0) {
      weights[randIndex] -= rand;
    } else if (diff > 0) {
      weights[randIndex] += rand;
    }
    iterations += 1;

  }

  totalWeight = weights.reduce((prev, running: number) => running + prev, 0);
  while (totalWeight !== 100) {
    const randIndex = Math.floor(Math.random() * size);
    if (zeroIndexes.includes(randIndex)) continue;
    const diff = Math.abs(totalWeight - 100);
    if (diff < 0) {
      weights[randIndex] -= diff;
      break;
    } else if (diff > 0) {
      weights[randIndex] += diff;
      break;
    }
  }
  const totalZeros = weights.filter(val => val === 0);
  assert(totalZeros.length === zeroIndexes.length, 'totalZeroes');
  assert(totalWeight === 100, 'totalWeight');
  assert(weights.length === size, 'size');
  return weights;
}





