const NBU = artifacts.require("NBU");
const NimbusRouter = artifacts.require("NimbusRouter");
const NBU_WETH = artifacts.require("NBU_WETH");
const LockStakingRewardsSameTokenFixedAPY = artifacts.require(
  "LockStakingRewardSameTokenFixedAPY"
);
const NimbusInitialAcquisition = artifacts.require("NimbusInitialAcquisition");
const NBUInfluencerBonusPart = artifacts.require("NBUInfluencerBonusPart");
const NimbusReferralProgram = artifacts.require("NimbusReferralProgram");

module.exports = async function (deployer) {
  await deployer.deploy(
    NimbusInitialAcquisition,
    NBU.address,
    NimbusRouter.address,
    NBU_WETH.address,
    LockStakingRewardsSameTokenFixedAPY.address
  );

  await deployer.deploy(
    NBUInfluencerBonusPart,
    NBU.address,
    NimbusRouter.address,
    NimbusReferralProgram.address
  );
};
