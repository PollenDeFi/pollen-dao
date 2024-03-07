<div align="center">
   <img src="/assets/Pollen_logo.svg" alt="Pollen logo" width="300"/>
</div>

## Introduction

[Pollen](https://pollen.id/) introduces a fully decentralized asset management protocol ushering in the evolution of community investing. The Pollen protocol implements an automated liquidity protocol and asset governance model designed to democratize asset portfolio management.

<div align="center">
   <img src="/assets/architecture1.png" alt="Pollen High-level Architecture"/>
</div>

Please join the [community Discord server](https://discord.gg/sT2aUGes); our team and members of the community look forward to assisting you!

## Architecture

Let's take a look at the smart contracts that make up the the Pollen protocol.

<div align="center">
   <img src="/assets/architecture-breakdown.png" alt="Pollen High-level Architecture"/>
</div>

**PLN Token**: The Pollen ($PLN) governance token is at the core of all activity in the Pollen DeFi ecosystem. The main functions of the Pollen governance token (you can learn more about the $PLN token here):

* Allow users to actively manage virtual portfolios on the platform and, if they make good decisions, to earn $PLN as rewards. If they make bad decisions, $PLN will be burned.
* Allow passive delegators to delegate their $PLN tokens to the best performing traders and share $PLN tokens as rewards for good decisions made.
* Allow users to stake $PLN for extended periods of time in order to create fully-backed asset pools

**Pollen DAO**: The Pollen DAO is used by the Pollenator community to manage and govern the Pollen ecosystem. The Pollen DAO contract acts as a proxy.

**Pollen DAO Modules**: The Pollen DAO modules are contracts that contain the Pollen DAO's implementation logic. They are segmented by the types of operations they execute (i.e., portfolio management, $PLN rewards / penalties, governance, price feeds, etc.) This makes the codebase and protocol structured in a way that is ultra-composable, readable, and intuitive. Pollen DAO modules can be added, removed, and updated through governance. When functions in the modules are called via `delegatecall` they execute in the storage of the Pollen DAO.

**Asset Pool Factory**: The Asset Pool factory smart contract enables users to launch and govern their own fully backed asset pools. All asset pools are launched independent of the Pollen DAO and are backed by $PLN tokens locked as collateral. The $PLN tokens necessary to launch an asset pool must meet a minimum capitalization threshold and be locked for a certain period of time. This is done to optimize for high-quality asset pools.

<div align="center">
   <img src="/assets/factory.png" alt="Asset Pool Factory"/>
</div>

**Asset Pools**: Asset Pools are fully backed portfolios of assets that are managed with different allocation strategies. Each asset pool contract that is deployed by the Asset Pool Factory acts as a proxy, similar to the Pollen DAO. When it comes to securing assets and rebalancing, the asset pools utilize liquidity pools to fulfill orders. Through governance, asset pool users can determine if they'd like to subscribe to investment intelligence or "signals". These signals are generated using data from how the Pollen community manages their virtual portfolios.

**Asset Pool Modules**: The Asset Pool modules are contracts that contain the implementation logic for the asset pools. Similar to the Pollen DAO modules, the asset pool modules are segmented by the types of operations they execute (i.e., portfolio management, governance, price feeds, etc.) Again, this makes the codebase and protocol structured in a way that is ultra-composable, readable, and intuitive. Asset Pool modules can be added, removed, and updated through governance. When functions in the modules are called via delegatecall they execute in the storage of their corresponding asset pool contract.

**Asset Pool Tokens**: Each asset pool has its own corresponding asset pool token contract. The asset pool tokens are used to represent the participation and value of an individual's position in a particular asset pool.

For more details, please check the [Documentation](https://pollendao.gitbook.io/introduction/).

## Upgradable Proxy Pattern

The Pollen protocol has been architected in a way that makes it lightweight, modular, and extensible. To accomplish this we are using an upgradable proxy pattern in which both the Pollen DAO and the Asset Pool contracts act as proxies that `delegatecall` to different modules with implementation logic. When functions in the modules are called via `delegatecall` they execute in the storage of the Pollen DAO and Asset Pool contracts.

<div align="center">
   <img src="/assets/pollenDAO.png" alt="Upgradable Pollen DAO"/>
</div>

<div align="center">
   <img src="/assets/asset-pools.png" alt="Upgradable Asset Pools"/>
</div>

This proxy pattern provides the following advantages:
* It allows the community to easily upgrade the protocol and add/replace/remove functionality without having to redeploy existing functionality
* It enables the community to navigate around the 24kb smart contract size limit
* For both the Pollen DAO and AssetPool contracts, the community can add unlimited functionality associated with each of these addresses
* It structures the Pollen DAO and AssetPool contracts in a way that makes the protocol composable and easy for others to build on top of
* It makes the code more organized, structured, and readable

Modules can be added, removed or updated, providing the system with full flexibility. Those modules do not require a proxy pattern for this upgradability property. Instead, the modules are registered in the Pollen DAO and Asset Pool contracts and can be changed by updating the addresses that points to them, without the need for redeploying the Pollen DAO or Asset Pool contracts and keeping their respective storage slots as they are.

```
    /// @notice Adds a new module
    /// @dev function selector should not have been registered.
    /// @param implementation address of the implementation
    /// @param selectors selectors of the implementation contract
    function addModule(address implementation, bytes4[] calldata selectors)
        public
        onlyAdmin
    {
        DAOStorage storage ds = getPollenDAOStorage();
        for (uint256 i = 0; i < selectors.length; i++) {
            require(
                ds.implementations[selectors[i]] == address(0),
                "Selector already registered"
            );
            ds.implementations[selectors[i]] = implementation;
        }
        bytes32 hash = keccak256(abi.encode(selectors));
        ds.selectorsHash[implementation] = hash;
        emit ModuleAdded(implementation, selectors);
    }

    /// @notice Adds a new module and supported functions
    /// @dev function selector should not exist.
    /// @param implementation implementation address
    /// @param selectors function signatures
    function removeModule(address implementation, bytes4[] calldata selectors)
        internal
        onlyAdmin
    {
        DAOStorage storage ds = getPollenDAOStorage();
        bytes32 hash = keccak256(abi.encode(selectors));
        require(
            ds.selectorsHash[implementation] == hash,
            "PollenDAO: Invalid selector list"
        );

        for (uint256 i = 0; i < selectors.length; i++) {
            require(
                ds.implementations[selectors[i]] == implementation,
                "PollenDAO: unregistered selector"
            );
            ds.implementations[selectors[i]] = address(0);
        }
        emit ModuleRemoved(implementation, selectors);
    }
```

This lightweight proxy pattern was informed by EIP-2535: Diamonds, Multi-Facet Proxy, a proposed standard for creating modular smart contract systems that can be extended after deployment.

## Storage

In order to prevent storage slot collisions, the Pollen DAO and Asset Pool contracts have their own corresponding storage contracts. These storage contracts have structs with all the variables used in the corresponding implementation contracts. A hash of the modules is used to set the location of the structs. Because the way structs are stored, every element in a struct will be stored sequentially, then everything is below the storage slot determined by the hash of the module name.

```
contract ModuleStorage {
    bytes32 private constant STORAGE_SLOT = keccak256("PollenDAO.module.storage");

    struct ModuleStorage {
        // Variables
    }

    function getModuleStorage()
        internal
        pure
        returns (ModuleStorage storage ms)
    {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            ms.slot := slot
        }
    }
}
```
## Interacting with Modules
The Pollen DAO and Asset Pool contracts use their `fallback` functions to proxy function calls to the correct corresponding modules' implementation logic using message signatures included in the `calldata` of the transactions. This makes the system more transparent (i.e., the functions in the modules can be called directly from the front-end), but requires including the appropriate module's address with the implementation logic in the `msg.sig`.

```
    /// @notice pass a call to a  module
    /// @dev the first parameter of the function call is the address of the module
    /* solhint-disable no-complex-fallback, payable-fallback, no-inline-assembly */
    fallback() external {
        DAOStorage storage ds = getPollenDAOStorage();
        address implementation = ds.implementations[msg.sig];
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(
                gas(),
                implementation,
                0,
                calldatasize(),
                0,
                0
            )
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
```

## Available scripts

1. Standard
   - `npm run build` clean existing artifacts and compile project
   - `npm run test` run test suites
   - `npx hardhat --network <network> run scripts/deploy.ts` run deployment script in the selected network
2. Linting
   - `npm run lint` check solidity and typescript linting issues
   - `npm run lint:ts` check only typescript linting issues
   - `npm run lint:ts:fix` fix only typescript linting issues
   - `npm run lint:sol` check only solidity linting issues
   - `npm run lint:sol:fix` fix only solidity linting issues
3. Misc
   - `npm run coverage` clean existing artifacts, compile project and verify test coverage
   - `npm run gas-reporter` run test suites and show gas report
   - `npm run contract-sizer` clean existing artifacts, compile project and show the size of the contracts
   - `npm run prepare` config husky to run linters before commits


## Workflow best practices

### Branching

This project has two main branches, `main`, and `dev`. Then we do work based on branches off of `dev`.

`main`: Production branch. This is code that's live for the project.  
`dev`: Staging branch. This represents what will be included in the next release.

As we work on features, we branch off of the `dev` branch: `git checkout -b feature/new-nav-bar`.

Working branches have the form `<type>/<feature>` where `type` is one of:

- feat
- fix
- hotfix
- chore
- refactor

### Commit Messages

#### Basic

`<jira-issue-id> <type>(<scope>):<subject>`

Your basic commit messages should have a **jira-issue-id**, **type**, **scope**, and **subject**:

- _Jira-issue-id_ is the key in Jira issue, e.g., _PDV-1_
- _Type_ is one of the types listed above
- _Scope_ is the area of the code that the commit changes
- _Subject_ is a brief description of the work completed

#### Full

```
# <type>(<scope>): <subject>


# Why was this necessary?


# How does this address the issue?


# What side effects does this change have?


```

## Deployment

To interact with public networks:
1. Create a project secret key with a node provider like [Alchemy](https://www.alchemy.com/) or [Infura](https://infura.io/)
2. Create an `.env` file and store the mnemonic and API key for the project. See `.env.template`

### Local

1. Start a local blockchain using `npx hardhat node`
2. `npx hardhat run --network localhost scripts/deployPollenToken.ts` to compile and deploy to a local network

### Public Network

1. `npx hardhat run --network [NETWORK] scripts/deployPollenToken.ts` to compile and deploy to a public network e.g. Rinkeby or mainnet. See `hardhat.config.ts` for list of networks

## Verification on Etherscan
1. Get an API key from [Etherscan](https://etherscan.io) and add it as the `ETHERSCAN_API_KEY`  in the `.env` file to verify contracts on etherscan using the `hardhat-etherscan` plugin (see `.env.template`).
2. Ensure the contract has already been deployed, since we need its address for the verification command... then run `npx hardhat verify --network [NETWORK] [DEPLOYED CONTRACT ADDRESS] [CONSTRUCTOR ARGUMENT(s), if any]`
   - For example `npx hardhat verify --network ropsten [RESERVE ADDRESS]`
