import { Deployer, Reporter } from '@solarity/hardhat-migrate';
import { BaseContract } from 'ethers';

import { Interface } from 'ethers/lib/utils';
import { BridgeSender__factory, IPollenDAO__factory } from '../typechain';

function bridgeSelectors(instance: BaseContract): string[] {
  const redundant = ['burnAndBridgePollen'];

  return instance.interface.fragments
    .filter((item) => item.type === 'function' && !redundant.includes(item.name))
    .map((item) => Interface.getSighash(item));
}

module.exports = async (deployer: Deployer): Promise<void> => {
  const pollenDAO = await deployer.deployed(IPollenDAO__factory, '');

  // Mumbai
  const receiverChainId_ = 10109;
  const receiver_ = '0x56e292C0016ad6D04FaB2eE3C586d2a1d1ab8035';
  // sepolia
  const senderLzGateway_ = '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706';
  const bridge = await deployer.deploy(BridgeSender__factory, [
    pollenDAO.address,
    receiverChainId_,
    receiver_,
    senderLzGateway_
  ]);

  await pollenDAO.addModule(bridge.address, bridgeSelectors(bridge));
  //   await pollenDAO.updateModule(
  //     '0x26BCDEb3E4e7EDf5657daF543132cAF792728908',
  //     bridge.address,
  //     bridgeSelectors(bridge),
  //     bridgeSelectors(bridge)
  //   );

  Reporter.reportContracts(['PollenDAO', pollenDAO.address], ['BridgeSender', bridge.address]);
};
