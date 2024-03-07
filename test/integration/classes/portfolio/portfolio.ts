import { BigNumber as BN } from 'ethers'; 
import { IntegrationManager } from '..';
import { BASE_18, BASE_25, BASE_WEIGHTS, MIN_BALANCE_POLLINATOR } from '../../../helpers/constants';
import { PollinatorType } from '../manager/manager';
import { Pollinator } from '../pollinator/pollinator';
import { calcValue, getRewardRate, getBoostRate, calcWeightedAverage } from '../../../helpers/calculations';
import { randomAmount } from '../../helpers/random';
import { expect } from 'chai';


export type PollinatorPortfolio = {
  // Portfolio Scope
  id: number
  ownerAddress: string
  value: BN
  totalDeposited: BN
  totalBalance: BN
  weights: number[]
  assetAmounts: BN[]
  // Pollinator Scope
  balances: {[booleanTokenType: string]: {[address: string]: BN}}
  deposits: {[booleanTokenType: string]: {[address: string]: BN}}
  benchmarkRef: {[address: string]: BN};
}

export class PortfolioClass {
  portfolioCount: number
  portfolios: {[address: string]: PollinatorPortfolio}
  private totalDelegated: BN
  // benchmark
  benchmarkWeights: number[]
  benchmarkAssetAmounts: BN[]
  // Class Objects
  Manager: IntegrationManager
  constructor(manager: IntegrationManager, benchmarkWeights: number[]) {
    this.portfolioCount = 0;
    this.portfolios = {};
    this.totalDelegated = BN.from(0);
    // Class Objects
    this.Manager = manager;
    // benchmark
    this.benchmarkWeights = benchmarkWeights;
    this.benchmarkAssetAmounts = this.calcAssetAmounts(benchmarkWeights, BASE_18);
  }

  // *** PORTFOLIO ***
  addPortfolio(owner: Pollinator, weights: number[], initialAmount: BN, tokenType: boolean) {
    if(owner.address in this.portfolios) throw 'Portfolio: pollinator cannot create another portfolio';
    const ownerAddress = owner.address;
    const portfolioData = {
      id: this.portfolioCount,
      ownerAddress: ownerAddress,
      value: BASE_18,
      totalDeposited: BN.from(0),
      totalBalance: BN.from(0),
      balances: {'false': {[ownerAddress]: BN.from(0)},
        'true': {[ownerAddress]: BN.from(0)}},
      deposits: {'false': {[ownerAddress]: BN.from(0)},
        'true': {[ownerAddress]: BN.from(0)}},
      weights: weights,
      assetAmounts: this.calcAssetAmounts(weights, BASE_18),
      benchmarkRef: {[owner.address]: this.getBenchmarkValue()}
    };
    this.portfolios[ownerAddress] = portfolioData;
    this.portfolioCount += 1;
    this.depositIntoPortfolio(this.portfolios[ownerAddress], owner, initialAmount, tokenType);
  }

  async rebalancePortfolio(pollinator: Pollinator, weights: number[], amount: BN, tokenType: boolean) {
    if(!(pollinator.address in this.portfolios)) throw 'pollinator does not own a portfolio';
    const portfolio = this.portfolios[pollinator.address];
    // portfolio
    await this.updateValue(portfolio);

    // update benchmarkRef
    this.updateBenchmarkRef(pollinator, portfolio, amount);
    // handle balances
    this.depositIntoPortfolio(portfolio, pollinator, amount, tokenType);
    portfolio.weights = weights;
    await this.updateAssetAmounts(portfolio);
  }

  delegatePollen(portfolio: PollinatorPortfolio, pollinator: Pollinator, amount: BN, tokenType: boolean) {
    // const prices = this.Manager.getPrices();
    // const value = calcValue(portfolio.assetAmounts, prices);
    // const balanceIncrease = (amount.mul(BASE_18)).div(value);
    // portfolio.balances[tokenType.toString()][pollinator.address] = portfolio.balances[tokenType.toString()][pollinator.address].add(balanceIncrease);
    // portfolio.deposits[tokenType.toString()][pollinator.address] = portfolio.deposits[tokenType.toString()][pollinator.address].add(amount);
    // portfolio.totalDeposited = portfolio.totalDeposited.add(amount);
    // portfolio.totalBalance = portfolio.totalBalance.add(balanceIncrease);
    // this.totalDelegated = this.totalDelegated.add(amount);
    // update benchmarkRef
    this.updateBenchmarkRef(pollinator, portfolio, amount);
    // update state
    this.depositIntoPortfolio(portfolio, pollinator, amount, tokenType);
    

    
  }

  

  // *** UPDATE HELPERS *** 
  private async updateAssetAmounts(portfolio: PollinatorPortfolio) {
    const newAssetAmounts = this.calcAssetAmounts(portfolio.weights, portfolio.value);
    portfolio.assetAmounts = newAssetAmounts;
    const assets = this.Manager.getAssets().map(asset => {return asset.address;});
    // on-chain
    const onChainPortfolioObj = await this.Manager.PollenDAO.getPortfolio(portfolio.ownerAddress, portfolio.ownerAddress);
    const onChainPrices = await this.Manager.PollenDAO.getPrices(portfolio.weights, assets);
    // this.updateValue(portfolio);
    const offChainPrices = this.Manager.getPrices();
    for(let i = 0; i < onChainPrices.length; i++) {
      expect(portfolio.assetAmounts[i]).to.eq(onChainPortfolioObj.assetAmounts[i]);
    }
  }

  private async updateValue(portfolio: PollinatorPortfolio) {
    portfolio.value = calcValue(portfolio.assetAmounts, this.Manager.getPrices());
    // assertions
    const assets = this.Manager.getAssets().map(asset => {return asset.address;});
    // on-chain
    const onChainPortfolioObj = await this.Manager.PollenDAO.getPortfolio(portfolio.ownerAddress, portfolio.ownerAddress);
    const onChainPrices = await this.Manager.PollenDAO.getPrices(portfolio.weights, assets);
    // const onChainValue = await this.Manager.PollenDAO.getPortfolioValue(onChainPortfolioObj.assetAmounts, onChainPrices);
  }

  depositIntoPortfolio(portfolio: PollinatorPortfolio, pollinator: Pollinator, amount: BN, tokenType: boolean) {
    const pollenClass = this.Manager.PollenClass;
    const lockedPollenClass = this.Manager.LockedPollenClass;
    if(amount.isZero()) return;
    const pollinatorAddress = pollinator.address;

    // update pollinator fields
    const prevDeposits = portfolio.deposits[tokenType.toString()][pollinatorAddress] || BN.from(0);
    const prevBalance = portfolio.balances[tokenType.toString()][pollinatorAddress] || BN.from(0);

    const value = calcValue(portfolio.assetAmounts, this.Manager.getPrices());
    const balanceIncrease = amount.mul(BASE_25).div(value).div(10**7);
    // pollinator scope
    if (tokenType) lockedPollenClass.transfer(pollinator.address, this.Manager.address, amount);
    else pollenClass.transfer(pollinator.address, this.Manager.address, amount);

    // portfolio scope
    portfolio.deposits[tokenType.toString()][pollinatorAddress] = prevDeposits.add(amount);
    portfolio.balances[tokenType.toString()][pollinatorAddress] = prevBalance.add(balanceIncrease);
    portfolio.totalDeposited = portfolio.totalDeposited.add(amount);
    portfolio.totalBalance = portfolio.totalBalance.add(balanceIncrease);

    //global scope
    this.totalDelegated = this.totalDelegated.add(amount);
    
  }

  // any deposit or withdraw before updating value
  withdrawFromPortfolio(portfolio: PollinatorPortfolio, pollinator: Pollinator, amount: BN, tokenType: boolean) {
    const pollenClass = this.Manager.PollenClass;
    const lockedPollenClass = this.Manager.LockedPollenClass;
    if(amount.isZero()) return;
    const pollinatorAddress = pollinator.address;
    const value = calcValue(portfolio.assetAmounts, this.Manager.getPrices());
    // update pollinator fields
    const prevDeposits = portfolio.deposits[tokenType.toString()][pollinatorAddress];
    const prevBalance = portfolio.balances[tokenType.toString()][pollinatorAddress];
    
    const balanceDecrease = !prevDeposits.isZero() ? amount.mul(prevBalance).div(prevDeposits) : BN.from(0);
    // pollinator scope
    if (tokenType) lockedPollenClass.transfer(this.Manager.address, pollinator.address, amount);
    else pollenClass.transfer(this.Manager.address, pollinator.address, amount);

    // portfolio scope
    portfolio.deposits[tokenType.toString()][pollinatorAddress] = prevDeposits.sub(amount);
    portfolio.balances[tokenType.toString()][pollinatorAddress] = prevBalance.sub(balanceDecrease);
    portfolio.totalDeposited = portfolio.totalDeposited.sub(amount);
    portfolio.totalBalance = portfolio.totalBalance.sub(balanceDecrease);

    // global scope
    this.totalDelegated = this.totalDelegated.sub(amount);
    
  }

  private updateBenchmarkRef(pollinator: Pollinator, portfolio: PollinatorPortfolio, depositAmount: BN) {
    const plnDeposits = portfolio.deposits['false'][pollinator.address] || BN.from(0);
    const vePlnDeposits = portfolio.deposits['true'][pollinator.address] || BN.from(0);
    const prevDeposits = plnDeposits.add(vePlnDeposits);
    if(prevDeposits.isZero() && depositAmount.isZero()) return;
    const prevRef = portfolio.benchmarkRef[pollinator.address] || BN.from(0);
    if(prevRef.isZero() && !prevDeposits.isZero()) throw 'deposits without benchmark ref initialized';
    const currentBenchmark = this.getBenchmarkValue();
    const newRef = calcWeightedAverage(prevDeposits, depositAmount, prevRef, currentBenchmark);
    portfolio.benchmarkRef[pollinator.address] = newRef;
  }



  // *** CALCULATIONS ***
  calcAssetAmounts(weights: number[], value: BN) {
    const assets = this.Manager.getAssets();
    const prices = this.Manager.getPrices();
    const arr = Array(assets.length);
    assets.forEach(( _, index) => {
      if(!(weights[index] === 0) && !prices[index].isZero()) {
        arr[index] = value.mul(weights[index]).mul(BASE_18).div(prices[index]).div(BASE_WEIGHTS);
      } else {
        arr[index] = BN.from(0);
      }
    });
    return arr;
  }

  getBenchmarkValue() {
    return calcValue(this.benchmarkAssetAmounts, this.Manager.getPrices());
  }

  // GETTERS
  getTotalDelegated() {
    return this.totalDelegated;
  }

  getPortfolio(owner: string, delegator: string) {
    if(!(owner in this.portfolios)) return {
      assetAmounts: [BN.from(0)],
      plnBalance: BN.from(0),
      vePlnBalance: BN.from(0),
      depositPLN: BN.from(0),
      depositVePLN: BN.from(0),
    };
    const portfolio = this.portfolios[owner];
    const assetAmounts = portfolio.assetAmounts;
    const plnBalance = delegator in portfolio.balances['false'] ? portfolio.balances['false'][delegator] : BN.from(0);
    const vePlnBalance = delegator in portfolio.balances['true'] ? portfolio.balances['true'][delegator] : BN.from(0);
    const balance = plnBalance.add(vePlnBalance);
    const depositPLN = delegator in portfolio.deposits['false'] ? portfolio.deposits['false'][delegator] : BN.from(0);
    const depositVePLN = delegator in portfolio.deposits['true'] ? portfolio.deposits['true'][delegator] : BN.from(0);
    return {
      assetAmounts,
      plnBalance,
      vePlnBalance,
      depositPLN,
      depositVePLN,
    };
  }

  getAllPortfolios() {
    return Object.keys(this.portfolios).map((owner, _ ) => {
      return this.portfolios[owner];
    });
  }

}