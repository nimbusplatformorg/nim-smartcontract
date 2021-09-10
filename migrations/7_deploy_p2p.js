const NimbusP2P = artifacts.require("NimbusERC20P2P_V1");
const NBU_WETH = artifacts.require("NBU_WETH");

module.exports = async function (deployer) {
  await deployer.deploy(NimbusP2P, NBU_WETH.address);
};
