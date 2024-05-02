import { Deployer, Reporter } from '@solarity/hardhat-migrate';
import { ethers } from 'ethers';

import { PollenFaucet__factory, PollenToken__factory } from '../typechain';

module.exports = async (deployer: Deployer): Promise<void> => {
  // const pollenToken = await deployer.deployed(PollenToken__factory, '');
  const pollenToken = await deployer.deployed(
    PollenToken__factory,
    '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6'
  );

  const faucet = await deployer.deploy(PollenFaucet__factory, [
    pollenToken.address,
    ethers.utils.parseEther('100').toString()
  ]);

  // const reserveAddress = await (await deployer.getSigner()).getAddress();
  // console.log(reserveAddress);

  await pollenToken.transfer(faucet.address, ethers.utils.parseEther('1000000').toString());

  Reporter.reportContracts(['PollenFaucet', faucet.address]);
};
