import { ethers } from 'hardhat';

const RESERVE_ADDRESS = '0x5DA50322a6269431d220F2E014970A99f89f071e';
const PollenTokenAddress = '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf';

async function transferOwnership(newOwner: string) {
  console.log(`Transfering ownership to ${newOwner}...`);
  const PollenToken = await ethers.getContractFactory('PollenToken');
  const pollenToken = PollenToken.attach(PollenTokenAddress);

  (await pollenToken.transferOwnership(newOwner)).wait();

  console.log('Ownership transfered');
}

async function main() {
  // deploy PollenToken
  const PollenToken = await ethers.getContractFactory('PollenToken');
  console.log('Deploying PollenToken...');
  const pollenToken = await PollenToken.deploy(RESERVE_ADDRESS);
  await pollenToken.deployed();
  console.log('PollenToken deployed to:', pollenToken.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });