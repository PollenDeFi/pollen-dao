import chai from 'chai';
import { ethers, waffle } from 'hardhat';

import { PollenToken, IPollenDAO, LockedPollen } from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

const INITIAL_SUPPLY = '94000000000000000000000000';
const TOKEN_NAME = 'Pollen';
const TOKEN_SYMBOL = 'PLN';

describe('PollenToken', async function () {
  let pollenDAO: IPollenDAO;
  let pollenToken: PollenToken;
  let snapshot: string;

  const [
    admin,
    user,
  ] = provider.getWallets();

  before(async () => {
    // Deploy pollen token
    const PollenToken = await ethers.getContractFactory('PollenToken');
    pollenToken = await PollenToken.deploy(admin.address) as PollenToken;
    await pollenToken.deployed();

    // Deploy PollenDAO Implementation        
    const PollenDAO = await ethers.getContractFactory('PollenDAO');
    const pollenDAOImplementation = await PollenDAO.deploy() as IPollenDAO;
    await pollenDAOImplementation.deployed();

    // deploy vePLN
    const _vePLN = await hre.ethers.getContractFactory('LockedPollen');
    const vePLN = await _vePLN.deploy(pollenDAOImplementation.address, pollenToken.address) as LockedPollen;
    await vePLN.deployed();

    // instantiate full pollenDao
    pollenDAO = await ethers.getContractAt('IPollenDAO', pollenDAOImplementation.address) as IPollenDAO;
    await pollenDAO.setPollenTokens(pollenToken.address, vePLN.address);
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });

  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('Setup', function () {
    it('Should return the correct token name', async function () {
      expect(await pollenToken.name()).to.eq(TOKEN_NAME);
    });
    it('Should return the correct token symbol', async function () {
      expect(await pollenToken.symbol()).to.eq(TOKEN_SYMBOL);
    });
    it('Should have the correct initial supply', async function () {
      expect((await pollenToken.totalSupply()).toString()).to.eq(INITIAL_SUPPLY);
    });
  });

  describe('setDaoAddress', function () {
    it('Should revert if not called by the Owner', async function () {
      await expect(pollenToken.connect(user).setDaoAddress(pollenDAO.address))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should revert if the DAO contract address has already been set', async function () {
      await pollenToken.connect(admin).setDaoAddress(pollenDAO.address);
      await expect(pollenToken.connect(admin).setDaoAddress(pollenDAO.address))
        .to.be.revertedWith('Pollen: DAO address has already been set');
    });
    it('Should allow the admin to set the DAO contract address', async function () {
      await expect(pollenToken.connect(admin).setDaoAddress(pollenDAO.address))
        .to.not.be.reverted;
    });
  });

  describe('mint', function () {
    const mintAmount = 100;
    it('Should revert if not called by the DAO', async function () {
      await expect(pollenToken.connect(admin).mint(user.address, mintAmount))
        .to.be.revertedWith('Pollen: only callable by DAO contract');
    });
  });

  describe('burn', function () {
    const burnAmount = 100;
    it('Should revert if not called by the DAO', async function () {
      await expect(pollenToken.connect(admin).burn(burnAmount))
        .to.be.revertedWith('Pollen: only callable by DAO contract');
    });
  });
});