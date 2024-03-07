import { IntegrationManager } from '../../';

export { lockGainsAndRedelgate } from './lockGainsAndRedelegate';
export { noLockDelegatePln } from './noLockDelegatePln';
export { sameLockDelegateVePlnToSamePortfolio } from './sameLockDelegateVePlnToSamePortfolio';
export { randomLockDelegateVePlnToRandomPortfolio } from './randomLockDelegateVePlnToRandomPortfolio';
export { managersRebalanceCloseOrNothing } from './managersRebalanceCloseOrNothing';
export { delegatorsWithdrawDelegateOrNothing } from './delegatorsWithdrawDelegateOrNothing';


export function getLocalModules(manager: IntegrationManager) {
  const PollenClass = manager.PollenClass;
  const LockedPollenClass = manager.LockedPollenClass;
  const MinterClass = manager.MinterClass;
  const PortfolioClass = manager.PortfolioClass;
  return {
    PollenClass,
    LockedPollenClass,
    MinterClass,
    PortfolioClass
  };
}

export function getContracts(manager: IntegrationManager) {
  const pollenToken = manager.PollenToken;
  const vePln = manager.LockedPollen;
  const pollenDAO = manager.PollenDAO;
  return {
    pollenToken,
    vePln,
    pollenDAO
  };
}