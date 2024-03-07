import { BigNumber as BN, Wallet } from 'ethers';
import { waffle } from 'hardhat';
import { LockedPollenClass, MinterClass, PollenClass, PortfolioClass } from '../';
import { ERC20, IPollenDAO, LockedPollen, PollenToken } from '../../../../typechain';
import { BASE_18, ISSUANCE_SCHEDULE } from '../../../helpers/constants';
import { shuffle } from '../../helpers/random';
import { StepExecutor } from '../executor/executor';
import { Pollinator } from '../pollinator/pollinator';

export const INITIAL_PRICE = 10;
export const INITIAL_PRICES = BN.from(BASE_18).mul(INITIAL_PRICE);

const provider = waffle.provider;

const WALLETS = provider.getWallets();

export enum PollinatorType {
  MANAGER,
  DELEGATOR,
  STRATEGY_1
}

export interface IssuanceSchedule {
  maxTime: BN;
  offsetX: BN;
  offsetY: BN;
  rate: BN;
}

export class IntegrationManager {
  // global scope
  address: string;
  pollinatorCount: number;
  admin: Wallet;
  pollinators: Pollinator[];
  private prices: BN[];
  private assets: ERC20[];
  private currentTimestamp: BN;
  private issuanceSchedule: IssuanceSchedule[];
  // Contracts
  PollenToken: PollenToken;
  LockedPollen: LockedPollen;
  PollenDAO: IPollenDAO;
  // Class Objects
  PollenClass: PollenClass;
  LockedPollenClass: LockedPollenClass;
  PortfolioClass: PortfolioClass;
  MinterClass: MinterClass;
  // helper
  availableWallets: number;
  delegatorStack: Pollinator[];
  private initialized: boolean;

  constructor(
    PollenToken: PollenToken,
    LockedPollen: LockedPollen,
    PollenDAO: IPollenDAO,
    assets: ERC20[],
    benchmarkWeights: number[]
  ) {
    const current = BN.from(new Date().getTime().toString().slice(0, -3));
    // global storage
    this.address = 'DAO';
    this.pollinatorCount = 1;
    this.admin = WALLETS[0];
    this.pollinators = [];
    this.prices = [BASE_18, INITIAL_PRICES, INITIAL_PRICES, INITIAL_PRICES];
    this.assets = assets;
    this.issuanceSchedule = ISSUANCE_SCHEDULE;
    this.currentTimestamp = current;
    // Contracts
    this.PollenToken = PollenToken;
    this.LockedPollen = LockedPollen;
    this.PollenDAO = PollenDAO;
    // Class Objects
    this.PollenClass = new PollenClass(this.admin.address);
    this.LockedPollenClass = new LockedPollenClass(this);
    this.PortfolioClass = new PortfolioClass(this, benchmarkWeights);
    this.MinterClass = new MinterClass(this);
    // helpers
    this.availableWallets = WALLETS.length;
    this.delegatorStack = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await this.initClassWallets();
    await this.distributeFunds();
    await this.createBenchmarkPortfolio();
  }
  // init helpers
  // give all wallets equal funds
  private async distributeFunds() {
    const adminPlnBalance = await this.PollenToken.balanceOf(this.admin.address);
    const distAmount = adminPlnBalance.div(WALLETS.length).div(100);
    let index = 0;
    for await (const wallet of WALLETS) {
      if (index > 0) {
        await this.PollenToken.connect(this.admin).transfer(wallet.address, distAmount);
        this.PollenClass.transfer(this.admin.address, wallet.address, distAmount);
      }
      index += 1;
    }
    this.initialized = true;
  }

  private async createBenchmarkPortfolio() {
    await this.PollenDAO.connect(this.admin).createBenchMarkPortfolio(this.PortfolioClass.benchmarkWeights);
  }

  private initClassWallets() {
    new Promise((resolve, reject) => {
      // init Manager (DAO) wallet
      this.PollenClass.initWallet(this.address);
      this.LockedPollenClass.initWallet(this.address);
      // init LockedPollen wallet
      this.LockedPollenClass.initWallet(this.LockedPollenClass.address);
      this.PollenClass.initWallet(this.LockedPollenClass.address);
      WALLETS.forEach((wallet: Wallet, index) => {
        this.PollenClass.initWallet(wallet.address);
        this.LockedPollenClass.initWallet(wallet.address);
      });
      resolve(true);
    });
  }

  // *** EXECUTE ***
  async runRound() {
    // set delegator stack for randomization
    this.randomizeDelegatorStack();
    // quote price to prevent outdated price revert
    const assetAddresses = this.assets.map((asset) => asset.address);
    try {
      await this.PollenDAO.getPrices(this.prices, assetAddresses);
      // run
      const executor = new StepExecutor();
      await executor.executeRound(this);
    } catch (e) {
      throw {
        e,
        prices: this.prices,
        assetAddresses
      };
    }
  }

  // *** CREATE ***
  async newPollinator(type: PollinatorType) {
    if (!this.initialized) await this.init();
    if (this.pollinatorCount > WALLETS.length) {
      throw 'Number of Pollinators exceeds number of available wallets';
    }

    //get token balances
    const nextWallet = WALLETS[this.pollinatorCount];

    //save new Pollinator
    const newPollinator = new Pollinator(type, nextWallet, this);
    this.pollinators.push(newPollinator);

    this.pollinatorCount += 1;
    return newPollinator;
  }

  // SETTERS
  updateTime(newTime: BN) {
    this.currentTimestamp = newTime;
  }

  changePrices() {
    for (let i = 1; i < this.prices.length; i++) {
      const randomChange = Math.floor(Math.random() * 100); // 1-10% changes
      const isPositive = Math.random() > 0.5; // false is negative, true is positive
      if (isPositive) {
        this.prices[i] = this.prices[i].add(this.prices[i].mul(randomChange).div(1000));
      } else {
        this.prices[i] = this.prices[i].sub(this.prices[i].mul(randomChange).div(1000));
      }
    }
  }

  async updateCurrentTime() {
    this.currentTimestamp = BN.from((await provider.getBlock('latest')).timestamp);
  }

  // GETTERS
  getCurrentTime() {
    return this.currentTimestamp;
  }

  getAssets() {
    return this.assets;
  }

  getPrices() {
    return this.prices;
  }

  getIssuanceSchedule() {
    return this.issuanceSchedule;
  }

  getPollinator(walletAddress: string) {
    return this.pollinators.find((p) => p.address === walletAddress);
  }

  // HELPERS
  private randomizeDelegatorStack() {
    this.delegatorStack = shuffle(this.pollinators.filter((p) => p.type === PollinatorType.DELEGATOR));
  }

  getPortfolioManagers() {
    return this.pollinators.filter((p) => p.type === PollinatorType.MANAGER);
  }

  getDelegators() {
    return this.pollinators.filter((p) => p.type === PollinatorType.DELEGATOR);
  }

  getDelegatorsSample(percent: number) {
    if (percent > 1.0) throw 'Manager: delegator sample percent must be less than or equal to 1.00';
    const sampleSize = Math.ceil(this.delegatorStack.length * percent);
    const sample: Pollinator[] = [];
    for (let i = 0; i < sampleSize; i++) {
      const pol = this.delegatorStack.pop();
      if (pol) sample.push(pol);
    }
    return sample;
  }
}
