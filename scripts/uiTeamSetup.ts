import { ethers, network } from 'hardhat';
import teamWallets from './data/teamWallets.json';
import contractAddressesJSON from './data/latestDeployedContracts.json';

import { ContractAddressesByNetwork } from './types';
import { IPollenDAO } from '../typechain';
import { BigNumber } from 'ethers';

const supportedTestnets = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'avalanche', 'fuji'];
const contractAddresses: ContractAddressesByNetwork = contractAddressesJSON;
const PRECISION = BigNumber.from(10**10).mul(10**8);

async function fundWallets(wallets: string[], network: string) {
  const [deployer, secondWallet] = await ethers.getSigners();
  const amount = PRECISION.mul(100000);

  console.log('Funding UI Wallets...');
  const pollenTokenImplementation = await ethers.getContractFactory('PollenToken');
  const pollenToken = pollenTokenImplementation.attach(contractAddresses[network].pollenToken);

  for (const addr of wallets) {
    await (await pollenToken.connect(deployer).transfer(addr, amount)).wait();
    console.log(`Wallet ${addr} funded with ${amount} PLN`);
  }
}

async function addAdmins(wallets: string[], network: string) {
  const [deployer] = await ethers.getSigners();

  console.log('Adding admins...');
  const pollenDAO = await ethers.getContractAt('IPollenDAO', contractAddresses[network].pollenDAOImplementation) as IPollenDAO;

  for (const addr of wallets) {
    await (await pollenDAO.connect(deployer).transferAdminRole(addr)).wait();
    console.log(`Admin added ${addr}`);
  }
}

async function main() {
  const networkName: string = network.name;

  if (!supportedTestnets.includes(networkName)) {
    throw new Error('Invalid network');
  }

  await fundWallets(teamWallets.team, networkName);
  await addAdmins(teamWallets.admins, networkName);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
