const Pair = artifacts.require("NimbusPair");
const NimbusPair = artifacts.require("NimbusPair");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const WBNB = artifacts.require("NBU_WBNB");
const Router = artifacts.require("NimbusRouter");
const ILending = artifacts.require("LoanTokenLogicWbnb");

const Tiktoken = artifacts.require("TikToken")
const TiktokenProxy = artifacts.require("TikTokenProxy");

const Factory = artifacts.require("NimbusFactory");
const LPReward = artifacts.require("LPReward");
const StakingLPRewardFixedAPY = artifacts.require("StakingLPRewardFixedAPY");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;


const _rewardRate = 100;

let router;
let nbu;
let gnbu;
let lpReward;
let factory;
let wbnb;
let bnbNbuPair;
let bnbGnbuPair;
let stakingLPTokenBnbNbu;
let stakingLPTokenBnbGnbu;
let token;
let tiktokenProxy;
let contractTiktoken;
let lpStakingBnbNbu;
let lpStakingBnbGnbu;
let lending;


async function getPair(factory, address1, address2) {
  const result = await factory.getPair(address1, address2);
  return await NimbusPair.at(result);
}

contract("Tiktoken", (accounts)=> {
  beforeEach(async function () {

    nbu = await NBU.new();
    let bal = await nbu.balanceOf(accounts[0]);
    console.log(bal.toString(), 'nbu')
    gnbu = await GNBU.new();
    wbnb = await WBNB.new();

    factory = await Factory.new(accounts[0]);
    lpReward = await LPReward.new(nbu.address, factory.address);
    router = await Router.new(factory.address, wbnb.address, lpReward.address);
    console.log(accounts)

    const pairAddressNBU = await factory.createPair(wbnb.address, nbu.address, {from: accounts[0]});
    stakingLPTokenBnbNbu = await getPair(
      factory,
      wbnb.address,
      nbu.address
    );
      console.log(stakingLPTokenBnbNbu.address);

    const pairAddressGNBU = await factory.createPair(wbnb.address, gnbu.address,{from: accounts[0]});
    stakingLPTokenBnbGnbu = await getPair(
      factory,
      wbnb.address,
      gnbu.address
    );
    console.log(stakingLPTokenBnbGnbu.address);

    lpStakingBnbNbu = await StakingLPRewardFixedAPY.new(
        nbu.address,
        stakingLPTokenBnbNbu.address,
        wbnb.address,
        nbu.address,
        router.address,
        _rewardRate
    );

    console.log(lpStakingBnbNbu.address)

    lpStakingBnbGnbu = await StakingLPRewardFixedAPY.new(
        nbu.address,
        stakingLPTokenBnbGnbu.address,
        wbnb.address,
        gnbu.address,
        router.address,
        _rewardRate
    );

    console.log(lpStakingBnbGnbu.address)

  //  let a1 =  await nbu.approve(router.address, MAX_UINT256);
  //  let b = await gnbu.approve(router.address, MAX_UINT256);
  //  let c = await wbnb.approve(router.address, MAX_UINT256);

    lending = await ILending.new(accounts[0])


    token = await Tiktoken.new();
    tiktokenProxy = await TiktokenProxy.new(token.address);
    contractTiktoken = await Tiktoken.at(tiktokenProxy.address);
    let a = await contractTiktoken.initialize(
      router.address,
      wbnb.address,
      nbu.address,
      gnbu.address,
      stakingLPTokenBnbNbu.address,
      stakingLPTokenBnbGnbu.address,
      lpStakingBnbNbu.address,
      lpStakingBnbGnbu.address,
      lending.address
    )
    // console.log(a, 'aaaa')
    // console.log(contractTiktoken)
    await contractTiktoken.buyTikToken({from: accounts[0], value: 5000000000000000000})
  // await contract.buyTikToken()
    
  });
  it('TikToken', async () => {

  });
})

