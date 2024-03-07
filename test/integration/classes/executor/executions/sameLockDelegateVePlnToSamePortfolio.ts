
import { BigNumber as BN } from 'ethers';
import { expect } from 'chai';
import { ONE_YEAR } from '../../../../helpers/constants';
import { getCurrentTimestamp, isPositive } from '../../../../helpers/helpers';
import { getContracts, getLocalModules } from './index';
import { IntegrationManager, Pollinator, MinterClass, LockedPollenClass, PollenClass, PortfolioClass, PollinatorPortfolio } from '../..';

const STEP = 'sameLockDelegateVePlnToSamePortfolio: ';
const DELEGATOR_SAMPLE_PERCENTAGE = 0.4;
const LOCK_TERM = ONE_YEAR;

// *** HELPERS ***
async function redelegateRewards(pd: Pollinator, portfolio: PollinatorPortfolio, amount: BN) {
  if (!amount) return;
  try {
    await pd.delegatePollen(portfolio, false, amount);
  } catch (e) {
    throw {
      msg: STEP + 'redelegate',
      e,
      amount
    };
  }
}

async function withdrawRewards(pd: Pollinator, portfolio: PollinatorPortfolio) {
  try {
    await pd.withdrawRewards(portfolio, false);
  } catch (e: any) {
    throw {
      msg: STEP + 'withdrawRewards',
      e,
      line: e.lineNumber
    };
  }
}

async function newLock(manager: IntegrationManager, pd: Pollinator, amount: BN) {
  const newLock = manager.getCurrentTime().add(ONE_YEAR);
  try {
    await pd.lockPollen(amount, newLock);
  } catch (e) {
    throw {
      msg: STEP + 'newLock',
      e,
      newLock
    };
  }
}

async function increaseLock(manager: IntegrationManager, pm: Pollinator, amount: BN) {
  if (manager.LockedPollenClass.locks[pm.address].lockEnd.lte(manager.getCurrentTime())) {
    const currentLockEnd = (await manager.LockedPollen.locks(pm.address)).lockEnd;
    await pm.extendLock(currentLockEnd.add(ONE_YEAR));
  }
  try {
    await pm.increaseLock(amount);
  } catch (e) {
    throw {
      msg: STEP + 'increaseLock',
      e,
      amount: amount.toString()
    };
  }
}

// delegators (random 40%)
export async function sameLockDelegateVePlnToSamePortfolio(manager: IntegrationManager) {
  const { PollenClass, LockedPollenClass, MinterClass, PortfolioClass } = getLocalModules(manager);
  const { pollenToken, vePln, pollenDAO } = getContracts(manager);


  // loop through pollinators
  const portfolioDelegators = manager.getDelegatorsSample(DELEGATOR_SAMPLE_PERCENTAGE);
  if (!portfolioDelegators.length) return;
  for await (const pd of portfolioDelegators) {
    // get all delegated portfolios
    const myPortfolios = pd.getMyDelegatedPortfolios();
    for await (const port of myPortfolios) {
      // check for price gains in each portfolio
      const deposits = port.deposits['false'][pd.address];
      const rewards = MinterClass.getWithdrawAmount(port, pd, deposits, false);
      if (isPositive(rewards.pollinatorRewards.sub(deposits))) {
        // withdraw profits (because `withdrawRewards()` transfers an off-chain calculated amount in the class,
        // and asserts that balances equal afterwards values do not need to be asserted here )
        await withdrawRewards(pd, port);
        // lock rewards
        if (!LockedPollenClass.hasLock(pd.address)) {
          await newLock(manager, pd, rewards.pollinatorRewards.sub(deposits));
        } else {
          if (LockedPollenClass.hasExpiredLock(pd.address)) {
            await pd.extendLock(manager.getCurrentTime().add(LOCK_TERM));
          }
          await increaseLock(manager, pd, rewards.pollinatorRewards.sub(deposits));
        }
        // redelegate
        await redelegateRewards(pd, port, rewards.pollinatorRewards.sub(deposits));




      }
    }

    // *** ASSERTIONS ***


  }
}