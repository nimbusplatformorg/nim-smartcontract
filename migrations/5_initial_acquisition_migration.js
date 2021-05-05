const NimbusInitialAcquisition = artifacts.require("NimbusInitialAcquisition");

module.exports = async function (deployer) {
  await deployer.deploy(NimbusInitialAcquisition, NBU.address, NimbusRouter.address, NBU_WETH.address, LockStakingRewardsSameTokenFixedAPY.address);
}
