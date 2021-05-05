const Pair = artifacts.require("NimbusPair");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const Factory = artifacts.require("NimbusFactory");

const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");

const { expect } = require("chai");
const { ZERO_ADDRESS } = constants;

contract("Pair", (accounts) => {

  beforeEach(async () => {
    this.factory = await Factory.new(accounts[4])
    this.nbu = await NBU.new();
    this.gnbu = await GNBU.new();
    this.pairAddress = await this.factory.createPair(this.nbu.address, this.gnbu.address);
    this.pair = await Pair.at(this.pairAddress.logs[0].args.pair);
  })

  describe("Pair Contract Tests", () => {

    it("Check pair reserves", async () => {
      let reserves = await this.pair.getReserves();
      assert(reserves._reserve0, new BN("0"), "Reserve 0 not equal to 0")
      assert(reserves._reserve1, new BN("0"), "Reserve 1 not equal to 0")
    })

    it("Check pair initialization with not-factory address", async () => {
        let otherAccount = accounts[1]
        await expectRevert(
            this.pair.initialize(this.nbu.address, this.gnbu.address, { from: otherAccount }),
            'Nimbus: FORBIDDEN'
        )
    })

    it("Check mint token", async () => {
      const walletAddress = accounts[1];
      const token0Amount = new BN("10000");
      const token1Amount = new BN("10000");
      const expectedLiquidity = new BN("10000");
      const expectedMintedAmount = new BN("9000");

      await this.nbu.transfer(this.pair.address, token0Amount)
      await this.gnbu.transfer(this.pair.address, token1Amount)
      let {logs} = await this.pair.mint(walletAddress)

      await expectEvent.inLogs(logs, "Mint", { sender: accounts[0], amount0: token0Amount, amount1: token1Amount});
      await expectEvent.inLogs(logs, "Sync", { reserve0: token0Amount, reserve1: token1Amount});

      let reserves = await this.pair.getReserves();

      expect(await this.pair.totalSupply()).to.be.bignumber.eq(expectedLiquidity);
      expect(await this.pair.balanceOf(walletAddress)).to.be.bignumber.eq(expectedMintedAmount);
      expect(await this.nbu.balanceOf(this.pair.address)).to.be.bignumber.eq(token0Amount);
      expect(await this.gnbu.balanceOf(this.pair.address)).to.be.bignumber.eq(token1Amount);
      expect(reserves._reserve0).to.be.bignumber.eq(token0Amount);
      expect(reserves._reserve1).to.be.bignumber.eq(token1Amount);
    })
  });
}) 
