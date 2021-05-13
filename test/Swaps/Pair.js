const Pair = artifacts.require("NimbusPair");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const Factory = artifacts.require("NimbusFactory");
const NimbusReferralProgram = artifacts.require("NimbusReferralProgram");

const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");

const { expect } = require("chai");
const { ZERO_ADDRESS, ZERO_BYTES32 } = constants;

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

    
    it("Check burn tokens", async () => {
      const walletAddress = accounts[1];
      const nbuAmount = new BN("10000");
      const gnbuAmount = new BN("10000");
      const minLiquidity = new BN("1000");

      await this.nbu.transfer(this.pair.address, nbuAmount)
      await this.gnbu.transfer(this.pair.address, gnbuAmount)

      await this.pair.mint(walletAddress)
      let liquidity = await this.pair.balanceOf(walletAddress)
      await this.pair.transfer(this.pair.address, liquidity, { from: walletAddress })

      let {logs} = await this.pair.burn(walletAddress)

      expect(await this.pair.totalSupply()).to.be.bignumber.eq(minLiquidity);
      expect(await this.pair.balanceOf(walletAddress)).to.be.bignumber.eq(new BN("0"));
      expect(await this.nbu.balanceOf(this.pair.address)).to.be.bignumber.eq(new BN("1000"))
      expect(await this.gnbu.balanceOf(this.pair.address)).to.be.bignumber.eq(new BN("1000"))
      expect(await this.nbu.balanceOf(walletAddress)).to.be.bignumber.eq(nbuAmount.sub(new BN("1000")))
      expect(await this.gnbu.balanceOf(walletAddress)).to.be.bignumber.eq(gnbuAmount.sub(new BN("1000")))

      await expectEvent.inLogs(logs, "Burn", { sender: accounts[0], amount0: nbuAmount.sub(new BN("1000")), amount1: gnbuAmount.sub(new BN("1000")), to: walletAddress});
      await expectEvent.inLogs(logs, "Sync", { reserve0: new BN("1000"), reserve1: new BN("1000")});
    })

    it("Check burn revert with insuffisient liquidity", async () => {
      const walletAddress = accounts[1];
      const nbuAmount = new BN("10000");
      const gnbuAmount = new BN("10000");
      const minLiquidity = new BN("1000");

      await this.nbu.transfer(this.pair.address, nbuAmount)
      await this.gnbu.transfer(this.pair.address, gnbuAmount)

      await this.pair.mint(walletAddress)

      await expectRevert(this.pair.burn(walletAddress), 'Nimbus: INSUFFICIENT_LIQUIDITY_BURNED')
    })


    it("Check swap revert with swap amount 0", async () => {
      const walletAddress = accounts[1];
      await expectRevert(this.pair.swap(0, 0, walletAddress, ZERO_BYTES32), 'Nimbus: INSUFFICIENT_OUTPUT_AMOUNT')
    })

    it("Check swap revert if to equals to token address", async () => {
      const walletAddress = accounts[1];
      const nbuAmount = new BN("10000");
      const gnbuAmount = new BN("10000");

      await this.nbu.transfer(this.pair.address, nbuAmount)
      await this.gnbu.transfer(this.pair.address, gnbuAmount)

      await this.pair.mint(walletAddress)

      await expectRevert(this.pair.swap(1, 1, this.nbu.address, ZERO_BYTES32), 'Nimbus: INVALID_TO')
    })

    it("Check swap token 0", async () => {
      const rp = await NimbusReferralProgram.deployed();
      await this.factory.setNimbusReferralProgram(rp.address, { from: accounts[4] });

      const walletAddress = accounts[1];
      const nbuAmount = new BN("5").mul(new BN("10").pow(new BN("18")))
      const gnbuAmount = new BN("10").mul(new BN("10").pow(new BN("18")))
      const swapAmount = new BN("1").mul(new BN("10").pow(new BN("18")))
      const expectedOutAmount = new BN("1662497915624478906")

      await this.nbu.transfer(this.pair.address, nbuAmount)
      await this.gnbu.transfer(this.pair.address, gnbuAmount)
      await this.pair.mint(walletAddress);
      await this.nbu.transfer(this.pair.address, swapAmount)

      let {logs} = await this.pair.swap(0, expectedOutAmount, walletAddress, "0x", { from: walletAddress });

      let rpTransferEvent = logs.filter(l => l.event == 'Transfer' && l.args.to == rp.address);
      let feeAmount = rpTransferEvent[0].args.value;
      const reserves = await this.pair.getReserves();

      expectEvent.inLogs(logs, "Swap", { sender: walletAddress, amount0In: swapAmount, amount1In: "0", amount0Out: "0", amount1Out: expectedOutAmount, to: walletAddress})
      expectEvent.inLogs(logs, "Sync", { reserve0: nbuAmount.add(swapAmount).sub(feeAmount) , reserve1: gnbuAmount.sub(expectedOutAmount)})
      expectEvent.inLogs(logs, "Transfer", {from: this.pair.address, to: walletAddress, value: expectedOutAmount})

      expect(reserves[0]).to.be.bignumber.eq(nbuAmount.add(swapAmount).sub(feeAmount));
      expect(reserves[1]).to.be.bignumber.eq(gnbuAmount.sub(expectedOutAmount));
      expect(await this.nbu.balanceOf(this.pair.address)).to.be.bignumber.eq(nbuAmount.add(swapAmount).sub(feeAmount));
      expect(await this.gnbu.balanceOf(this.pair.address)).to.be.bignumber.eq(gnbuAmount.sub(expectedOutAmount));
    })

    it("Check swap token 1", async () => {
      const rp = await NimbusReferralProgram.deployed();
      await this.factory.setNimbusReferralProgram(rp.address, { from: accounts[4] });

      const walletAddress = accounts[1];
      const nbuAmount = new BN("5").mul(new BN("10").pow(new BN("18")))
      const gnbuAmount = new BN("10").mul(new BN("10").pow(new BN("18")))
      const swapAmount = new BN("1").mul(new BN("10").pow(new BN("18")))
      const expectedOutAmount = new BN("453305446940074565")

      await this.nbu.transfer(this.pair.address, nbuAmount)
      await this.gnbu.transfer(this.pair.address, gnbuAmount)

      await this.pair.mint(walletAddress);
      await this.gnbu.transfer(this.pair.address, swapAmount)

      let {logs} = await this.pair.swap(expectedOutAmount, 0, walletAddress, "0x", { from: walletAddress });

      let rpTransferEvent = logs.filter(l => l.event == 'Transfer' && l.args.to == rp.address);
      let feeAmount = rpTransferEvent[0].args.value;
      const reserves = await this.pair.getReserves();

      expectEvent.inLogs(logs, "Swap", { sender: walletAddress, amount0In: "0", amount1In: swapAmount, amount0Out: expectedOutAmount, amount1Out: "0", to: walletAddress})

      expectEvent.inLogs(logs, "Sync", { reserve0: nbuAmount.sub(expectedOutAmount) , reserve1: gnbuAmount.add(swapAmount).sub(feeAmount)})
      expectEvent.inLogs(logs, "Transfer", {from: this.pair.address, to: walletAddress, value: expectedOutAmount})

      expect(reserves[0]).to.be.bignumber.eq(nbuAmount.sub(expectedOutAmount));
      expect(reserves[1]).to.be.bignumber.eq(gnbuAmount.add(swapAmount).sub(feeAmount));
      expect(await this.nbu.balanceOf(this.pair.address)).to.be.bignumber.eq(nbuAmount.sub(expectedOutAmount));
      expect(await this.gnbu.balanceOf(this.pair.address)).to.be.bignumber.eq(gnbuAmount.add(swapAmount).sub(feeAmount));
    })
  });
}) 
