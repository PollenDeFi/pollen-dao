import { ethers } from 'hardhat';

async function main() {
  // mumbai
  const pollenDAO = await ethers.getContractAt('IPollenDAO', '0x56e292C0016ad6D04FaB2eE3C586d2a1d1ab8035');
  // fuji
  //   const pollenDAO = await ethers.getContractAt('IPollenDAO', '0x74Be1B7fdF080e913f1B358aB30cF1758c185cc0');

  console.log(await pollenDAO.pollenToken());
  // console.log(await pollenDAO.getTimeLock());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// npx hardhat run scripts/test.ts --network mumbai
