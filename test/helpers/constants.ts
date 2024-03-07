import { BigNumber as BN } from 'ethers';

export const ADDRESS_WHITELIST = 'ADDRESS_WHITELIST';
export const DELEGATION = 'DELEGATION';
export const GETTERS = 'GETTERS';
export const MODULE = 'MODULE';
export const PORTFOLIO = 'PORTFOLIO';
export const PROPOSALS = 'PROPOSALS';
export const QUOTER = 'QUOTER';
export const VOTING = 'VOTING';
export const DAO_ADMIN_ADDRESS = '0xbd726eabEB583a2638173F4a837eF4C8d87d5e8c';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const DAYS_TO_SECONDS = 24 * 3600;
export const ONE_YEAR = 365 * DAYS_TO_SECONDS;
const HALF_YEAR = ONE_YEAR / 2;
export const MAX_LOCK_PERIOD = DAYS_TO_SECONDS * 1405;
export const MIN_LOCK_PERIOD = DAYS_TO_SECONDS * 90;
export const BASE_8 = BN.from(10 ** 8);
export const BASE_10 = BN.from(10 ** 10);
export const BASE_18 = BASE_10.mul(BASE_8);
export const BASE_25 = BASE_18.mul(10 ** 7);
export const BASE_WEIGHTS = 100;
export const MIN_BALANCE_POLLINATOR = BASE_18.mul(50);
export const INITIAL_BALANCES = BASE_18.mul(1000);
// export const DAYS_TO_SECONDS = 24n * 3600n;
// export const ONE_YEAR = 365n * DAYS_TO_SECONDS;
// export const MAX_LOCK_PERIOD = DAYS_TO_SECONDS * 1405n;
// export const MIN_LOCK_PERIOD = DAYS_TO_SECONDS * 90n;
// export const BASE_8 = 10n ** 8n;
// export const BASE_10 = 10n ** 10n;
// export const BASE_18 = BASE_10 * BASE_8;
// export const BASE_25 = BASE_18 * 10n ** 7n;
// export const BASE_WEIGHTS = 100n;
// export const MIN_BALANCE_POLLINATOR = BASE_18 * 50n;
// export const INITIAL_BALANCES = BASE_18 * 1000n;
export const VEPLN_TOKEN_NAME = 'Locked Pollen';
export const VEPLN_TOKEN_SYMBOL = 'vePLN';

// 210040000000000000
// 44505000000000000
// 13480000000000000
// 5491678575680000

const year = BN.from(365 * 24 * 60 * 60);
const startDate = BN.from('1654473600');

const rates = [];
rates[0] = BN.from('210040000000000000'); //2.10040
rates[1] = BN.from('44505000000000000'); //0.44505
rates[2] = BN.from('13480000000000000'); //0.13480
rates[3] = BN.from('5491678575680000'); //0.0549167857568
rates[4] = BN.from('0');
// const year = 365n * 24n * 60n * 60n;
// const startDate = 1654473600n;
// const rates = [
//   210040000000000000n, //2.10040
//   44505000000000000n, //0.44505
//   13480000000000000n, //0.13480
//   5491678575680000n, //0.0549167857568
//   0n
// ];
const maxTime = [];
maxTime[0] = startDate.add(year);
maxTime[1] = maxTime[0].add(year);
maxTime[2] = maxTime[1].add(year);
maxTime[3] = maxTime[2].add(year);
maxTime[4] = maxTime[3].add(year.mul(100));
// const maxTime: bigint[] = [];
// maxTime[0] = startDate + year;
// maxTime[1] = maxTime[0] + year;
// maxTime[2] = maxTime[1] + year;
// maxTime[3] = maxTime[2] + year;
// maxTime[4] = maxTime[3] + year * 100n;

const offsetX = [];
offsetX[0] = startDate;
offsetX[1] = offsetX[0].add(year);
offsetX[2] = offsetX[1].add(year);
offsetX[3] = offsetX[2].add(year);
offsetX[4] = offsetX[3].add(year.mul(1000));
// const offsetX: bigint[] = [];
// offsetX[0] = startDate;
// offsetX[1] = offsetX[0] + year;
// offsetX[2] = offsetX[1] + year;
// offsetX[3] = offsetX[2] + year;
// offsetX[4] = offsetX[3] + year * 1000n;

const offsetY = [];
offsetY[0] = BN.from('94000000000000000000000000'); //94M
offsetY[1] = rates[0].mul(maxTime[0]).add(offsetY[0]);
offsetY[2] = rates[1].mul(maxTime[1]).add(offsetY[1]);
offsetY[3] = rates[2].mul(maxTime[2]).add(offsetY[2]);
offsetY[4] = rates[3].mul(maxTime[3]).add(offsetY[3]);
// const offsetY: bigint[] = [];
// offsetY[0] = 94000000000000000000000000n; //94M
// offsetY[1] = rates[0] * maxTime[0] + offsetY[0];
// offsetY[2] = rates[1] * maxTime[1] + offsetY[1];
// offsetY[3] = rates[2] * maxTime[2] + offsetY[2];
// offsetY[4] = rates[3] * maxTime[3] + offsetY[3];

export const ISSUANCE_SCHEDULE = [
  {
    maxTime: maxTime[0].toString(),
    offsetX: offsetX[0].toString(),
    offsetY: offsetY[0].toString(),
    rate: rates[0].toString()
  },
  {
    maxTime: maxTime[1].toString(),
    offsetX: offsetX[1].toString(),
    offsetY: offsetY[1].toString(),
    rate: rates[1].toString()
  },
  {
    maxTime: maxTime[2].toString(),
    offsetX: offsetX[2].toString(),
    offsetY: offsetY[2].toString(),
    rate: rates[2].toString()
  },
  {
    maxTime: maxTime[3].toString(),
    offsetX: offsetX[3].toString(),
    offsetY: offsetY[3].toString(),
    rate: rates[3].toString()
  },
  {
    maxTime: maxTime[4].toString(),
    offsetX: offsetX[4].toString(),
    offsetY: offsetY[4].toString(),
    rate: rates[4].toString()
  }
];

export const ISSUANCE_SCHEDULE_TEST = [
  {
    maxTime: maxTime[0],
    offsetX: offsetX[0],
    offsetY: offsetY[0],
    rate: rates[0]
  }
];
