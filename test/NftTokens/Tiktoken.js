const WBNB = artifacts.require("NBU_WBNB");
const TT = artifacts.require("ERC20TestToken");
const MockRouter = artifacts.require("MockRouterforTiktoken");
const MockLpStaking = artifacts.require("MockLpStakingforTiktoken");
const MockLending = artifacts.require("MockLendingforTiktoken");
const Tiktoken = artifacts.require("TikToken")
const TiktokenProxy = artifacts.require("TikTokenProxy");

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
let tiktokenProxy;
let contractTiktoken;
let lending;




contract("Tiktoken", (accounts) => {
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

    token = await Tiktoken.new();
    tiktokenProxy = await TiktokenProxy.new(token.address);
    contractTiktoken = await Tiktoken.at(tiktokenProxy.address);
    let a = await contractTiktoken.initialize(
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

    await nbu.approve(contractTiktoken.address, MAX_UINT256, {
      from: accounts[0],
    });
    await nbu.transfer(contractTiktoken.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

    await gnbu.approve(contractTiktoken.address, MAX_UINT256, {
      from: accounts[0],
    });
    await gnbu.transfer(contractTiktoken.address, new BN("10000000000000000000000"), {
      from: accounts[0],
    });

  });

  describe("test buyTiktoken method", async function () {
    it("purchase should not take place if the amount is less than the min purchase amount", async function () {
      await expectRevert(
        contractTiktoken.buyTikToken({
          from: accounts[0],
          value: "100000000000000000"
        }),
        'TikToken: min purchase is too low'
      );
    });

    it("purchase must take place if the BNB amount is more than the min purchase amount", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });

      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      let tokenInfo = await contractTiktoken.tikSupplies(userTokens[userTokens.length - 1]);
      let tokenCount = await contractTiktoken.tokenCount();
      let tokenOwner = await contractTiktoken.ownerOf(userTokens[userTokens.length - 1]);

      expect(tokenCount).to.be.bignumber.equal(new BN(1));
      expect(tokenInfo.ProvidedBnb).to.be.bignumber.equal(new BN("5000000000000000000"));
      expect(tokenInfo.IsActive).to.be.true;
      expect(tokenOwner).to.equal(accounts[0])
    });
  });

  describe("test withdrawUserRewards method", async function () {
    it("should send the owner of the token his reward", async function () {
      let date = Date.now()
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      let userRewards = await contractTiktoken.getTokenRewardsAmounts(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      );
      await time.increaseTo(new BN(date + 15));
      await contractTiktoken.withdrawUserRewards(userTokens[userTokens.length - 1], {
        from: accounts[0]
      })
      expect(userRewards["0"] + userRewards["1"]).to.be.bignumber.equal(new BN(0));
    });

    it("rewards should not be sent to not the token owner", async function () {
      let date = Date.now()
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));

      await expectRevert(
        contractTiktoken.withdrawUserRewards(userTokens[userTokens.length - 1], {
          from: accounts[1]
        }),
        "TikToken: Not token owner"
      );
    });

    it("rewards should not be sent if they haven't appeared yet", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);

      await expectRevert(
        contractTiktoken.withdrawUserRewards(userTokens[userTokens.length - 1], {
          from: accounts[0]
        }),
        "TikToken: Claim not enough"
      );
    });

  });

  describe("test burnTikToken method", async function () {
    it("should burn TikToken", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      await contractTiktoken.burnTikToken(userTokens[userTokens.length - 1], {
        from: accounts[0]
      })
      let tokenInfo = await contractTiktoken.tikSupplies(userTokens[userTokens.length - 1]);
      let tokenOwner = await contractTiktoken.ownerOf(userTokens[userTokens.length - 1]);

      expect(tokenOwner).to.not.equal(accounts[0])
      expect(tokenInfo.IsActive).to.be.false;
    });

    it("not must burn Tiktoken if the user is not the owner of Tiktoken", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);

      await expectRevert(
        contractTiktoken.burnTikToken(userTokens[userTokens.length - 1], {
          from: accounts[1]
        }),
        "TikToken: Not token owner"
      );
    });

  });

  describe("test read contract methods", async function () {
    it("getUserTokens should return an array of user tokens", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      let tokenCount = await contractTiktoken.tokenCount();

      expect(userTokens).to.be.an('array');
      expect(userTokens[userTokens.length - 1]).to.be.bignumber.equal(tokenCount);
    });



    it("tokenCount should return the number of tokens on the contract", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let tokenCount = await contractTiktoken.tokenCount();

      expect(tokenCount).to.be.bignumber.equal(new BN(1));
    });


    it("tikSupplies should return information about the TikToken", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      let tokenInfo = await contractTiktoken.tikSupplies(userTokens[userTokens.length - 1]);

      expect(tokenInfo.ProvidedBnb).to.be.bignumber.equal(new BN("5000000000000000000"));
      expect(tokenInfo.IsActive).to.be.true;
      expect(tokenInfo.SupplyTime).to.be.bignumber;
      expect(tokenInfo.TokenId).to.be.bignumber;

    });

    it("getTokenRewardsAmounts must return the expected amount of rewards", async function () {
      let date = Date.now();
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));
      let userRewards = await contractTiktoken.getTokenRewardsAmounts(
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
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      await time.increaseTo(new BN(date + 15));
      let userRewards = await contractTiktoken.getTotalAmountsOfRewards(
        userTokens[userTokens.length - 1], {
          from: accounts[0]
        }
      )

      expect(userRewards).to.be.bignumber;
    });

    it("minPurchaseAmount must return min purchase amount", async function () {
      let minPurchaseAmount = contractTiktoken.minPurchaseAmount();

      expect(minPurchaseAmount).to.be.bignumber;
    });

    it("rewardDuration should return the duration of rewards", async function () {
      let rewardDuration = contractTiktoken.rewardDuration();

      expect(rewardDuration).to.be.bignumber;
    });

    it("weightedStakeDate must return the last reward withdrawal date", async function () {
      await contractTiktoken.buyTikToken({
        from: accounts[0],
        value: "5000000000000000000"
      });
      let userTokens = await contractTiktoken.getUserTokens(accounts[0]);
      let stakeDate = await contractTiktoken.weightedStakeDate(userTokens[userTokens.length - 1]);

      expect(stakeDate).to.be.bignumber;
    });
  });
})
