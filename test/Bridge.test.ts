import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { getSelectors } from './helpers/functions';
import { createSnapshot, revertToSnapshot } from './helpers/snapshot';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BridgeReceiver, BridgeSender, IPollenDAO, MockLZInterface, PollenToken } from '../typechain';

const { solidity } = waffle;
chai.use(solidity);

describe('Bridge', function () {
  const srcId = 1111;
  const dstId = 2222;
  const FAKE_VEPLN = '0x1111111111111111111111111111111111111111';

  let snapshot: string;

  let pln1: PollenToken;
  let pln2: PollenToken;
  let dao1: Contract;
  let dao2: Contract;
  let sourceLz: MockLZInterface;
  let destinationLz: MockLZInterface;
  let bridge1: BridgeSender;
  let bridge2: BridgeReceiver;

  before(async () => {
    const [deployer] = await ethers.getSigners();

    // START setup PollenDAO and PollenToken
    // Deploy PollenDAO on first and second chain
    const PollenDAO = await ethers.getContractFactory('PollenDAO');
    dao1 = (await PollenDAO.deploy()) as IPollenDAO;
    dao2 = (await PollenDAO.deploy()) as IPollenDAO;
    await dao1.deployed();
    await dao2.deployed();

    // Deploy PollenToken on first and second chain
    const PollenToken = await ethers.getContractFactory('PollenToken');
    pln1 = (await PollenToken.deploy(deployer.address)) as PollenToken;
    pln2 = (await PollenToken.deploy(deployer.address)) as PollenToken;
    await pln1.deployed();
    await pln2.deployed();

    // Setup relations between PollenDAO and PollenToken on first network
    await dao1.connect(deployer).setPollenTokens(pln1.address, FAKE_VEPLN);
    await pln1.connect(deployer).setDaoAddress(dao1.address);

    // Setup relations between PollenDAO and PollenToken on first network
    await dao2.connect(deployer).setPollenTokens(pln2.address, FAKE_VEPLN);
    await pln2.connect(deployer).setDaoAddress(dao2.address);
    // END

    // START setup bridges
    const MockInterface = await ethers.getContractFactory('MockLZInterface');

    sourceLz = (await MockInterface.deploy(srcId)) as MockLZInterface;
    destinationLz = (await MockInterface.deploy(dstId)) as MockLZInterface;
    await sourceLz.deployed();
    await destinationLz.deployed();

    const BridgeSender = await ethers.getContractFactory('BridgeSender');
    const BridgeReceiver = await ethers.getContractFactory('BridgeReceiver');
    bridge1 = (await BridgeSender.deploy(dao1.address, dstId, dao2.address, sourceLz.address)) as BridgeSender;
    bridge2 = (await BridgeReceiver.deploy()) as BridgeReceiver;
    await bridge1.deployed();
    await bridge2.deployed();

    await (await sourceLz.setDestLzEndpoint(dao2.address, destinationLz.address)).wait();

    await (await dao1.addModule(bridge1.address, getSelectors(BridgeSender.interface))).wait();
    await (await dao2.addModule(bridge2.address, getSelectors(BridgeReceiver.interface))).wait();

    dao1 = new ethers.Contract(dao1.address, [...dao1.interface.fragments, 'function burnPollen(address,uint256)']);

    dao2 = new ethers.Contract(dao2.address, [
      ...dao2.interface.fragments,
      'function setBridgeReceiverStorage(uint16,address,address)',
      'function retryMessage(uint16,bytes,uint64,bytes)',
      'function lzReceive(uint16,bytes,uint64,bytes)'
    ]);

    await dao2
      .connect(deployer)
      ['setBridgeReceiverStorage(uint16,address,address)'](srcId, bridge1.address, destinationLz.address);
    // END
  });

  beforeEach(async () => {
    snapshot = await createSnapshot();
  });

  afterEach(async () => {
    await revertToSnapshot(snapshot);
  });

  describe('BridgeSender', () => {
    describe('#burnAndBridgePollen', () => {
      it('Should burn and bridge tokens', async () => {
        const [deployer] = await ethers.getSigners();
        const amount = ethers.utils.parseEther('1');

        await pln1.approve(dao1.address, amount);

        const pln1BalanceBefore = await pln1.balanceOf(deployer.address);
        const pln2BalanceBefore = await pln2.balanceOf(deployer.address);

        await bridge1.connect(deployer).burnAndBridgePollen(amount, {
          value: ethers.utils.parseEther('1')
        });

        expect(await pln1.balanceOf(deployer.address)).to.eq(pln1BalanceBefore.sub(amount));
        expect(await pln2.balanceOf(deployer.address)).to.eq(pln2BalanceBefore.add(amount));
      });
      it('Should fail when amount is invalid', async () => {
        const [deployer] = await ethers.getSigners();

        await expect(bridge1.connect(deployer).burnAndBridgePollen(0)).to.be.revertedWith('Invalid amount');
      });
    });

    describe('#burnPollen', () => {
      it('Should burn tokens from main token holder', async () => {
        const [deployer] = await ethers.getSigners();
        const amount = ethers.utils.parseEther('1');

        await pln1.approve(dao1.address, amount);

        await expect(() =>
          dao1.connect(deployer)['burnPollen(address,uint256)'](deployer.address, amount)
        ).to.changeTokenBalance(pln1, deployer, amount.mul(-1));
      });
      it('Should burn tokens from custom holder', async () => {
        const [, john] = await ethers.getSigners();
        const amount = ethers.utils.parseEther('100');

        await pln1.transfer(john.address, amount);
        await pln1.connect(john).approve(dao1.address, amount);
        expect(await pln1.balanceOf(john.address)).to.eq(amount);

        await expect(() =>
          dao1.connect(john)['burnPollen(address,uint256)'](john.address, amount)
        ).to.changeTokenBalance(pln1, john, amount.mul(-1));
      });
    });

    describe('#setBridgeReceiverStorage', () => {
      it('Should fail when function calls not by admin', async () => {
        const [, john] = await ethers.getSigners();

        await expect(
          dao2
            .connect(john)
            ['setBridgeReceiverStorage(uint16,address,address)'](srcId, dao1.address, destinationLz.address)
        ).to.be.revertedWith('Admin access required');
      });
    });
  });

  describe('BridgeReceiver', () => {
    describe('#lzReceive', () => {
      it('Should fail when function calls not by gateway', async () => {
        const [, john] = await ethers.getSigners();
        await expect(dao2.connect(john).lzReceive(srcId, '0x', 0, '0x')).to.be.revertedWith('Invalid gateway');
      });
    });

    describe('#nonblockingLzReceive', () => {
      it('Should fail when function calls not by bridge receiver itself', async () => {
        const [, john] = await ethers.getSigners();

        await expect(bridge2.connect(john).nonblockingLzReceive(srcId, '0x', 0, '0x')).to.be.revertedWith(
          'Invalid caller'
        );
      });
    });

    describe('#retryMessage', () => {
      let senderAndReceiverAddresses: string;
      let payload: string;
      let deployer: SignerWithAddress;
      let john: SignerWithAddress;

      beforeEach(async () => {
        [deployer, john] = await ethers.getSigners();
        senderAndReceiverAddresses = ethers.utils.solidityPack(
          ['address', 'address'],
          [deployer.address, dao2.address]
        );
        payload = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [john.address, 1]);

        await dao2
          .connect(deployer)
          ['setBridgeReceiverStorage(uint16,address,address)'](srcId, john.address, deployer.address);

        // Fail this call
        await dao2.connect(deployer).lzReceive(srcId, senderAndReceiverAddresses, 1, payload);
      });

      it('Should retry message', async () => {
        await dao2
          .connect(deployer)
          ['setBridgeReceiverStorage(uint16,address,address)'](srcId, deployer.address, deployer.address);

        await expect(() =>
          dao2.connect(deployer).retryMessage(srcId, senderAndReceiverAddresses, 1, payload)
        ).to.changeTokenBalance(pln2, john, 1);
      });
      it('Should fail when chainId is invalid', async () => {
        await dao2
          .connect(deployer)
          ['setBridgeReceiverStorage(uint16,address,address)'](0, deployer.address, deployer.address);

        await expect(
          dao2.connect(deployer).retryMessage(srcId, senderAndReceiverAddresses, 1, payload)
        ).to.be.revertedWith('Invalid sender chain ID');
      });
      it('Should fail when no stored messages', async () => {
        await expect(
          dao2.connect(deployer).retryMessage(srcId, senderAndReceiverAddresses, 2, payload)
        ).to.be.revertedWith('No stored message');
      });
      it('Should fail when hash is invalid', async () => {
        const payload = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [john.address, 2]);

        await expect(
          dao2.connect(deployer).retryMessage(srcId, senderAndReceiverAddresses, 1, payload)
        ).to.be.revertedWith('Invalid payload');
      });
    });
  });
});

// npx hardhat test "test/Bridge.test.ts"
