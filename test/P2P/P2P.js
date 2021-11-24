const P2pProxy = artifacts.require("NimbusP2P_V2Proxy");
const P2P = artifacts.require("NimbusP2P_V2");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const WBNB = artifacts.require("NBU_WBNB");
const NFT = artifacts.require("ERC721");

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

let nbu;
let p2p;
let p2pProxy;
let gnbu;
let wbnb;
let contractP2P;
let nft;

contract("Tiktoken", (accounts) => {
  beforeEach(async function () {

    nbu = await NBU.new();
    gnbu = await GNBU.new();
    wbnb = await WBNB.new();
    nft = await NFT.new('test', 'ts');

    await nft.mint(accounts[0], '1');
    await nft.mint(accounts[0], '2');
    await nft.mint(accounts[1], '3');
    await nft.mint(accounts[1], '4');

    p2p = await P2P.new({
      from: accounts[0]
    });
    p2pProxy = await P2pProxy.new(p2p.address, {
      from: accounts[0]
    });
    contractP2P = await P2P.at(p2pProxy.address, {
      from: accounts[0]
    });
    await contractP2P.initialize(
      wbnb.address
    )
 
  });
  describe("create trade with not allowed nft address", function () {
    const tokenId = new BN(1);
    let price = new BN(1);
    let date = Date.now();
    let oneDay = 86400;
    let dedline = date + oneDay;
    beforeEach(async function () {
      await contractP2P.toggleAnyNFTAllowed({
        from: accounts[0]
      });
    });
    it('should not be createTradeBNBtoNFT with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeBNBtoNFT(
          nft.address,
          price,
          new BN(dedline), {
            from: accounts[1],
            value: "1000000000000000000"
          }),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeEIP20ToNFT with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeEIP20ToNFT(
          nbu.address,
          new BN(10),
          nft.address,
          tokenId,
          new BN(dedline), {
            from: accounts[0]
          }),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeNFTtoEIP20 with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeNFTtoEIP20(
          nft.address,
          tokenId,
          nbu.address,
          new BN(10),
          new BN(dedline), {
            from: accounts[0]
          }),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeEIP20ToNFTs with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeEIP20ToNFTs(
          nbu.address,
          new BN(10),
          [nft.address],
          [tokenId],
          new BN(dedline), {
            from: accounts[0]
          }),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
    it('should not be createTradeNFTsToEIP20 with nft not allowed for exchange', async function () {
      await expectRevert(
        contractP2P.createTradeNFTsToEIP20(
          [nft.address],
          [tokenId],
          nbu.address,
          new BN(10),
          new BN(dedline), {
            from: accounts[0]
          }),
        "NimbusP2P_V2: Not allowed NFT"
      );
    });
  })

  describe("create trades methods", function () {
    let date = Date.now();
    let oneDay = 86400;
    let dedline = date + oneDay;
    beforeEach(async function () {
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[0]
      })
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[1]
      })
      await nbu.approve(contractP2P.address, MAX_UINT256)
    });
    it('createTradeBNBtoNFT', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[1]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });


    it('createTradeNFTtoEIP20', async function () {
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(1),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[0]
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });

    it('createTradeEIP20ToNFT', async function () {
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[0]
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });

    it('createTradeEIP20ToNFTs', async function () {
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });

    it('createTradeNFTsToEIP20', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[0]
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });

    it('createTradeNFTsToNFTs', async function () {
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });

    it('createTradeBNBtoNFTs', async function () {
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      let tradeCount = await contractP2P.tradeCount();
      expect(tradeCount).to.be.bignumber.equal(userTrades[userTrades.length - 1]);
    });

    it('createTradeBNBtoNFT should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeBNBtoNFT(
          nft.address,
          new BN(1),
          new BN(1), {
            from: accounts[1],
            value: "1000000000000000000"
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeNFTtoEIP20 should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeNFTtoEIP20(
          nft.address,
          new BN(1),
          nbu.address,
          new BN(10),
          new BN(1), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeEIP20ToNFT should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeEIP20ToNFT(
          nbu.address,
          new BN(10),
          nft.address,
          new BN(1),
          new BN(1), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeEIP20ToNFTs should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeEIP20ToNFTs(
          nbu.address,
          new BN(10),
          [nft.address, nft.address],
          [new BN(3), new BN(4)],
          new BN(1), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeNFTsToEIP20 should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeNFTsToEIP20(
          [nft.address, nft.address],
          [new BN(1), new BN(2)],
          nbu.address,
          new BN(10),
          new BN(1), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeNFTsToNFTs should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeNFTsToNFTs(
          [nft.address, nft.address],
          [new BN(1), new BN(2)],
          [nft.address, nft.address],
          [new BN(3), new BN(4)],
          new BN(1), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeBNBtoNFTs should be not create with incorect dedline', async function () {
      expectRevert(
        contractP2P.createTradeBNBtoNFTs(
          [nft.address, nft.address],
          [new BN(1), new BN(2)],
          new BN(1), {
            from: accounts[0],
            value: "1000000000000000000"
          }
        ),
        "NimbusP2P_V2: Incorrect deadline"
      )
    });

    it('createTradeBNBtoNFT should not create trade with zero amount', async function () {
      expectRevert(
        contractP2P.createTradeBNBtoNFT(
          nft.address,
          new BN(1),
          new BN(dedline), {
            from: accounts[1],
            value: "0"
          }
        ),
        "NimbusP2P_V2: Zero amount not allowed"
      )
    });

    it('createTradeEIP20ToNFT should not create trade with zero amount', async function () {
      expectRevert(
        contractP2P.createTradeEIP20ToNFT(
          nbu.address,
          new BN(0),
          nft.address,
          new BN(1),
          new BN(dedline), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Zero amount not allowed"
      )
    });

    it('createTradeBNBtoNFTs should not create trade with zero amount', async function () {
      expectRevert(
        contractP2P.createTradeBNBtoNFTs(
          [nft.address, nft.address],
          [new BN(1), new BN(2)],
          new BN(dedline), {
            from: accounts[0],
            value: "0"
          }
        ),
        "NimbusP2P_V2: Zero amount not allowed"
      )
    });

    it('createTradeEIP20ToNFTs should not create trade with zero amount', async function () {
      expectRevert(
        contractP2P.createTradeEIP20ToNFTs(
          nbu.address,
          new BN(0),
          [nft.address, nft.address],
          [new BN(3), new BN(4)],
          new BN(dedline), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Zero amount not allowed"
      )
    });

    it("createTradeEIP20ToNFTs should not be create trade with wrong lengths proposed assets", async function () {
      expectRevert(
        contractP2P.createTradeEIP20ToNFTs(
          nbu.address,
          new BN(5),
          [nft.address],
          [new BN(3), new BN(4)],
          new BN(dedline), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Wrong lengths"
      )
    });

    it("createTradeBNBtoNFTs should not be create trade with wrong lengths proposed assets", async function () {
      expectRevert(
        contractP2P.createTradeBNBtoNFTs(
          [nft.address],
          [new BN(1), new BN(2)],
          new BN(dedline), {
            from: accounts[0],
            value: "1000000000000000000"
          }
        ),
        "NimbusP2P_V2: Wrong lengths"
      )
    });

    it("createTradeNFTsToEIP20 should not be create trade with wrong lengths proposed assets", async function () {
      expectRevert(
        contractP2P.createTradeNFTsToEIP20(
          [nft.address],
          [new BN(1), new BN(2)],
          nbu.address,
          new BN(10),
          new BN(dedline), {
            from: accounts[0]
          }
        ),
        "NimbusP2P_V2: Wrong lengths"
      )
    });
  })

  describe("test methods support trades ", function () {
    let date = Date.now();
    let oneDay = 86400;
    let dedline = date + oneDay;
    beforeEach(async function () {
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[0]
      })
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[1]
      })
      await nbu.approve(contractP2P.address, MAX_UINT256)
    });
    it('supportTradeSingle BNB to NFT', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.supportTradeSingle(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[0]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(1))).to.equal(accounts[1]);
    });

    it('supportTradeSingle NFT to EIP20', async function () {
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(3),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.supportTradeSingle(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[0]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[0]);
    });

    it('supportTradeSingle EIP20 to NFT', async function () {
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(3),
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.supportTradeSingle(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[1]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[0]);
    });

    it('supportTradeMulti EIP20 to NFTs', async function () {
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.supportTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[1]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[0]);
      expect(await nft.ownerOf(new BN(4))).to.equal(accounts[0]);
    });

    it('supportTradeMulti NFTs to EIP20', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.supportTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[0]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[0]);
      expect(await nft.ownerOf(new BN(4))).to.equal(accounts[0]);
    });

    it('supportTradeMulti NFTs to NFTs', async function () {
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.supportTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[1]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(1))).to.equal(accounts[1]);
      expect(await nft.ownerOf(new BN(2))).to.equal(accounts[1]);
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[0]);
      expect(await nft.ownerOf(new BN(4))).to.equal(accounts[0]);
    });

    it('supportTradeMulti BNB to NFTs', async function () {
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.supportTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[1]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[0]);
      expect(await nft.ownerOf(new BN(4))).to.equal(accounts[0]);
    });

    it('supportTradeSingle BNB to NFT', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.supportTradeSingle(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.counterparty).to.equal(accounts[0]);
      expect(currentTrade.status).to.be.bignumber.equal(new BN(1));
      expect(await nft.ownerOf(new BN(1))).to.equal(accounts[1]);
    });


    it('BNB to NFT trade should not be support  with invalid trade id', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )
      expectRevert(
        contractP2P.supportTradeSingle(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('NFT to EIP20 trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(3),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )
      expectRevert(
        contractP2P.supportTradeSingle(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('EIP20 to NFT trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(3),
        new BN(dedline), {
          from: accounts[0]
        }
      )
      expectRevert(
        contractP2P.supportTradeSingle(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('EIP20 to NFTs multi trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )
      expectRevert(
        contractP2P.supportTradeMulti(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('NFTs to EIP20 multi trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )
      expectRevert(
        contractP2P.supportTradeMulti(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('NFTs to EIP20 multi trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )
      expectRevert(
        contractP2P.supportTradeMulti(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('NFTs to NFTs multi trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )
      expectRevert(
        contractP2P.supportTradeMulti(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });

    it('BNB to NFTs multi trade should not be support with invalid trade id', async function () {
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )
      expectRevert(
        contractP2P.supportTradeMulti(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      )
    });
  })


  describe("test methods cancel trades ", function () {
    let date = Date.now();
    let oneDay = 86400;
    let dedline = date + oneDay;
    beforeEach(async function () {
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[0]
      })
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[1]
      })
      await nbu.approve(contractP2P.address, MAX_UINT256)
    });

    it('cancel trade BNB to NFT', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.cancelTrade(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
    });

    it('cancelTrade NFT to EIP20', async function () {
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(3),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.cancelTrade(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[1]);
    });

    it('cancel trade EIP20 to NFT', async function () {
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(3),
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.cancelTrade(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
    });

    it('cancel trade multi EIP20 to NFTs', async function () {
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
    });

    it('cancel trade multi NFTs to EIP20', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[1]);
      expect(await nft.ownerOf(new BN(4))).to.equal(accounts[1]);
    });

    it('cancel trade multi NFTs to NFTs', async function () {
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
      expect(await nft.ownerOf(new BN(1))).to.equal(accounts[0]);
      expect(await nft.ownerOf(new BN(2))).to.equal(accounts[0]);
    });

    it('cancel trade multi BNB to NFTs', async function () {
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(2));
    });



    it('BNB to NFT trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )

      expectRevert(
        contractP2P.cancelTrade(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('NFT to EIP20 trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(3),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      expectRevert(
        contractP2P.cancelTrade(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('EIP20 to NFT trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(3),
        new BN(dedline), {
          from: accounts[0]
        }
      )

      expectRevert(
        contractP2P.cancelTrade(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('EIP20 to NFTs trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      expectRevert(
        contractP2P.cancelTradeMulti(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('NFTs to EIP20 trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      expectRevert(
        contractP2P.cancelTradeMulti(new BN(88), {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('NFTs to NFTs trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      expectRevert(
        contractP2P.cancelTradeMulti(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('BNB to NFTs trade should not be canceled with invalid trade id', async function () {
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )

      expectRevert(
        contractP2P.cancelTradeMulti(new BN(88), {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Invalid trade id"
      );
    });

    it('BNB to NFT trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);

      expectRevert(
        contractP2P.cancelTrade(userTrades[userTrades.length - 1], {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('NFT to EIP20 trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(3),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);

      expectRevert(
        contractP2P.cancelTrade(userTrades[userTrades.length - 1], {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('EIP20 to NFT trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(3),
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);

      expectRevert(
        contractP2P.cancelTrade(userTrades[userTrades.length - 1], {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('EIP20 to NFTs trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);

      expectRevert(
        contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('NFTs to EIP20 trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[1]);

      expectRevert(
        contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('NFTs to NFTs trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);

      expectRevert(
        contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('BNB to NFTs trade should not be canceled if user not owner', async function () {
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);

      expectRevert(
        contractP2P.cancelTradeMulti(userTrades[userTrades.length - 1], {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

  })

  describe("testing methods withdraw overdue assets ", function () {
    beforeEach(async function () {
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[0]
      })
      await nft.setApprovalForAll(contractP2P.address, true, {
        from: accounts[1]
      })
      await nbu.approve(contractP2P.address, MAX_UINT256)

    });

    it('withdraw BNB to NFT', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )

      await time.increaseTo(new BN(date + 1));
      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.withdrawOverdueAssetSingle(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
    });

    it('withdraw NFT to EIP20', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeNFTtoEIP20(
        nft.address,
        new BN(3),
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )
      await time.increaseTo(new BN(date + 2));
      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.withdrawOverdueAssetSingle(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[1]);
    });

    it('withdraw EIP20 to NFT', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeEIP20ToNFT(
        nbu.address,
        new BN(10),
        nft.address,
        new BN(3),
        new BN(dedline), {
          from: accounts[0]
        }
      )
      await time.increaseTo(new BN(date + 3));
      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.withdrawOverdueAssetSingle(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesSingle(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
    });

    it('withdraw multi EIP20 to NFTs', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeEIP20ToNFTs(
        nbu.address,
        new BN(10),
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      await time.increaseTo(new BN(date + 4));
      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.withdrawOverdueAssetsMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
    });

    it('withdraw multi NFTs to EIP20', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeNFTsToEIP20(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        nbu.address,
        new BN(10),
        new BN(dedline), {
          from: accounts[1]
        }
      )

      await time.increaseTo(new BN(date + 5));
      let userTrades = await contractP2P.userTrades(accounts[1]);
      await contractP2P.withdrawOverdueAssetsMulti(userTrades[userTrades.length - 1], {
        from: accounts[1]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
      expect(await nft.ownerOf(new BN(3))).to.equal(accounts[1]);
      expect(await nft.ownerOf(new BN(4))).to.equal(accounts[1]);
    });

    it('withdraw multi NFTs to NFTs', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeNFTsToNFTs(
        [nft.address, nft.address],
        [new BN(1), new BN(2)],
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0]
        }
      )

      await time.increaseTo(new BN(date + 6));
      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.withdrawOverdueAssetsMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
      expect(await nft.ownerOf(new BN(1))).to.equal(accounts[0]);
      expect(await nft.ownerOf(new BN(2))).to.equal(accounts[0]);
    });

    it('withdraw multi BNB to NFTs', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )

      await time.increaseTo(new BN(date + 7));
      let userTrades = await contractP2P.userTrades(accounts[0]);
      await contractP2P.withdrawOverdueAssetsMulti(userTrades[userTrades.length - 1], {
        from: accounts[0]
      });
      let currentTrade = await contractP2P.tradesMulti(userTrades[userTrades.length - 1]);

      expect(currentTrade.status).to.be.bignumber.equal(new BN(3));
    });

    it('withdraw should not run until the deadline has expired', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[1]);
      await expectRevert(
        contractP2P.withdrawOverdueAssetSingle(userTrades[userTrades.length - 1], {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Not available for withdrawal"
      );
    });

    it('withdraw multi should not run until the deadline has expired', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )

      let userTrades = await contractP2P.userTrades(accounts[0]);

      await expectRevert(
        contractP2P.withdrawOverdueAssetsMulti(userTrades[userTrades.length - 1], {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Not available for withdrawal"
      );
    });

    it('withdraw should not work if the user is not the creator of the trade', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeBNBtoNFT(
        nft.address,
        new BN(1),
        new BN(dedline), {
          from: accounts[1],
          value: "1000000000000000000"
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[1]);
      await expectRevert(
        contractP2P.withdrawOverdueAssetSingle(userTrades[userTrades.length - 1], {
          from: accounts[0]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });

    it('withdraw multi should not work if the user is not the creator of the trade', async function () {
      let date = Date.now();
      let dedline = date;
      await contractP2P.createTradeBNBtoNFTs(
        [nft.address, nft.address],
        [new BN(3), new BN(4)],
        new BN(dedline), {
          from: accounts[0],
          value: "1000000000000000000"
        }
      )
      let userTrades = await contractP2P.userTrades(accounts[0]);
      await expectRevert(
        contractP2P.withdrawOverdueAssetsMulti(userTrades[userTrades.length - 1], {
          from: accounts[1]
        }),
        "NimbusP2P_V2: Not allowed"
      );
    });
  })

})