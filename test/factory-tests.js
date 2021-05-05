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

contract("Factory", (accounts) => {

  beforeEach(async () => {
    this.factory = await Factory.new(accounts[0]);
  })

  describe("Factory Contract Tests", () => {

    it("Check pair count change after pair creation.", async () => {
      let pair = await this.factory.createPair(accounts[2], accounts[3]);
      let pairsCount = await this.factory.allPairsLength();
      assert(pairsCount.eq(new BN("1")), "Pair wasn't added!");
    });

    it("Check for identical token addresses tx revert.", async () => {
      let pairAddress = accounts[1];

      await expectRevert(
        this.factory.createPair(pairAddress, pairAddress),
        'Nimbus: IDENTICAL_ADDRESSES'
      )
    })

    it("Check for zero token addresses.", async () => {
      await expectRevert(
        this.factory.createPair(ZERO_ADDRESS, accounts[1]),
        'Nimbus: ZERO_ADDRESS'
      )
    })

    it("Check for adding existing pair.", async () => {
      let address1 = accounts[1];
      let address2 = accounts[2];

      await this.factory.createPair(address1, address2);

      await expectRevert(
        this.factory.createPair(address1, address2),
        'Nimbus: PAIR_EXISTS'
      )
    })

    it("Check that msg sender adderess doesn't equal to feeToSetter while setting feeTo address", async () => {
      let address1 = accounts[1];

      await expectRevert(
        this.factory.setFeeTo(address1, { from: address1 }),
        'Nimbus: FORBIDDEN'
      )
    })

    it("Check that msg sender adderess doesn't equal to feeToSetter while setting feeToSetter address", async () => {
      let address1 = accounts[1];

      await expectRevert(
        this.factory.setFeeTo(address1, { from: address1 }),
        'Nimbus: FORBIDDEN'
      )
    })

    it("Check that msg sender adderess doesn't equal to feeToSetter while setting refferal program address", async () => {
      let address1 = accounts[1];

      await expectRevert(
        this.factory.setFeeTo(address1, { from: address1 }),
        'Nimbus: FORBIDDEN'
      )
    })
  });
}) 
