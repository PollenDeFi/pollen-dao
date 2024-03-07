import { ethers } from 'hardhat';

// Rinkeby
// const names = ['Cosmos', 'Basic Attention Token', 'Binance Coin', 'Dai Stablecoin', 'Chainlink Token', 'Augur', 'Synthetix', 'USDC Stablecoin', 'Synth sCEX', 'Synth sDEFI', 'Wrapped Bitcoin', 'Wrapped Litecoin'];
// const symbols = ['ATOM', 'BAT', 'BNB', 'DAI', 'LINK', 'REP', 'SNX', 'USDC', 'sCEX', 'sDEFI', 'WBTC', 'WLTC'];

// Kovan
// const names = ['Basic Attention Token', 'Binance Coin', 'Compound', 'Dai Stablecoin', 'KingDeFi', 'Chainlink Token', 'Augur', 'Synthetix', 'Uniswap', 'USDC Stablecoin', 'USDT Stablecoin', 'sCEX', 'sDEFI', 'Wrapped Bitcoin', 'Wrapped Ethereum', 'Wrapped Litecoin', 'Ripple'];
// const symbols = ['BAT', 'BNB', 'COMP', 'DAI', 'KRW', 'LINK', 'REP', 'SNX', 'UNI', 'USDC', 'USDT', 'sCEX', 'sDEFI', 'WBTC', 'WETH', 'WLTC', 'XRP'];

// Fuji
const names = ['Avalanche Token', 'Chainlink Token', 'USDT Stablecoin', 'Wrapped Bitcoin', 'Wrapped Ethereum'];
const symbols = ['AVAX', 'LINK', 'USDT', 'WBTC', 'WETH'];

async function main () {
  for (let i = 0; i < names.length; i++) {
    // deploy Token contract
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    console.log(`Deploying ${symbols[i]}...`);
    const mockErc20 = await MockERC20.deploy(names[i], symbols[i]);
    await mockErc20.deployed();
    console.log(`${symbols[i]} deployed to:`, mockErc20.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });