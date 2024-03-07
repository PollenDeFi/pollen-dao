import { BigNumber as BN} from 'ethers';
import { BASE_18 } from '../../../helpers/constants';


export class PollenClass {
  address: string
  private totalSupply: BN
  private balances: {[address: string]: BN}
  constructor(adminAddress: string) {
    this.address = 'POLLEN';
    this.totalSupply = BASE_18.mul(94000000);
    this.balances = {};
    this.balances[adminAddress] = this.totalSupply;
  }

  transfer(from: string, to: string, amount: BN) {
    if (this.balances[from].gte(amount)){
      this.balances[from] = this.balances[from].sub(amount);
      this.balances[to] = this.balances[to].add(amount);
    } else {
      throw 'not enough balances to transfer';
    }
    this.balances[from];
  }

  mint(to: string, amount: BN) {
    this.totalSupply = this.totalSupply.add(amount);
    this.balances[to] = this.balances[to].add(amount);
  }

  burn(from: string, amount: BN) {
    this.totalSupply = this.totalSupply.sub(amount);
    this.balances[from] = this.balances[from].sub(amount);
  }

  // GETTERS
  // GETTERS
  balanceOf(address: string) {
    if(!(address in this.balances)) return BN.from(0);
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
}