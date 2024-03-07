import { Deployer } from '@solarity/hardhat-migrate';

import { IPollenDAO__factory, LeaguesProxy__factory } from '../../typechain';

module.exports = async (deployer: Deployer): Promise<void> => {
  // const pollenDAO = await deployer.deployed(IPollenDAO__factory, '0x56e292C0016ad6D04FaB2eE3C586d2a1d1ab8035');

  // // sepolia
  // const senderChainId = 10106;
  // const sender = '0xD3e0FA6C4cc081E84f37a0f9EBa5De0C5E7A8F6C';
  // // mumbai
  // const receiverLzGateway = '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8';
  // await pollenDAO.setBridgeReceiverStorage(senderChainId, sender, receiverLzGateway);

  const proxy = await deployer.deployed(LeaguesProxy__factory, '0xDd612d373D6ba328901571434ef76bd1751Df661');
  console.log(await proxy.admin());
};
