const P2pProxy = artifacts.require("NimbusP2P_V2Proxy");
const P2P = artifacts.require("NimbusP2P_V2");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const WBNB = artifacts.require("NBU_WBNB");
const NFT = artifacts.require("ERC721");
// const ILending = artifacts.require("LoanTokenLogicWbnb");

// const Tiktoken = artifacts.require("TikToken")
// const TiktokenProxy = artifacts.require("TikTokenProxy");

// const Factory = artifacts.require("NimbusFactory");
// const LPReward = artifacts.require("LPReward");
// const StakingLPRewardFixedAPY = artifacts.require("StakingLPRewardFixedAPY");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
  ether
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;


// const _rewardRate = 100;

// let router;
let nbu;
// let lpReward;
// let factory;
// let bnbNbuPair;
// let bnbGnbuPair;
// let stakingLPTokenBnbNbu;
// let stakingLPTokenBnbGnbu;
// let token;
// let tiktokenProxy;
// let contractTiktoken;
// let lpStakingBnbNbu;
// let lpStakingBnbGnbu;
// let lending;
let p2p;
let p2pProxy;
let gnbu;
let wbnb;
let contractP2P;
let nft;
let dateNow;
let day;

// async function getPair(factory, address1, address2) {
//   const result = await factory.getPair(address1, address2);
//   return await NimbusPair.at(result);
// }

contract("Tiktoken", (accounts)=> {
  beforeEach(async function () {
    console.log(accounts);
    nbu = await NBU.new();
    let bal = await nbu.balanceOf(accounts[0]);
    console.log(bal.toString(), 'nbu')
    gnbu = await GNBU.new();
    wbnb = await WBNB.new();
    nft = await NFT.new('test', 'ts');

    await nft.mint(accounts[0], '1');
    await nft.mint(accounts[0], '2');
    await nft.mint(accounts[1], '3');
    await nft.mint(accounts[1], '4');
    let id = await nft.ownerOf('1');
    console.log(id);

    dateNow = Date.now();
    let day = 86400;
 
    p2p = await P2P.new({from:accounts[0]});
    p2pProxy = await P2pProxy.new(p2p.address,{from:accounts[0]});
    contractP2P = await P2P.at(p2pProxy.address, {from:accounts[0]});
    let a = await contractP2P.initialize(
      wbnb.address
    )
    let b = await contractP2P.WBNB();
    console.log(b, 'contract wbnb');
    console.log(wbnb.address, 'addr')    
  });
  describe("before not allowed nft trade", function () {
    const tokenId = new BN(1);
    let price = new BN(1);
    let date = Date.now();
    let oneDay = 86400;
    let dedline = date + oneDay;
    beforeEach(async function () {
      await contractP2P.toggleAnyNFTAllowed({from: accounts[0]});
    });
    it('should not be createTradeBNBtoNFT with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeBNBtoNFT(nft.address, price, new BN(dedline), {from: accounts[1], value: "1000000000000000000"}),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeEIP20ToNFT with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeEIP20ToNFT(nbu.address, new BN(10), nft.address, tokenId, new BN(dedline), {from: accounts[0]}),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeNFTtoEIP20 with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeNFTtoEIP20( nft.address, tokenId, nbu.address, new BN(10), new BN(dedline), {from: accounts[0]}),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeEIP20ToNFTs with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeEIP20ToNFTs(nbu.address, new BN(10), [nft.address], [tokenId], new BN(dedline), {from: accounts[0]}),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeNFTsToEIP20 with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeNFTsToEIP20([nft.address], [tokenId],nbu.address, new BN(10), new BN(dedline), {from: accounts[0]}),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
  })

  describe("create trades", function () {
    let date = Date.now();
    let oneDay = 86400;
    let dedline = date + oneDay;
    beforeEach(async function () {
      await nft.setApprovalForAll(contractP2P.address, true, {from: accounts[0]})
      await nft.setApprovalForAll(contractP2P.address, true, {from: accounts[1]})
      await nbu.approve(contractP2P.address, MAX_UINT256)
    });
    it('createTradeBNBtoNFT', async function () {
     let tradeId = await contractP2P.createTradeBNBtoNFT(
       nft.address, 
       new BN(1), 
       new BN(dedline), 
       {from: accounts[1], value: "1000000000000000000"}
       )
      let userTrades = await contractP2P.userTrades(accounts[1]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });
    it('createTradeNFTtoEIP20', async function () {
      let tradeId = await contractP2P.createTradeNFTtoEIP20(
        nft.address, 
        new BN(1),
        nbu.address, 
        new BN(10),
        new BN(dedline), 
        {from: accounts[0]}
        )
       let userTrades = await contractP2P.userTrades(accounts[0]);
       let tradeCount = await contractP2P.tradeCount();
       expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
     });

     it('createTradeEIP20ToNFT', async function () {
      let tradeId = await contractP2P.createTradeEIP20ToNFT(
        nbu.address, 
        new BN(10), 
        nft.address, 
        new BN(1), 
        new BN(dedline), 
        {from: accounts[0]}
        )
       let userTrades = await contractP2P.userTrades(accounts[0]);
       let tradeCount = await contractP2P.tradeCount();
       expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
     });

     it('createTradeEIP20ToNFTs', async function () {
      let tradeId = await contractP2P.createTradeEIP20ToNFTs(
        nbu.address, 
        new BN(10), 
        [nft.address, nft.address], 
        [new BN(3), new BN(4)], 
        new BN(dedline), 
        {from: accounts[0]})
       let userTrades = await contractP2P.userTrades(accounts[0]);
       let tradeCount = await contractP2P.tradeCount();
       expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
     });

     it('createTradeNFTsToEIP20', async function () {
      let tradeId = await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address], 
        [new BN(1),new BN(2)],
        nbu.address, 
        new BN(10), 
        new BN(dedline), 
        {from: accounts[0]}
        )
       let userTrades = await contractP2P.userTrades(accounts[0]);
       let tradeCount = await contractP2P.tradeCount();
       expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
     });

     it('createTradeNFTsToNFTs', async function () {
      let tradeId = await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address], 
        [new BN(1),new BN(2)],
        [nft.address, nft.address], 
        [new BN(3),new BN(4)], 
        new BN(dedline), 
        {from: accounts[0]}
        )
       let userTrades = await contractP2P.userTrades(accounts[0]);
       let tradeCount = await contractP2P.tradeCount();
       expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
     });
     
     it('createTradeBNBtoNFTs', async function () {
      let tradeId = await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address], 
        [new BN(1),new BN(2)], 
        new BN(dedline), 
        {from: accounts[0], value: "1000000000000000000"}
        )
       let userTrades = await contractP2P.userTrades(accounts[0]);
       let tradeCount = await contractP2P.tradeCount();
       expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
     });
  })

})

