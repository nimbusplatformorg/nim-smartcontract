const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const NimbusRouter = artifacts.require("NimbusRouter");
const TT = artifacts.require("ERC20TestToken");
const NimbusPair = artifacts.require("NimbusPair");
// const NBU_WETH = artifacts.require("NBU_WETH");
// const Factory = artifacts.require("NimbusERC20");
// const LPRewards = artifacts.require("LPReward");

const LockStakingRewardsSameTokenFixedAPY = artifacts.require(
  "LockStakingRewardSameTokenFixedAPY"
);
const StakingRewardsSameTokenFixedAPY = artifacts.require(
  "StakingRewardsSameTokenFixedAPY"
);

const LockStakingRewardFixedAPY = artifacts.require(
  "LockStakingRewardFixedAPY"
);
const StakingRewardFixedAPY = artifacts.require("StakingRewardFixedAPY");

const LockStakingRewardMinAmountFixedAPY = artifacts.require(
  "LockStakingRewardMinAmountFixedAPY"
);
const StakingRewardMinAmountFixedAPY = artifacts.require(
  "StakingRewardMinAmountFixedAPY"
);

const LockStakingLPRewardFixedAPY = artifacts.require(
  "LockStakingLPRewardFixedAPY"
);
const StakingLPRewardFixedAPY = artifacts.require("StakingLPRewardFixedAPY");

module.exports = async function (deployer) {
  const _lockDuration = 86400; // 1 day
  const _rewardRate = 100;

  await deployer.deploy(
    LockStakingRewardsSameTokenFixedAPY,
    NBU.address,
    _rewardRate,
    _lockDuration
  );
  await deployer.deploy(
    StakingRewardsSameTokenFixedAPY,
    NBU.address,
    _rewardRate
  );

  await deployer.deploy(
    LockStakingRewardFixedAPY,
    GNBU.address,
    NBU.address,
    NimbusRouter.address,
    _rewardRate,
    _lockDuration
  );
  await deployer.deploy(
    StakingRewardFixedAPY,
    GNBU.address,
    NBU.address,
    NimbusRouter.address,
    _rewardRate
  );

  await deployer.deploy(
    LockStakingRewardMinAmountFixedAPY,
    GNBU.address,
    NBU.address,
    _rewardRate,
    _lockDuration,
    NimbusRouter.address,
    TT.address,
    100
  );
  await deployer.deploy(
    StakingRewardMinAmountFixedAPY,
    GNBU.address,
    NBU.address,
    _rewardRate,
    NimbusRouter.address,
    TT.address,
    100
  );

  await deployer.deploy(
    LockStakingLPRewardFixedAPY,
    GNBU.address,
    NimbusPair.address,
    NBU.address,
    TT.address,
    NimbusRouter.address,
    _rewardRate,
    _lockDuration
  );

  await deployer.deploy(
    StakingLPRewardFixedAPY,
    GNBU.address,
    NimbusPair.address,
    NBU.address,
    TT.address,
    NimbusRouter.address,
    _rewardRate
  );
};
