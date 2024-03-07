import { Deployer, Reporter } from '@solarity/hardhat-migrate';
import { ethers } from 'ethers';

import { PollenFaucet__factory, PollenToken__factory } from '../typechain';

module.exports = async (deployer: Deployer): Promise<void> => {
  const pollenToken = await deployer.deployed(PollenToken__factory, '');

  const faucet = await deployer.deploy(PollenFaucet__factory, [
    pollenToken.address,
    ethers.utils.parseEther('100').toString()
  ]);

  await pollenToken.transfer(faucet.address, ethers.utils.parseEther('1000000').toString());

  Reporter.reportContracts(['PollenFaucet', faucet.address]);
};
