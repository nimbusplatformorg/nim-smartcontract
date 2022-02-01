const Referal30 = artifacts.require("NimbusInitialAcquisitionNew");
const Nbu = artifacts.require("NBU");
const NimbusVesting = artifacts.require("NimbusVesting");
const NimbusRouter = artifacts.require("NimbusRouter");
const NBU_WBNB = artifacts.require("NBU_WBNB");
const PriceFeeds = artifacts.require("PriceFeeds");
const TestToken = artifacts.require("ERC20TestToken");
const NimbusPair = artifacts.require("NimbusPair");
const Factory = artifacts.require("NimbusFactory");
const LPRewards = artifacts.require("LPReward");



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
let wbnb;
let testToken;
let factory;
let lpRewards;
let nimbusPair;
let nimbusVesting;
let initialAcuisitionReferal;
let priceFeeds;
let lpTokenBnbGnbu;
let iToken;
let bnbNbuPair;
let bnbGnbuPair;
let token;
let smartLPProxy;
let contractSmartLP;
let lending;




contract("AP3-0", (accounts) => {
  beforeEach(async function () {
    
    // deploy NBU
    nbu = await Nbu.new({
      from: accounts[0]
    })
    let balanceNbu = await nbu.balanceOf(accounts[0], {from: accounts[0]})
    console.log(balanceNbu.toString())

    // deploy NBU_WBNB
    wbnb = await NBU_WBNB.new({from: accounts[0]});
    console.log(wbnb.address, 'wbnb')

    // deploy TestToken
    testToken = await TestToken.new(new BN("1000000000000000000000000"), {
      from: accounts[0]
    });

    let balanceTest = await testToken.balanceOf(accounts[0], {from: accounts[0]})

    console.log(balanceTest.toString())


    // deploy Factory
    factory = await Factory.new(accounts[0], {from: accounts[0]})
    console.log(factory.address, 'factory')

    // deploy LpRewards
    lpRewards = await LPRewards.new(nbu.address, factory.address,{from: accounts[0]})
    console.log(lpRewards.address, "lpRewards")

    // deploy NimbusPair
    nimbusPair = await NimbusPair.new({from: accounts[0]})
    console.log(nimbusPair.address, "nimbusPair")

    // deploy NimbusROuter
    router = await NimbusRouter.new(factory.address, nbu.address, lpRewards.address, {from: accounts[0]})
    console.log(router.address, "router")

    //deploy NimbusVesting
    nimbusVesting = await NimbusVesting.new(nbu.address, {from: accounts[0]})
    console.log(nimbusVesting.address, "vesting")

    // deploy PriceFeeds
    priceFeeds = await PriceFeeds.new({from: accounts[0]})
    console.log(priceFeeds.address, "priceFeeds")

    // deploy InitialAcuisitionReferal3-0
    initialAcuisitionReferal = await Referal30.new(
      nbu.address, 
      nimbusVesting.address, 
      router.address, 
      wbnb.address, 
      priceFeeds.address,
      {from: accounts[0]} 
    )
    console.log(initialAcuisitionReferal.address, 'referal')

    await wbnb.deposit({from: accounts[0], value: 100000 });
     await lpRewards.updateSwapRouter(router.address, {from: accounts[0]});
    

    let newPair = await factory.createPair(nbu.address, testToken.address, {from: accounts[0]})
    await lpRewards.updateAllowedPair(nbu.address, testToken.address, true, {from: accounts[0]});
    console.log(newPair, 'pair')
    let getpair = await factory.getPair(nbu.address, testToken.address, {from: accounts[0]});
    console.log(getpair, 'getpair')
   
      await nbu.approve(router.address, MAX_UINT256, {
      from: accounts[0],
    });

    await testToken.approve(router.address, MAX_UINT256, {
      from: accounts[0],
    });


    // let liq = await router.addLiquidity(
    //   nbu.address,
    //   testToken.address,
    //   new BN("10000"),
    //   new BN("10000"),
    //   0,
    //   0,
    //   accounts[0],
    //   new BN(16004483087),
    //   {from: accounts[0]}
    // );
    // console.log(liq, 'liq')
    // await nbu.approve(router.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await nbu.transfer(router.address, new BN("100000000000000000000000"), {
    //   from: accounts[0],
    // });
    // await router.send(new BN(5), {
    //   from: accounts[0]
    // })

    // await gnbu.approve(router.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await gnbu.transfer(router.address, new BN("100000000000000000000000"), {
    //   from: accounts[0],
    // });
    // await lpToken.approve(router.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await lpToken.transfer(router.address, new BN("100000000000000000000000"), {
    //   from: accounts[0],
    // });

    // await nbu.approve(bnbNbuPair.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await nbu.transfer(bnbNbuPair.address, new BN("10000000000000000000000"), {
    //   from: accounts[0],
    // });

    // await nbu.approve(bnbGnbuPair.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await nbu.transfer(bnbGnbuPair.address, new BN("10000000000000000000000"), {
    //   from: accounts[0],
    // });

    // await lending.send(new BN(5), {
    //   from: accounts[0]
    // })




    // await nbu.approve(contractSmartLP.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await nbu.transfer(contractSmartLP.address, new BN("10000000000000000000000"), {
    //   from: accounts[0],
    // });

    // await gnbu.approve(contractSmartLP.address, MAX_UINT256, {
    //   from: accounts[0],
    // });
    // await gnbu.transfer(contractSmartLP.address, new BN("10000000000000000000000"), {
    //   from: accounts[0],
    // });

  });

  describe("test buySmartLP method", async function () {
    it("purchase should not take place if the amount is less than the min purchase amount", async function () {
    //   await expectRevert(
    //     contractSmartLP.buySmartLP({
    //       from: accounts[0],
    //       value: "100000000000000000"
    //     }),
    //     'SmartLP: Token price is more than sent'
    //   );
    });

    // it("purchase must take place if the BNB amount is more than the min purchase amount", async function () {
    //   await contractSmartLP.buySmartLP({
    //     from: accounts[0],
    //     value: "5000000000000000000"
    //   });

    //   let userTokens = await contractSmartLP.getUserTokens(accounts[0]);
    //   let tokenInfo = await contractSmartLP.tikSupplies(userTokens[userTokens.length - 1]);
    //   let tokenCount = await contractSmartLP.tokenCount();
    //   let tokenOwner = await contractSmartLP.ownerOf(userTokens[userTokens.length - 1]);

    //   expect(tokenCount).to.be.bignumber.equal(new BN(1));
    //   expect(tokenInfo.ProvidedBnb).to.be.bignumber.equal(new BN("5000000000000000000"));
    //   expect(tokenInfo.IsActive).to.be.true;
    //   expect(tokenOwner).to.equal(accounts[0])
    // });
  });
})