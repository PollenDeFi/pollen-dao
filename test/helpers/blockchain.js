/* global module, web3 */
module.exports = {
    createSnapshot,
    revertToSnapshot,
};

async function createSnapshot () {
    return new Promise((resolve, reject) =>  {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_snapshot',
            params: [],
            id: new Date().getSeconds()
        }, async (err, res) => {
            if (err) { reject(err); }
            return resolve(res.result);
        });
    });
}

async function revertToSnapshot (snapshot) {
    return new Promise((resolve, reject) =>  {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_revert',
            params: [snapshot],
            id: new Date().getSeconds()
        }, async (err, res) => {
            if (err) { reject(err); }
            return resolve(res);
        });
    });
}
