require('babel-register');
require('babel-polyfill');
const HDWalletProvider = require('@truffle/hdwallet-provider');
require("dotenv").config();
const infuraKey = process.env.INFURA_KEY;
const mnemonic = process.env.HD_MNEMONIC;
const privKey = process.env.PRIVKEY;

module.exports = {
  networks: {
    "pln-chain": {           // "sandbox" network for dev/tests (note `scripts/start-pln-chain.sh`)
      host: "127.0.0.1",
      port: 8555,
      network_id: "2020",
      gas: 5500000,
      contracts: {           // expected addresses (for migration/test scripts)
        proxyAdmin: "0xcCD9C9c3BBf5939423909e9F8EC86a5d3F5f1198",
        proxies: {
          Pollen: "0xd6855115e271e03cc99Ed2F33a6707C8775279a0",
          PollenDAO: "0x4fc3D94c0B52723610864Fd21AE121403975E8A5",
        },
        implementations: {
          Pollen: "0x00D9ddc02A52C5FbFb2fb9615CD4C4Cd8940E5Ad",
          PollenDAO: "0xE36f5cF652a91048F903E4F074afeAedBd8287f4",
        }
      },
    },

    "local-node": {          // arbitrary Ethereum RPC-node
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
      contracts: { }         // May need to be defined, depending on the chain connected
    },
    development: {           // for use with 'truffle develop --log'
      host: "127.0.0.1",
      port: 9545,
      network_id: "*",
      contracts: { }         // Left empty: don't expect addresses remain unchanged on restarts
    },

    ropsten: {
      provider: () => new HDWalletProvider(privKey || mnemonic, `https://ropsten.infura.io/v3/${infuraKey}`),
      network_id: 3,       // Ropsten's id
      gas: 5500000,        // Ropsten has a lower block limit than mainnet
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true,    // Skip dry run before migrations? (default: false for public nets )

      contracts: {         // addresses of deployed contracts
        proxyAdmin: "0xd4A171fe0B39d0120BeEc0ea81b3c06896735Bc4",
        proxies: {
          Pollen: "0xe88B849FD0109e5d9A943A42EED98c5507c32E01",
          PollenDAO: "0x58cdDaaCae33f2df3DE8ffe20B07C67ed310aAc6",
          MockPriceOracle: {
            "r:ethUsd": "0x71271d853A665758b8E81bE8cd54B9a54877321e",
            "r:compUsd": "0xC9e417fbF07019b7cCDA6f83D0bc6073F5B4819E",
            "r:daiEth": "0x6f4a9e4057A99De37537acC02968B2B2c8e575B4",
            "r:lendEth": "0xeE44558Ef55f4f7890ED66cd89d4367051e0cF9d",
            "r:snxEth": "0x87199Ffc02BD459331E1422bbaC1A171262e5744",
            "r:plnEth": "0x382975824786BF53e5Ad4726b51F89959218d0Ec",
            "r:mkrEth": "0x75064F1347FB6196EF8f6B53120630281ba6cb35",
          },
        },
        implementations: {
          Pollen: "0xbef545Ec09386B1aB34e84C48e7CD431678190Dd",
          PollenDAO: "0x74Ebe39599a26C2B9410607E2F6e4f71FFC3bFFE",
          MockPriceOracle: "0xF95E66Dd3eEc8f545090C16398b78ceD0C0004af",
        }
      },
    },

    mainnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://mainnet.infura.io/v3/${infuraKey}`),
      network_id: 1,       // Live's id
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)

      // TODO:as soon as contract deployed on the mainnet, define expected addresses
      contracts: {         // addresses of the contracts on the mainnet
        proxyAdmin: "",
        proxies: {
          Pollen: "",
          PollenDAO: "",
        },
        implementations: {
          Pollen: "",
          PollenDAO: "",
        }
      },
    },
  },

  mocha: {
    timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "^0.6.2",    // Fetch latest 6.x.x version
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "istanbul"
      }
    }
  },

  contracts_build_directory: "artifacts/contracts"
}
