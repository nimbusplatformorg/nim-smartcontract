const { assert } = require("chai");
const NimbusP2P = artifacts.require("NimbusERC20P2P_V1");
const NBU = artifacts.require("NBU");
const GNBU = artifacts.require("GNBU");
const NBU_WETH = artifacts.require("NBU_WETH");

const { constants, BN, expectRevert, time } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { ZERO_ADDRESS, MAX_UINT256, ZERO_BYTES32 } = constants;

contract("NimbusP2P", (accounts) => {
  const [owner, client, notAllowAccount] = accounts;
  const _lockDuration = 86400; // 1 day
  const deadline = time.duration.years(2022);
  const zeroAmount = new BN(0);
  console.log(accounts);
  let nimbusP2P;
  let nbu;
  let gnbu;
  let nbuWeth;

  before(async () => {
    nbu = await NBU.deployed();
    gnbu = await GNBU.deployed();
    nbuWeth = await NBU_WETH.deployed();
    nimbusP2P = await NimbusP2P.deployed();

    await nbu.approve(nimbusP2P.address, MAX_UINT256);
    await gnbu.approve(nimbusP2P.address, MAX_UINT256);
    await nbuWeth.approve(nimbusP2P.address, MAX_UINT256);

    await nbu.approve(nimbusP2P.address, MAX_UINT256, { from: client });
    await gnbu.approve(nimbusP2P.address, MAX_UINT256, { from: client });
    await nbuWeth.approve(nimbusP2P.address, MAX_UINT256, { from: client });

    await nbu.transfer(client, new BN("100000"));
    await gnbu.transfer(client, new BN("100000"));
    await gnbu.transfer(owner, new BN("100000"));
    // await nbuWeth.deposit({ from: owner, value: new BN("1000000000000") });
    // await nbuWeth.deposit({ from: client, value: new BN("1000000000000") });

    console.log("Balance", await web3.eth.getBalance(owner), await web3.eth.getBalance(client), await web3.eth.getBalance(notAllowAccount));

  });

  describe('Init', () => {
    it('exist', async () => {
      assert(nimbusP2P.address !== '');
    });
  });

  describe('function createTrade', () => {
    it('Create owner: success', async () => {
      const tradeId = await nimbusP2P.createTrade.call(nbu.address, 10, gnbu.address, 15, deadline, { from: owner });
      assert(tradeId.gte(zeroAmount));
    });
    it('Create owner: amount zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(nbu.address, zeroAmount, gnbu.address, zeroAmount, deadline, { from: owner }),
        "NimbusERC20P2P_V1: zero proposed amount",
      );
    });
    it('Create owner: amount1 zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(nbu.address, zeroAmount, gnbu.address, 15, deadline, { from: owner }),
        "NimbusERC20P2P_V1: zero proposed amount",
      );
    });
    it('Create owner: amount2 zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(nbu.address, 10, gnbu.address, zeroAmount, deadline, { from: owner }),
        "NimbusERC20P2P_V1: zero asked amount",
      );
    });
    it('Create owner: address zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(ZERO_ADDRESS, 10, ZERO_ADDRESS, 15, deadline, { from: owner }),
        "NimbusERC20P2P_V1: Not contracts",
      );
    });
    it('Create owner: address1 zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(ZERO_ADDRESS, 10, gnbu.address, 15, deadline, { from: owner }),
        "NimbusERC20P2P_V1: Not contracts",
      );
    });
    it('Create owner: address2 zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(nbu.address, 10, ZERO_ADDRESS, 15, deadline, { from: owner }),
        "NimbusERC20P2P_V1: Not contracts",
      );
    });
    it('Create owner: copy address', async () => {
      await expectRevert(
        nimbusP2P.createTrade.call(gnbu.address, 10, gnbu.address, 15, deadline, { from: owner }),
        "NimbusERC20P2P_V1: asked asset can't be equal to proposed asset",
      );
    });
    it('Create owner: time duration zero', async () => {
      await expectRevert(
        nimbusP2P.createTrade(nbu.address, 10, gnbu.address, 15, 0, { from: owner }),
        "NimbusERC20P2P_V1: incorrect deadline",
      );
    });
    it('Create client: failed', async () => {
      await expectRevert(
        nimbusP2P.createTrade(nbu.address, 10, gnbu.address, 15, deadline, { from: notAllowAccount }),
        "TransferHelper: TRANSFER_FROM_FAILED",
      );
    });
  });

  describe('function createTradeETH', () => {
    it('Create owner: success', async () => {
      const tradeId = await nimbusP2P.createTradeETH.call(gnbu.address, 10, deadline, { from: owner, value: 10 });
      assert(tradeId.gte(zeroAmount));
    });
    it('Create owner: NBU_WETH', async () => {
      await expectRevert(
        nimbusP2P.createTradeETH(nbuWeth.address, 1, deadline, { from: owner, value: 1 }),
        "NimbusERC20P2P_V1: asked asset can't be equal to proposed asset",
      );
    });
    it('Create owner: value zero', async () => {
      await expectRevert(
        nimbusP2P.createTradeETH.call(gnbu.address, 10, deadline, { from: owner }),
        "NimbusERC20P2P_V1: zero proposed amount",
      );
    });
    it('Create owner: address zero', async () => {
      await expectRevert(
        nimbusP2P.createTradeETH.call(ZERO_ADDRESS, 10, deadline, { from: owner, value: 10 }),
        "NimbusERC20P2P_V1: Not contract",
      );
    });
    it('Create owner: amount zero', async () => {
      await expectRevert(
        nimbusP2P.createTradeETH.call(gnbu.address, 0, deadline, { from: owner, value: 10 }),
        "NimbusERC20P2P_V1: zero asked amount",
      );
    });
    it('Create owner: time duration zero', async () => {
      await expectRevert(
        nimbusP2P.createTradeETH.call(gnbu.address, 10, 0, { from: owner, value: 10 }),
        "NimbusERC20P2P_V1: incorrect deadline",
      );
    });
    it('Create client: success', async () => {
      const tradeId = await nimbusP2P.createTradeETH.call(gnbu.address, 10, deadline, { from: notAllowAccount, value: 10 });
      assert(tradeId.gte(zeroAmount));
    });
  });


  describe('function supportTrade', () => {
    it('Create owner: trade success', async () => {
      const trade = await nimbusP2P.createTrade(nbu.address, 10, gnbu.address, 15, deadline, { from: owner });
      const tradeId = trade.logs[0].args.tradeId;
      // const result = await nimbusP2P.supportTrade(tradeId, { from: client });
      assert(tradeId.gte(zeroAmount) && await nimbusP2P.supportTrade(tradeId, { from: client }));
    });
    // it('Create owner: trade owner', async () => {
    //   const trade = await nimbusP2P.createTrade(nbu.address, 10, gnbu.address, 15, deadline, { from: owner });
    //   const tradeId = trade.logs[0].args.tradeId;
    //   await expectRevert(
    //     nimbusP2P.supportTrade(tradeId, { from: owner }),
    //     "NimbusERC20P2P_V1: support is owner",
    //   );
    // });
    it('Create owner: tradeId is zero', async () => {
      await expectRevert(
        nimbusP2P.supportTrade(0, { from: client }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: tradeId is MAX', async () => {
      await expectRevert(
        nimbusP2P.supportTrade(MAX_UINT256, { from: client }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
  });

  describe('function supportTradeETH', () => {
    it('Create owner: trade success', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 15, deadline, { from: owner, value: 10 });
      const tradeId = trade.logs[0].args.tradeId;
      // const result = await nimbusP2P.supportTrade.call(tradeId, {from: client});
      // console.log(result);
      assert(tradeId);
    });
    it('Create owner: trade success', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 15, deadline, { from: owner, value: 10 });
      const tradeId = trade.logs[0].args.tradeId;
      await expectRevert(
        nimbusP2P.supportTradeETH.call(tradeId, {from: client, value: 20 }),
        "NimbusERC20P2P_V1: ERC20 trade",
      );
    });
    // it('Create owner: trade owner', async () => {
    //   const trade = await nimbusP2P.createTradeETH(gnbu.address, 15, deadline, { from: owner, value: 20 });
    //   const tradeId = trade.logs[0].args.tradeId;
    //   await expectRevert(
    //     nimbusP2P.supportTradeETH(tradeId, { from: owner }),
    //     "NimbusERC20P2P_V1: support is owner",
    //   );
    // });
    it('Create owner: trade owner', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 15, deadline, { from: owner, value: 10 });
      const tradeId = trade.logs[0].args.tradeId;
      await expectRevert(
        nimbusP2P.supportTradeETH(tradeId, { from: client }),
        "NimbusERC20P2P_V1: Not enough ETH sent",
      );
    });
    it('Create owner: tradeId is zero', async () => {
      await expectRevert(
        nimbusP2P.supportTradeETH(0, { from: client }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: tradeId is MAX', async () => {
      await expectRevert(
        nimbusP2P.supportTradeETH(MAX_UINT256, { from: client }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });

  });

  describe('function cancelTrade', () => {
    // it('Create owner: trade success', async () => {
    //   const tradeAmount = new BN("10000");
    //   const trade = await nimbusP2P.createTradeETH(nbuWeth.address, tradeAmount, deadline, { from: owner, value: tradeAmount });
    //   const tradeId = trade.logs[0].args.tradeId;
    //   const result = await nimbusP2P.cancelTrade.call(tradeId, { from: owner });
    //   console.log(result);
    //   assert(tradeId.gte(zeroAmount) && result);
    // });
    it('Create owner: trade client', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 15, deadline, { from: owner, value: 20 });
      const tradeId = trade.logs[0].args.tradeId;
      await expectRevert(
        nimbusP2P.cancelTrade(tradeId, { from: client }),
        "NimbusERC20P2P_V1: not allowed",
      );
    });
    it('Create owner: tradeId is zero', async () => {
      await expectRevert(
        nimbusP2P.cancelTrade(0, { from: owner }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: tradeId is MAX', async () => {
      await expectRevert(
        nimbusP2P.cancelTrade(MAX_UINT256, { from: owner }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: trade is not NBU_WETH', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 20, deadline, { from: owner, value: 15 });
      const tradeId = trade.logs[0].args.tradeId;
      // const result = await nimbusP2P.cancelTrade.call(tradeId, { from: owner });
      assert(tradeId);
    });
  });

  describe('function withdrawOverdueAsset', () => {
    // it('Create owner: trade success', async () => {
    //   const tradeAmount = new BN("10000");
    //   const trade = await nimbusP2P.createTradeETH(nbuWeth.address, tradeAmount, deadline, { from: owner, value: tradeAmount });
    //   const tradeId = trade.logs[0].args.tradeId;
    //   const result = await nimbusP2P.withdrawOverdueAsset.call(tradeId, { from: owner });
    //   console.log(result);
    //   assert(tradeId.gte(zeroAmount) && result);
    // });
    it('Create owner: trade client', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 15, deadline, { from: owner, value: 20 });
      const tradeId = trade.logs[0].args.tradeId;
      await expectRevert(
        nimbusP2P.withdrawOverdueAsset(tradeId, { from: client }),
        "NimbusERC20P2P_V1: not allowed",
      );
    });
    it('Create owner: tradeId is zero', async () => {
      await expectRevert(
        nimbusP2P.withdrawOverdueAsset(0, { from: owner }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: tradeId is MAX', async () => {
      await expectRevert(
        nimbusP2P.withdrawOverdueAsset(MAX_UINT256, { from: owner }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    // it('Create owner: trade is deadline', async () => {
    //   const trade = await nimbusP2P.createTradeETH(nbuWeth.address, 15, _lockDuration, { from: owner, value: 20 });
    //   const tradeId = trade.logs[0].args.tradeId;
    //   await expectRevert(
    //     nimbusP2P.withdrawOverdueAsset.call(tradeId, { from: owner }),
    //     "NimbusERC20P2P_V1: not active trade",
    //   );
    // });
    // it('Create owner: trade is not NBU_WETH', async () => {
    //   const trade = await nimbusP2P.createTradeETH(gnbu.address, 1, deadline, { from: owner, value: 1 });
    //   const tradeId = trade.logs[0].args.tradeId;
    //   const result = await nimbusP2P.withdrawOverdueAsset.call(tradeId, { from: owner });
    //   assert(result);
    // });
  });

  describe('function state', () => {
    it('Create owner: trade success', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 20, deadline, { from: owner, value: 10 });
      const tradeId = trade.logs[0].args.tradeId;
      const result = await nimbusP2P.state(tradeId, { from: owner });
      assert(result);
    });
    it('Create owner: trade client', async () => {
      const trade = await nimbusP2P.createTrade(nbu.address, 15, gnbu.address, 15, deadline, { from: owner });
      const tradeId = trade.logs[0].args.tradeId;
      const res = await nimbusP2P.state(tradeId, { from: client });
      assert(res);
    });
    it('Create owner: tradeId is zero', async () => {
      await expectRevert(
        nimbusP2P.state(0, { from: owner }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: tradeId is MAX', async () => {
      await expectRevert(
        nimbusP2P.state(MAX_UINT256, { from: owner }),
        "NimbusERC20P2P_V1: invalid trade id",
      );
    });
    it('Create owner: trade is not NBU_WETH', async () => {
      const trade = await nimbusP2P.createTradeETH(gnbu.address, 1, deadline, { from: owner, value: 1 });
      const tradeId = trade.logs[0].args.tradeId;
      const result = await nimbusP2P.state.call(tradeId, { from: owner });
      assert(result);
    });
  });

  describe('function userTrades', () => {
    it('Create owner: trade owner', async () => {
      await nimbusP2P.createTrade(nbu.address, 10, gnbu.address, 15, deadline, { from: owner});
      const result = await nimbusP2P.userTrades(owner, { from: owner });
      // console.log("userTrades", result);
      assert(result.length > 0);
    });
    it('Create owner: trade client', async () => {
      const res = await nimbusP2P.userTrades(owner, { from: client });
      assert(res.length > 0);
    });
    it('Create owner: trade not exist', async () => {
      const res = await nimbusP2P.userTrades(client, { from: client });
      assert(res.length === 0);
    });
    it('Create owner: trade zero', async () => {
      const res = await nimbusP2P.userTrades(ZERO_ADDRESS, { from: owner });
      assert(res.length === 0);
    });
  });
});
// test ./test/dApps/P2P/NimbusP2PERC20.js