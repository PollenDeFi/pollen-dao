pragma solidity >=0.6 <0.7.0;

import "./openzeppelin/IAdminUpgradeabilityProxy.sol";
import "./IPollenDAO.sol";


/**
* @title PollenDAO extended Interface (the "proxy" and the "implementation" combined)
* @dev A deployed proxy instance not just calls (via DELEGATECALL) the "implementation"
* but also processes some calls itself.
* Therefore an instance (proxy) of the "PollenDAO" contract effectually supports two interfaces:
* - the "PollenDAO" (i.e. the "implementation") contract ABI (IPollenDAO)
* - the "transparent proxy" ABI (IAdminUpgradeabilityProxy)
* @author vkonst
*/
interface IPollenDAOProxy is IPollenDAO, IAdminUpgradeabilityProxy {
}
