import { BigNumber as BN} from 'ethers';
import { poll } from 'ethers/lib/utils';
import { BASE_18 } from '../../../helpers/constants';
import { Pollinator, PollenClass, IntegrationManager } from '../';
import { getCurrentTimestamp } from '../../../helpers/helpers';

type InflationInfo = {
  reserved: BN
  supply: BN
}

type LockInfo = {
  supply: BN
  amount: BN
}

type PollenLock = {
  lockEnd: BN
  amount: BN
  lockDetail: LockInfo[]
}

export class LockedPollenClass {
  address: string
  locks: {[address: string]: PollenLock}
  inflationInfo: InflationInfo
  private totalSupply: BN
  private balances: {[address: string]: BN}
  // Class Objects
  Manager: IntegrationManager
  constructor(manager: IntegrationManager){
    this.address = 'LOCKED_POLLEN';
    this.locks = {};
    this.inflationInfo = {reserved: BN.from(0), supply: BASE_18.mul(94000000)};
    this.totalSupply = BN.from(0);
    this.balances = {};
    // Class Objects
    this.Manager = manager;
  }

  // *** LOCKED POLLEN ***
  lockPollen(pollinator: Pollinator, lockEnd: BN, amount: BN) {
    if((pollinator.address in this.locks)) throw 'Lock already created';
    const totalPlnSupply = this.Manager.PollenClass.getTotalSupply();
    // create lock
    const lockDetail = {supply: totalPlnSupply, amount};
    const lock = { lockEnd, amount, lockDetail: [lockDetail]};
    this.locks[pollinator.address] = lock;
    // swap PLN for vePLN
    this.swap(pollinator.address, amount);
  }

  increaseLock(pollinator: Pollinator, amount: BN) {
    const plnTotalSupply = this.Manager.PollenClass.getTotalSupply();
    if(!(pollinator.address in this.locks)) throw 'Must create lock before updating';
    // update lock
    const newLockDetail = {supply: plnTotalSupply, amount};
    this.locks[pollinator.address].lockDetail.push(newLockDetail);
    this.locks[pollinator.address].amount = this.locks[pollinator.address].amount.add(amount);
    // swap PLN for vePLN
    this.swap(pollinator.address, amount);
  }

  extendLock(pollinator: Pollinator, lockEnd: BN) {
    if(!(pollinator.address in this.locks)) throw 'Must create lock before updating';
    // update lock
    if(lockEnd <= this.locks[pollinator.address].lockEnd) throw 'new lock must be greater than previous lock';
    this.locks[pollinator.address].lockEnd = lockEnd;
  }

  unlock(pollinator: Pollinator) {
    if(!(pollinator.address in this.locks)) throw 'Pollinator does not have a lock';
    const userLock = this.locks[pollinator.address];
    if(userLock.lockEnd.gte(this.Manager.getCurrentTime())) throw 'throw lock is still active';
    if(userLock.amount.isZero()) throw 'Invalid lock';
    this.processInflation();

    const vePlnBalance = this.balanceOf(pollinator.address);
    if(!vePlnBalance) throw 'Pollinator does not have a locked pollen balance';
    const plnTotalSupply = this.Manager.PollenClass.getTotalSupply();
    let amount = BN.from(0);
    userLock.lockDetail.forEach((detail, index) => {
      if(!(detail.supply.gt(plnTotalSupply))) {
        const inflationProtection = detail.amount.mul(plnTotalSupply.sub(detail.supply)).div(plnTotalSupply);
        amount = amount.add(inflationProtection);
      }
    });
    this.inflationInfo.reserved = this.inflationInfo.reserved.sub(amount);
    // mint inflation protection to pollinator
    this.Manager.MinterClass.mintInflationReimburse(pollinator, amount);
    // transfer PLN deposits to pollinator
    this.Manager.PollenClass.transfer(this.address, pollinator.address, amount);
    // burn vePLN
    this.burn(pollinator.address, vePlnBalance);

  }

  private processInflation() {
    const supply = this.Manager.PollenClass.getTotalSupply();

    const info = this.inflationInfo;

    const  status = supply.lt(info.supply);
    const deltaSupply = status ? supply.sub(info.supply) : info.supply.sub(supply);
    const lockedSupply = this.Manager.LockedPollenClass.getTotalSupply().add(info.reserved);
    const unlockedSupply = info.supply.sub(lockedSupply).add(info.reserved);
    const reserve = deltaSupply.mul(lockedSupply).div(unlockedSupply);
    info.supply = supply;
    if (status) {
      info.reserved = info.reserved.add(reserve);
    } else {
      info.reserved = info.reserved.lt(reserve)
        ? info.reserved.sub(reserve)
        : BN.from(0);
    }
  }

  /// @notice swap PLN by vePLN, PLN are taken from the sender
  /// @param account account that will receive the vePLN
  /// @param amount amount of PLN to swap
  private swap(to: string, amount: BN) {
    this.mint(to, amount);
    this.Manager.PollenClass.transfer(to, this.address, amount);
  }

  // ERC20
  transfer(from: string, to: string, amount: BN) {
    if(from !== this.Manager.address && to !== this.Manager.address && from !== this.address && to !== this.address) throw 'Only Manager/LockedPollenClass transfers allowed for vePLN';
    if (this.balances[from].gte(amount)){
      this.balances[from] = this.balances[from].sub(amount);
      this.balances[to] = this.balances[to].add(amount);
    } else {
      throw 'not enough balances to transfer';
    }
    this.balances[from];
  }

  burn(from: string, amount: BN) {
    this.totalSupply = this.totalSupply.sub(amount);
    this.balances[from] = this.balances[from].add(amount);
  }

  private mint(to: string, amount: BN) {
    this.totalSupply = this.totalSupply.add(amount);
    this.balances[to] = this.balances[to].add(amount);
    
  }

  // GETTERS
  balanceOf(address: string) {
    if(!(address in this.balances)) return;
    return this.balances[address];
  }

  getTotalSupply() {
    return this.totalSupply;
  }

  // HELPERS
  initWallet(address: string) {
    if(!this.balances[address]){
      this.balances[address] = BN.from(0);
    }
  }

  hasLock(address: string) {
    return (address in this.locks);

  }

  hasExpiredLock(address: string) {
    if(!this.hasLock(address)) return true;
    const current = this.Manager.getCurrentTime();
    return this.locks[address].lockEnd.lte(current);
  }
}