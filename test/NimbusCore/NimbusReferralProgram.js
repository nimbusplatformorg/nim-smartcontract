const NBU = artifacts.require("NBU");
const Router = artifacts.require("NimbusRouter");
const TT = artifacts.require("ERC20TestToken");
const Referal = artifacts.require("NimbusReferralProgram");
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
const { mockSwap } = require("../utils/mocks");
const { ZERO } = require("../utils/constants");
const { utils } = require("ethers");
const { keccak256, defaultAbiCoder, toUtf8Bytes } = utils;
contract("NimbusReferralProgram", (accounts) => {
  const [owner, client] = accounts;
  const virtualSponsorId = new BN(1000000001);
  const defaultFeeAmount = new BN(100);
  const _minAmountForCheck = 10 ** 3;
  const _swapTokenAmountThreshold = _minAmountForCheck;

  async function makeReferalTree(contract) {
    await contract.register({ from: accounts[0] });

    await contract.registerBySponsorAddress(accounts[0], {
      from: accounts[1],
    });

    await contract.registerBySponsorAddress(accounts[1], {
      from: accounts[2],
    });
    await contract.registerBySponsorAddress(accounts[2], {
      from: accounts[3],
    });

    await contract.registerBySponsorAddress(accounts[3], {
      from: accounts[4],
    });
    await contract.registerBySponsorAddress(accounts[4], {
      from: accounts[5],
    });

    await contract.registerBySponsorAddress(accounts[5], {
      from: accounts[6],
    });
    await contract.registerBySponsorAddress(accounts[6], {
      from: accounts[7],
    });
    await contract.registerBySponsorAddress(accounts[6], {
      from: accounts[8],
    });
    await contract.registerBySponsorAddress(accounts[6], {
      from: accounts[9],
    });
  }

  function mockBonusAmount(amount, level, reserve = false) {
    this.persent = new BN(100);
    this.levels = [
      new BN(40),
      new BN(20),
      new BN(13),
      new BN(10),
      new BN(10),
      new BN(7),
    ];
    if (!reserve) {
      return amount.mul(this.levels[level]).div(this.persent);
    } else {
      let sum = ZERO;
      for (let i = level; i < this.levels.length; i++) {
        sum = sum.add(this.levels[i]);
      }
      return amount.mul(sum).div(this.persent);
    }
  }
  before(async function () {
    this.token = await NBU.deployed();
    this.router = await Router.deployed();
    this.swapToken = await TT.deployed();
    this.LPReward = await LPReward.deployed();

    await this.LPReward.updateSwapRouter(this.router.address, { from: owner });
    await this.token.approve(this.router.address, MAX_UINT256);
    await this.swapToken.approve(this.router.address, MAX_UINT256);
    await this.router.addLiquidity(
      this.token.address,
      this.swapToken.address,
      new BN(10000),
      new BN(10000),
      0,
      0,
      accounts[0],
      MAX_UINT256
    );
  });

  beforeEach(async function () {
    this.contract = await Referal.new(owner, this.token.address);
    await this.contract.migrateUsers(
      [virtualSponsorId],
      [1],
      [ZERO_ADDRESS],
      [0]
    );
    await this.contract.finishBasicMigration(virtualSponsorId, { from: owner });

    await this.contract.updateSwapRouter(this.router.address, { from: owner });
    await this.contract.updateSwapToken(this.swapToken.address, {
      from: owner,
    });

    await this.contract.updateMinTokenAmountForCheck(_minAmountForCheck, {
      from: owner,
    });
  });

  describe("build and sync methods", function () {
    it("DOMAIN_SEPARATOR", async function () {
      const chainId = await web3.eth.getChainId();
      expect(await this.contract.DOMAIN_SEPARATOR()).to.eq(
        keccak256(
          defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32", "uint256", "address"],
            [
              keccak256(
                toUtf8Bytes(
                  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                )
              ),
              keccak256(toUtf8Bytes("NimbusReferralProgram")),
              keccak256(toUtf8Bytes("1")),
              chainId,
              this.contract.address,
            ]
          )
        )
      );
    });

    describe("register", function () {
      describe("first user register", function () {
        it("from zero address", async function () {
          await expectRevert(
            this.contract.register({ from: ZERO_ADDRESS }),
            "Returned error: sender account not recognized"
          );
        });

        it("success", async function () {
          await this.contract.register({ from: owner });
          const userId = await this.contract.userIdByAddress(owner);
          expect(await this.contract.lastUserId()).to.be.bignumber.equal(
            userId
          );
          expect(await this.contract.userAddressById(userId)).to.be.equal(
            owner
          );
          expect(await this.contract.userSponsor(userId)).to.be.bignumber.equal(
            virtualSponsorId
          );
          expect(
            await this.contract.methods["getUserReferrals(uint256)"](
              virtualSponsorId
            )
          ).to.deep.include(userId);
        });
      });

      describe("other user register", async function () {
        beforeEach(async function () {
          await this.contract.register({ from: owner });
        });

        it("reject when no such sponsor Id", async function () {
          await expectRevert(
            this.contract.registerBySponsorId(virtualSponsorId.subn(1), {
              from: client,
            }),
            "Nimbus Referral: No such sponsor"
          );
        });

        it("reject zero address", async function () {
          await expectRevert(
            this.contract.registerBySponsorAddress(ZERO_ADDRESS, {
              from: client,
            }),
            "Nimbus Referral: No such sponsor"
          );
        });

        it("reject when is already register", async function () {
          await expectRevert(
            this.contract.registerBySponsorId(virtualSponsorId, {
              from: owner,
            }),
            "Nimbus Referral: Already registered"
          );
        });

        it("succes by Id", async function () {
          const sponsorId = await this.contract.userIdByAddress(owner);
          await this.contract.registerBySponsorId(sponsorId, {
            from: client,
          });
          const userId = await this.contract.userIdByAddress(client);
          expect(await this.contract.lastUserId()).to.be.bignumber.equal(
            userId
          );
          expect(await this.contract.userAddressById(userId)).to.be.equal(
            client
          );
          expect(await this.contract.userSponsor(userId)).to.be.bignumber.equal(
            sponsorId
          );
          expect(
            await this.contract.methods["getUserReferrals(uint256)"](sponsorId)
          ).to.deep.include(userId);
        });

        it("succes by address", async function () {
          const sponsorId = await this.contract.userIdByAddress(owner);
          await this.contract.registerBySponsorAddress(owner, {
            from: client,
          });
          const userId = await this.contract.userIdByAddress(client);
          expect(await this.contract.lastUserId()).to.be.bignumber.equal(
            userId
          );
          expect(await this.contract.userAddressById(userId)).to.be.equal(
            client
          );
          expect(await this.contract.userSponsor(userId)).to.be.bignumber.equal(
            sponsorId
          );
          expect(
            await this.contract.methods["getUserReferrals(uint256)"](sponsorId)
          ).to.deep.include(userId);
        });
      });
    });
  });

  describe("when referal tree is already build", function () {
    beforeEach(async function () {
      await makeReferalTree(this.contract);
    });

    describe("recordFee", function () {
      it("reject when there was no transfer before", async function () {
        await expectRevert(
          this.contract.recordFee(this.token.address, owner, defaultFeeAmount),
          "revert"
        );
      });

      it("reject second fee without transfer before", async function () {
        await this.token.transfer(this.contract.address, defaultFeeAmount);
        const t = await this.contract.recordFee(
          this.token.address,
          owner,
          defaultFeeAmount
        );
        await expectRevert(
          this.contract.recordFee(this.token.address, owner, defaultFeeAmount),
          "Nimbus Referral: Balance check failed"
        );
      });

      it("success", async function () {
        const userId = await this.contract.userIdByAddress(owner);
        await this.token.transfer(this.contract.address, defaultFeeAmount);
        const t = await this.contract.recordFee(
          this.token.address,
          owner,
          defaultFeeAmount
        );
        expect(
          await this.contract.undistributedFees(this.token.address, userId)
        ).to.be.bignumber.equal(defaultFeeAmount);
      });
    });

    describe("isUserBalanceEnough", function () {
      it("reject to zero address", async function () {
        expect(
          await this.contract.isUserBalanceEnough(ZERO_ADDRESS)
        ).to.be.equal(false);
      });

      it("reject when not enoughth balance for check", async function () {
        expect(await this.contract.isUserBalanceEnough(client)).to.be.equal(
          false
        );
      });

      it("reject when less then swap token amount threshold", async function () {
        const balance = _minAmountForCheck;
        const threshold = (
          await this.router.getAmountsOut(balance, [
            this.token.address,
            this.swapToken.address,
          ])
        )[1];
        await this.contract.updateSwapTokenAmountForFeeDistributionThreshold(
          threshold.addn(1),
          {
            from: owner,
          }
        );

        await this.token.transfer(client, balance, { from: owner });
        expect(await this.contract.isUserBalanceEnough(client)).to.be.equal(
          false
        );
      });

      it("success", async function () {
        const balance = (
          await this.router.getAmountsIn(_minAmountForCheck, [
            this.token.address,
            this.swapToken.address,
          ])
        )[0];

        await this.token.transfer(client, balance, { from: owner });
        expect(await this.contract.isUserBalanceEnough(client)).to.be.equal(
          true
        );
      });
    });

    describe("distribute earned fees", function () {
      it("reject when no swap before", async function () {
        const userId = await this.contract.userIdByAddress(owner);
        await expectRevert(
          this.contract.distributeEarnedFees(this.token.address, userId),
          "Undistributed fee is 0"
        );
      });

      it("succes for root of referal tree", async function () {
        const userId = await this.contract.userIdByAddress(accounts[0]);
        await mockSwap(
          this.contract,
          this.token,
          _minAmountForCheck,
          accounts[0]
        );
        const expectedAmount = await this.contract.undistributedFees(
          this.token.address,
          userId
        );
        const balanceBefore = await this.token.balanceOf(accounts[0]);
        const { logs } = await this.contract.distributeEarnedFees(
          this.token.address,
          userId,
          { from: accounts[0] }
        );

        const bonusAmount = mockBonusAmount(expectedAmount, 0, true);

        expectEvent.inLogs(logs, "DistributeFees", {
          token: this.token.address,
          userId,
          amount: expectedAmount,
        });

        expectEvent.inLogs(logs, "TransferToNimbusSpecialReserveFund", {
          token: this.token.address,
          fromUserId: userId,
          undistributedAmount: bonusAmount,
        });

        expect(
          await this.contract.undistributedFees(this.token.address, 0)
        ).to.be.bignumber.equal(bonusAmount);
      });

      it("success for root from another user", async function () {
        const userId = await this.contract.userIdByAddress(accounts[0]);
        await mockSwap(
          this.contract,
          this.token,
          _minAmountForCheck,
          accounts[0]
        );
        const expectedAmount = await this.contract.undistributedFees(
          this.token.address,
          userId
        );
        const balanceBefore = await this.token.balanceOf(accounts[0]);
        const { logs } = await this.contract.distributeEarnedFees(
          this.token.address,
          userId,
          { from: accounts[3] }
        );

        const bonusAmount = mockBonusAmount(expectedAmount, 0, true);

        expectEvent.inLogs(logs, "DistributeFees", {
          token: this.token.address,
          userId,
          amount: expectedAmount,
        });

        expectEvent.inLogs(logs, "TransferToNimbusSpecialReserveFund", {
          token: this.token.address,
          fromUserId: userId,
          undistributedAmount: bonusAmount,
        });

        expect(
          await this.contract.undistributedFees(this.token.address, 0)
        ).to.be.bignumber.equal(bonusAmount);
      });

      it("success fot leaf when one of sponsor doesn't have enought balance", async function () {
        const sponsorWithoutEnoughtBalance = accounts[4];
        const balanceOfSponsorWithoutEnoughtBalance = await this.token.balanceOf(
          sponsorWithoutEnoughtBalance
        );
        const distributeUserAddress = accounts[7];
        const usedAccounts = [
          accounts[0],
          accounts[1],
          accounts[2],
          accounts[3],
          accounts[5],
          accounts[6],
        ];
        const usedAccountsBalances = [];
        for (const user of usedAccounts) {
          await this.token.transfer(user, _minAmountForCheck, {
            from: owner,
          });
          usedAccountsBalances.push(await this.token.balanceOf(user));
        }
        usedAccountsBalances[0] = (await this.token.balanceOf(owner)).subn(
          _minAmountForCheck
        );

        const distributeUserId = await this.contract.userIdByAddress(
          distributeUserAddress
        );
        await mockSwap(
          this.contract,
          this.token,
          _minAmountForCheck,
          distributeUserAddress
        );

        const event = await this.contract.distributeEarnedFees(
          this.token.address,
          distributeUserId,
          { from: accounts[0] }
        );

        for (let index = 0; index < usedAccounts.length; index++) {
          const userAddress = usedAccounts[index];
          const userId = await this.contract.userIdByAddress(userAddress);
          const userBalanceBefore = usedAccountsBalances[index];
          const bonus = mockBonusAmount(
            new BN(1000),
            usedAccounts.length - index - 1,
            false
          );

          expectEvent(event, "DistributeFeesForUser", {
            token: this.token.address,
            recipientId: userId,
            amount: bonus,
          });

          expect(await this.token.balanceOf(userAddress)).to.be.bignumber.equal(
            userBalanceBefore.add(bonus)
          );
        }

        expect(
          await this.token.balanceOf(sponsorWithoutEnoughtBalance)
        ).to.be.bignumber.equal(balanceOfSponsorWithoutEnoughtBalance);

        expectEvent(event, "DistributeFees", {
          token: this.token.address,
          userId: distributeUserId,
          amount: new BN(_minAmountForCheck),
        });
      });

      it("success fot leaf with full tree length", async function () {
        const sponsorWithoutEnoughtBalance = accounts[4];
        const distributeUserAddress = accounts[7];
        const usedAccounts = [
          accounts[1],
          accounts[2],
          accounts[3],
          accounts[4],
          accounts[5],
          accounts[6],
        ];
        const usedAccountsBalances = [];
        for (const user of usedAccounts) {
          await this.token.transfer(user, _minAmountForCheck, {
            from: owner,
          });
          usedAccountsBalances.push(await this.token.balanceOf(user));
        }

        const distributeUserId = await this.contract.userIdByAddress(
          distributeUserAddress
        );
        await mockSwap(
          this.contract,
          this.token,
          _minAmountForCheck,
          distributeUserAddress
        );

        const event = await this.contract.distributeEarnedFees(
          this.token.address,
          distributeUserId,
          { from: accounts[0] }
        );

        for (let index = 0; index < usedAccounts.length; index++) {
          const userAddress = usedAccounts[index];
          const userId = await this.contract.userIdByAddress(userAddress);
          const userBalanceBefore = usedAccountsBalances[index];
          const bonus = mockBonusAmount(
            new BN(1000),
            usedAccounts.length - index - 1,
            false
          );

          expectEvent(event, "DistributeFeesForUser", {
            token: this.token.address,
            recipientId: userId,
            amount: bonus,
          });

          expect(await this.token.balanceOf(userAddress)).to.be.bignumber.equal(
            userBalanceBefore.add(bonus)
          );
        }

        expectEvent(event, "DistributeFees", {
          token: this.token.address,
          userId: distributeUserId,
          amount: new BN(_minAmountForCheck),
        });
      });
    });

    describe("claim special reserve fund", function () {
      it("reject when reserve amount is equal zero", async function () {
        await expectRevert(
          this.contract.claimSpecialReserveFund(this.token.address),
          "Nimbus Referral: No unclaimed funds for selected token"
        );
      });

      it("reject when reserve fund is not initialize", async function () {
        await mockSwap(this.contract, this.token, _minAmountForCheck, owner);
        await this.contract.distributeEarnedFees(
          this.token.address,
          await this.contract.userIdByAddress(owner),
          { from: owner }
        );

        await expectRevert(
          this.contract.claimSpecialReserveFund(this.token.address),
          "TransferHelper: TRANSFER_FAILED"
        );
      });

      it("success", async function () {
        await mockSwap(this.contract, this.token, _minAmountForCheck, owner);
        await this.contract.distributeEarnedFees(
          this.token.address,
          await this.contract.userIdByAddress(owner),
          { from: owner }
        );
        await this.contract.updateSpecialReserveFund(accounts[9]);
        await this.contract.claimSpecialReserveFund(this.token.address);
        expect(
          await this.contract.undistributedFees(this.token.address, 0)
        ).to.be.bignumber.equal(ZERO);
        expect(await this.token.balanceOf(accounts[9])).to.be.bignumber.equal(
          new BN(_minAmountForCheck)
        );
      });
    });
  });
});
