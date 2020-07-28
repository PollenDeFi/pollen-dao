Pollen DAO
===================

Repository for the Pollen DAO - DApp and smart contracts

Development
===========

1- Set the following environment variables:

```
INFURA_KEY (your Infure API key)
HD_MNEMONIC (your ETH wallet private key which will act as the contract owner)

```

2- Execute testnet-console script to interact with the Ropsten deployment. After the console opens up, run the following code line by line to define the asset token contract and DAO contract instances and mint some asset tokens.
> E.g., mint 1200 asset tokens.

```
const assetToken = await MockERC20.deployed()
await assetToken.mint(this.web3.utils.toBN('1200000000000000000000'))
const dao = await PollenDAO.deployed()
```

2- Use the contract instance to call the contract functions.
For the first run, you need to submit an invest proposal then execute it to send a defined amount of asset tokens in exchange for a defined amount of Pollens.
> E.g., get 1000 Pollens in exchange for 200 asset tokens.

```
await dao.submit(0, 0, assetToken.address, this.web3.utils.toBN('200000000000000000000'), this.web3.utils.toBN('1000000000000000000000'))
await assetToken.approve(dao.address, this.web3.utils.toBN('200000000000000000000'))
await dao.execute(0)
```
