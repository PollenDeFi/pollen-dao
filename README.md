Repository for the Investment Fund DAO - DApp and smart contracts

## Development
1- Set the following environment variables:

```
INFURA_KEY (your Infure API key)
HD_MNEMONIC (your ETH wallet private key which will act as the contract owner)

```

2- Execute testnet-console script to interact with the Ropsten deployment. After the console opens up, run the following line to define the contract instance.

```
const instance = await this.AudacityDAO.at(DAO_CONTRACT_ADDRESS)
```

Where DAO_CONTRACT_ADDRESS is the address of the deployed contract on said network.

2- Use the contract instance to call the contract functions.
For the first run, you need to submit an invest proposal and execute it to get tokens.

```
await instance.submit(0, 0, DAO_CONTRACT_ADDRESS, 1, this.web3.utils.toBN('1000000000000000000'))
await instance.execute(0)
```
