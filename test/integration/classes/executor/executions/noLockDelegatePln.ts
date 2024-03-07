import { BigNumber as BN } from 'ethers';
import { expect } from 'chai';
import { ONE_YEAR } from '../../../../helpers/constants';
import { getCurrentTimestamp, isPositive } from '../../../../helpers/helpers';
import { getContracts, getLocalModules } from './index';
import { IntegrationManager, Pollinator, MinterClass, LockedPollenClass, PollenClass, PortfolioClass, PollinatorPortfolio } from '../..';

const STEP = 'noLockDelegatePln: ';
const DELEGATOR_SAMPLE_PERCENTAGE = 0.4;

// *** HELPERS ***
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

async function redelegateRewards(pm: Pollinator, portfolio: PollinatorPortfolio, amount: BN) {
  if (!amount) return;
  try {
    await pm.delegatePollen(portfolio, false, amount);
  } catch (e) {
    throw {
      msg: STEP + 'redelegate',
      e,
      amount
    };
  }
}

// delegators (random 40%)
export async function noLockDelegatePln(manager: IntegrationManager) {
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
        // redelegate
        await redelegateRewards(pd, port, rewards.pollinatorRewards.sub(deposits));




      }
    }

    // *** ASSERTIONS ***


  }
}