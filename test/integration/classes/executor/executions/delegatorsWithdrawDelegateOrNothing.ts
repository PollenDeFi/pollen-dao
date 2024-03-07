import { BigNumber as BN } from 'ethers';
import { expect } from 'chai';
import { ONE_YEAR } from '../../../../helpers/constants';
import { getCurrentTimestamp, isPositive } from '../../../../helpers/helpers';
import { getContracts, getLocalModules } from './index';
import { IntegrationManager, Pollinator, MinterClass, LockedPollenClass, PollenClass, PortfolioClass } from '../..';

const STEP = 'delegatorsWithdrawDelegateOrNothing: ';

// *** HELPERS ***

async function takeProfitsLosses(manager: IntegrationManager, pd: Pollinator) {
  const delegatedPortfolios = pd.getMyDelegatedPortfolios();
  try {
    for await (const pf of delegatedPortfolios) {
      await pd.withdrawRewards(pf, false);
      await pd.withdrawRewards(pf, true);
    }

  } catch (e) {
    throw {
      msg: STEP + 'takeProfits',
      e
    };
  }
}

async function delegate(manager: IntegrationManager, pd: Pollinator) {
  const allPortfolios = manager.PortfolioClass.getAllPortfolios();
  const randomPortfolio = allPortfolios[Math.floor(Math.random() * allPortfolios.length)];
  try {
    await pd.delegatePollen(randomPortfolio, false);
  } catch (e) {
    throw {
      msg: STEP + 'delegate',
      e
    };
  }
}

async function doNothing(manager: IntegrationManager, pm: Pollinator) {
  return;
}

const decisions: { [key: number]: (manager: IntegrationManager, pm: Pollinator) => void } = {
  0: takeProfitsLosses,
  1: delegate,
  2: doNothing
};



// onlyManagers
/**
 * @dev this function looks for any rewards that the portfolio manager may have fees, and redelegates the rewards (if any) back into their portfolio
 * @param manager 
 * @var delegatorRewards => class balance is only local to a Pollinator, meaning it only updates when calling a method on that pollinator whereas chainBalance is global. The difference between the two returns rewards since the last time the given Pollinator performed an execution
 * @var portfolioRewards => current pending portfolio rewards (if any)
 */
export async function delegatorsWithdrawDelegateOrNothing(manager: IntegrationManager) {
  const { PollenClass, LockedPollenClass, MinterClass, PortfolioClass } = getLocalModules(manager);
  const { pollenToken, vePln, pollenDAO } = getContracts(manager);


  // loop through pollinators
  const allDelegators = manager.getDelegators();
  for await (const pd of allDelegators) {
    const randomDecision = Math.floor(Math.random() * Object.keys(decisions).length);
    await decisions[randomDecision](manager, pd);
  }
}