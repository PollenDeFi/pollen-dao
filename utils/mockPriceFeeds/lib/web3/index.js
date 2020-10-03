const Web3 = require("web3");

const BN = Web3.utils.toBN;

const toUint256 = function(num, decimals = 18) {
  const s = "" + num;
  const base = s.split(".")[1]
    ? s.split(".")[0] + s.split(".")[1]
    : s.split(".")[0];
  const exp = s.split(".")[1] ? s.split(".")[1].length : 0;
  return Number(BN(base).mul(BN(10).pow(BN(decimals - exp)))).toString();
};

module.exports = { toUint256 }
