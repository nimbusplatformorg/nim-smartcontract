const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const TT = artifacts.require("ERC20TestToken");
const TR = artifacts.require("ERC20TestRescue");
const NimbusReferralProgram = artifacts.require("NimbusReferralProgram");
const { constants } = require("@openzeppelin/test-helpers");
module.exports = async function (deployer, netwotk, accounts) {
  await deployer.deploy(NBU);
  await deployer.deploy(GNBU, { gas: 0x1fffffffffffff });
  await deployer.deploy(TT, constants.MAX_UINT256);
  await deployer.deploy(TR, constants.MAX_UINT256);
  await deployer.deploy(NimbusReferralProgram, accounts[0], NBU.address);
};
