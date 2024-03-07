import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

import { ContractAddressesByNetwork } from './types';
import contractAddressesJSON from './data/latestDeployedContracts.json';
import {ILeagues} from '../typechain';

const supportedNetworks = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'avalanche', 'fuji'];
const URI = 'https://pollen.id/'; // TODO: replace URI
const pollenTokenContract = '0x1a392bf21fF6fa7E083CaA887B63F568D0f73820';

function writeAddresses(addresses: ContractAddressesByNetwork, networkName: string) {
  console.log('Writing addresses to file...');
  console.log(addresses);

  const currentAddresses: ContractAddressesByNetwork = contractAddressesJSON;
  currentAddresses[networkName] = addresses[networkName];

  fs.writeFileSync(path.resolve(__dirname, 'data', 'latestDeployedLeagues.json'), JSON.stringify(currentAddresses, null, 4));
}

async function deploy(networkName: string) {
  const [deployer, proxyAdmin] = await ethers.getSigners();

  const Leagues = await ethers.getContractFactory('Leagues');
  const leagues = await Leagues.deploy();
  await leagues.deployed();

  const LeaguesProxy = await ethers.getContractFactory('LeaguesProxy');
  const leagueProxy = await LeaguesProxy.deploy(
    leagues.address,
    proxyAdmin.address,
    '0x'
  ) as ILeagues;

  await leagueProxy.deployed();

  const liveLeagues = await ethers.getContractAt('ILeagues', leagueProxy.address) as ILeagues;
  await liveLeagues.initialize(URI, pollenTokenContract);

  /// Write contract addresses ///
  const newAddresses: ContractAddressesByNetwork = {
    [networkName]: {
      'leagues': leagues.address,
      'leaguesProxy': leagueProxy.address
    }
  };

  writeAddresses(newAddresses, networkName);

  /// Contract addresses ///

  console.log('\nDeployed contracts:');
  Object.keys(newAddresses[networkName]).forEach(contract => {
    console.log(`${contract} deployed to: ${newAddresses[networkName][contract]}`);
  });
}

async function main() {
  const networkName: string = network.name;

  if (!supportedNetworks.includes(networkName)) {
    throw new Error('Invalid network');
  }

  await deploy(networkName);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
