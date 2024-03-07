import { BigNumber as BN, Wallet } from 'ethers';
import { ERC20, MockPriceFeed, PollenToken, Portfolio, PollenDAO, IPollenDAO, IPollen, LockedPollen } from '../../../../typechain';
import { IntegrationManager, PollinatorType, PollinatorPortfolio } from '../';
import { BASE_18, BASE_8 } from '../../../helpers/constants';
import { calcValue, getRewardRate, getBoostRate, calcExpectedPortfolioWithdraw } from '../../../helpers/calculations';
import { expect } from 'chai';
import { PollenClass } from '../Pollen/pollen';
import { LockedPollenClass } from '../lockedPollen/lockedPollen';
import { isPositive } from '../../../helpers/helpers';
import { poll } from 'ethers/lib/utils';

type PollenLock = {
  lockEnd: BN
  amount: BN
}

type PortfolioFees = {
  gained: BN
  prevBalance: BN
}

const err = 'Pollinator: ';
export class Pollinator {
  wallet: Wallet
  address: string
  type: PollinatorType
  associatedPortfolios: Array<string>
  // State checks
  private portfolioFees: PortfolioFees
  private nonce: number
  // Class Objects
  private Manager: IntegrationManager

  constructor(type: PollinatorType, wallet: Wallet, manager: IntegrationManager) {
    const initialBalance = manager.PollenClass.balanceOf(wallet.address);
    const initialFees = { gained: BN.from(0), prevBalance: initialBalance };
    this.wallet = wallet;
    this.address = wallet.address;
    this.type = type;
    this.associatedPortfolios = [];
    // State checks
    this.portfolioFees = initialFees;
    this.nonce = 0;
    // Class Objects
    this.Manager = manager;
  }

  async lockPollen(amount: BN, lockEnd: BN) {
    // chain interaction
    const LockedPollen = this.Manager.LockedPollen;
    await this.approveLockedPollen(amount);
    await this.updateNonce();
    if (lockEnd.isZero()) throw 'lock is 0';
    await LockedPollen.connect(this.wallet).lock(amount, lockEnd, { nonce: this.nonce });
    await this.Manager.updateCurrentTime();
    // class updates
    this.Manager.LockedPollenClass.lockPollen(this, lockEnd, amount);
    // assertions
    await this.checkBalances();
  }

  async increaseLock(amount: BN) {
    // chain interaction
    const LockedPollen = this.Manager.LockedPollen;
    await this.approveLockedPollen(amount);
    await this.updateNonce();
    await LockedPollen.connect(this.wallet).increaseLock(amount, { nonce: this.nonce });
    await this.Manager.updateCurrentTime();
    // class updates
    this.Manager.LockedPollenClass.increaseLock(this, amount);
    // assertions
    await this.checkBalances();
  }

  async extendLock(newLock: BN) {
    // chain interaction
    const LockedPollen = this.Manager.LockedPollen;
    await this.updateNonce();
    await LockedPollen.connect(this.wallet).extendLock(newLock, { nonce: this.nonce });
    await this.Manager.updateCurrentTime();
    // class updates
    this.Manager.LockedPollenClass.extendLock(this, newLock);
    // assertions
    await this.checkBalances();
  }

  // *** PORTFOLIO MANAGER ONLY FUNCTIONS ***
  /**
   * @dev create portfolio and update Manager to add portfolio
   */
  async createPortfolio(tokenType: boolean) {
    const balance = await this.Manager.PollenToken.balanceOf(this.address);
    // parameters
    const amount = this.randomAmount(tokenType);
    const weights = this.randomWeights();
    const isShort = Array(weights.length).fill(false);
    // chain interactions
    const pollenDAO = this.Manager.PollenDAO;
    await this.approvePollenDAO(tokenType, amount);
    await this.updateNonce();
    await pollenDAO.connect(this.wallet).createPortfolio(amount, weights, isShort, tokenType, { nonce: this.nonce });
    await this.Manager.updateCurrentTime();
    // class updates
    this.Manager.PortfolioClass.addPortfolio(this, weights, amount, tokenType);
    // this.updatePrevBalance();

    // assertions
    await this.checkBalances();
    await this.checkPortfolio(this.address, this.address);0;
  }

  /**
   * @dev rebalance portfolio and update Manager to add portfolio
   */
  async rebalancePortfolio(tokenType: boolean) {
    if (!(this.address in this.Manager.PortfolioClass.portfolios)) throw 'Pollenator does not manage a portfolio';
    // parameters
    const amount = this.randomAmount(tokenType);
    const weights = this.randomWeights();
    const isShort = Array(weights.length).fill(false);
    // chain interactions
    const PollenDAO = this.Manager.PollenDAO;
    await this.approvePollenDAO(tokenType, amount);
    await this.updateNonce();
    await PollenDAO.connect(this.wallet).rebalancePortfolio(weights, isShort, amount, tokenType, { nonce: this.nonce });
    await this.Manager.updateCurrentTime();
    // class updates
    await this.Manager.PortfolioClass.rebalancePortfolio(this, weights, amount, tokenType);
    // this.updatePrevBalance();

    // assertions
    await this.checkBalances();
    await this.checkPortfolio(this.address, this.address);
  }

  async closePortfolio(onChain: boolean) {
    // on chain interactions
    const PollenDAO = this.Manager.PollenDAO;
    const weights = this.closeWeights();
    const isShort = Array(weights.length).fill(false);
    if (onChain) {
      await this.updateNonce();
      await PollenDAO.connect(this.wallet).rebalancePortfolio(weights, isShort, 0, false, { nonce: this.nonce });
      await this.Manager.updateCurrentTime();
    }
    // class updates
    await this.Manager.PortfolioClass.rebalancePortfolio(this, weights, BN.from(0), false);
    // this.updatePrevBalance();
    // assertions
    await this.checkBalances();
    await this.checkPortfolio(this.address, this.address);
  }

  /**
   * @dev withdraw all funds, close portfolio and update Manager storage
   */
  async closeAndWithdrawPortfolio() {
    await this.checkBalances();
    const portfolios = this.Manager.PortfolioClass.portfolios;
    if (!(this.address in portfolios)) throw 'Pollenator does not manage a portfolio';
    const portfolio = portfolios[this.address];

    // parameters
    const vePlnAmount = portfolio.deposits['true'][this.address] || BN.from(0);
    const plnAmount = portfolio.deposits['false'][this.address] || BN.from(0);
    if (plnAmount.add(vePlnAmount).isZero()) return;
    // chain interactions
    const PollenDAO = this.Manager.PollenDAO;
    const onChainPortfolio = await PollenDAO.getPortfolio(this.address, this.address);
    expect(onChainPortfolio.depositPLN).to.eq(plnAmount);
    expect(onChainPortfolio.depositVePLN).to.eq(vePlnAmount);
    if (!plnAmount.isZero()) {
      await this.updateNonce();
      await PollenDAO.connect(this.wallet).closeAndWithdraw(plnAmount, false, { nonce: this.nonce });
      await this.Manager.updateCurrentTime();
      // get estimated withdraw
      const { ownerRewards: ownerPlnRewards,
        pollinatorRewards: pollinatorPlnRewards,
        isRewards: isPlnRewards } = this.Manager.MinterClass.getWithdrawAmount(portfolio, this, plnAmount, false);
      // get estimated withdraw
      // manager updates
      if (!isPlnRewards) {
        this.Manager.PortfolioClass.withdrawFromPortfolio(portfolio, this, plnAmount, false);
        this.Manager.PollenClass.burn(this.address, pollinatorPlnRewards);
      }
      else {
        this.Manager.PortfolioClass.withdrawFromPortfolio(portfolio, this, plnAmount, false);
        this.Manager.PollenClass.mint(this.address, pollinatorPlnRewards);
      }
      await this.closePortfolio(false);
      // this.updatePrevBalance();
    }
    // assertions
    await this.checkBalances();
    await this.checkPortfolio(this.address, this.address);
    if (!vePlnAmount.isZero()) {
      // handle all vePLN withdraw updates with class method
      await this.withdraw(portfolio, vePlnAmount, true);
    }
  }

  // *** DELEGATOR AND MANAGER FUNCTIONS ***
  /**
   * @dev delegate token to a portfolio and update Manager
   */
  async delegatePollen(portfolio: PollinatorPortfolio, tokenType: boolean, amount?: BN) {
    // parameters
    if (!amount) amount = this.randomAmount(tokenType);
    if (amount.isZero()) return;
    // chain interactions
    const PollenDAO = this.Manager.PollenDAO;
    await this.approvePollenDAO(tokenType, amount);
    await this.updateNonce();
    await PollenDAO.connect(this.wallet).delegatePollen(portfolio.ownerAddress, amount, tokenType);
    await this.Manager.updateCurrentTime();
    // class updates
    this.Manager.PortfolioClass.delegatePollen(portfolio, this, amount, tokenType);
    // this.Manager.PortfolioClass.depositIntoPortfolio(portfolio, this, amount, tokenType);
    // this.updatePrevBalance();
    // assertions
    await this.checkBalances();
    await this.checkPortfolioOwnerBalances(portfolio.ownerAddress);
    await this.checkPortfolio(portfolio.ownerAddress, this.address);
  }

  async withdraw(portfolio: PollinatorPortfolio, amount: BN, tokenType: boolean) {
    const owner = this.Manager.getPollinator(portfolio.ownerAddress);
    const { ownerRewards: oR, pollinatorRewards: checkRewards, isRewards: iR } = this.Manager.MinterClass.getWithdrawAmount(portfolio, this, amount, tokenType);
    if (checkRewards.isZero()) return;
    // on-chain withdraw
    const PollenDAO = this.Manager.PollenDAO;
    await this.updateNonce();
    await PollenDAO.connect(this.wallet).withdraw(portfolio.ownerAddress, amount, tokenType);
    await this.Manager.updateCurrentTime();
    // get estimated withdraw
    const { ownerRewards, pollinatorRewards, isRewards } = this.Manager.MinterClass.getWithdrawAmount(portfolio, this, amount, tokenType);
    // model updates
    if (ownerRewards && isPositive(ownerRewards) && owner) {
      this.Manager.PollenClass.mint(owner.address, ownerRewards);
      owner.addPendingPortfolioFees(ownerRewards);
    }
    if (!isRewards) {
      this.Manager.PortfolioClass.withdrawFromPortfolio(portfolio, this, amount, tokenType);
      tokenType ? this.Manager.LockedPollenClass.burn(this.address, pollinatorRewards) :
        this.Manager.PollenClass.burn(this.address, pollinatorRewards);
    }
    else {
      this.Manager.PortfolioClass.withdrawFromPortfolio(portfolio, this, amount, tokenType);
      this.Manager.PollenClass.mint(this.address, pollinatorRewards);
    }
    // this.updatePrevBalance();

    // assertions
    await this.checkBalances();
    await this.checkPortfolioOwnerBalances(portfolio.ownerAddress);
    await this.checkPortfolio(portfolio.ownerAddress, this.address);
  }

  async withdrawAll() {
    const allPortfolios = this.getMyDelegatedPortfolios();
    for await (const portfolio of allPortfolios) {
      const myPlnBalance = portfolio.deposits['false'][this.address] || BN.from(0);
      const myVePlnBalance = portfolio.deposits['true'][this.address] || BN.from(0);
      if (!myPlnBalance.isZero()) await this.withdraw(portfolio, myPlnBalance, false);
      if (!myVePlnBalance.isZero()) await this.withdraw(portfolio, myVePlnBalance, true);
    }
  }

  async withdrawRewards(portfolio: PollinatorPortfolio, tokenType: boolean) {
    const owner = this.Manager.getPollinator(portfolio.ownerAddress);
    // get estimated rewards
    const balance = portfolio.balances[tokenType.toString()][this.address] || BN.from(0);
    const deposits = portfolio.deposits[tokenType.toString()][this.address] || BN.from(0);
    const { ownerRewards, pollinatorRewards, isRewards } = this.Manager.MinterClass.getWithdrawAmount(portfolio, this, deposits, tokenType);
    if (!isRewards || deposits.isZero()) return;
    // on-chain withdraw
    const PollenDAO = this.Manager.PollenDAO;
    await this.updateNonce();
    await PollenDAO.connect(this.wallet).withdrawRewards(portfolio.ownerAddress, tokenType);
    await this.Manager.updateCurrentTime();
    // model updates
    if (ownerRewards && owner) {
      this.Manager.PollenClass.mint(owner.address, ownerRewards);
      owner.addPendingPortfolioFees(ownerRewards);
    }
    if (isPositive(pollinatorRewards)) this.Manager.PollenClass.mint(this.address, pollinatorRewards);
    // reset benchmark ref
    portfolio.benchmarkRef[this.address] = this.Manager.PortfolioClass.getBenchmarkValue();
    // this.updatePrevBalance();
    // update portfolio total balance
    const value = calcValue(portfolio.assetAmounts, this.Manager.getPrices());
    const newBalance = deposits.mul(BASE_18).div(value);
    portfolio.balances[tokenType.toString()][this.address] = newBalance;
    portfolio.totalBalance = portfolio.totalBalance.add(newBalance).sub(balance);
    // assertions
    await this.checkBalances();
    await this.checkPortfolioOwnerBalances(portfolio.ownerAddress);
    await this.checkPortfolio(portfolio.ownerAddress, this.address);
  }

  // SETTERS
  /**
   * @info the manager's balance will already account for fees but is used to determine if the manager 
   *        has seen the balance increase or not
   * @param amount 
   */
  addPendingPortfolioFees(amount: BN) {
    this.portfolioFees.gained = this.portfolioFees.gained.add(amount);
  }
  acknowledgePortfolioFees() {
    this.portfolioFees.gained = BN.from(0);
    this.portfolioFees.prevBalance = this.Manager.PollenClass.balanceOf(this.address);
  }

  // GETTERS
  getMyPortfolio() {
    return this.Manager.PortfolioClass.portfolios[this.address];
  }

  getMyDelegatedPortfolios() {
    const portfolios = this.Manager.PortfolioClass.portfolios;
    const associatedPortfolios: PollinatorPortfolio[] = [];
    Object.keys(portfolios).forEach((ownerAddress) => {
      if (this.address in portfolios[ownerAddress].balances['true'] ||
        this.address in portfolios[ownerAddress].balances['false']
        && this.address !== ownerAddress) {
        associatedPortfolios.push(portfolios[ownerAddress]);
      }
    });
    return associatedPortfolios;
  }

  checkPortfolioFees() {
    return this.portfolioFees;
  }


  // *** HELPERS ***
  randomAmount(tokenType: boolean) {
    let token: LockedPollenClass | PollenClass = this.Manager.PollenClass;
    if (tokenType) {
      token = this.Manager.LockedPollenClass;
    }
    let balance = token.balanceOf(this.address) || BN.from(0);
    if (!tokenType) balance = balance.sub(this.portfolioFees.gained);
    const fraction = Math.floor(Math.random() * 101);
    if (!balance) return BN.from(0);
    return balance.mul(fraction).div(1000); // (1-10% of portfolio balance)
  }

  randomWeights() {
    return [0, 10, 20, 70]; // need to use random weights
  }

  closeWeights() {
    const weights: number[] = [];
    this.Manager.getAssets().forEach((_, index) => {
      if (index === 0) weights.push(100);
      else weights.push(0);
    });
    return weights;
  }

  updatePrevBalance() {
    const bal = this.Manager.PollenClass.balanceOf(this.address);
    this.portfolioFees.prevBalance = bal;
  }

  // *** ON-CHAIN HELPER ***
  async approvePollenDAO(tokenType: boolean, amount: BN) {
    const PollenDAO = this.Manager.PollenDAO;
    await this.updateNonce();
    if (tokenType) {
      const LockedPollen = this.Manager.LockedPollen;
      await LockedPollen.connect(this.wallet).approve(PollenDAO.address, amount, { nonce: this.nonce });
    } else {
      const PollenToken = this.Manager.PollenToken;
      await PollenToken.connect(this.wallet).approve(PollenDAO.address, amount, { nonce: this.nonce });
    }
  }

  async approveLockedPollen(amount: BN) {
    const PollenToken = this.Manager.PollenToken;
    const lockedPollen = this.Manager.LockedPollen;
    await this.updateNonce();
    await PollenToken.connect(this.wallet).approve(lockedPollen.address, amount, { nonce: this.nonce });
  }

  async updateNonce() {
    this.nonce = await this.wallet.getTransactionCount();
  }

  // *** ASSERTIONS *** 
  async checkBalances() {
    // on chain
    const LockedPollen = this.Manager.LockedPollen;
    const onChainVePlnBalance = await this.Manager.LockedPollen.balanceOf(this.address);
    const onChainPlnBalance = await this.Manager.PollenToken.balanceOf(this.address);
    // off chain
    const offChainVePlnBalance = this.Manager.LockedPollenClass.balanceOf(this.address) || BN.from(0);
    const offChainPlnBalance = this.Manager.PollenClass.balanceOf(this.address);
    // assertions
    const err_1 = 'PLN balances do not match';
    // 10 decimal precision
    expect(onChainPlnBalance).to.eq(offChainPlnBalance, err + err_1);
    const err_2 = 'vePLN balances do not match';
    expect(onChainVePlnBalance).to.eq(offChainVePlnBalance, err + err_2);
  }

  async checkPortfolioOwnerBalances(ownerAddress: string) {
    // on chain
    const LockedPollen = this.Manager.LockedPollen;
    const onChainVePlnBalance = await this.Manager.LockedPollen.balanceOf(ownerAddress);
    const onChainPlnBalance = await this.Manager.PollenToken.balanceOf(ownerAddress);
    // off chain
    const offChainVePlnBalance = this.Manager.LockedPollenClass.balanceOf(ownerAddress) || BN.from(0);
    const offChainPlnBalance = this.Manager.PollenClass.balanceOf(ownerAddress);
    // assertions
    const err_1 = 'PLN balances do not match';
    // 10 decimal precision
    expect(onChainPlnBalance).to.eq(offChainPlnBalance, err + err_1);
    const err_2 = 'vePLN balances do not match';
    expect(onChainVePlnBalance).to.eq(offChainVePlnBalance, err + err_2);
  }

  async checkPortfolio(owner: string, delegator: string) {
    const portfolio = this.Manager.PortfolioClass.portfolios[owner];
    // on chain
    const onChainPortfolio = await this.Manager.PollenDAO.getPortfolio(owner, delegator);
    // off chain
    const offChainPortfolio = this.Manager.PortfolioClass.getPortfolio(owner, delegator);
    // assertions
    const err_1 = 'asset amounts do not match';
    onChainPortfolio.assetAmounts.forEach((onChain, index) => {
      expect(onChain).to.eq(offChainPortfolio.assetAmounts[index], err + err_1);
    });
    const err_2 = 'plnBalance does not match';
    expect(onChainPortfolio.balance).to.eq(offChainPortfolio.plnBalance.add(offChainPortfolio.vePlnBalance), err + err_2);
    const err_3 = 'depositVePLN does not match';
    expect(onChainPortfolio.depositVePLN).to.eq(offChainPortfolio.depositVePLN, err + err_3);
    // portfolio.deposits['true'][this.address] = offChainPortfolio.depositVePLN;
    const err_4 = 'depositPLN does not match';
    expect(onChainPortfolio.depositPLN).to.eq(offChainPortfolio.depositPLN, err + err_4);
    // portfolio.deposits['false'][this.address] = offChainPortfolio.depositPLN;

  }
}

