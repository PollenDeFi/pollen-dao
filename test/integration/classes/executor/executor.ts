import { shuffle } from '../../helpers/random';
import { IntegrationManager, Pollinator } from '../';

import {
  lockGainsAndRedelgate,
  noLockDelegatePln,
  sameLockDelegateVePlnToSamePortfolio,
  randomLockDelegateVePlnToRandomPortfolio,
  managersRebalanceCloseOrNothing,
  delegatorsWithdrawDelegateOrNothing
} from './executions/index';


type Executor = {
  [key: string]: (T: IntegrationManager) => void
}

// Refer to Integration Step doc for steps in a round
export enum STEPS {
  LOCK_GAINS_AND_REDELEGATE,                        // row 4
  NO_LOCK_DELEGATE_PLN,                             // row 5
  SAME_LOCK_DELEGATE_VEPLN_TO_SAME_PORTFOLIO,       // row 6
  RANDOM_LOCK_DELEGATE_VEPLN_TO_RANDOM_PORTFOLIO,   // row 7
  TIME_PASS_AND_PRICE_CHANGE,                       // row 8
  MANAGERS_REBALANCE_CLOSE_OR_NOTHING,              // row 9
  DELEGATORS_WITHDRAW_DELEGATE_OR_NOTHING,          // row 10
}

export const executor: Executor = {
  [STEPS.LOCK_GAINS_AND_REDELEGATE]: lockGainsAndRedelgate,
  [STEPS.NO_LOCK_DELEGATE_PLN]: noLockDelegatePln,
  [STEPS.SAME_LOCK_DELEGATE_VEPLN_TO_SAME_PORTFOLIO]: sameLockDelegateVePlnToSamePortfolio,
  [STEPS.RANDOM_LOCK_DELEGATE_VEPLN_TO_RANDOM_PORTFOLIO]: randomLockDelegateVePlnToRandomPortfolio,
  [STEPS.MANAGERS_REBALANCE_CLOSE_OR_NOTHING]: managersRebalanceCloseOrNothing,
  [STEPS.DELEGATORS_WITHDRAW_DELEGATE_OR_NOTHING]: delegatorsWithdrawDelegateOrNothing,
};

export class StepExecutor {
  stepStack: string[]
  constructor() {
    this.stepStack = Object.keys(executor);
  }

  private randomizeStepsStack() {
    shuffle(this.stepStack);
  }

  async executeRound(integrationManager: IntegrationManager) {
    this.randomizeStepsStack();
    for await (const step of this.stepStack) {
      await executor[step](integrationManager);
    }
  }
}