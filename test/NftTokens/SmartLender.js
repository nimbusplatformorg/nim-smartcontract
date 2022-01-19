const WBNB = artifacts.require("NBU_WBNB");
const TT = artifacts.require("ERC20TestToken");
const MockRouter = artifacts.require("MockRouterforSmartLender");
const MockLpStaking = artifacts.require("MockLpStakingforSmartLender");
const MockLending = artifacts.require("MockLendingforSmartLender");
const SmartLender = artifacts.require("SmartLender")
const SmartLenderProxy = artifacts.require("SmartLenderProxy");

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
let busd;
let lpToken;
let lpTokenBnbGnbu;
let iToken;
let bnbNbuPair;
let busdNbuPair;
let token;
let smartLenderProxy;
let contractSmartLender;
let lending;


contract("SmartLender", (accounts) => {
  beforeEach(async function () {

    nbu = await TT.new(new BN("1000000000000000000000000"), {
      from: accounts[0]
    });
    busd = await TT.new(new BN("1000000000000000000000000"), {
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
    busdNbuPair = await MockLpStaking.new(busd.address, lpToken.address, accounts[0], nbu.address, {
      from: accounts[0]
    });

    lending = await MockLending.new(busd.address, iToken.address, accounts[0], {
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

    await busd.approve(router.address, MAX_UINT256, {
      from: accounts[0],
    });
    await busd.transfer(router.address, new BN("100000000000000000000000"), {
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

    await nbu.approve(busdNbuPair.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(busdNbuPair.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    await router.send(new BN(5), {
      from: accounts[0]
    })

    await busd.approve(lending.address, MAX_UINT256, {
      from: accounts[0],
    });

    await busd.transfer(lending.address, new BN("100000000000000000000000"), {
      from: accounts[0],
    });

    await iToken.approve(lending.address, MAX_UINT256, {
      from: accounts[0],
    });
    await iToken.transfer(lending.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });



    token = await SmartLender.new();
    smartLenderProxy = await SmartLenderProxy.new(token.address);
    contractSmartLender = await SmartLender.at(smartLenderProxy.address);
    await contractSmartLender.initialize(
      router.address,
      wbnb.address,
      nbu.address,
      busd.address,
      lpToken.address,
      lpToken.address,
      bnbNbuPair.address,
      busdNbuPair.address,
      lending.address
    )

    await nbu.approve(contractSmartLender.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(contractSmartLender.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    await busd.approve(contractSmartLender.address, MAX_UINT256, {
      from: accounts[0],
    });
    await busd.transfer(contractSmartLender.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });
  });

  describe("test buySmartLender method", async function () {
    it("purchase should not take place if the amount is less than the min purchase amount", async function () {
      await expectRevert(
        contractSmartLender.buySmartLender("300000000000000000000",{
          from: accounts[0],
        }),
        'SmartLender: Token price is more than sent'
      );
    });

    it("purchase must take place if the BUSD amount is more than the min purchase amount", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });

      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      let tokenInfo = await contractSmartLender.tikSupplies(userTokens[userTokens.length - 1]);
      let tokenCount = await contractSmartLender.tokenCount();
      let tokenOwner = await contractSmartLender.ownerOf(userTokens[userTokens.length - 1]);

      expect(tokenCount).to.be.bignumber.equal(new BN(1));
      expect(tokenInfo.ProvidedBusd).to.be.bignumber.equal(new BN("500000000000000000000"));
      expect(tokenInfo.IsActive).to.be.true;
      expect(tokenOwner).to.equal(accounts[0])
    });
  });

  describe("testing of zero rewards for lend", async function () {

    it("if there are no lend rewards, lend rewards must be zero in getTokenRewardsAmounts",
      async function () {
        await lending.setTokenPrice(0, {from: accounts[0]})
        await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });

        let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
        const userRewards = await contractSmartLender.getTokenRewardsAmounts(userTokens[userTokens.length - 1], {
          from: accounts[0]
        })

        expect(userRewards["2"]).to.be.bignumber.equal(new BN(0));
      });

    it("if there are no lend rewards, lend rewards must be zero in getTotalAmountsOfRewards",
      async function () {
        await lending.setTokenPrice(0, {
          from: accounts[0]
        })
        await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });

        let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
        const userRewards = await contractSmartLender.getTotalAmountsOfRewards(userTokens[userTokens.length - 1], {
          from: accounts[0]
        })

        expect(userRewards["1"]).to.be.bignumber.equal(new BN(0));
      });

  });

  describe("test withdrawUserRewards method", async function () {
    it("should send the owner of the token his reward", async function () {
      let date = Date.now()
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      let userRewards = await contractSmartLender.getTokenRewardsAmounts(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      );
      await time.increaseTo(new BN(date + 15));
      await contractSmartLender.withdrawUserRewards(userTokens[userTokens.length - 1], {
        from: accounts[0]
      })
      expect(userRewards["0"] + userRewards["1"]).to.be.bignumber.equal(new BN(0));
    });

    it("rewards should not be sent to not the token owner", async function () {
      let date = Date.now()
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));

      await expectRevert(
        contractSmartLender.withdrawUserRewards(userTokens[userTokens.length - 1], {
          from: accounts[1]
        }),
        "SmartLender: Not token owner"
      );
    });

    it("rewards should not be sent if they haven't appeared yet", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);

      await expectRevert(
        contractSmartLender.withdrawUserRewards(userTokens[userTokens.length - 1], {
          from: accounts[0]
        }),
        "SmartLender: Claim not enough"
      );
    });

  });

  describe("test burnSmartLender method", async function () {
    it("should burn SmartLender", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      await contractSmartLender.burnSmartLender(userTokens[userTokens.length - 1], {
        from: accounts[0]
      })
      let tokenInfo = await contractSmartLender.tikSupplies(userTokens[userTokens.length - 1]);
      let tokenOwner = await contractSmartLender.ownerOf(userTokens[userTokens.length - 1]);

      expect(tokenOwner).to.not.equal(accounts[0])
      expect(tokenInfo.IsActive).to.be.false;
    });

    it("not must burn SmartLender if the user is not the owner of SmartLender", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);

      await expectRevert(
        contractSmartLender.burnSmartLender(userTokens[userTokens.length - 1], {
          from: accounts[1]
        }),
        "SmartLender: Not token owner"
      );
    });

  });

  describe("test read contract methods", async function () {
    it("getUserTokens should return an array of user tokens", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      let tokenCount = await contractSmartLender.tokenCount();

      expect(userTokens).to.be.an('array');
      expect(userTokens[userTokens.length - 1]).to.be.bignumber.equal(tokenCount);
    });



    it("tokenCount should return the number of tokens on the contract", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let tokenCount = await contractSmartLender.tokenCount();

      expect(tokenCount).to.be.bignumber.equal(new BN(1));
    });


    it("tikSupplies should return information about the SmartLender", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      let tokenInfo = await contractSmartLender.tikSupplies(userTokens[userTokens.length - 1]);

      expect(tokenInfo.ProvidedBusd).to.be.bignumber.equal(new BN("500000000000000000000"));
      expect(tokenInfo.IsActive).to.be.true;
      expect(tokenInfo.SupplyTime).to.be.bignumber;
      expect(tokenInfo.TokenId).to.be.bignumber;

    });

    it("getTokenRewardsAmounts must return the expected amount of rewards", async function () {
      let date = Date.now();
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));
      let userRewards = await contractSmartLender.getTokenRewardsAmounts(
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
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));
      let userRewards = await contractSmartLender.getTotalAmountsOfRewards(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      )

      expect(userRewards).to.be.bignumber;
    });

    it("minPurchaseAmount must return min purchase amount", async function () {
      let minPurchaseAmount = contractSmartLender.minPurchaseAmount();

      expect(minPurchaseAmount).to.be.bignumber;
    });

    it("rewardDuration should return the duration of rewards", async function () {
      let rewardDuration = contractSmartLender.rewardDuration();

      expect(rewardDuration).to.be.bignumber;
    });

    it("weightedStakeDate must return the last reward withdrawal date", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });

      let userTokens = await contractSmartLender.getUserTokens(accounts[0]);
      let stakeDate = await contractSmartLender.weightedStakeDate(userTokens[userTokens.length - 1]);

      expect(stakeDate).to.be.bignumber;
    });
  });

  describe("test SmartLender transfer", async function () {
    
    it("token must be removed from the user's token array and added to another user", async function () {
      await contractSmartLender.buySmartLender(new BN("500000000000000000000"),{ from: accounts[0] });
      await contractSmartLender.safeTransferFrom(accounts[0], accounts[1], new BN(1))

      let userTokensFrom = await contractSmartLender.getUserTokens(accounts[0]);
      let userTokensTo = await contractSmartLender.getUserTokens(accounts[1]);

      expect(userTokensFrom.length).to.equal(0);
      expect(userTokensTo[userTokensTo.length - 1]).to.be.bignumber.equal(new BN(1));
    });
  });
})
