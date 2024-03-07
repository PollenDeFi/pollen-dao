import chai from 'chai';
import { ethers, waffle } from 'hardhat';

import {
  PollenDAO,
  PollenToken,
  LockedPollen,
  Quoter,
  Minter,
  MockGetters,
  IPollenDAO
} from '../typechain';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';
import { ZERO_ADDRESS } from './helpers/constants';
import { getSelectors } from './helpers/functions';
import { BytesLike } from 'ethers';

const { expect } = chai;
const { solidity } = waffle;
const provider = waffle.provider;

chai.use(solidity);

describe('PollenDAO', function () {
  let snapshot: string;
  let pollenDAOImplementation: PollenDAO;
  let pollenDAO: IPollenDAO;
  let pollenToken: PollenToken;
  let vePLN: LockedPollen;
  let mockGettersImplementation: MockGetters;
  let newMinterSelectors: BytesLike[];
  let minterSelectors: BytesLike[];
  let minterImplementation: Minter;
  let newMinterImplementation: Minter;
  let quoterImplementation: Quoter;
  let quoterSelectors: BytesLike[];

  const [
    admin,
    user,
    newOwner
  ] = provider.getWallets();

  before(async () => {
    // Deploy PollenDAO Implementation        
    const PollenDAO = await ethers.getContractFactory('PollenDAO');
    pollenDAOImplementation = await PollenDAO.deploy() as PollenDAO;
    await pollenDAOImplementation.deployed();

    const PollenToken = await ethers.getContractFactory('PollenToken');
    pollenToken = await PollenToken.deploy(admin.address) as PollenToken;
    await pollenToken.deployed();

    // deploy vePLN
    const _vePLN = await ethers.getContractFactory('LockedPollen');
    vePLN = await _vePLN.deploy(pollenDAOImplementation.address, pollenToken.address) as LockedPollen;
    await vePLN.deployed();

    //deploy modules
    const Portfolio = await ethers.getContractFactory('Portfolio');
    const portfolioImplementation = await Portfolio.deploy();
    await portfolioImplementation.deployed();

    const Quoter = await ethers.getContractFactory('Quoter');
    quoterImplementation = await Quoter.deploy() as IPollenDAO;
    await quoterImplementation.deployed();

    const Minter = await ethers.getContractFactory('Minter');
    minterImplementation = await Minter.deploy() as Minter;
    await minterImplementation.deployed();

    newMinterImplementation = await Minter.deploy() as Minter;
    await newMinterImplementation.deployed();

    const MockGetters = await ethers.getContractFactory('MockGetters');
    mockGettersImplementation = await MockGetters.deploy() as MockGetters;
    await mockGettersImplementation.deployed();

    // deploy modules selectors
    const portfolioSelectors = getSelectors(Portfolio.interface);
    const mockGettersSelectors = getSelectors(MockGetters.interface);
    quoterSelectors = getSelectors(Quoter.interface);
    minterSelectors = getSelectors(Minter.interface);
    newMinterSelectors = getSelectors(Minter.interface);

    pollenDAO = await ethers.getContractAt('IPollenDAO', pollenDAOImplementation.address) as IPollenDAO;

    await pollenDAO.setPollenTokens(pollenToken.address, vePLN.address);

    // set Dao in token contract
    await pollenToken.setDaoAddress(pollenDAOImplementation.address);
    await pollenDAO.addModule(portfolioImplementation.address, portfolioSelectors);
    await pollenDAO.addModule(mockGettersImplementation.address, mockGettersSelectors);
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });

  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('daoAdmin', async function () {
    it('Should return correct owner after deployment', async function () {
      const isAdmin = await pollenDAO.isAdmin(admin.address);
      expect(isAdmin).to.be.true;
    });
  });

  describe('setPollenToken', async function () {
    it('Should revert if not called by the admin', async function () {
      await expect(pollenDAO.connect(user).setPollenTokens(pollenToken.address, vePLN.address))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if pollenToken is the zero address', async function () {
      await expect(pollenDAO.connect(admin).setPollenTokens(ZERO_ADDRESS, vePLN.address))
        .to.be.revertedWith('PLN cannot be zero address');
    });
    it('Should revert if vePLN address is zero address', async () => {
      // TODO
    });
    it('Should allow admin to set PollenToken address', async function () {
      await pollenDAO.connect(admin).setPollenTokens(pollenToken.address, vePLN.address);
      expect((await pollenDAO.pollenToken())).to.eq(pollenToken.address);
      // TODO check vePLN address
    });
    it('Should emit PollenTokenSet event with the correct params', async function () {
      await expect(pollenDAO.connect(admin).setPollenTokens(pollenToken.address, vePLN.address))
        .to.emit(pollenDAOImplementation, 'PollenTokenSet')
        .withArgs(pollenToken.address, vePLN.address);
    });
  });

  describe('transferAdminRole', async function () {
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(pollenDAO.connect(user).transferAdminRole(user.address))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if the new owner is the zero address', async function () {
      await expect(pollenDAO.connect(admin).transferAdminRole(ZERO_ADDRESS))
        .to.be.revertedWith('newAdmin cannot be zero address');
    });
    it('Should correctly set the new owner', async function () {
      const newOwnerAdminBefore = await pollenDAO.isAdmin(newOwner.address);

      await pollenDAO.connect(admin).transferAdminRole(newOwner.address);

      const newOwnerAdminAfter = await pollenDAO.isAdmin(newOwner.address);

      expect(newOwnerAdminBefore).to.be.false;
      expect(newOwnerAdminAfter).to.be.true;
    });
    it('Should emit AdminRoleTransferred event with the correct params', async function () {
      await expect(pollenDAO.connect(admin).transferAdminRole(newOwner.address))
        .to.emit(pollenDAOImplementation, 'AdminRoleTransferred')
        .withArgs(admin.address, newOwner.address);
    });
  });

  describe('addModule', async function () {
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(pollenDAO.connect(user).addModule(quoterImplementation.address, quoterSelectors))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if the new module is already registered', async function () {
      await pollenDAO.connect(admin).addModule(quoterImplementation.address, quoterSelectors);
      await expect(pollenDAO.connect(admin).addModule(quoterImplementation.address, quoterSelectors))
        .to.be.revertedWith('Selector already registered');
    });
    it('Should correctly register a new module', async function () {
      await pollenDAO.connect(admin).addModule(minterImplementation.address, minterSelectors);
      expect(await pollenDAO.isRegisteredModule(minterImplementation.address, minterSelectors)).to.be.true;
    });
    it('Should emit ModuleAdded event with the correct params', async function () {
      await expect(pollenDAO.connect(admin).addModule(minterImplementation.address, minterSelectors))
        .to.emit(pollenDAOImplementation, 'ModuleAdded')
        .withArgs(minterImplementation.address, minterSelectors);
    });
  });

  describe('updateModule', async function () {
    it('Should revert if not called by the ProxyAdmin', async function () {
      await expect(pollenDAO.connect(user).updateModule(newMinterImplementation.address, minterImplementation.address, newMinterSelectors, minterSelectors))
        .to.be.revertedWith('Admin access required');
    });
    it('Should revert if the old module is not registered', async function () {
      await expect(pollenDAO.connect(admin).updateModule(newMinterImplementation.address, minterImplementation.address, newMinterSelectors, minterSelectors))
        .to.be.revertedWith('Invalid selector list');
    });
    it('Should correctly update a new module', async function () {
      await pollenDAO.connect(admin).addModule(minterImplementation.address, minterSelectors);
      await pollenDAO.connect(admin).updateModule(newMinterImplementation.address, minterImplementation.address, newMinterSelectors, minterSelectors);
      expect(await pollenDAO.isRegisteredModule(newMinterImplementation.address, newMinterSelectors)).to.be.true;
    });
    it('Should correctly unregister the old module', async function () {
      await pollenDAO.connect(admin).addModule(minterImplementation.address, minterSelectors);
      await pollenDAO.connect(admin).updateModule(newMinterImplementation.address, minterImplementation.address, newMinterSelectors, minterSelectors);
      expect(await pollenDAO.isRegisteredModule(minterImplementation.address, minterSelectors)).to.be.false;
    });
    it('Should emit ModuleUpdated event with the correct params', async function () {
      await pollenDAO.connect(admin).addModule(minterImplementation.address, quoterSelectors);
      expect(await pollenDAO.connect(admin).updateModule(newMinterImplementation.address, minterImplementation.address, newMinterSelectors, quoterSelectors))
        .to.emit(pollenDAOImplementation, 'ModuleUpdated')
        .withArgs(newMinterImplementation.address, minterImplementation.address, newMinterSelectors, quoterSelectors);
    });
  });
});
