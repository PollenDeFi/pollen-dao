import { Deployer, Reporter } from '@solarity/hardhat-migrate';
import { BaseContract, ethers } from 'ethers';

import { Interface } from 'ethers/lib/utils';
import assetsByNetworkJSON from '../scripts/data/assets.json';
import { AssetsByNetwork } from '../scripts/types';
import {
  BridgeReceiver__factory,
  Governance__factory,
  IPollenDAO__factory,
  LockedPollen__factory,
  Minter__factory,
  PollenDAO__factory,
  PollenToken__factory,
  Portfolio__factory,
  Quoter__factory
} from '../typechain';
const assetsByNetwork: AssetsByNetwork = assetsByNetworkJSON;

import { ISSUANCE_SCHEDULE } from '../test/helpers/constants';

function selectors(instance: BaseContract): string[] {
  return instance.interface.fragments
    .filter((item) => item.type === 'function')
    .map((item) => Interface.getSighash(item));
}

module.exports = async (deployer: Deployer): Promise<void> => {
  // const reserveAddress = await (await deployer.getSigner()).getAddress();

  const pollenDAO = await deployer.deployed(
    IPollenDAO__factory,
    // (
    //   await deployer.deploy(PollenDAO__factory, [], { name: 'PollenDAO' })
    // ).address
    '0x75DA25c267a328B6b5c53e019D09ACEDB566c94F'
  );

  // const pollenToken = await deployer.deploy(PollenToken__factory, [reserveAddress]);
  const pollenToken = await deployer.deployed(PollenToken__factory, '0x55e2F015f64dDAb807c3DE673cE3074Ae603CCE1');

  // const lockedPollen = await deployer.deploy(LockedPollen__factory, [pollenDAO.address, pollenToken.address]);
  const lockedPollen = await deployer.deployed(LockedPollen__factory, '0xA7c7a51f4cA7a27C669D7248f98f544Bd08beA80');

  const governance = await deployer.deploy(Governance__factory);
  const portfolio = await deployer.deploy(Portfolio__factory);
  const quoter = await deployer.deploy(Quoter__factory);
  const minter = await deployer.deploy(Minter__factory);
  // const bridge = await deployer.deploy(BridgeReceiver__factory);

  await pollenDAO.addModule(governance.address, selectors(governance));
  await pollenDAO.addModule(portfolio.address, selectors(portfolio));
  await pollenDAO.addModule(quoter.address, selectors(quoter));
  await pollenDAO.addModule(minter.address, selectors(minter));
  // await pollenDAO.addModule(bridge.address, selectors(bridge));

  // await pollenDAO.setPollenTokens(pollenToken.address, lockedPollen.address);

  // await pollenToken.setDaoAddress(pollenDAO.address);

  const assetData = assetsByNetwork['mumbai'];
  const assets = assetData.map((asset) => asset.address);
  const feeds = assetData.map((asset) => asset.feed);
  const rateBases = new Array<number>(assets.length).fill(0);

  for (let i = 0; i < assets.length; i++) {
    await pollenDAO.addAsset(assets[i]);
  }

  await pollenDAO.setRebalancePeriod(3600);

  await pollenDAO.setMaxNumberOfAssetsPerPortfolio(10);

  await pollenDAO.setLimitPortfolioBalance(
    ethers.utils.parseEther('1').toString(),
    ethers.utils.parseEther('100000').toString()
  );

  await pollenDAO.addPriceFeeds(rateBases, assets, feeds);

  await pollenDAO.setBoostingScale(ethers.utils.parseEther('0.2').toString());
  await pollenDAO.setMaxNumberWithdrawls(10);

  await pollenDAO.initializeIssuanceInfo(ISSUANCE_SCHEDULE);

  await pollenDAO.setQuorum(200);
  await pollenDAO.setVotingPeriod(604800);
  await pollenDAO.setTimeLock(604800);

  // await pollenDAO.createBenchMarkPortfolio([0, 0, 0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await pollenDAO.createBenchMarkPortfolio([100]);

  // // sepolia
  // const senderChainId = 10106;
  // const sender = '0xD3e0FA6C4cc081E84f37a0f9EBa5De0C5E7A8F6C';
  // // mumbai
  // const receiverLzGateway = '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8';
  // await pollenDAO.setBridgeReceiverStorage(senderChainId, sender, receiverLzGateway);

  Reporter.reportContracts(
    ['PollenDAO', pollenDAO.address],
    ['PollenToken', pollenToken.address],
    ['LockedPollen', lockedPollen.address],
    ['Governance', governance.address],
    ['Portfolio', portfolio.address],
    ['Quoter', quoter.address],
    ['Minter', minter.address]
    // ['BridgeReceiver', bridge.address]
  );
};
