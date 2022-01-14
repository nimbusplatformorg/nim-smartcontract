const WBNB = artifacts.require("NBU_WBNB");
const TT = artifacts.require("ERC20TestToken");
const MockRouter = artifacts.require("MockRouterforTiktoken");
const MockLpStaking = artifacts.require("MockLpStakingforTiktoken");
const MockLending = artifacts.require("MockLendingforTiktoken");
const SmartLP = artifacts.require("SmartLP")
const SmartLPProxy = artifacts.require("SmartLPProxy");

const {
  BN,
  constants,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const {
  expect
} = require("chai");
const {
  MAX_UINT256
} = constants;


let router;
let nbu;
let gnbu;
let lpToken;
let lpTokenBnbGnbu;
let iToken;
let bnbNbuPair;
let bnbGnbuPair;
let token;
let smartLPProxy;
let contractSmartLP;
let lending;




contract("SmartLP", (accounts) => {
  beforeEach(async function () {

    nbu = await TT.new(new BN("1000000000000000000000000"), {
      from: accounts[0]
    });
    gnbu = await TT.new(new BN("1000000000000000000000000"), {
      from: accounts[0]
    });
    wbnb = await WBNB.new({
      from: accounts[0]
    });
    lpToken = await TT.new(new BN("1000000000000000000000000"), {
      from: accounts[0]
    })
    iToken = await TT.new(new BN("1000000000000000000000000"), {
      from: accounts[0]
    })

    router = await MockRouter.new(wbnb.address, lpToken.address, accounts[0], {
      from: accounts[0]
    });
    bnbNbuPair = await MockLpStaking.new(wbnb.address, lpToken.address, accounts[0], nbu.address, {
      from: accounts[0]
    });
    bnbGnbuPair = await MockLpStaking.new(wbnb.address, lpToken.address, accounts[0], nbu.address, {
      from: accounts[0]
    });
    lending = await MockLending.new(wbnb.address, iToken.address, accounts[0], {
      from: accounts[0]
    });

    await nbu.approve(router.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(router.address, new BN("100000000000000000000000"), {
      from: accounts[0],
    });
    await router.send(new BN(5), {
      from: accounts[0]
    })

    await gnbu.approve(router.address, MAX_UINT256, {
      from: accounts[0],
    });
    await gnbu.transfer(router.address, new BN("100000000000000000000000"), {
      from: accounts[0],
    });
    await lpToken.approve(router.address, MAX_UINT256, {
      from: accounts[0],
    });
    await lpToken.transfer(router.address, new BN("100000000000000000000000"), {
      from: accounts[0],
    });

    await nbu.approve(bnbNbuPair.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(bnbNbuPair.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    await nbu.approve(bnbGnbuPair.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(bnbGnbuPair.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    await lending.send(new BN(5), {
      from: accounts[0]
    })

    await iToken.approve(lending.address, MAX_UINT256, {
      from: accounts[0],
    });
    await iToken.transfer(lending.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    token = await SmartLP.new();
    smartLPProxy = await SmartLPProxy.new(token.address);
    contractSmartLP = await SmartLP.at(smartLPProxy.address);
    let a = await contractSmartLP.initialize(
      router.address,
      wbnb.address,
      nbu.address,
      gnbu.address,
      lpToken.address,
      lpToken.address,
      bnbNbuPair.address,
      bnbGnbuPair.address,
      lending.address
    )

    await nbu.approve(contractSmartLP.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(contractSmartLP.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    await gnbu.approve(contractSmartLP.address, MAX_UINT256, {
      from: accounts[0],
    });
    await gnbu.transfer(contractSmartLP.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

  });

  describe("test buySmartLP method", async function () {
    it("purchase should not take place if the amount is less than the min purchase amount", async function () {
      await expectRevert(
        contractSmartLP.buySmartLP({
          from: accounts[0],
          value: "100000000000000000"
        }),
        'SmartLP: Token price is more than sent'
      );
    });

    it("purchase must take place if the BNB amount is more than the min purchase amount", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });

      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      let tokenInfo = await contractSmartLP.tikSupplies(userTokens[userTokens.length - 1]);
      let tokenCount = await contractSmartLP.tokenCount();
      let tokenOwner = await contractSmartLP.ownerOf(userTokens[userTokens.length - 1]);

      expect(tokenCount).to.be.bignumber.equal(new BN(1));
      expect(tokenInfo.ProvidedBnb).to.be.bignumber.equal(new BN("5000000000000000000"));
      expect(tokenInfo.IsActive).to.be.true;
      expect(tokenOwner).to.equal(accounts[0])
    });
  });

  describe("testing of zero rewards for lend", async function () {

    it("if there are no lend rewards, lend rewards must be zero in getTokenRewardsAmounts",
      async function () {
        await lending.setTokenPrice(0, {
          from: accounts[0]
        })
        await contractSmartLP.buySmartLP({
          from: accounts[0],
          value: "5000000000000000000"
        });

        let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
        const userRewards = await contractSmartLP.getTokenRewardsAmounts(userTokens[userTokens.length - 1], {
          from: accounts[0]
        })

        expect(userRewards["2"]).to.be.bignumber.equal(new BN(0));
      });

    it("if there are no lend rewards, lend rewards must be zero in getTotalAmountsOfRewards",
      async function () {
        await lending.setTokenPrice(0, {
          from: accounts[0]
        })
        await contractSmartLP.buySmartLP({
          from: accounts[0],
          value: "5000000000000000000"
        });

        let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
        const userRewards = await contractSmartLP.getTotalAmountsOfRewards(userTokens[userTokens.length - 1], {
          from: accounts[0]
        })

        expect(userRewards["1"]).to.be.bignumber.equal(new BN(0));
      });

  });

  describe("test withdrawUserRewards method", async function () {
    it("should send the owner of the token his reward", async function () {
      let date = Date.now()
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      let userRewards = await contractSmartLP.getTokenRewardsAmounts(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      );
      await time.increaseTo(new BN(date + 15));
      await contractSmartLP.withdrawUserRewards(userTokens[userTokens.length - 1], {
        from: accounts[0]
      })
      expect(userRewards["0"] + userRewards["1"]).to.be.bignumber.equal(new BN(0));
    });

    it("rewards should not be sent to not the token owner", async function () {
      let date = Date.now()
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));

      await expectRevert(
        contractSmartLP.withdrawUserRewards(userTokens[userTokens.length - 1], {
          from: accounts[1]
        }),
        "SmartLP: Not token owner"
      );
    });

    it("rewards should not be sent if they haven't appeared yet", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);

      await expectRevert(
        contractSmartLP.withdrawUserRewards(userTokens[userTokens.length - 1], {
          from: accounts[0]
        }),
        "SmartLP: Claim not enough"
      );
    });

  });

  describe("test burnSmartLP method", async function () {
    it("should burn SmartLP", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      await contractSmartLP.burnSmartLP(userTokens[userTokens.length - 1], {
        from: accounts[0]
      })
      let tokenInfo = await contractSmartLP.tikSupplies(userTokens[userTokens.length - 1]);
      let tokenOwner = await contractSmartLP.ownerOf(userTokens[userTokens.length - 1]);

      expect(tokenOwner).to.not.equal(accounts[0])
      expect(tokenInfo.IsActive).to.be.false;
    });

    it("not must burn SmartLP if the user is not the owner of SmartLP", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);

      await expectRevert(
        contractSmartLP.burnSmartLP(userTokens[userTokens.length - 1], {
          from: accounts[1]
        }),
        "SmartLP: Not token owner"
      );
    });

  });

  describe("test read contract methods", async function () {
    it("getUserTokens should return an array of user tokens", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      let tokenCount = await contractSmartLP.tokenCount();

      expect(userTokens).to.be.an('array');
      expect(userTokens[userTokens.length - 1]).to.be.bignumber.equal(tokenCount);
    });



    it("tokenCount should return the number of tokens on the contract", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let tokenCount = await contractSmartLP.tokenCount();

      expect(tokenCount).to.be.bignumber.equal(new BN(1));
    });


    it("tikSupplies should return information about the SmartLP", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      let tokenInfo = await contractSmartLP.tikSupplies(userTokens[userTokens.length - 1]);

      expect(tokenInfo.ProvidedBnb).to.be.bignumber.equal(new BN("5000000000000000000"));
      expect(tokenInfo.IsActive).to.be.true;
      expect(tokenInfo.SupplyTime).to.be.bignumber;
      expect(tokenInfo.TokenId).to.be.bignumber;

    });

    it("getTokenRewardsAmounts must return the expected amount of rewards", async function () {
      let date = Date.now();
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));
      let userRewards = await contractSmartLP.getTokenRewardsAmounts(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      )

      expect(userRewards["0"]).to.be.bignumber;
      expect(userRewards["1"]).to.be.bignumber;
      expect(userRewards["2"]).to.be.bignumber;
    });

    it("getTotalAmountsOfRewards must return the expected amount of rewards for lp staking", async function () {
      let date = Date.now();
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));
      let userRewards = await contractSmartLP.getTotalAmountsOfRewards(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      )

      expect(userRewards).to.be.bignumber;
    });

    it("minPurchaseAmount must return min purchase amount", async function () {
      let minPurchaseAmount = contractSmartLP.minPurchaseAmount();

      expect(minPurchaseAmount).to.be.bignumber;
    });

    it("rewardDuration should return the duration of rewards", async function () {
      let rewardDuration = contractSmartLP.rewardDuration();

      expect(rewardDuration).to.be.bignumber;
    });

    it("weightedStakeDate must return the last reward withdrawal date", async function () {
      await contractSmartLP.buySmartLP({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
      let stakeDate = await contractSmartLP.weightedStakeDate(userTokens[userTokens.length - 1]);

      expect(stakeDate).to.be.bignumber;
    });
  });
})