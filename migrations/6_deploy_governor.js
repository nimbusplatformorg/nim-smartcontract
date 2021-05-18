const GNBU = artifacts.require("GNBU");
const LockStakingRewardSameTokenFixedAPY = artifacts.require(
  "LockStakingRewardSameTokenFixedAPY"
);
const NimbusGovernorV1 = artifacts.require("NimbusGovernorV1Test");

module.exports = async function (deployer) {
  await deployer.deploy(NimbusGovernorV1, GNBU.address, [
    LockStakingRewardSameTokenFixedAPY.address,
  ]);
};
