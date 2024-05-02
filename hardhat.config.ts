import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@solarity/hardhat-migrate';
import '@typechain/hardhat';
import * as dotenv from 'dotenv';
import 'dotenv/config';
import 'hardhat-abi-exporter';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'hardhat-storage-layout';
import 'solidity-coverage';

dotenv.config();

function privateKey() {
  return process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [];
}

// const dummyPrivateKey = '1234567890123456789012345678901234567890123456789012345678901234';
const dummyAPIKey = '12345678912345678912345678912345';
const dummyMnemonic = 'test test test test test test test test test test test test';

// const privateKey = [process.env.PRIVATE_KEY_1 || dummyPrivateKey];
const mnemonic = { mnemonic: process.env.MNEMONIC || dummyMnemonic };
const apiKey = process.env.NODE_API_KEY || dummyAPIKey;
const moralisApiKey = process.env.MORALIS_SPEED_NODE_KEY || dummyAPIKey;
const etherscanAPIKey = process.env.ETHERSCAN_API_KEY;
const priceFeedAPIKey = process.env.COINMARKETCAP_API_KEY;

export default {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout']
        }
      }
    }
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      // initialBaseFeePerGas: 0 // workaround from https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136 . Remove when that issue is closed.
      forking: {
        url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        accounts: privateKey(),
      }
    },
    localhost: {
      url: 'http://127.0.0.1:8545'
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${apiKey}`,
      accounts: mnemonic
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${apiKey}`,
      accounts: mnemonic,
      gasLimit: 800000,
      gasPrice: 100000000000
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${apiKey}`,
      accounts: mnemonic,
      gasLimit: 800000,
      gasPrice: 10000000000
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${apiKey}`,
      accounts: mnemonic,
      gasPrice: 100000000000
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${apiKey}`,
      accounts: mnemonic
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: mnemonic
    },
    fuji: {
      url: 'https://avalanche-fuji-c-chain.publicnode.com',
      accounts: mnemonic
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: privateKey(),
      gasMultiplier: 1.2
    },
    polygon: {
      url: 'https://polygon-pokt.nodies.app',
      chainId: 137,
      accounts: mnemonic
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com/',
      accounts: privateKey(),
      gasMultiplier: 1.2
    },
    snowtrace: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: privateKey()
    },
    baseSepolia: {
      url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      accounts: privateKey(),
      gasMultiplier: 1.1
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false, //process.env.CONTRACT_SIZER !== undefined,
    disambiguatePaths: false
  },
  gasReporter: {
    enabled: false, //process.env.REPORT_GAS !== undefined,
    currency: 'USD',
    coinmarketcap: `${priceFeedAPIKey}`
  },
  abiExporter: {
    path: './abis',
    flat: true
  },
  plugins: ['solidity-coverage'],
  mocha: {
    timeout: 500000
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: true,
    discriminateTypes: true
  },
  migrate: {
    pathToMigrations: './deploy/',
    only: 5
  },
  etherscan: {
    apiKey: {
      goerli: `${process.env.ETHERSCAN_KEY}`,
      sepolia: `${process.env.ETHERSCAN_KEY}`,
      mainnet: `${process.env.ETHERSCAN_KEY}`,
      bscTestnet: `${process.env.BSCSCAN_KEY}`,
      bsc: `${process.env.BSCSCAN_KEY}`,
      polygonMumbai: `${process.env.POLYGONSCAN_KEY}`,
      polygon: `${process.env.POLYGONSCAN_KEY}`,
      avalancheFujiTestnet: `${process.env.AVALANCHE_KEY}`,
      avalanche: `${process.env.AVALANCHE_KEY}`,
      snowtrace: `${process.env.AVALANCHE_KEY}`,
      arbitrumGoerli: `${process.env.ETHERSCAN_KEY}`,
      arbitrumSepolia: `${process.env.ETHERSCAN_KEY}`,
      baseSepolia: `${process.env.BASE_KEY}`
    },
    customChains: [
      {
        network: 'snowtrace',
        chainId: 43114,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan',
          browserURL: 'https://snowtrace.io'
        }
      }
    ]
  }
};
