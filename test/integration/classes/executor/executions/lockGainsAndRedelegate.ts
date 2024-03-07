import { BigNumber as BN } from 'ethers';
import { expect } from 'chai';
import { ONE_YEAR } from '../../../../helpers/constants';
import { getCurrentTimestamp, isPositive } from '../../../../helpers/helpers';
import { getContracts, getLocalModules } from './index';
import { IntegrationManager, Pollinator, MinterClass, LockedPollenClass, PollenClass, PortfolioClass } from '../..';
import { ethers } from 'hardhat';

const STEP = 'lockGainsAndRedelegate: ';

// *** HELPERS ***
function checkForGains(pm: Pollinator, MinterClass: MinterClass, onChainPlnBalanceStart: BN,) {
  const portfolio = pm.getMyPortfolio();
  const unseenFeeReturns = pm.checkPortfolioFees();
  pm.acknowledgePortfolioFees();
  const ret = MinterClass.checkPriceReturnForPortfolio(portfolio, pm, false);
  return {
    feeReturns: unseenFeeReturns.gained,
    ret
  };

}

async function newLock(manager: IntegrationManager, pm: Pollinator, amount: BN) {
  const newLock = manager.getCurrentTime().add(ONE_YEAR);
  try {
    await pm.lockPollen(amount, newLock);
  } catch (e) {
    throw {
      msg: STEP + 'newLock',
      e,
      newLock
    };
  }
}

async function increaseLock(manager: IntegrationManager, pm: Pollinator, amount: BN) {
  const onChainLockEnd = (await manager.LockedPollen.locks(pm.address)).lockEnd;
  const lastBlock = await ethers.provider.getBlock('latest');
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

async function redelegate(pm: Pollinator, PortfolioClass: PortfolioClass, LockedPollenClass: LockedPollenClass) {
  const vePlnBalance = LockedPollenClass.balanceOf(pm.address);
  if (!vePlnBalance) return;
  const thisPortfolio = PortfolioClass.portfolios[pm.address];
  try {
    await pm.delegatePollen(thisPortfolio, true, vePlnBalance);
  } catch (e) {
    throw {
      msg: 'redelegate',
      e,
      vePlnBalance
    };
  }
}


// onlyManagers
/**
 * @dev this function looks for any rewards that the portfolio manager may have fees, and redelegates the rewards (if any) back into their portfolio
 * @param manager 
 * @var delegatorRewards => class balance is only local to a Pollinator, meaning it only updates when calling a method on that pollinator whereas chainBalance is global. The difference between the two returns rewards since the last time the given Pollinator performed an execution
 * @var portfolioRewards => current pending portfolio rewards (if any)
 */
export async function lockGainsAndRedelgate(manager: IntegrationManager) {
  const { PollenClass, LockedPollenClass, MinterClass, PortfolioClass } = getLocalModules(manager);
  const { pollenToken, vePln, pollenDAO } = getContracts(manager);


  // loop through pollinators
  const portfolioManagers = manager.getPortfolioManagers();
  for await (const pm of portfolioManagers) {
    const balance = PollenClass.balanceOf(pm.address);
    const onChainPlnBalanceStart = await pollenToken.balanceOf(pm.address);
    // check for gains (fees + gains)
    const { feeReturns, ret } = checkForGains(pm, MinterClass, onChainPlnBalanceStart);
    // if no gains do not do anything
    if (!(isPositive(feeReturns))) return;
    // relock all gains
    const amount = feeReturns;
    if (!LockedPollenClass.hasLock(pm.address)) {
      await newLock(manager, pm, amount);
    } else {
      if (LockedPollenClass.hasExpiredLock(pm.address)) {
        await pm.extendLock(manager.getCurrentTime().add(ONE_YEAR));
      }
      await increaseLock(manager, pm, amount);
    }



    // redelegate new vePLN
    await redelegate(pm, PortfolioClass, LockedPollenClass);


    // *** ASSERTIONS ***


  }
}