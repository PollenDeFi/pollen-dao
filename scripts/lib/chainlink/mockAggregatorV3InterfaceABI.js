/**
 * ABI for `MockPriceOracle` contract (that emulates `AggregatorV3Interface` by Chainlink)
 *
 * @namespace MockAggregatorV3InterfaceABI
 * @typedef {import('./aggregatorV3InterfaceABI').Abi}
 */

const aggregatorV3Interface = require("./aggregatorV3InterfaceABI");

/** @type {Abi} module.exports */
module.exports = [ ...aggregatorV3Interface,
  {
    "inputs": [],
    "name": "getOwner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getUpdater",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "updater",
        "type": "address"
      }
    ],
    "name": "changeUpdater",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "version",
        "type": "uint32"
      },
      {
        "internalType": "uint8",
        "name": "decimals",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint80",
        "name": "roundId",
        "type": "uint80"
      },
      {
        "internalType": "int256",
        "name": "answer",
        "type": "int256"
      },
      {
        "internalType": "uint256",
        "name": "updatedAt",
        "type": "uint256"
      }
    ],
    "name": "setRoundData",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
];
