import { BigNumber as BN } from 'ethers';
import { expect } from 'chai';
import { ONE_YEAR } from '../../../../helpers/constants';
import { getCurrentTimestamp } from '../../../../helpers/helpers';
import { getContracts, getLocalModules } from './index';
import { IntegrationManager, Pollinator, MinterClass, LockedPollenClass, PollenClass, PortfolioClass } from '../..';

const STEP = 'managersRebalanceCloseOrNothing: ';

// *** HELPERS ***
function getDecision() {
  return Math.floor(Math.random() * 2);
}

async function rebalance(pm: Pollinator) {
  try {
    await pm.rebalancePortfolio(false);
  } catch (e) {
    throw {
      msg: 'rebalance',
      e
    };
  }
}

async function close(pm: Pollinator) {
  try {
    await pm.closePortfolio(true);
  } catch (e) {
    throw {
      msg: STEP + 'close',
      e,
    };
  }
}

function doNothing(pm: Pollinator) {
  return;
}

const decisions: { [key: number]: (param: Pollinator) => void } = {
  0: rebalance,
  1: close,
  2: doNothing
};


// onlyManagers
/**
 * @dev this function looks for any rewards that the portfolio manager may have fees, and redelegates the rewards (if any) back into their portfolio
 * @param manager 
 * @var delegatorRewards => class balance is only local to a Pollinator, meaning it only updates when calling a method on that pollinator whereas chainBalance is global. The difference between the two returns rewards since the last time the given Pollinator performed an execution
 * @var portfolioRewards => current pending portfolio rewards (if any)
 */
export async function managersRebalanceCloseOrNothing(manager: IntegrationManager) {
  const { PollenClass, LockedPollenClass, MinterClass, PortfolioClass } = getLocalModules(manager);
  const { pollenToken, vePln, pollenDAO } = getContracts(manager);

  // loop through pollinators
  const portfolioManagers = manager.getPortfolioManagers();
  for await (const pm of portfolioManagers) {
    // get decision
    const decision = getDecision();
    await decisions[0](pm);





    // *** ASSERTIONS ***


  }
}