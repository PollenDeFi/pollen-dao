import { Deployer, Reporter } from '@solarity/hardhat-migrate';
import { BaseContract } from 'ethers';

import { Interface } from 'ethers/lib/utils';
import {
  BridgeReceiver__factory,
  IPollenDAO__factory,
  LockedPollen__factory,
  PollenDAO__factory,
  PollenToken__factory
} from '../../typechain';

function selectors(instance: BaseContract): string[] {
  return instance.interface.fragments
    .filter((item) => item.type === 'function')
    .map((item) => Interface.getSighash(item));
}

module.exports = async (deployer: Deployer): Promise<void> => {
  const reserveAddress = await (await deployer.getSigner()).getAddress();

  const pollenDAO = await deployer.deployed(
    IPollenDAO__factory,
    (
      await deployer.deploy(PollenDAO__factory, [], { name: 'PollenDAO' })
    ).address
  );

  const pollenToken = await deployer.deploy(PollenToken__factory, [reserveAddress]);

  const lockedPollen = await deployer.deploy(LockedPollen__factory, [pollenDAO.address, pollenToken.address]);

  const bridge = await deployer.deploy(BridgeReceiver__factory);
  await pollenDAO.addModule(bridge.address, selectors(bridge));

  await pollenDAO.setPollenTokens(pollenToken.address, lockedPollen.address);

  await pollenToken.setDaoAddress(pollenDAO.address);

  Reporter.reportContracts(
    ['PollenDAO', pollenDAO.address],
    ['PollenToken', pollenToken.address],
    ['LockedPollen', lockedPollen.address],
    ['BridgeReceiver', bridge.address]
  );
};
