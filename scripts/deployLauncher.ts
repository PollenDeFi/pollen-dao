import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

import { ContractAddressesByNetwork } from './types';
import { getSelectors } from '../test/helpers/functions';
import { DAO_ADMIN_ADDRESS, ISSUANCE_SCHEDULE, ISSUANCE_SCHEDULE_TEST } from '../test/helpers/constants';
import contractAddressesJSON from './data/latestDeployedContracts.json';
import { AssetsByNetwork } from './types';
import assetsByNetworkJSON from './data/assets.json';
import { IPollenDAO } from '../typechain';
import { BigNumber as BN } from '@ethersproject/bignumber/lib/bignumber';
const assetsByNetwork: AssetsByNetwork = assetsByNetworkJSON;

const supportedNetworks = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'avalanche', 'fuji'];
const supportedTestnets = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'fuji'];

const assetData4Test = [
  {
    'name': 'Tether',
    'symbol': 'USDT',
    'address': '0x9C094eB28F5bd88B697F3d5e4c08D9f086BaA1a2',
    'feed': '0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad'
  },
  {
    'name': 'Avalanche',
    'symbol': 'AVAX',
    'address': '0x2241fD746d69ff5a269FAca7FdD5892114d7e81b',
    'feed': '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD'
  },
  {
    'name': 'Bitcoin',
    'symbol': 'BTC',
    'address': '0x31ff41C488eE3672301a21520D79EaBd55a6a4fa',
    'feed': '0x31CF013A08c6Ac228C94551d535d5BAfE19c602a'
  },
  {
    'name': 'Ethereum',
    'symbol': 'ETH',
    'address': '0xF8Ab28093C19d2c4f96247140175C6395763b868',
    'feed': '0x86d67c3D38D2bCeE722E601025C25a575021c6EA'
  }
];

function writeAddresses(addresses: ContractAddressesByNetwork, networkName: string) {
  console.log('Writing addresses to file...');
  console.log(addresses);

  const currentAddresses: ContractAddressesByNetwork = contractAddressesJSON;
  currentAddresses[networkName] = addresses[networkName];

  fs.writeFileSync(path.resolve(__dirname, 'data', 'latestDeployedContractsWithLauncher.json'), JSON.stringify(currentAddresses, null, 4));
}

async function callLauncher4Test(networkName: string) {
  const [deployer] = await ethers.getSigners();
  const pollenToken = await ethers.getContractAt('PollenToken', '0x2B1f930432559b6FCDDcf081D0E559ea3eC2ae05');
  const launcher = await ethers.getContractAt('Launcher', '0xf88BD8230A9e3Ad6cEE4A14B5B5D834084E80371');

  // step 1: vote
  const allowance = ethers.utils.parseEther('100');
  await (await pollenToken.connect(deployer).approve(launcher.address, allowance)).wait();
  await (await launcher.connect(deployer).vote(allowance, true)).wait();

  // step 2: validate campaign and create portfolio
  const currentCampaign = await launcher.currentCampaign();
  await (await launcher.connect(deployer).validateCampaign(currentCampaign)).wait();

  const dao = await launcher.daoAddr();
  console.log('DAO:', dao);
  const pollenDAO = await ethers.getContractAt('IPollenDAO', dao);

  const portfolioAmount = ethers.utils.parseEther('100');
  const weights = [BN.from(30), BN.from(30), BN.from(40)];
  await (await pollenToken.connect(deployer).approve(dao, portfolioAmount)).wait();
  await (await pollenDAO.connect(deployer).createPortfolio(portfolioAmount, weights, false)).wait();
}

async function deploy(networkName: string) {
  const [deployer] = await ethers.getSigners();

  // Init parameters by network
  let assetData;
  let issuanceSchedule;
  let daoAdmin;
  let benchMark;
  if (supportedTestnets.includes(networkName)) {
    assetData = assetData4Test;
    issuanceSchedule = ISSUANCE_SCHEDULE_TEST;
    daoAdmin = deployer.address;
    benchMark = [0, 50, 0, 50]; // test benchmark weights
  } else {
    assetData = assetsByNetwork[networkName];
    issuanceSchedule = ISSUANCE_SCHEDULE;
    benchMark = [0, 0, 0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  /// Pollen Token deployment ///

  // console.log('Deploying PollenToken...');
  // const PollenToken = await ethers.getContractFactory('PollenToken');
  // const pollenToken = await PollenToken.deploy(deployer.address);
  // await pollenToken.deployed();

  /// Modules deployment ///

  console.log('Deploying Governance...');
  const Governance = await ethers.getContractFactory('Governance');
  const governance = await Governance.deploy();
  await governance.deployed();

  console.log('Deploying Portfolio...');
  const Portfolio = await ethers.getContractFactory('Portfolio');
  const portfolio = await Portfolio.deploy();
  await portfolio.deployed();

  console.log('Deploying Quoter...');
  const Quoter = await ethers.getContractFactory('Quoter');
  const quoter = await Quoter.deploy();
  await quoter.deployed();

  console.log('Deploying Minter...');
  const Minter = await ethers.getContractFactory('Minter');
  const minter = await Minter.deploy();
  await minter.deployed();

  /// Getting selectors ///

  const governanceSelectors = getSelectors(Governance.interface);
  const portfolioSelectors = getSelectors(Portfolio.interface);
  const quoterSelectors = getSelectors(Quoter.interface);
  const minterSelectors = getSelectors(Minter.interface);

  const mInfo = {
    quoterSelectors: quoterSelectors,
    portfolioSelectors: portfolioSelectors,
    minterSelectors: minterSelectors,
    governanceSelectors: governanceSelectors,
    quoterAddr: quoter.address,
    portfolioAddr: portfolio.address,
    minterAddr: minter.address,
    governanceAddr: governance.address,
    daoAdminAddr: '0xbd726eabEB583a2638173F4a837eF4C8d87d5e8c',
    benchMark: benchMark
  };

  const assets = assetData.map((asset) => asset.address);
  const feeds = assetData.map((asset) => asset.feed);
  const rateBases = new Array<number>(assets.length).fill(0);

  const Launcher = await ethers.getContractFactory('Launcher');
  const launcher = await Launcher.deploy(
    '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
    assets,
    feeds,
    rateBases,
    issuanceSchedule,
    mInfo
  );

  /// Write contract addresses ///

  const newAddresses: ContractAddressesByNetwork = {
    [networkName]: {
      'pollenToken': '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
      'governance': governance.address,
      'portfolio': portfolio.address,
      'quoter': quoter.address,
      'minter': minter.address,
      'launcher': launcher.address
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
