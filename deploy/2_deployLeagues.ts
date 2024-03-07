import { Deployer, Reporter } from '@solarity/hardhat-migrate';

import { LeaguesProxy__factory, Leagues__factory, PollenToken__factory } from '../typechain';

const URI = 'https://pollen.id/'; // TODO: replace URI
const pollenTokenContract = '0x55e2F015f64dDAb807c3DE673cE3074Ae603CCE1';
module.exports = async (deployer: Deployer): Promise<void> => {
  // const proxyAdmin = '';
  const proxyAdmin = '0x3a383A440EF65A40e68A62d93489C1F0276c5E41';
  if (!proxyAdmin) {
    throw new Error('Proxy admin address not set');
  }

  const pollenToken = await deployer.deployed(PollenToken__factory, pollenTokenContract);

  const leaguesImplementation = await deployer.deploy(Leagues__factory);

  await deployer.deploy(LeaguesProxy__factory, [leaguesImplementation.address, proxyAdmin, '0x'], {
    name: 'leagueProxy'
  });

  const liveLeagues = await deployer.deployed(Leagues__factory, 'leagueProxy');

  await liveLeagues.initialize(URI, pollenToken.address);

  Reporter.reportContracts(['LeaguesImplementation', leaguesImplementation.address], ['Leagues', liveLeagues.address]);
};
