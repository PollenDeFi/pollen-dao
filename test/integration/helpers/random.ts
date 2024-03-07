import { BigNumber as BN} from 'ethers';
import { BASE_18, ONE_YEAR } from '../../helpers/constants';

const ONE_HOUR = 3600;
const ONE_DAY = ONE_HOUR * 24;
const ONE_WEEK = ONE_DAY * 7;
const ONE_MONTH = Math.ceil(ONE_YEAR / 12);
const HALF_YEAR = ONE_YEAR / 2;
const TWO_YEARS = ONE_YEAR * 2;
const THREE_YEARS = ONE_YEAR * 3;
const FOUR_YEARS = ONE_YEAR * 4;

const LOCKS = [
  ONE_WEEK + ONE_DAY,
  ONE_MONTH,
  HALF_YEAR,
  ONE_YEAR,
  TWO_YEARS,
  THREE_YEARS,
  FOUR_YEARS
];

export function shuffle(array: Array<any>) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

// Pollinator
export function randomTokenType() {
  // placeholder
}

export function randomAmount(totalBalance: BN) {
  // placeholder
}

export function randomWeights() {
  // placeholder
}

export function randomLockTerm() {
  return LOCKS[Math.floor(Math.random() * LOCKS.length)];
}

export function bnToNumber(bn: BN) {
  const BASE_10 = BN.from(10**10);
  const whole_numbers = bn.div(BASE_18).toNumber();
  const decimals = bn.sub(whole_numbers).div(BASE_10).toNumber() / 10**8; // 8 decimal point precision
  return whole_numbers + decimals;


} 




