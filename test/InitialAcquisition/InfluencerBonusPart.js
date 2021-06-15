const NBU = artifacts.require("NBU");
const Token = artifacts.require("ERC20TestToken");
const NimbusRouter = artifacts.require("NimbusRouter");
const NBU_WETH = artifacts.require("NBU_WETH");
const LockStakingRewardsSameTokenFixedAPY = artifacts.require(
  "LockStakingRewardSameTokenFixedAPY"
);

const Referal = artifacts.require("NimbusReferralProgram");
const LPReward = artifacts.require("LPReward");
const NimbusInitialAcquisition = artifacts.require("NimbusInitialAcquisition");
const { snapshot, revertToSnapShot } = require("../utils/timeHelpers");
const {
  expectEvent,
  expectRevert,
  BN,
  send,
} = require("@openzeppelin/test-helpers");
const NBUInfluencerBonusPart = artifacts.require("NBUInfluencerBonusPart");
const { getPowerBN } = require("../utils/helpers");
const Constants = require("../utils/constants");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { expect } = require("chai");

contract("InfluencerBonusPart", function (accounts) {
  const availableInitialSupply = new BN("1000000000000000");
  const _swapTokenAmountForBonusThreshold = new BN("1000");

  async function initReferalProgram(routerAddress, tokenAddress) {
    const RP = await Referal.deployed();
    await RP.migrateUsers(
      [new BN("1000000001")],
      [1],
      [Constants.ZERO_ADDRESS],
      [0]
    );
    await RP.updateSwapRouter(routerAddress);
    await RP.updateSwapToken(tokenAddress);
    await RP.finishBasicMigration(new BN("1000000001"));

    return RP;
  }

  before(async function () {
    this.nbu = await NBU.deployed();
    this.token = await Token.deployed();
    this.router = await NimbusRouter.deployed();
    this.referal = await initReferalProgram(
      this.router.address,
      this.token.address
    );

    this.contract = await NBUInfluencerBonusPart.new(
      this.nbu.address,
      this.router.address,
      this.referal.address
    );

    //referal register
    await this.referal.register({ from: accounts[0] });
    await this.referal.registerBySponsorAddress(accounts[0], {
      from: accounts[1],
    });

    //add liquidity
    this.LPReward = await LPReward.deployed();
    await this.LPReward.updateSwapRouter(this.router.address);
    await this.nbu.approve(this.router.address, Constants.MAX_UINT256);
    await this.token.approve(this.router.address, Constants.MAX_UINT256);
    await this.router.addLiquidity(
      this.nbu.address,
      this.token.address,
      new BN(10000),
      new BN(10000),
      0,
      0,
      accounts[0],
      Constants.MAX_UINT256
    );

    this.pool = await LockStakingRewardsSameTokenFixedAPY.deployed();

    await this.nbu.approve(this.pool.address, Constants.MAX_UINT256);
    await this.token.approve(this.pool.address, Constants.MAX_UINT256);
    await this.nbu.approve(this.pool.address, Constants.MAX_UINT256, {
      from: accounts[1],
    });

    await this.token.approve(this.contract.address, Constants.MAX_UINT256);
    await this.nbu.approve(this.contract.address, Constants.MAX_UINT256);

    await this.contract.updateStakingPoolAdd(this.pool.address);
    await this.contract.updateSwapTokenAmountForBonusThreshold(
      _swapTokenAmountForBonusThreshold
    );
    await this.contract.updateSwapToken(this.token.address);
    await this.contract.updateInfluencer(accounts[0], true);

    await this.nbu.transfer(this.contract.address, getPowerBN("10e18"));

    this.minNbuAmountForBonus = (
      await this.router.getAmountsOut(_swapTokenAmountForBonusThreshold, [
        this.token.address,
        this.nbu.address,
      ])
    )[1];

    this.snapshotId = await snapshot();
  });

  afterEach(async function () {
    await revertToSnapShot(this.snapshotId);
  });

  beforeEach(async function () {
    this.snapshotId = await snapshot();
  });

  describe("claimBonus & isBonusForUserAllowed", function () {
    it("reject when not influencer", async function () {
      await this.contract.updateInfluencer(accounts[0], false);

      expect(
        await this.contract.isBonusForUserAllowed(accounts[0], accounts[1])
      ).to.be.equal(false);
      await expectRevert(
        this.contract.claimBonus([accounts[1]]),
        "NBUInfluencerBonusPart: Not influencer"
      );
    });

    it("reject when is not sponsor", async function () {
      await this.contract.updateInfluencer(accounts[2], true);

      expect(
        await this.contract.isBonusForUserAllowed(accounts[2], accounts[1])
      ).to.be.equal(false);
      await expectRevert(
        this.contract.claimBonus([accounts[1]], { from: accounts[2] }),
        "NBUInfluencerBonusPart: Not user sponsor"
      );
    });

    it("reject when less then threshold", async function () {
      expect(
        await this.contract.isBonusForUserAllowed(accounts[0], accounts[1])
      ).to.be.equal(false);
      await expectRevert(
        this.contract.claimBonus([accounts[1]]),
        "NBUInfluencerBonusPart: Bonus threshold not met"
      );
    });

    it("success claim bonus", async function () {
      await this.nbu.transfer(accounts[1], this.minNbuAmountForBonus);
      await this.pool.stake(this.minNbuAmountForBonus, { from: accounts[1] });

      expect(
        await this.contract.isBonusForUserAllowed(accounts[0], accounts[1])
      ).to.be.equal(true);
      const tx = await this.contract.claimBonus([accounts[1]]);

      await expectEvent(tx, "ProcessInfluencerBonus", {
        influencer: accounts[0],
        user: accounts[1],
        userAmount: this.minNbuAmountForBonus,
        influencerBonus: getPowerBN("5e18"),
      });

      await expectEvent.inTransaction(tx.tx, this.nbu, "Transfer", {
        from: this.contract.address,
        to: accounts[0],
        value: getPowerBN("5e18"),
      });
    });

    it("reject when already received", async function () {
      await this.nbu.transfer(accounts[1], this.minNbuAmountForBonus);
      await this.pool.stake(this.minNbuAmountForBonus, { from: accounts[1] });

      await this.contract.claimBonus([accounts[1]]);
      expect(
        await this.contract.isBonusForUserAllowed(accounts[0], accounts[1])
      ).to.be.equal(false);
      await expectRevert(
        this.contract.claimBonus([accounts[1]]),
        "NBUInfluencerBonusPart: Bonus for user already received"
      );
    });
  });
});
