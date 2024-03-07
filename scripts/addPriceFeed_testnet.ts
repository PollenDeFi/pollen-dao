import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { AssetsByNetwork, ContractAddressesByNetwork } from './types';
import { IPollenDAO } from '../typechain';
import assetsByNetworkJSON from './data/assets.json';
import contractAddressesJSON from './data/latestDeployedContracts.json';

const supportedTestnets = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'avalanche', 'fuji'];
const assetsByNetwork: AssetsByNetwork = assetsByNetworkJSON;
const contractAddresses: ContractAddressesByNetwork = contractAddressesJSON;

function getAssetsArray(networkName: string) {
  const benchMarkAmounts = Array(assetsByNetwork[networkName].length).fill(0);
  benchMarkAmounts[1] = 30;
  benchMarkAmounts[2] = 70;
  return benchMarkAmounts;
}

async function addAssetsToWhitelist(deployer: SignerWithAddress, network: string) {
  console.log('Adding assets to Portfolio whitelist...');

  const pollenDAO = await ethers.getContractAt('IPollenDAO', contractAddresses[network].pollenDAOImplementation) as IPollenDAO;
  const assets = assetsByNetwork[network];

  for (const asset of assets) {
    await (await pollenDAO.connect(deployer).addAsset(asset.address)).wait();
    console.log(`Asset ${asset.symbol} added`);
  }

  console.log('Creating benchmark portfolio...');
  const benchmarkValues = getAssetsArray(network);
  await (await pollenDAO.connect(deployer).createBenchMarkPortfolio(benchmarkValues));
}

async function addPriceFeeds(deployer: SignerWithAddress, network: string) {
  console.log('Adding assets and feeds to Quoter...');

  const pollenDAO = await ethers.getContractAt('IPollenDAO', contractAddresses[network].pollenDAOImplementation) as IPollenDAO;
  const assets = assetsByNetwork[network];

  await (
    await pollenDAO.connect(deployer).addPriceFeeds(
      new Array<number>(assets.length).fill(0),
      assets.map((asset) => asset.address),
      assets.map((asset) => asset.feed)
    )
  ).wait();

  for (const asset of assets) {
    console.log(`Added asset: ${asset.symbol}`);
    console.log(`Address....: ${asset.address}`);
    console.log(`Feed.......: ${asset.feed}`);
  }

  console.log();
}

async function main() {
  const networkName: string = network.name;

  if (!supportedTestnets.includes(networkName)) {
    throw new Error('Invalid network');
  }

  const [deployer] = await ethers.getSigners();
  await addPriceFeeds(deployer, networkName);
  await addAssetsToWhitelist(deployer, networkName);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });