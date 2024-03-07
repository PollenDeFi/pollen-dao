import { Deployer, Reporter } from '@solarity/hardhat-migrate';

import { BaseContract } from 'ethers';
import assetsByNetworkJSON from '../../scripts/data/assets.json';
import {
  Governance__factory,
  Launcher__factory,
  Minter__factory,
  Portfolio__factory,
  Quoter__factory
} from '../../typechain';

import { Interface } from 'ethers/lib/utils';
import { ISSUANCE_SCHEDULE, ISSUANCE_SCHEDULE_TEST } from '../../test/helpers/constants';
import { Launcher } from '../../typechain/contracts/Launcher';
import { IssuanceInfoStruct } from '../../typechain/contracts/interface/IPollenDAO';

// module.exports = async (deployer: Deployer): Promise<void> => {
//   //test
//   const pollenToken = await deployer.deployed(PollenToken__factory);
//   const launcher = await deployer.deployed(Launcher__factory, []);

//   // step 1: vote
//   const allowance = ethers.utils.parseEther('100');
//   await pollenToken.approve(launcher.address, allowance);
//   await launcher.vote(allowance, true);

//   // step 2: validate campaign and create portfolio
//   const currentCampaign = await launcher.currentCampaign();
//   await launcher.validateCampaign(currentCampaign);

//   const dao = await launcher.daoAddr();
//   const pollenDAO = await deployer.deployed(IPollenDAO__factory, dao);

//   const portfolioAmount = ethers.utils.parseEther('100');
//   const weights = [BN.from(30), BN.from(30), BN.from(40)];
//   await pollenToken.approve(dao, portfolioAmount);
//   // TODO: WTF?
//   await pollenDAO.createPortfolio(portfolioAmount, weights, false);
// };

const supportedNetworks = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'avalanche', 'fuji'];
const supportedTestnets = ['hardhat', 'localhost', 'rinkeby', 'kovan', 'fuji'];

const assetData4Test = [
  {
    name: 'Tether',
    symbol: 'USDT',
    address: '0x9C094eB28F5bd88B697F3d5e4c08D9f086BaA1a2',
    feed: '0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad'
  },
  {
    name: 'Avalanche',
    symbol: 'AVAX',
    address: '0x2241fD746d69ff5a269FAca7FdD5892114d7e81b',
    feed: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD'
  },
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    address: '0x31ff41C488eE3672301a21520D79EaBd55a6a4fa',
    feed: '0x31CF013A08c6Ac228C94551d535d5BAfE19c602a'
  },
  {
    name: 'Ethereum',
    symbol: 'ETH',
    address: '0xF8Ab28093C19d2c4f96247140175C6395763b868',
    feed: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA'
  }
];

function getSelectors(instance: BaseContract): string[] {
  return instance.interface.fragments
    .filter((item) => item.type === 'function')
    .map((item) => Interface.getSighash(item));
}

module.exports = async (deployer: Deployer): Promise<void> => {
  const networkName = (await (await deployer.getSigner()).provider?.getNetwork())?.name;
  if (!networkName) {
    throw new Error('Network name not found');
  }

  // Init parameters by network
  let assetData: { name: string; symbol: string; address: string; feed: string }[];
  let issuanceSchedule: IssuanceInfoStruct[];
  // let daoAdmin: string;
  let benchMark: number[];
  if (supportedTestnets.includes(networkName)) {
    assetData = assetData4Test;
    issuanceSchedule = ISSUANCE_SCHEDULE_TEST;
    // daoAdmin = await (await deployer.getSigner()).getAddress();
    benchMark = [0, 50, 0, 50]; // test benchmark weights
  } else {
    assetData = assetsByNetworkJSON[networkName];
    issuanceSchedule = ISSUANCE_SCHEDULE;
    benchMark = [0, 0, 0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  const quoter = await deployer.deployed(Quoter__factory);
  const portfolio = await deployer.deployed(Portfolio__factory);
  const minter = await deployer.deployed(Minter__factory);
  const governance = await deployer.deployed(Governance__factory);

  const governanceSelectors = getSelectors(governance);
  const portfolioSelectors = getSelectors(portfolio);
  const quoterSelectors = getSelectors(quoter);
  const minterSelectors = getSelectors(minter);

  const mInfo: Launcher.ModulesInfoStruct = {
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

  const launcher = await deployer.deploy(Launcher__factory, [
    '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf', // PollenToken
    assets,
    feeds,
    rateBases,
    issuanceSchedule,
    mInfo
  ]);

  Reporter.reportContracts(['Launcher', launcher.address]);
};
