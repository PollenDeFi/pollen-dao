import hre from 'hardhat';
import {
  PollenToken,
  Portfolio,
  IPollenDAO,
  LockedPollen,
  Minter,
  Quoter,
  Governance
} from '../../typechain';
import { getSelectors } from './functions';

interface Contracts {
  pollenDAO: IPollenDAO,
  pollenToken: PollenToken,
  vePLN: LockedPollen
}

export async function deployContracts(adminAddress: string): Promise<Contracts> {
  // Deploy PollenDAO Implementation
  const PollenDAO = await hre.ethers.getContractFactory('PollenDAO');
  const pollenDAOImplementation = await PollenDAO.deploy() as IPollenDAO;
  await pollenDAOImplementation.deployed();

  // Deploy pollen token
  const PLN = await hre.ethers.getContractFactory('PollenToken');
  const pollenToken = await PLN.deploy(adminAddress) as PollenToken;
  await pollenToken.deployed();

  // deploy vePLN
  const _vePLN = await hre.ethers.getContractFactory('LockedPollen');
  const vePLN = await _vePLN.deploy(pollenDAOImplementation.address, pollenToken.address) as LockedPollen;
  await vePLN.deployed();

  const Minter = await hre.ethers.getContractFactory('Minter');
  const minter = await Minter.deploy() as Minter;
  await minter.deployed();

  const Portfolio = await hre.ethers.getContractFactory('Portfolio');
  const portfolio = await Portfolio.deploy() as Portfolio;
  await portfolio.deployed();

  const Quoter = await hre.ethers.getContractFactory('Quoter');
  const quoter = await Quoter.deploy() as Quoter;
  await quoter.deployed();

  const Governance = await hre.ethers.getContractFactory('Governance');
  const governance = await Governance.deploy() as Governance;
  await governance.deployed();

  const pollenDAO = await hre.ethers.getContractAt('IPollenDAO', pollenDAOImplementation.address) as IPollenDAO;

  // Get module selectors
  const minterSelectors = getSelectors(Minter.interface);
  const portfolioSelectors = getSelectors(Portfolio.interface);
  const quoterSelectors = getSelectors(Quoter.interface);
  const governanceSelectors = getSelectors(Governance.interface);

  // Initialize DAO and add modules
  await pollenDAO.setPollenTokens(pollenToken.address, vePLN.address);
  await pollenToken.setDaoAddress(pollenDAOImplementation.address);
  await pollenDAO.addModule(minter.address, minterSelectors);
  await pollenDAO.addModule(quoter.address, quoterSelectors);
  await pollenDAO.addModule(portfolio.address, portfolioSelectors);
  await pollenDAO.addModule(governance.address, governanceSelectors);

  const contracts: Contracts = {
    pollenDAO,
    pollenToken,
    vePLN
  };

  return contracts;
}
