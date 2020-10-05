const Web3 = require("web3");

const toBN = Web3.utils.toBN;

const toStringifiedBN = function(num, decimals = 18) {
  const s = "" + num;
  const base = s.split(".")[1]
    ? s.split(".")[0] + s.split(".")[1]
    : s.split(".")[0];
  const exp = s.split(".")[1] ? s.split(".")[1].length : 0;
  const bnResult = toBN(base).mul(toBN(10).pow(toBN(decimals - exp)));
  return bnResult.toString(10, bnResult.toString().replace(/[^0-9]/g,"").length);
};

module.exports = { toBN, toStringifiedBN }
