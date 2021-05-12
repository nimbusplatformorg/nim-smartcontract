const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");

const NimbusRouter = artifacts.require("NimbusRouter");
const NimbusPair = artifacts.require("NimbusPair");
const NBU_WETH = artifacts.require("NBU_WETH");
const Factory = artifacts.require("NimbusFactory");
const LPRewards = artifacts.require("LPReward");
const { constants, BN } = require("@openzeppelin/test-helpers");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(Factory, accounts[0]);

  await deployer.deploy(NimbusPair);

  await deployer.deploy(NBU_WETH);

  await deployer.deploy(LPRewards, NBU.address, Factory.address);

  await deployer.deploy(
    NimbusRouter,
    Factory.address,
    NBU.address,
    LPRewards.address
  );
};
