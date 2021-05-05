const LockStakingRewardFixedAPY = artifacts.require(
  "LockStakingRewardFixedAPY"
);
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const Router = artifacts.require("NimbusRouter");
const Factory = artifacts.require("NimbusFactory");
const LPReward = artifacts.require("LPReward");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const timeHelper = require("../utils/timeHelpers");
const { DAY, ZERO } = require("../utils/constants");
const { mockWeightedStakeDate } = require("../utils/mocks");

contract("LockStakingRewardFixedAPY", (accounts) => {
  const [owner, client, notAllowAccount] = accounts;
  const clientAllowance = MAX_UINT256;
  const stakeAmount = new BN("200");
  const _lockDuration = new BN(86400); // 1 day
  const _rewardRate = new BN(100);
  const _rewardDuration = DAY.muln(365);

  before(async function () {
    this.stakingToken = await NBU.deployed();
    this.rewardToken = await GNBU.deployed();
    this.router = await Router.deployed();
    this.factory = await Factory.deployed();
    this.LPReward = await LPReward.deployed();

    await this.LPReward.updateSwapRouter(this.router.address, { from: owner });
    await this.stakingToken.approve(this.router.address, MAX_UINT256);
    await this.rewardToken.approve(this.router.address, MAX_UINT256);
    await this.router.addLiquidity(
      this.stakingToken.address,
      this.rewardToken.address,
      new BN(10000),
      new BN(10000),
      0,
      0,
      accounts[0],
      MAX_UINT256
    );

    await this.stakingToken.transfer(client, new BN("10000"));
    await this.rewardToken.transfer(client, new BN("10000"));
  });

  beforeEach(async function () {
    this.contract = await LockStakingRewardFixedAPY.new(
      this.rewardToken.address,
      this.stakingToken.address,
      this.router.address,
      _rewardRate,
      _lockDuration
    );
    await this.stakingToken.approve(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.stakingToken.transfer(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.stakingToken.approve(this.contract.address, clientAllowance, {
      from: client,
    });

    await this.rewardToken.approve(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.rewardToken.transfer(this.contract.address, new BN(100000), {
      from: owner,
    });
    await this.rewardToken.approve(this.contract.address, clientAllowance, {
      from: client,
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
        const equivalentAmount = await this.contract.getEquivalentAmount(
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
        const equivalentAmount = await this.contract.getEquivalentAmount(
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

      it("before lock period pass", async function () {
        const timeIncrease = _lockDuration.divn(2).toNumber();
        await timeHelper.increaseTime(timeIncrease);

        expect(await this.contract.earned(client)).to.be.bignumber.equal(ZERO);
      });

      it("after lock period", async function () {
        const timeIncrease = _lockDuration.toNumber();

        const expectedEarn = getEarnedMock(this.balancesRewardEq, timeIncrease);
        await timeHelper.increaseTime(timeIncrease);

        expect(await this.contract.earned(client)).to.be.bignumber.equal(
          expectedEarn
        );
      });

      it("after lock period + 100 days ", async function () {
        const timeIncrease = _lockDuration.add(DAY.muln(100)).toNumber();

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

        const timeIncrease = _lockDuration.toNumber();
        await timeHelper.increaseTime(timeIncrease);

        const balanceOfRewardEquivalent = await this.contract.getEquivalentAmount(
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
        "LockStakingRewardFixedAPY: Cannot stake 0"
      );
    });

    describe("value more than 0", function () {
      it("stake for sender", async function () {
        const { logs } = await this.contract.stake(stakeAmount, {
          from: owner,
        });
        const timeStamp = await time.latest();

        const equivalent = await this.contract.getEquivalentAmount(stakeAmount);
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
          await this.contract.stakeLocks(owner, nonce)
        ).to.be.bignumber.equal(timeStamp.add(_lockDuration));

        expect(
          await this.contract.weightedStakeDate(owner)
        ).to.be.bignumber.equal(timeStamp);
      });

      it("stake for another account ", async function () {
        const { logs } = await this.contract.stakeFor(stakeAmount, client, {
          from: owner,
        });
        const timeStamp = await time.latest();

        const equivalent = await this.contract.getEquivalentAmount(stakeAmount);
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
          await this.contract.stakeLocks(client, nonce)
        ).to.be.bignumber.equal(timeStamp.add(_lockDuration));

        expect(
          await this.contract.weightedStakeDate(client)
        ).to.be.bignumber.equal(timeStamp);
      });

      it("two stake", async function () {
        const stakesAmount = [stakeAmount, stakeAmount.addn(300)];
        const nonces = [ZERO, new BN(1)];
        const equivalents = [
          await this.contract.getEquivalentAmount(stakesAmount[0]),
          await this.contract.getEquivalentAmount(stakesAmount[1]),
        ];
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
          await this.contract.stakeLocks(owner, nonces[0])
        ).to.be.bignumber.equal(timeStamp1.add(_lockDuration));
        expect(
          await this.contract.stakeLocks(owner, nonces[1])
        ).to.be.bignumber.equal(timeStamp2.add(_lockDuration));

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
    const stakeValue = stakeAmount;
    it("doesn't stake before", async function () {
      await expectRevert(
        this.contract.withdraw(0, { from: client }),
        "LockStakingRewardFixedAPY: This stake nonce was withdrawn"
      );
    });

    describe("stake before", function () {
      beforeEach(async function () {
        this.balanceBeforeStake = await this.stakingToken.balanceOf(client);
        await this.contract.stake(stakeValue, { from: client });
      });

      it("reject when is locked", async function () {
        await expectRevert(
          this.contract.withdraw(0, { from: client }),
          "LockStakingRewardFixedAPY: Locked"
        );
      });

      it("success after lock period", async function () {
        const timeIncrease = _lockDuration.toNumber() + 1;
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

        expect(await this.stakingToken.balanceOf(client)).to.be.bignumber.equal(
          this.balanceBeforeStake
        );
      });

      it("succes two stake", async function () {
        const secondStakeValue = new BN(300);
        const equivalent = await this.contract.getEquivalentAmount(stakeValue);
        await this.contract.stake(secondStakeValue, { from: client });

        const timeIncrease = _lockDuration.toNumber() + 1;
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

        expect(await this.stakingToken.balanceOf(client)).to.be.bignumber.equal(
          this.balanceBeforeStake.sub(stakeValue)
        );
      });
    });
  });

  describe("getReward", function () {
    const stakeValue = stakeAmount;
    it("doesn't stake before", async function () {
      const event = await this.contract.getReward({ from: client });
      expectEvent.notEmitted(event, "RewardPaid");
    });

    describe("stake before", function () {
      beforeEach(async function () {
        this.stakingTokenBalanceBeforeStake = await this.stakingToken.balanceOf(
          client
        );
        this.rewardTokenBalanceBeforeStake = await this.rewardToken.balanceOf(
          client
        );
        await this.contract.stake(stakeValue, { from: client });
      });

      it("success after lock period", async function () {
        const timeIncrease = DAY.muln(300).toNumber();
        await timeHelper.increaseTime(timeIncrease);
        const earned = await this.contract.earned(client);

        const { logs } = await this.contract.getReward({ from: client });
        const newStakingBalance = await this.stakingToken.balanceOf(client);
        const newRewardBalance = await this.rewardToken.balanceOf(client);

        expectEvent.inLogs(logs, "RewardPaid", {
          user: client,
          reward: earned,
        });
        expect(newStakingBalance).to.be.bignumber.equal(
          this.stakingTokenBalanceBeforeStake.sub(stakeValue)
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
        const newStakingBalance = await this.stakingToken.balanceOf(client);
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
          this.stakingTokenBalanceBeforeStake
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
            "LockStakingRewardFixedAPY: Cannot rescue to the zero address"
          );
        });

        it("zero amount", async function () {
          await expectRevert(
            this.contract.rescue(owner, this.rewardToken.address, ZERO, {
              from: owner,
            }),
            "LockStakingRewardFixedAPY: Cannot rescue 0"
          );
        });

        it("staking token", async function () {
          await expectRevert(
            this.contract.rescue(owner, this.stakingToken.address, value, {
              from: owner,
            }),
            "LockStakingRewardFixedAPY: Cannot rescue staking token"
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
            "LockStakingRewardFixedAPY: Cannot rescue to the zero address"
          );
        });

        it("zero amount", async function () {
          await expectRevert(
            this.contract.methods["rescue(address,uint256)"](owner, ZERO, {
              from: owner,
            }),
            "LockStakingRewardFixedAPY: Cannot rescue 0"
          );
        });
      });
    });
  });
});
