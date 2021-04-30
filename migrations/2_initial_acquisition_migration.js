const NimbusInitialAcquisition = artifacts.require("NimbusInitialAcquisition");
const NBU = artifacts.require("./NimbusCore/NBU");
const Router = artifacts.require("./Swaps/NimbusRouter");
const NBUWETH = artifacts.require("./Swaps/NBU_WETH");
const Factory = artifacts.require("./Swaps/NimbusFactory");
const LPRewards = artifacts.require("./Swaps/LPReward");
const Pool = artifacts.require("./Staking/LockStakingRewardSameTokenFixedAPY");

module.exports = async function (deployer) {
  const accounts = await web3.eth.getAccounts();
  
  await deployer.deploy(NBU);
  const nbu = await NBU.deployed();

  await deployer.deploy(NBUWETH);
  const nbuWeth = await NBUWETH.deployed();
  
  await deployer.deploy(Factory, accounts[0]);
  const factory = await Factory.deployed();

  await deployer.deploy(LPRewards, nbuWeth.address, factory.address);
  const lpRewards = await LPRewards.deployed();

  await deployer.deploy(Router, factory.address, nbuWeth.address, lpRewards.address);
  const router = await Router.deployed();

  await deployer.deploy(Pool, nbu.address, 30, 180);
  const pool = await Pool.deployed();

  await deployer.deploy(NimbusInitialAcquisition, nbu.address, router.address, nbuWeth.address, pool.address);
  const nia = await NimbusInitialAcquisition.deployed();
}
