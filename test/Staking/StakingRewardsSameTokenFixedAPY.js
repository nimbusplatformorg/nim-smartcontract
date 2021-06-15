const StakingRewardsSameTokenFixedAPY = artifacts.require(
  "StakingRewardsSameTokenFixedAPY"
);
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
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

contract("StakingRewardsSameTokenFixedAPY", (accounts) => {
  const [owner, client, notAllowAccount] = accounts;
  const clientAllowance = MAX_UINT256;
  const stakeAmount = new BN("200");
  const _defaultPeriod = new BN(86400); 
  const _rewardRate = new BN(100);
  const _rewardDuration = DAY.muln(365);

  before(async function () {
    this.token = await NBU.deployed();
    this.swapToken = await GNBU.deployed();
    await this.token.transfer(client, new BN("10000"));
  });

  beforeEach(async function () {
    this.contract = await StakingRewardsSameTokenFixedAPY.new(
      this.token.address,
      _rewardRate
    );
    await this.token.approve(this.contract.address, new BN(100000), {
      from: owner,
    });

    await this.token.approve(this.contract.address, clientAllowance, {
      from: client,
    });

    await this.token.transfer(this.contract.address, new BN(100000), {
      from: owner,
    });

    await this.swapToken.approve(this.contract.address, new BN(100000), {
      from: owner,
    });
  });

  describe("total supply", function () {
    describe("before stake", function () {
      it("tokens", async function () {
        expect(await this.contract.totalSupply()).to.be.bignumber.equal(ZERO);
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
    });
  });

  describe("balanceOf", function () {
    describe("before stake", function () {
      it("tokens", async function () {
        expect(
          await this.contract.balanceOf(notAllowAccount)
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
    });
  });

  describe("earned", function () {
    function getEarnedMock(balance, timeIncrease) {
      return balance
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
      });

      it("before default period pass", async function () {
        const timeIncrease = _defaultPeriod.divn(2).toNumber();
        await timeHelper.increaseTime(timeIncrease);
        const expectedEarn = getEarnedMock(stakeAmount, timeIncrease);
        expect(await this.contract.earned(client)).to.be.bignumber.equal(
          expectedEarn
        );
      });

      it("after default period", async function () {
        const timeIncrease = _defaultPeriod.toNumber();

        const expectedEarn = getEarnedMock(stakeAmount, timeIncrease);
        await timeHelper.increaseTime(timeIncrease);

        expect(await this.contract.earned(client)).to.be.bignumber.equal(
          expectedEarn
        );
      });

      it("after default period + 100 days ", async function () {
        const timeIncrease = _defaultPeriod.add(DAY.muln(100)).toNumber();

        const expectedEarn = getEarnedMock(stakeAmount, timeIncrease);
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

        const timeIncrease = _defaultPeriod.toNumber();
        await timeHelper.increaseTime(timeIncrease);

        const expectedEarn = getEarnedMock(
          stakeAmount.add(stakeAmount2),
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
        "StakingRewardsSameTokenFixedAPY: Cannot stake 0"
      );
    });

    describe("value more than 0", function () {
      it("stake for sender", async function () {
        const { logs } = await this.contract.stake(stakeAmount, {
          from: owner,
        });
        const timeStamp = await time.latest();

        expectEvent.inLogs(logs, "Staked", {
          user: owner,
          amount: stakeAmount,
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeAmount
        );

        expect(await this.contract.balanceOf(owner)).to.be.bignumber.equal(
          stakeAmount
        );

        expect(
          await this.contract.weightedStakeDate(owner)
        ).to.be.bignumber.equal(timeStamp);
      });

      it("stake for another account ", async function () {
        const { logs } = await this.contract.stakeFor(stakeAmount, client, {
          from: owner,
        });
        const timeStamp = await time.latest();
        expectEvent.inLogs(logs, "Staked", {
          user: client,
          amount: stakeAmount,
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeAmount
        );

        expect(await this.contract.balanceOf(client)).to.be.bignumber.equal(
          stakeAmount
        );

        expect(
          await this.contract.weightedStakeDate(client)
        ).to.be.bignumber.equal(timeStamp);
      });

      it("two stake", async function () {
        const stakesAmount = [stakeAmount, stakeAmount.addn(300)];

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

        expect(await this.contract.balanceOf(owner)).to.be.bignumber.equal(
          stakesAmount[0].add(stakesAmount[1])
        );

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
        this.contract.withdraw(100, { from: client }),
        "revert"
      );
    });

    it("reject to zero value", async function () {
      await expectRevert(
        this.contract.withdraw(0, { from: client }),
        "StakingRewardsSameTokenFixedAPY: Cannot withdraw 0"
      );
    });

    describe("stake before", function () {
      beforeEach(async function () {
        this.balanceBeforeStake = await this.token.balanceOf(client);
        await this.contract.stake(stakeValue, { from: client });
      });

      it("success after default period", async function () {
        const timeIncrease = _defaultPeriod.toNumber() + 1;
        await timeHelper.increaseTime(timeIncrease);

        const { logs } = await this.contract.withdraw(stakeValue, {
          from: client,
        });

        expectEvent.inLogs(logs, "Withdrawn", {
          user: client,
          amount: stakeValue,
        });
        expect(await this.contract.totalSupply()).to.be.bignumber.equal(ZERO);

        expect(await this.contract.balanceOf(client)).to.be.bignumber.equal(
          ZERO
        );

        expect(await this.token.balanceOf(client)).to.be.bignumber.equal(
          this.balanceBeforeStake
        );
      });

      it("succes two stake", async function () {
        const secondStakeValue = new BN(300);
        await this.contract.stake(secondStakeValue, { from: client });

        const timeIncrease = _defaultPeriod.toNumber() + 1;
        await timeHelper.increaseTime(timeIncrease);

        const { logs } = await this.contract.withdraw(secondStakeValue, {
          from: client,
        });

        expectEvent.inLogs(logs, "Withdrawn", {
          user: client,
          amount: secondStakeValue,
        });

        expect(await this.contract.totalSupply()).to.be.bignumber.equal(
          stakeValue
        );

        expect(await this.contract.balanceOf(client)).to.be.bignumber.equal(
          stakeValue
        );

        expect(await this.token.balanceOf(client)).to.be.bignumber.equal(
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
        this.tokenBalanceBeforeStake = await this.token.balanceOf(client);
        await this.contract.stake(stakeValue, { from: client });
      });

      it("success after default period", async function () {
        const timeIncrease = DAY.muln(300).toNumber();
        await timeHelper.increaseTime(timeIncrease);
        const earned = await this.contract.earned(client);

        const { logs } = await this.contract.getReward({ from: client });
        const newBalance = await this.token.balanceOf(client);

        expectEvent.inLogs(logs, "RewardPaid", {
          user: client,
          reward: earned,
        });

        expect(newBalance).to.be.bignumber.equal(
          this.tokenBalanceBeforeStake.sub(stakeValue).add(earned)
        );
      });

      it("success withdrawAndGetReward", async function () {
        const timeIncrease = DAY.muln(300).toNumber();
        await timeHelper.increaseTime(timeIncrease);
        const earned = await this.contract.earned(client);

        const { logs } = await this.contract.withdrawAndGetReward(stakeValue, {
          from: client,
        });
        const newBalance = await this.token.balanceOf(client);

        expectEvent.inLogs(logs, "RewardPaid", {
          user: client,
          reward: earned,
        });
        expectEvent.inLogs(logs, "Withdrawn", {
          user: client,
          amount: stakeValue,
        });
        expect(newBalance).to.be.bignumber.equal(
          this.tokenBalanceBeforeStake.add(earned)
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
          this.contract.rescue(owner, this.swapToken.address, value, {
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
            this.contract.rescue(ZERO_ADDRESS, this.swapToken.address, value, {
              from: owner,
            }),
            "StakingRewardsSameTokenFixedAPY: Cannot rescue to the zero address"
          );
        });

        it("zero amount", async function () {
          await expectRevert(
            this.contract.rescue(owner, this.swapToken.address, ZERO, {
              from: owner,
            }),
            "StakingRewardsSameTokenFixedAPY: Cannot rescue 0"
          );
        });

        it("staking token", async function () {
          await expectRevert(
            this.contract.rescue(owner, this.token.address, value, {
              from: owner,
            }),
            "StakingRewardsSameTokenFixedAPY: Cannot rescue staking/reward"
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
          await this.swapToken.transfer(this.contract.address, value);
          const { logs } = await this.contract.rescue(
            owner,
            this.swapToken.address,
            value,
            {
              from: owner,
            }
          );
          expectEvent.inLogs(logs, "RescueToken", {
            to: owner,
            token: this.swapToken.address,
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
            "StakingRewardsSameTokenFixedAPY: Cannot rescue to the zero address"
          );
        });

        it("zero amount", async function () {
          await expectRevert(
            this.contract.methods["rescue(address,uint256)"](owner, ZERO, {
              from: owner,
            }),
            "StakingRewardsSameTokenFixedAPY: Cannot rescue 0"
          );
        });
      });
    });
  });
});
