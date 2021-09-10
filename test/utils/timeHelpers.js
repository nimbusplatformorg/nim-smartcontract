const { time, BN } = require("@openzeppelin/test-helpers");
const { promisify } = require("util");
async function increaseTime(addSeconds) {
  return await time.increase(addSeconds);
}

async function getBlockTimestamp(number) {
  return new BN((await web3.eth.getBlock(number)).timestamp);
}

const takeSnapshot = async () => {
  return promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_snapshot",
    id: new Date().getTime(),
  });
};

async function snapshot() {
  return (await takeSnapshot()).result;
}

const revertToSnapShot = async (id) => {
  return promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_revert",
    params: [id],
    id: new Date().getTime(),
  });
};

module.exports = {
  getBlockTimestamp,
  increaseTime,
  takeSnapshot,
  revertToSnapShot,
  snapshot,
};
