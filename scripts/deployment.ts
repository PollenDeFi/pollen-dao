import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

import { ContractAddressesByNetwork } from './types';
import { getSelectors } from '../test/helpers/functions';
import { ISSUANCE_SCHEDULE } from '../test/helpers/constants';
import { IPollenDAO } from '../typechain';
import contractAddressesJSON from './data/latestDeployedContracts.json';
import { AssetsByNetwork } from './types';
import assetsByNetworkJSON from './data/assets.json';
const assetsByNetwork: AssetsByNetwork = assetsByNetworkJSON;

const RESERVE_ADDRESS = '0x2e0E97D6994ee69B448Cc1dfb7f953615683BA89';
const supportedTestnets = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'avalanche', 'fuji'];

const RATE = '10000000000000000';
const RATE_DURATION = (365 * 24 * 60 * 60).toString();

function writeAddresses(addresses: ContractAddressesByNetwork, networkName: string) {
  console.log('Writing addresses to file...');
  console.log(addresses);

  const currentAddresses: ContractAddressesByNetwork = contractAddressesJSON;
  currentAddresses[networkName] = addresses[networkName];

  fs.writeFileSync(path.resolve(__dirname, 'data', 'latestDeployedContracts.json'), JSON.stringify(currentAddresses, null, 4));
}

async function deploy(networkName: string) {
  const [deployer] = await ethers.getSigners();

  /// DAO deployment ///

  console.log('Deploying PollenDAO...');
  const PollenDAO = await ethers.getContractFactory('PollenDAO');
  const pollenDAOImplementation = await PollenDAO.deploy();
  await pollenDAOImplementation.deployed();

  /// Pollen Token deployment ///

  console.log('Deploying PollenToken...');
  const PollenToken = await ethers.getContractFactory('PollenToken');
  const pollenToken = await PollenToken.deploy(deployer.address);
  await pollenToken.deployed();

  // deploy PollenToken
  const LockedPollen = await ethers.getContractFactory('LockedPollen');
  console.log('Deploying vePLN Token...');
  const lockedPollen = await LockedPollen.deploy(pollenDAOImplementation.address, pollenToken.address);
  await lockedPollen.deployed();
  console.log('vePLN Token deployed to:', lockedPollen.address);

  /// Modules deployment ///

  console.log('Deploying Governance...');
  const Governance = await ethers.getContractFactory('Governance');
  const governanceImplementation = await Governance.deploy();
  await governanceImplementation.deployed();

  console.log('Deploying Portfolio...');
  const Portfolio = await ethers.getContractFactory('Portfolio');
  const portfolioImplementation = await Portfolio.deploy();
  await portfolioImplementation.deployed();

  console.log('Deploying Quoter...');
  const Quoter = await ethers.getContractFactory('Quoter');
  const quoterImplementation = await Quoter.deploy();
  await quoterImplementation.deployed();

  console.log('Deploying Minter...');
  const Minter = await ethers.getContractFactory('Minter');
  const minterImplementation = await Minter.deploy();
  await minterImplementation.deployed();

  const pollenDAO = await ethers.getContractAt('IPollenDAO', pollenDAOImplementation.address) as IPollenDAO;

  /// Write contract addresses ///

  const newAddresses: ContractAddressesByNetwork = {
    [networkName]: {
      'pollenToken': pollenToken.address,
      'vePLN': lockedPollen.address,
      'pollenDAOImplementation': pollenDAOImplementation.address,
      'governanceImplementation': governanceImplementation.address,
      'portfolioImplementation': portfolioImplementation.address,
      'quoterImplementation': quoterImplementation.address,
      'minterImplementation': minterImplementation.address
    }
  };

  writeAddresses(newAddresses, networkName);

  /// Contract addresses ///

  console.log('\nDeployed contracts:');
  Object.keys(newAddresses[networkName]).forEach(contract => {
    console.log(`${contract} deployed to: ${newAddresses[networkName][contract]}`);
  });

  /// Getting selectors ///

  const governanceSelectors = getSelectors(Governance.interface);
  const portfolioSelectors = getSelectors(Portfolio.interface);
  const quoterSelectors = getSelectors(Quoter.interface);
  const minterSelectors = getSelectors(Minter.interface);

  /// Modules registration and settings ///

  console.log('Registering modules...');
  await (await pollenDAO.addModule(governanceImplementation.address, governanceSelectors)).wait();
  await (await pollenDAO.addModule(portfolioImplementation.address, portfolioSelectors)).wait();
  await (await pollenDAO.addModule(quoterImplementation.address, quoterSelectors)).wait();
  await (await pollenDAO.addModule(minterImplementation.address, minterSelectors)).wait();

  console.log('Setting PollenToken in the DAO...');
  await (await pollenDAO.connect(deployer).setPollenTokens(pollenToken.address, lockedPollen.address)).wait();

  console.log('Setting DAO address in PollenToken...');
  await (await pollenToken.connect(deployer).setDaoAddress(pollenDAO.address)).wait();

  console.log('Setting maximum number of assets per portfolio...');
  await (await pollenDAO.setMaxNumberOfAssetsPerPortfolio(40)).wait();

  console.log('Setting maximum number of withdrawls per transcation...');
  await (await pollenDAO.setMaxNumberWithdrawls(20)).wait();

  console.log('Setting issuance rate info...');
  await (await pollenDAO.initializeIssuanceInfo(ISSUANCE_SCHEDULE)).wait();

  console.log('Setting min pollen bal and max delegation amount.');
  await (await pollenDAO.setLimitPortfolioBalance('0', ethers.utils.parseEther('10000000'))).wait();
}

async function main() {
  const networkName: string = network.name;

  if (!supportedTestnets.includes(networkName)) {
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