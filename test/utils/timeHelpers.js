const { time, BN } = require("@openzeppelin/test-helpers");

async function increaseTime(addSeconds) {
  const id = await time.latest();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [addSeconds],
        id,
      },
      (err1) => {
        if (err1) return reject(err1);

        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            id: id.add(time.duration.seconds(1)),
          },
          (err2, res) => (err2 ? reject(err2) : resolve(res))
        );
      }
    );
  });
}

async function getBlockTimestamp(number) {
  return new BN((await web3.eth.getBlock(number)).timestamp);
}

module.exports = {
  getBlockTimestamp,
  increaseTime,
};
