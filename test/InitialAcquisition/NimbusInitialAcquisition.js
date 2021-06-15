const NBU = artifacts.require("NBU");
const Token = artifacts.require("ERC20TestToken");
const NimbusRouter = artifacts.require("NimbusRouter");
const NBU_WETH = artifacts.require("NBU_WETH");
const StakingRewardsSameTokenFixedAPY = artifacts.require(
  "StakingRewardsSameTokenFixedAPY"
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
const Constants = require("../utils/constants");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { expect } = require("chai");

contract("NimbusInitialAcquisition", function (accounts) {
  const availableInitialSupply = new BN("1000000000000000");
  const _swapBonusThreshold = new BN("1000");

  before(async function () {
    this.nbu = await NBU.deployed();
    this.token = await Token.deployed();
    this.WETH = await NBU_WETH.deployed();
    this.router = await NimbusRouter.deployed();
    this.pool = await StakingRewardsSameTokenFixedAPY.deployed();
    this.LPReward = await LPReward.deployed();

    this.contract = await NimbusInitialAcquisition.new(
      this.nbu.address,
      this.router.address,
      this.WETH.address,
      this.pool.address
    );

    this.nbu.transfer(this.contract.address, availableInitialSupply);

    await this.WETH.deposit({ value: 100000 });
    await this.LPReward.updateSwapRouter(this.router.address);
    await this.nbu.approve(this.router.address, Constants.MAX_UINT256);
    await this.token.approve(this.router.address, Constants.MAX_UINT256);
    await this.WETH.approve(this.router.address, Constants.MAX_UINT256);

    await this.nbu.approve(this.pool.address, Constants.MAX_UINT256);
    await this.token.approve(this.pool.address, Constants.MAX_UINT256);
    await this.nbu.approve(this.pool.address, Constants.MAX_UINT256, {
      from: accounts[1],
    });
    // await this.nbu.approve(this.pool.address, Constants.MAX_UINT256, {from:})
    // await this.token.approve(this.router.address, MAX_UINT256);

    await this.token.approve(this.contract.address, Constants.MAX_UINT256);
    await this.nbu.approve(this.contract.address, Constants.MAX_UINT256);
    await this.WETH.approve(this.contract.address, Constants.MAX_UINT256);

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

    await this.router.addLiquidity(
      this.nbu.address,
      this.WETH.address,
      new BN(20000),
      new BN(20000),
      0,
      0,
      accounts[0],
      Constants.MAX_UINT256
    );

    await this.contract.updateStakePool(this.pool.address);

    this.allowedTokens = async function () {
      await this.contract.updateAllowedTokens(this.token.address, true);
      await this.contract.updateAllowedTokens(this.WETH.address, true);
      await this.contract.updateAllowedTokens(this.nbu.address, true);
    };

    await this.contract.updateSwapToken(this.token.address);
    await this.contract.updateSwapTokenAmountForBonusThreshold(
      _swapBonusThreshold
    );

    this.snapshotId = await snapshot();
  });

  afterEach(async function () {
    //console.log(`revert  ${this.snapshotId}`);
    await revertToSnapShot(this.snapshotId);
  });

  beforeEach(async function () {
    this.snapshotId = await snapshot();
  });

  describe("reject not allowed tokens", function () {
    it("buyExactNbuForTokens", async function () {
      await expectRevert(
        this.contract.buyExactNbuForTokens(
          this.token.address,
          500,
          accounts[1]
        ),
        "NimbusInitialAcquisition: Not allowed token"
      );
    });

    it("buyNbuForExactTokens", async function () {
      await expectRevert(
        this.contract.buyNbuForExactTokens(
          this.token.address,
          500,
          accounts[1]
        ),
        "NimbusInitialAcquisition: Not allowed token"
      );
    });

    it("buyNbuForExactEth", async function () {
      await expectRevert(
        this.contract.buyNbuForExactEth(accounts[1]),
        "NimbusInitialAcquisition: Not allowed purchase for ETH"
      );
    });

    it("buyExactNbuForEth", async function () {
      await expectRevert(
        this.contract.buyExactNbuForEth(500, accounts[1]),
        "NimbusInitialAcquisition: Not allowed purchase for ETH"
      );
    });
  });

  describe("tokens allowed", function () {
    before(async function () {
      await this.allowedTokens();
    });

    describe("buy", function () {
      describe("reject", function () {
        it("buy nbu for nbu", async function () {
          await expectRevert(
            this.contract.buyExactNbuForTokens(
              this.nbu.address,
              500,
              accounts[1]
            ),
            "NimbusLibrary: IDENTICAL_ADDRESSES"
          );
        });

        it("buy exact NBU when doesnt have enought token", async function () {
          await expectRevert(
            this.contract.buyExactNbuForTokens(
              this.token.address,
              "100000",
              accounts[2],
              { from: accounts[2] }
            ),
            "TransferHelper: TRANSFER_FROM_FAILED."
          );
        });

        it("buy  NBU when doesnt have enought exact token", async function () {
          await expectRevert(
            this.contract.buyNbuForExactTokens(
              this.token.address,
              "100000",
              accounts[2],
              { from: accounts[2] }
            ),
            "TransferHelper: TRANSFER_FROM_FAILED."
          );
        });

        it("exact eth is zero", async function () {
          await expectRevert(
            this.contract.buyNbuForExactEth(accounts[2], {
              from: accounts[2],
              value: 0,
            }),
            "NimbusLibrary: INSUFFICIENT_INPUT_AMOUNT."
          );
        });

        it("exact eth not enought", async function () {
          await expectRevert(
            this.contract.buyNbuForExactEth(accounts[2], {
              from: accounts[2],
              value: 1,
            }),
            "StakingRewardsSameTokenFixedAPY: Cannot stake 0"
          );
        });

        it("exact NBU with eth is zero", async function () {
          await expectRevert(
            this.contract.buyExactNbuForEth("10000", accounts[2], {
              from: accounts[2],
              value: 0,
            }),
            "NimbusLibrary: INSUFFICIENT_INPUT_AMOUNT"
          );
        });

        it("exact NBU without enought eth", async function () {
          await expectRevert(
            this.contract.buyExactNbuForEth("10000", accounts[2], {
              from: accounts[2],
              value: 1,
            }),
            "NimbusInitialAcquisition: Not enough ETH"
          );
        });
      });

      describe("success", function () {
        const targetValue = new BN("10000");

        it("buyExactNbuForTokens", async function () {
          const path = [this.nbu.address, this.token.address];
          const expectTokenAmount = (
            await this.router.getAmountsOut(targetValue, path)
          )[1];

          const tx = await this.contract.buyExactNbuForTokens(
            this.token.address,
            targetValue,
            accounts[2]
          );

          await expectEvent(tx, "BuyNbuForToken", {
            token: this.token.address,
            tokenAmount: expectTokenAmount,
            nbuAmount: targetValue,
            nbuRecipient: accounts[2],
          });

          await expectEvent(tx, "AddUnclaimedSponsorBonus", {
            user: accounts[0],
            nbuAmount: targetValue,
          });

          await expectEvent.inTransaction(tx.tx, this.token, "Transfer", {
            from: accounts[0],
            to: this.contract.address,
            value: expectTokenAmount,
          });

          await expectEvent.inTransaction(tx.tx, this.pool, "Staked", {
            user: accounts[2],
            amount: targetValue,
          });
        });

        it("buyNbuForExactTokens", async function () {
          const path = [this.token.address, this.nbu.address];
          const expectNBUAmount = (
            await this.router.getAmountsOut(targetValue, path)
          )[1];

          const tx = await this.contract.buyNbuForExactTokens(
            this.token.address,
            targetValue,
            accounts[2]
          );

          await expectEvent(tx, "BuyNbuForToken", {
            token: this.token.address,
            tokenAmount: targetValue,
            nbuAmount: expectNBUAmount,
            nbuRecipient: accounts[2],
          });

          await expectEvent(tx, "AddUnclaimedSponsorBonus", {
            user: accounts[0],
            nbuAmount: expectNBUAmount,
          });

          await expectEvent.inTransaction(tx.tx, this.token, "Transfer", {
            from: accounts[0],
            to: this.contract.address,
            value: targetValue,
          });

          await expectEvent.inTransaction(tx.tx, this.pool, "Staked", {
            user: accounts[2],
            amount: expectNBUAmount,
          });
        });

        it("buyNbuForExactEth", async function () {
          const path = [this.WETH.address, this.nbu.address];
          const expectNBUAmount = (
            await this.router.getAmountsOut(targetValue, path)
          )[1];

          const tx = await this.contract.buyNbuForExactEth(accounts[2], {
            value: targetValue,
          });

          await expectEvent(tx, "BuyNbuForToken", {
            token: this.WETH.address,
            tokenAmount: targetValue,
            nbuAmount: expectNBUAmount,
            nbuRecipient: accounts[2],
          });

          await expectEvent(tx, "AddUnclaimedSponsorBonus", {
            user: accounts[0],
            nbuAmount: expectNBUAmount,
          });

          await expectEvent.inTransaction(tx.tx, this.WETH, "Deposit", {
            dst: this.contract.address,
            wad: targetValue,
          });

          await expectEvent.inTransaction(tx.tx, this.pool, "Staked", {
            user: accounts[2],
            amount: expectNBUAmount,
          });
        });

        it("buyExactNbuForEth", async function () {
          const path = [this.WETH.address, this.nbu.address];
          const expectTokenAmount = (
            await this.router.getAmountsOut(targetValue, path)
          )[1];

          const tx = await this.contract.buyExactNbuForEth(
            expectTokenAmount,
            accounts[2],
            {
              value: targetValue,
            }
          );

          await expectEvent(tx, "BuyNbuForToken", {
            token: this.WETH.address,
            tokenAmount: targetValue,
            nbuAmount: expectTokenAmount,
            nbuRecipient: accounts[2],
          });

          await expectEvent(tx, "AddUnclaimedSponsorBonus", {
            user: accounts[0],
            nbuAmount: expectTokenAmount,
          });

          await expectEvent.inTransaction(tx.tx, this.WETH, "Deposit", {
            dst: this.contract.address,
            wad: targetValue,
          });

          await expectEvent.inTransaction(tx.tx, this.pool, "Staked", {
            user: accounts[2],
            amount: expectTokenAmount,
          });
        });

        it.skip("buyExactNbuForEth with dust", async function () {
          const path = [this.WETH.address, this.nbu.address];
          const expectTokenAmount = (
            await this.router.getAmountsOut(targetValue, path)
          )[1];

          await this.contract.sendTransaction({
            from: accounts[0],
            value: "10000000",
          });

          await this.contract.buyExactNbuForEth(
            expectTokenAmount,
            accounts[2],
            {
              value: targetValue,
            }
          );

          const tx = await this.contract.buyExactNbuForEth(
            expectTokenAmount,
            accounts[2],
            {
              value: targetValue.addn(10),
            }
          );

          await expectEvent(tx, "BuyNbuForToken", {
            token: this.WETH.address,
            tokenAmount: targetValue,
            nbuAmount: expectTokenAmount,
            nbuRecipient: accounts[2],
          });

          await expectEvent(tx, "AddUnclaimedSponsorBonus", {
            user: accounts[0],
            nbuAmount: expectTokenAmount,
          });

          await expectEvent.inTransaction(tx.tx, this.WETH, "Deposit", {
            dst: this.contract.address,
            wad: targetValue,
          });

          await expectEvent.inTransaction(tx.tx, this.pool, "Staked", {
            user: accounts[2],
            amount: expectTokenAmount,
          });

          await expectEvent.inTransaction(tx.tx, this.contract, "Transfer", {
            user: accounts[2],
            amount: expectTokenAmount,
          });
        });
      });
    });

    describe("sponsor bonuses", function () {
      describe("without referal program", function () {
        it("unclaimedBonusBases", async function () {
          expect(
            await this.contract.unclaimedBonusBases(accounts[0])
          ).to.be.bignumber.equal("0");
          await this.contract.buyExactNbuForTokens(
            this.token.address,
            "1000",
            accounts[2]
          );
          expect(
            await this.contract.unclaimedBonusBases(accounts[0])
          ).to.be.bignumber.equal("1000");
        });

        it("reject without unclaimed bonuses", async function () {
          await expectRevert(
            this.contract.claimSponsorBonuses(accounts[2]),
            "NimbusInitialAcquisition: No unclaimed bonuses"
          );
        });

        it("reject when referal program is not set", async function () {
          await this.contract.buyExactNbuForTokens(
            this.token.address,
            "1000",
            accounts[1],
            { from: accounts[0] }
          );
          await expectRevert(
            this.contract.claimSponsorBonuses(accounts[0]),
            "revert"
          );
        });
      });

      describe("with referal program", function () {
        const sponsor = accounts[1];
        const client = accounts[2];

        before(async function () {
          //start init referal program
          this.referal = await Referal.deployed();
          await this.referal.migrateUsers(
            [new BN("1000000001")],
            [1],
            [Constants.ZERO_ADDRESS],
            [0]
          );

          await this.referal.updateSwapRouter(this.router.address);
          await this.referal.updateSwapToken(this.token.address);

          await this.referal.finishBasicMigration(new BN("1000000001"));

          await this.referal.updateMinTokenAmountForCheck("10");
          await this.referal.register({ from: sponsor });
          await this.referal.registerBySponsorAddress(sponsor, {
            from: client,
          });
          //finish init referal program

          await this.contract.updateReferralProgramContract(
            this.referal.address
          );

          await this.token.approve(
            this.contract.address,
            Constants.MAX_UINT256,
            { from: client }
          );
          await this.nbu.transfer(client, "100000");
          await this.token.transfer(client, "100000");

          this.minNbuAmountForBonus = (
            await this.router.getAmountsOut(_swapBonusThreshold, [
              this.token.address,
              this.nbu.address,
            ])
          )[1];
        });

        describe("claim sponsor bonuses", function () {
          it("reject when not user sponsor", async function () {
            await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus,
              sponsor,
              { from: client }
            );
            await expectRevert(
              this.contract.claimSponsorBonuses(client, {
                from: accounts[3],
              }),
              "NimbusInitialAcquisition: Not user sponsor"
            );
          });

          it("reject bonus threshold not met", async function () {
            await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus.subn(1),
              sponsor,
              { from: client }
            );

            await expectRevert(
              this.contract.claimSponsorBonuses(client, { from: sponsor }),
              "NimbusInitialAcquisition: Bonus threshold not met"
            );
          });

          it("reject sponsore balance threshold not met", async function () {
            await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus,
              sponsor,
              { from: client }
            );

            await this.pool.withdraw(await this.pool.balanceOf(sponsor), {
              from: sponsor,
            });

            await expectRevert(
              this.contract.claimSponsorBonuses(client, { from: sponsor }),
              "NimbusInitialAcquisition: Sponsor balance threshold for bonus not met"
            );
          });

          it("success claim sponsor bonuses", async function () {
            await this.nbu.updateVesters(this.contract.address, true);
            await this.nbu.transfer(
              sponsor,
              this.minNbuAmountForBonus.addn(1000)
            );
            await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus,
              sponsor,
              { from: client }
            );

            const tx = await this.contract.claimSponsorBonuses(client, {
              from: sponsor,
            });

            expectEvent(tx, "ProcessSponsorBonus", {
              sponsor,
              user: client,
              bonusAmount: this.minNbuAmountForBonus.muln(10).div(new BN(100)),
            });

            expectEvent.inTransaction(tx.tx, this.nbu, "Transfer", {
              from: accounts[0],
              to: sponsor,
              value: this.minNbuAmountForBonus.muln(10).div(new BN(100)),
            });
          });
        });

        describe("_processSponsor", function () {
          it("nbu amount equal minNbuAmountForBonus", async function () {
            const tx = await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus,
              sponsor,
              { from: client }
            );
            expectEvent(tx, "AddUnclaimedSponsorBonus", {
              user: client,
              nbuAmount: this.minNbuAmountForBonus,
            });
          });

          it("sponsor stake amount equal minNbuAmountForBonus", async function () {
            await this.nbu.transfer(sponsor, this.minNbuAmountForBonus);
            await this.pool.stake(this.minNbuAmountForBonus, {
              from: sponsor,
            });

            const tx = await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus.addn(1),
              accounts[4],
              { from: client }
            );
            expectEvent(tx, "AddUnclaimedSponsorBonus", {
              user: client,
              nbuAmount: this.minNbuAmountForBonus.addn(1),
            });
          });

          it("sponsor stake more than minNbuAmountForBonus", async function () {
            await this.nbu.transfer(
              sponsor,
              this.minNbuAmountForBonus.addn(1000)
            );
            await this.pool.stake(this.minNbuAmountForBonus.addn(1), {
              from: sponsor,
            });

            await this.nbu.updateVesters(this.contract.address, true);
            await this.nbu.transfer(
              sponsor,
              this.minNbuAmountForBonus.addn(1000)
            );
            const tx = await this.contract.buyExactNbuForTokens(
              this.token.address,
              this.minNbuAmountForBonus.addn(1),
              sponsor,
              { from: client }
            );

            expectEvent(tx, "ProcessSponsorBonus", {
              sponsor,
              user: client,
              bonusAmount: this.minNbuAmountForBonus
                .addn(1)
                .muln(10)
                .div(new BN(100)),
            });

            expectEvent.inTransaction(tx.tx, this.nbu, "Transfer", {
              from: accounts[0],
              to: sponsor,
              value: this.minNbuAmountForBonus
                .addn(1)
                .muln(10)
                .div(new BN(100)),
            });
          });
        });
      });
    });
  });
});
