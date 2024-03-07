const hre = require('hardhat'); // eslint-disable-line

async function main() {
  await hre.storageLayout.export();
}

main();