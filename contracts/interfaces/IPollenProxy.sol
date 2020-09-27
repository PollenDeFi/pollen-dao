pragma solidity >=0.6 <0.7.0;

import "./openzeppelin/IAdminUpgradeabilityProxy.sol";
import "./IPollen.sol";


/**
* @title Pollen extended Interface (the "proxy" and the "implementation" combined)
* @dev A deployed proxy instance not just calls (via DELEGATECALL) the "implementation"
* but also processes some calls itself.
* Therefore an instance (proxy) of the "Pollen" contract effectually supports two interfaces:
* - the "Pollen" (i.e. the "implementation") contract ABI (IPollen)
* - the "transparent proxy" ABI (IAdminUpgradeabilityProxy)
* @author vkonst
*/
interface IPollenProxy is IPollen, IAdminUpgradeabilityProxy {
}
