const { time, BN } = require("@openzeppelin/test-helpers");

async function increaseTime(addSeconds) {
return await time.increase(addSeconds)
}

async function getBlockTimestamp(number) {
  return new BN((await web3.eth.getBlock(number)).timestamp);
}

module.exports = {
  getBlockTimestamp,
  increaseTime,
};
