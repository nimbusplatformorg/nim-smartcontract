const { BN, constants } = require("@openzeppelin/test-helpers");

module.exports = {
  ZERO: new BN(0),
  DAY: new BN("86400"),
  ONE_ADDRESS: "0x0000000000000000000000000000000000000001",
  ZERO_BYTES: Buffer.from(""),
  ...constants,
};
