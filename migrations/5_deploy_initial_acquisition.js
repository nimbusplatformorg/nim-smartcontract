const NBU = artifacts.require("NBU");
const NimbusRouter = artifacts.require("NimbusRouter");
const NBU_WETH = artifacts.require("NBU_WETH");
const LockStakingRewardsSameTokenFixedAPY = artifacts.require("LockStakingRewardSameTokenFixedAPY");
const NimbusInitialAcquisition = artifacts.require("NimbusInitialAcquisition");

module.exports = async function (deployer) {
  await deployer.deploy(NimbusInitialAcquisition, NBU.address, NimbusRouter.address, NBU_WETH.address, LockStakingRewardsSameTokenFixedAPY.address);
}
