const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const red = BN.red("k256");
const StakingLPRewardFixedAPY = artifacts.require("StakingLPRewardFixedAPY");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const Router = artifacts.require("NimbusRouter");
const Factory = artifacts.require("NimbusFactory");
const LPReward = artifacts.require("LPReward");
const TT = artifacts.require("ERC20TestToken");
const NimbusPair = artifacts.require("NimbusPair");
const { expect } = require("chai");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const timeHelper = require("../utils/timeHelpers");
const { DAY, ZERO } = require("../utils/constants");
const {
  mockWeightedStakeDate,
  mockAmoutsOut,
  mockCurrentLPPrice,
} = require("../utils/mocks");

contract("StakingLPRewardFixedAPY", (accounts) => {
  const [owner, client, notAllowAccount] = accounts;
  const clientAllowance = MAX_UINT256;
  const defaultPeriod = new BN(86400); 
  const _rewardRate = new BN(100);
  const _rewardDuration = DAY.muln(365);
  const stakeAmount = new BN("2000");

  async function getEquivalentAmount(contract, amount) {
    const price = await contract.getCurrentLPPrice();
    return price.mul(amount).div(new BN(10).pow(new BN(18)));
  }

  before(async function () {
    this.rewardToken = await GNBU.deployed();

    this.tokenA = await NBU.deployed();
    this.tokenB = await TT.deployed();

    this.router = await Router.deployed();
    this.factory = await Factory.deployed();
    this.LPReward = await LPReward.deployed();

    async function getPair(factory, address1, address2) {
      const result = await factory.getPair(address1, address2);
      return await NimbusPair.at(result);
    }

    await this.LPReward.updateSwapRouter(this.router.address, { from: owner });
    await this.tokenA.approve(this.router.address, MAX_UINT256);
    await this.rewardToken.approve(this.router.address, MAX_UINT256);
    await this.tokenB.approve(this.router.address, MAX_UINT256);

    await this.router.addLiquidity(
      this.tokenA.address,
      this.tokenB.address,
      new BN(1000000000),
      new BN(1000000000),
      0,
      0,
      accounts[0],
      MAX_UINT256
    );

    await this.router.addLiquidity(
      this.rewardToken.address,
      this.tokenA.address,
      new BN(10000),
      new BN(10000),
      0,
      0,
      accounts[0],
      MAX_UINT256
    );

    await this.router.addLiquidity(
      this.rewardToken.address,
      this.tokenB.address,
      new BN(10000),
      new BN(10000),
      0,
      0,
      accounts[0],
      MAX_UINT256
    );

    this.stakingLPToken = await getPair(
      this.factory,
      this.tokenA.address,
      this.tokenB.address
    );
    await this.stakingLPToken.approve(this.router.address, MAX_UINT256);
    this.LPTokenReserves = await this.stakingLPToken.getReserves();
    this.rewardTokenAReserves = await (
      await getPair(this.factory, this.rewardToken.address, this.tokenA.address)
    ).getReserves();
    this.rewardTokenBReserves = await (
      await getPair(this.factory, this.rewardToken.address, this.tokenB.address)
    ).getReserves();

    await this.tokenA.transfer(client, new BN("10000"));
    await this.tokenB.transfer(client, new BN("10000"));
    await this.stakingLPToken.transfer(client, new BN("100000"));
    await this.rewardToken.transfer(client, new BN("10000"));
  });

  beforeEach(async function () {
    this.contract = await StakingLPRewardFixedAPY.new(
      this.rewardToken.address,
      this.stakingLPToken.address,
      this.tokenA.address,
      this.tokenB.address,
      this.router.address,
      _rewardRate
    );

    await this.rewardToken.approve(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.rewardToken.transfer(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.rewardToken.approve(this.contract.address, clientAllowance, {
      from: client,
    });

    await this.stakingLPToken.approve(this.contract.address, new BN(1000000), {
      from: owner,
    });
    await this.stakingLPToken.transfer(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.stakingLPToken.approve(this.contract.address, clientAllowance, {
      from: client,
    });
  });

  describe("getDecimalPriceCalculationCompensate", function () {
    it("equal decimals of tokens minus 6", async function () {
      const decimalsTokenA = await this.tokenA.decimals();
      const decimalsTokenB = await this.tokenB.decimals();
      const result = await this.contract.getDecimalPriceCalculationCompensate();
      expect(result.tokenADecimalCompensate).to.be.bignumber.equal(
        decimalsTokenA.subn(6)
      );
      expect(result.tokenBDecimalCompensate).to.be.bignumber.equal(
        decimalsTokenB.subn(6)
      );
    });
  });

  describe("total supply", function () {
    describe("before stake", function () {
      it("tokens", async function () {
        expect(await this.contract.totalSupply()).to.be.bignumber.equal(ZERO);
      });

      it("reward equivalent", async function () {
        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(ZERO);
      });
    });

    describe("after stake", function () {
      beforeEach(async function () {
        await this.contract.stake(stakeAmount, {
          from: owner,
        });
      });

      it("tokens", async function () {
        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeAmount
        );
      });

      it("reward equivalent", async function () {
        const equivalentAmount = await getEquivalentAmount(
          this.contract,
          stakeAmount
        );
        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(equivalentAmount);
      });
    });
  });

  describe("balanceOf", function () {
    describe("before stake", function () {
      it("tokens", async function () {
        expect(
          await this.contract.balanceOf(notAllowAccount)
        ).to.be.bignumber.equal(ZERO);
      });

      it("reward equivalent", async function () {
        expect(
          await this.contract.balanceOfRewardEquivalent(notAllowAccount)
        ).to.be.bignumber.equal(ZERO);
      });
    });

    describe("after stake", function () {
      beforeEach(async function () {
        await this.contract.stake(stakeAmount, {
          from: owner,
        });
      });

      it("tokens", async function () {
        expect(await this.contract.balanceOf(owner)).to.be.bignumber.equal(
          stakeAmount
        );
      });

      it("reward equivalent", async function () {
        const equivalentAmount = await getEquivalentAmount(
          this.contract,
          stakeAmount
        );
        expect(
          await this.contract.balanceOfRewardEquivalent(owner)
        ).to.be.bignumber.equal(equivalentAmount);
      });
    });
  });

  describe("earned", function () {
    function getEarnedMock(eqBalance, timeIncrease) {
      return eqBalance
        .muln(timeIncrease)
        .mul(_rewardRate)
        .div(_rewardDuration.muln(100));
    }

    describe("without stake", function () {
      it("returns zero", async function () {
        expect(await this.contract.earned(client)).to.be.bignumber.equal(ZERO);
      });
    });

    describe("with stake", function () {
      beforeEach(async function () {
        await this.contract.stake(stakeAmount, { from: client });
        this.balancesRewardEq = await this.contract.balanceOfRewardEquivalent(
          client
        );
      });

      it("before default period pass", async function () {
        const timeIncrease = defaultPeriod.divn(2).toNumber();
        await timeHelper.increaseTime(timeIncrease);

        expect(await this.contract.earned(client)).to.be.bignumber.equal(ZERO);
      });

      it("after default period", async function () {
        const timeIncrease = defaultPeriod.toNumber();

        const expectedEarn = getEarnedMock(this.balancesRewardEq, timeIncrease);
        await timeHelper.increaseTime(timeIncrease);

        expect(await this.contract.earned(client)).to.be.bignumber.equal(
          expectedEarn
        );
      });

      it("after default period + 100 days ", async function () {
        const timeIncrease = defaultPeriod.add(DAY.muln(100)).toNumber();

        const expectedEarn = getEarnedMock(this.balancesRewardEq, timeIncrease);
        await timeHelper.increaseTime(timeIncrease);

        expect(await this.contract.earned(client)).to.be.bignumber.equal(
          expectedEarn
        );
      });

      it("after two stake", async function () {
        const stakeAmount2 = new BN(300);
        const timeStamp1 = await time.latest();

        const { logs } = await this.contract.stake(stakeAmount2, {
          from: client,
        });
        const timeStamp2 = await timeHelper.getBlockTimestamp(
          logs[0].blockNumber
        );

        const expectedWeightedStakeDate1 = mockWeightedStakeDate(
          ZERO,
          stakeAmount,
          ZERO,
          timeStamp1
        );

        const expectedWeightedStakeDate2 = mockWeightedStakeDate(
          stakeAmount,
          stakeAmount2,
          expectedWeightedStakeDate1,
          timeStamp2
        );

        const timeIncrease = defaultPeriod.toNumber();
        await timeHelper.increaseTime(timeIncrease);

        const balanceOfRewardEquivalent = await getEquivalentAmount(
          this.contract,
          stakeAmount.add(stakeAmount2)
        );

        const expectedEarn = getEarnedMock(
          balanceOfRewardEquivalent,
          timeStamp2
            .addn(timeIncrease)
            .sub(expectedWeightedStakeDate2)
            .toNumber()
        );

        expect(await this.contract.earned(client)).to.be.bignumber.equal(
          expectedEarn
        );
      });
    });
  });

  describe("stake", function () {
    it("reject when contract doesnt have allowance token from user", async function () {
      await expectRevert(
        this.contract.stake(stakeAmount, {
          from: notAllowAccount,
        }),
        "SafeERC20: low-level call failed"
      );
    });

    it("reject stake zero value", async function () {
      await expectRevert(
        this.contract.stake(ZERO, { from: owner }),
        "StakingLPRewardFixedAPY: Cannot stake 0"
      );
    });

    describe("value more than 0", function () {
      it("stake for sender", async function () {
        const { logs } = await this.contract.stake(stakeAmount, {
          from: owner,
        });
        const timeStamp = await time.latest();

        const equivalent = await getEquivalentAmount(
          this.contract,
          stakeAmount
        );
        const nonce = ZERO;

        expectEvent.inLogs(logs, "Staked", {
          user: owner,
          amount: stakeAmount,
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeAmount
        );

        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(equivalent);

        expect(await this.contract.balanceOf(owner)).to.be.bignumber.equal(
          stakeAmount
        );

        expect(
          await this.contract.balanceOfRewardEquivalent(owner)
        ).to.be.bignumber.equal(equivalent);

        expect(await this.contract.stakeNonces(owner)).to.be.bignumber.equal(
          nonce.addn(1)
        );

        expect(
          await this.contract.stakeAmounts(owner, nonce)
        ).to.be.bignumber.equal(stakeAmount);

        expect(
          await this.contract.stakeAmountsRewardEquivalent(owner, nonce)
        ).to.be.bignumber.equal(equivalent);

        expect(
          await this.contract.weightedStakeDate(owner)
        ).to.be.bignumber.equal(timeStamp);
      });

      it("stake for another account ", async function () {
        const { logs } = await this.contract.stakeFor(stakeAmount, client, {
          from: owner,
        });
        const timeStamp = await time.latest();

        const equivalent = await getEquivalentAmount(
          this.contract,
          stakeAmount
        );
        const nonce = ZERO;

        expectEvent.inLogs(logs, "Staked", {
          user: client,
          amount: stakeAmount,
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeAmount
        );

        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(equivalent);

        expect(await this.contract.balanceOf(client)).to.be.bignumber.equal(
          stakeAmount
        );

        expect(
          await this.contract.balanceOfRewardEquivalent(client)
        ).to.be.bignumber.equal(equivalent);

        expect(await this.contract.stakeNonces(client)).to.be.bignumber.equal(
          nonce.addn(1)
        );

        expect(
          await this.contract.stakeAmounts(client, nonce)
        ).to.be.bignumber.equal(stakeAmount);

        expect(
          await this.contract.stakeAmountsRewardEquivalent(client, nonce)
        ).to.be.bignumber.equal(equivalent);

        expect(
          await this.contract.weightedStakeDate(client)
        ).to.be.bignumber.equal(timeStamp);
      });

      it("two stake", async function () {
        const stakesAmount = [stakeAmount, stakeAmount.addn(300)];
        const equivalents = [
          await getEquivalentAmount(this.contract, stakesAmount[0]),
          await getEquivalentAmount(this.contract, stakesAmount[1]),
        ];
        const nonces = [ZERO, new BN(1)];

        const logs1 = await this.contract.stake(stakesAmount[0], {
          from: owner,
        });
        const logs2 = await this.contract.stake(stakesAmount[1], {
          from: owner,
        });
        const timeStamp1 = await timeHelper.getBlockTimestamp(
          logs1.logs[0].blockNumber
        );
        const timeStamp2 = await time.latest();

        const expectedWeightedStakeDate1 = mockWeightedStakeDate(
          ZERO,
          stakesAmount[0],
          ZERO,
          timeStamp1
        );

        const expectedWeightedStakeDate2 = mockWeightedStakeDate(
          stakesAmount[0],
          stakesAmount[1],
          expectedWeightedStakeDate1,
          timeStamp2
        );

        expectEvent.inLogs(logs1.logs, "Staked", {
          user: owner,
          amount: stakesAmount[0],
        });
        expectEvent.inLogs(logs2.logs, "Staked", {
          user: owner,
          amount: stakesAmount[1],
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakesAmount[0].add(stakesAmount[1])
        );

        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(equivalents[0].add(equivalents[1]));

        expect(await this.contract.balanceOf(owner)).to.be.bignumber.equal(
          stakesAmount[0].add(stakesAmount[1])
        );

        expect(
          await this.contract.balanceOfRewardEquivalent(owner)
        ).to.be.bignumber.equal(equivalents[0].add(equivalents[1]));

        expect(await this.contract.stakeNonces(owner)).to.be.bignumber.equal(
          nonces[1].addn(1)
        );

        expect(
          await this.contract.stakeAmounts(owner, nonces[0])
        ).to.be.bignumber.equal(stakesAmount[0]);

        expect(
          await this.contract.stakeAmounts(owner, nonces[1])
        ).to.be.bignumber.equal(stakesAmount[1]);

        expect(
          await this.contract.stakeAmountsRewardEquivalent(owner, nonces[0])
        ).to.be.bignumber.equal(equivalents[0]);
        expect(
          await this.contract.stakeAmountsRewardEquivalent(owner, nonces[1])
        ).to.be.bignumber.equal(equivalents[1]);

        expect(
          await this.contract.weightedStakeDate(owner)
        ).to.be.bignumber.equal(expectedWeightedStakeDate2);
      });

      it("reject when stake more than approve", async function () {
        await expectRevert(
          this.contract.stake(clientAllowance.addn(1), { from: client }),
          "value out-of-bounds"
        );
      });
    });
  });

  describe("withdraw", function () {
    const stakeValue = new BN("100");
    it("doesn't stake before", async function () {
      await expectRevert(
        this.contract.withdraw(0, { from: client }),
        "StakingLPRewardFixedAPY: This stake nonce was withdrawn"
      );
    });

    describe("stake before", function () {
      beforeEach(async function () {
        this.balanceBeforeStake = await this.stakingLPToken.balanceOf(client);
        await this.contract.stake(stakeValue, { from: client });
      });

      it("success after default period", async function () {
        const timeIncrease = defaultPeriod.toNumber() + 1;
        await timeHelper.increaseTime(timeIncrease);

        const { logs } = await this.contract.withdraw(0, { from: client });

        expectEvent.inLogs(logs, "Withdrawn", {
          user: client,
          amount: stakeValue,
        });
        expect(await this.contract.totalSupply()).to.be.bignumber.equal(ZERO);
        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(ZERO);

        expect(await this.contract.balanceOf(client)).to.be.bignumber.equal(
          ZERO
        );
        expect(
          await this.contract.balanceOfRewardEquivalent(client)
        ).to.be.bignumber.equal(ZERO);

        expect(
          await this.contract.stakeAmounts(client, 0)
        ).to.be.bignumber.equal(ZERO);
        expect(
          await this.contract.stakeAmountsRewardEquivalent(client, 0)
        ).to.be.bignumber.equal(ZERO);

        expect(await this.contract.stakeNonces(client)).to.be.bignumber.equal(
          "1"
        );

        expect(
          await this.stakingLPToken.balanceOf(client)
        ).to.be.bignumber.equal(this.balanceBeforeStake);
      });

      it("succes two stake", async function () {
        const secondStakeValue = new BN(300);
        const equivalent = await getEquivalentAmount(this.contract, stakeValue);
        await this.contract.stake(secondStakeValue, { from: client });

        const timeIncrease = defaultPeriod.toNumber() + 1;
        await timeHelper.increaseTime(timeIncrease);

        const { logs } = await this.contract.withdraw(1, { from: client });

        expectEvent.inLogs(logs, "Withdrawn", {
          user: client,
          amount: secondStakeValue,
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeValue
        );
        expect(
          await this.contract.totalSupplyRewardEquivalent()
        ).to.be.bignumber.equal(equivalent);

        expect(await this.contract.balanceOf(client)).to.be.bignumber.equal(
          stakeValue
        );
        expect(
          await this.contract.balanceOfRewardEquivalent(client)
        ).to.be.bignumber.equal(equivalent);

        expect(
          await this.contract.stakeAmounts(client, 0)
        ).to.be.bignumber.equal(stakeValue);
        expect(
          await this.contract.stakeAmountsRewardEquivalent(client, 0)
        ).to.be.bignumber.equal(equivalent);

        expect(
          await this.contract.stakeAmounts(client, 1)
        ).to.be.bignumber.equal(ZERO);
        expect(
          await this.contract.stakeAmountsRewardEquivalent(client, 1)
        ).to.be.bignumber.equal(ZERO);

        expect(await this.contract.stakeNonces(client)).to.be.bignumber.equal(
          "2"
        );

        expect(
          await this.stakingLPToken.balanceOf(client)
        ).to.be.bignumber.equal(this.balanceBeforeStake.sub(stakeValue));
      });
    });
  });

  describe("getReward", function () {
    const stakeValue = new BN("1000");
    it("doesn't stake before", async function () {
      const event = await this.contract.getReward({ from: client });
      expectEvent.notEmitted(event, "RewardPaid");
    });

    describe("stake before", function () {
      beforeEach(async function () {
        this.stakingLPTokenBalanceBeforeStake = await this.stakingLPToken.balanceOf(
          client
        );
        this.rewardTokenBalanceBeforeStake = await this.rewardToken.balanceOf(
          client
        );
        await this.contract.stake(stakeValue, { from: client });
      });

      it("success after default period", async function () {
        const timeIncrease = DAY.muln(300).toNumber();
        await timeHelper.increaseTime(timeIncrease);
        const earned = await this.contract.earned(client);
        const { logs } = await this.contract.getReward({ from: client });
        const newStakingBalance = await this.stakingLPToken.balanceOf(client);
        const newRewardBalance = await this.rewardToken.balanceOf(client);

        expectEvent.inLogs(logs, "RewardPaid", {
          user: client,
          reward: earned,
        });
        expect(newStakingBalance).to.be.bignumber.equal(
          this.stakingLPTokenBalanceBeforeStake.sub(stakeValue)
        );
        expect(newRewardBalance).to.be.bignumber.equal(
          this.rewardTokenBalanceBeforeStake.add(earned)
        );
      });

      it("success withdrawAndGetReward", async function () {
        const timeIncrease = DAY.muln(300).toNumber();
        await timeHelper.increaseTime(timeIncrease);
        const earned = await this.contract.earned(client);

        const { logs } = await this.contract.withdrawAndGetReward(0, {
          from: client,
        });
        const newStakingBalance = await this.stakingLPToken.balanceOf(client);
        const newRewardBalance = await this.rewardToken.balanceOf(client);
        expectEvent.inLogs(logs, "RewardPaid", {
          user: client,
          reward: earned,
        });
        expectEvent.inLogs(logs, "Withdrawn", {
          user: client,
          amount: stakeValue,
        });
        expect(newStakingBalance).to.be.bignumber.equal(
          this.stakingLPTokenBalanceBeforeStake
        );
        expect(newRewardBalance).to.be.bignumber.equal(
          this.rewardTokenBalanceBeforeStake.add(earned)
        );
      });
    });
  });

  describe("updateRewardAmount", function () {
    it("not owner", async function () {
      await expectRevert(
        this.contract.updateRewardAmount(new BN(200), { from: client }),
        "Ownable: Caller is not the owner"
      );
    });
    it("owner", async function () {
      const newReward = new BN(200);
      const { logs } = await this.contract.updateRewardAmount(newReward, {
        from: owner,
      });
      expectEvent.inLogs(logs, "RewardUpdated", {
        reward: newReward,
      });
    });
  });

  describe("rescue", function () {
    const value = new BN(100);
    describe("not owner", function () {
      it("rescue token", async function () {
        await expectRevert(
          this.contract.rescue(owner, this.rewardToken.address, value, {
            from: client,
          }),
          "Ownable: Caller is not the owner"
        );
      });

      it("rescue", async function () {
        await expectRevert(
          this.contract.methods["rescue(address,uint256)"](owner, value, {
            from: client,
          }),
          "Ownable: Caller is not the owner"
        );
      });
    });

    describe("owner", function () {
      describe("rescue token", function () {
        it("zero address", async function () {
          await expectRevert(
            this.contract.rescue(
              ZERO_ADDRESS,
              this.rewardToken.address,
              value,
              {
                from: owner,
              }
            ),
            "StakingLPRewardFixedAPY: Cannot rescue to the zero address"
          );
        });

        it("zero amount", async function () {
          await expectRevert(
            this.contract.rescue(owner, this.rewardToken.address, ZERO, {
              from: owner,
            }),
            "StakingLPRewardFixedAPY: Cannot rescue 0"
          );
        });

        it("staking token", async function () {
          await expectRevert(
            this.contract.rescue(owner, this.stakingLPToken.address, value, {
              from: owner,
            }),
            "StakingLPRewardFixedAPY: Cannot rescue staking token"
          );
        });

        it("not token address", async function () {
          await expectRevert(
            this.contract.rescue(owner, client, value, {
              from: owner,
            }),
            "SafeERC20: call to non-contract"
          );
        });

        it("success rescue token", async function () {
          const { logs } = await this.contract.rescue(
            owner,
            this.rewardToken.address,
            value,
            {
              from: owner,
            }
          );
          expectEvent.inLogs(logs, "RescueToken", {
            to: owner,
            token: this.rewardToken.address,
            amount: value,
          });
        });
      });

      describe("rescue", function () {
        it("zero address", async function () {
          await expectRevert(
            this.contract.methods["rescue(address,uint256)"](
              ZERO_ADDRESS,
              value,
              {
                from: owner,
              }
            ),
            "StakingLPRewardFixedAPY: Cannot rescue to the zero address"
          );
        });

        it("zero amount", async function () {
          await expectRevert(
            this.contract.methods["rescue(address,uint256)"](owner, ZERO, {
              from: owner,
            }),
            "StakingLPRewardFixedAPY: Cannot rescue 0"
          );
        });
      });
    });
  });
});
