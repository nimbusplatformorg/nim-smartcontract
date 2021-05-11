const NimbusGovernorV1 = artifacts.require("NimbusGovernorV1Test");
const GNBU = artifacts.require("GNBU");
const Pool = artifacts.require("LockStakingRewardSameTokenFixedAPY");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS } = constants;
const timeHelper = require("../utils/timeHelpers");
const { DAY, ZERO } = require("../utils/constants");
const { utils } = require("ethers");
const { keccak256, toUtf8Bytes, toUtf8String, toUtf8CodePoints } = utils;

contract("NimbusGovernorV1", (accounts) => {
  const [owner, client] = accounts;
  const clientAllowance = new BN(10000);
  const _votingDelay = new BN(1);
  const _votingPeriod = new BN(13);
  const stakeValue = new BN(3000);

  const ProposalState = {
    Pending: new BN(0),
    Active: new BN(1),
    Canceled: new BN(2),
    Defeated: new BN(3),
    Succeeded: new BN(4),
    Executed: new BN(5),
  };

  function getIdFromEvent(event) {
    return event.logs[0].args.id;
  }

  async function createProposal(contract, token, p) {
    const proposal = p
      ? p
      : {
          targets: [token.address],
          values: [ZERO],
          signatures: ["transferFrom(address,address,uint256)"],
          calldatas: [
            utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [owner, client, 1000]
            ),
          ],
          description: "description 1",
        };

    return await contract.propose(...Object.values(proposal));
  }

  async function expectPropose(propose, event) {
    const e = await expectEvent(event, "ProposalCreated", {
      targets: propose.targets,
      signatures: propose.signatures,
      calldatas: propose.calldatas,
      description: propose.description,
      proposer: propose.proposer,
      startBlock: propose.startBlock,
      endBlock: propose.endBlock,
    });
    propose.values.forEach((value, index) => {
      expect(e.args.values[index]).to.be.bignumber.equal(value);
    });
  }

  beforeEach(async function () {
    this.token = await GNBU.new();
    await this.token.transfer(client, clientAllowance);

    this.pool = await Pool.new(this.token.address, 100, 86400);
    await this.token.approve(this.pool.address, new BN(100000), {
      from: owner,
    });

    await this.token.approve(this.pool.address, clientAllowance, {
      from: client,
    });

    this.contract = await NimbusGovernorV1.new(this.token.address, [
      this.pool.address,
    ]);

    await this.token.approve(this.contract.address, clientAllowance.muln(2));
  });

  describe("propose", function () {
    describe("when proposer doesnt have enough votes", function () {
      it("reject", async function () {
        await expectRevert(
          this.contract.propose(
            [this.token.address],
            [new BN(100)],
            ["transfer (address, uint)"],
            [web3.utils.utf8ToHex(`${client},1000`)],
            "test"
          ),
          "NimbusGovernorV1::propose: proposer votes below participation threshold"
        );
      });
    });

    describe("when proposer has enough votes", function () {
      beforeEach(async function () {
        await this.token.delegate(owner);
      });

      describe("when doesnt stake before", function () {
        it("reject targets is empty", async function () {
          await expectRevert(
            this.contract.propose([], [], [], [], "description 1"),
            "NimbusGovernorV1::propose: must provide actions"
          );
        });

        it("reject when different length of data", async function () {
          await expectRevert(
            this.contract.propose(
              [this.token.address, this.token.address],
              [new BN(100)],
              ["transfer (address, uint)"],
              [web3.utils.utf8ToHex(`${client},1000`)],
              "description 1"
            ),
            "NimbusGovernorV1::propose: proposal function information arity mismatch"
          );
        });

        it("reject when too many actions", async function () {
          const propose = {
            targets: [],
            values: [],
            signatures: [],
            calldatas: [],
            description: "description 1",
          };
          for (let index = 0; index <= 10; index++) {
            propose.targets.push(this.token.address);
            propose.values.push(new BN(100));
            propose.signatures.push("transfer (address, uint)");
            propose.calldatas.push(web3.utils.utf8ToHex(`${client},1000`));
          }
          await expectRevert(
            this.contract.propose(...Object.values(propose)),
            "NimbusGovernorV1::propose: too many actions"
          );
        });

        it("reject when proposer doesnt have enough stakes tokens", async function () {
          await expectRevert(
            this.contract.propose(
              [this.token.address],
              [new BN(100)],
              ["transfer (address, uint)"],
              [web3.utils.utf8ToHex(`${client},1000`)],
              "description 1"
            ),
            "revert"
          );
        });
      });

      describe("when stake before", function () {
        beforeEach(async function () {
          await this.pool.stake(stakeValue);
        });

        it("succes", async function () {
          const propose = {
            targets: [this.token.address],
            values: [new BN(0)],
            signatures: ["transferFrom(address,address,uint256)"],
            calldatas: [
              utils.defaultAbiCoder.encode(
                ["address", "address", "uint256"],
                [owner, client, 1000]
              ),
            ],
            description: "description 1",
          };
          const event = await this.contract.propose(...Object.values(propose));
          const blockNumber = event.receipt.blockNumber;
          expectPropose(
            {
              ...propose,
              proposer: owner,
              startBlock: new BN(blockNumber).add(_votingDelay),
              endBlock: new BN(blockNumber)
                .add(_votingPeriod)
                .add(_votingDelay),
            },
            event
          );
        });
      });
    });
  });

  describe("castVote", function () {
    describe("when propose doesnt exist", function () {
      it("reject", async function () {
        await expectRevert(
          this.contract.castVote(1, true),
          "NimbusGovernorV1::state: invalid proposal id"
        );
      });
    });

    describe("when propose exist", function () {
      beforeEach(async function () {
        await this.token.delegate(owner);
        await this.pool.stake(stakeValue);
        const event = await createProposal(this.contract, this.token);
        this.proposalId = event.logs[0].args.id;
      });

      describe("when voter doesnt have enough votes", function () {
        it("reject ", async function () {
          await time.advanceBlock();
          await expectRevert(
            this.contract.castVote(this.proposalId, true, { from: client }),
            "NimbusGovernorV1::_castVote: voter votes below participation threshold"
          );
        });
      });

      describe("when when voter havs enough votes", function () {
        beforeEach(async function () {
          await this.token.delegate(client, { from: client });
        });

        it("succes", async function () {
          const event = await this.contract.castVote(this.proposalId, true, {
            from: client,
          });
          expectEvent(event, "VoteCast", {
            voter: client,
            proposalId: this.proposalId,
          });
        });

        it("reject when voter already vote before", async function () {
          await this.contract.castVote(this.proposalId, true);
          await expectRevert(
            this.contract.castVote(this.proposalId, false),
            "NimbusGovernorV1::_castVote: voter already voted"
          );
        });

        it("reject when propose is not active", async function () {
          await this.contract.castVote(this.proposalId, true);
          await expectRevert(
            this.contract.castVote(this.proposalId, false),
            "NimbusGovernorV1::_castVote: voter already voted"
          );
        });
      });
    });
  });

  describe("cancel", function () {
    beforeEach(async function () {
      await this.token.delegate(client, { from: client });

      for (let i = 2; i < accounts.length; i++) {
        const user = accounts[i];
        await this.token.transfer(user, new BN(5000));
        await this.token.delegate(user, { from: user });
      }
      await this.token.delegate(owner);
      await this.pool.stake(stakeValue);

      this.quorumVotes = await this.contract.quorumVotes();
      this.maxVoteWeight = await this.contract.maxVoteWeight();
      const proposal = {
        targets: [this.token.address],
        values: [ZERO],
        signatures: ["transferFrom(address,address,uint256)"],
        calldatas: [
          utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [owner, client, 10]
          ),
        ],
        description: "description 1",
      };
      const event = await createProposal(this.contract, this.token);
      this.proposalId = event.logs[0].args.id;
      this.endBlock = event.logs[0].args.endBlock;
    });

    it("reject when proposer has more than 1% votes", async function () {
      await time.advanceBlock();
      await expectRevert(
        this.contract.cancel(this.proposalId),
        "NimbusGovernorV1::cancel: proposer above threshold"
      );
    });

    it("reject when proposer has more than 0.1% stake tokens", async function () {
      await this.token.delegate(client);
      await time.advanceBlock();
      await expectRevert(
        this.contract.cancel(this.proposalId),
        "NimbusGovernorV1::cancel: proposer above threshold"
      );
    });

    it("succes", async function () {
      await this.token.delegate(client);
      await time.increase(DAY.muln(15));
      await this.pool.withdraw(0);

      const event = await this.contract.cancel(this.proposalId);

      expectEvent(event, "ProposalCanceled", {
        id: this.proposalId,
      });
    });

    it("reject when propose is executed", async function () {
      const voteCount = this.quorumVotes
        .div(this.maxVoteWeight)
        .addn(1)
        .toNumber();
      await time.advanceBlock();
      for (let i = 0; i < voteCount; i++) {
        await this.contract.castVote(this.proposalId, true, {
          from: accounts[i],
        });
      }
      await time.advanceBlockTo(this.endBlock.addn(1));
      const execudeEvent = await this.contract.execute(this.proposalId);
      await expectRevert(
        this.contract.cancel(this.proposalId),
        "NimbusGovernorV1::cancel: cannot cancel executed proposal"
      );
    });
  });

  describe("execute", function () {
    beforeEach(async function () {
      await this.token.delegate(owner);
      await this.pool.stake(stakeValue);
      await this.token.delegate(client, { from: client });

      for (let i = 2; i < accounts.length; i++) {
        const user = accounts[i];
        await this.token.transfer(user, new BN(2000));
        await this.token.delegate(user, { from: user });
      }

      this.quorumVotes = await this.contract.quorumVotes();
      this.maxVoteWeight = await this.contract.maxVoteWeight();
    });

    it("reject when propose doesnt success", async function () {
      const event = await createProposal(this.contract, this.token);
      const proposalId = event.logs[0].args.id;
      await expectRevert(
        this.contract.execute(proposalId),
        "NimbusGovernorV1::execute: proposal can only be executed if it is succeeded"
      );
    });

    it("when transaction execution reverted", async function () {
      const propose = {
        targets: [this.token.address],
        values: [ZERO],
        signatures: ["invalid(address,address,uint256)"],
        calldatas: [
          utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [owner, client, 1000]
          ),
        ],
        description: "description 1",
      };

      const event = await createProposal(this.contract, this.token, propose);
      const proposalId = event.logs[0].args.id;
      const endBlock = event.logs[0].args.endBlock;

      const voteCount = this.quorumVotes
        .div(this.maxVoteWeight)
        .addn(1)
        .toNumber();
      await time.advanceBlock();
      for (let i = 0; i < voteCount; i++) {
        await this.contract.castVote(proposalId, true, {
          from: accounts[i],
        });
      }
      await time.advanceBlockTo(endBlock.addn(1));

      await expectRevert(
        this.contract.execute(proposalId),
        "NimbusGovernorV1::executeTransaction: Transaction execution reverted."
      );
    });

    it("success", async function () {
      const propose = {
        targets: [this.token.address],
        values: [ZERO],
        signatures: ["transferFrom(address,address,uint256)"],
        calldatas: [
          utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [owner, client, 1000]
          ),
        ],
        description: "description 1",
      };
      const event = await createProposal(this.contract, this.token, propose);
      const proposalId = event.logs[0].args.id;
      const endBlock = event.logs[0].args.endBlock;

      const voteCount = this.quorumVotes
        .div(this.maxVoteWeight)
        .addn(1)
        .toNumber();
      await time.advanceBlock();
      for (let i = 0; i < voteCount; i++) {
        await this.contract.castVote(proposalId, true, {
          from: accounts[i],
        });
      }
      await time.advanceBlockTo(endBlock.addn(1));
      const balanceBefore = await this.token.balanceOf(client);
      const execudeEvent = await this.contract.execute(proposalId);
      expectEvent(execudeEvent, "ExecuteTransaction", {
        target: propose.targets[0],
        value: propose.values[0],
        signature: propose.signatures[0],
        data: propose.calldatas[0],
      });
      expectEvent(execudeEvent, "ProposalExecuted", {
        id: proposalId,
      });
      expect(await this.token.balanceOf(client)).to.be.bignumber.equal(
        balanceBefore.addn(1000)
      );
    });
  });

  describe("state", function () {
    it("when propose doesnt exists", async function () {
      await expectRevert(
        this.contract.state(new BN(1)),
        "NimbusGovernorV1::state: invalid proposal id"
      );
    });

    describe("when propose", function () {
      beforeEach(async function () {
        await this.token.delegate(owner);
        await this.pool.stake(stakeValue);
        await this.token.delegate(client, { from: client });

        for (let i = 2; i < accounts.length; i++) {
          const user = accounts[i];
          await this.token.transfer(user, new BN(5000));
          await this.token.delegate(user, { from: user });
        }

        this.quorumVotes = await this.contract.quorumVotes();
        this.maxVoteWeight = await this.contract.maxVoteWeight();

        const event = await createProposal(this.contract, this.token);
        this.proposalId = event.logs[0].args.id;
        this.endBlock = event.logs[0].args.endBlock;
      });

      it("just created = Pending", async function () {
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Pending);
      });

      it("after delay = Active", async function () {
        await time.advanceBlock();
        await time.advanceBlock();
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Active);
      });

      it("after voting period without enough votes = Defeated", async function () {
        const voteCount = this.quorumVotes
          .div(this.maxVoteWeight)
          .subn(1)
          .toNumber();
        await time.advanceBlock();
        await time.advanceBlock();
        for (let i = 0; i < voteCount; i++) {
          await this.contract.castVote(this.proposalId, true, {
            from: accounts[i],
          });
        }
        await time.advanceBlockTo(this.endBlock.addn(1));
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Defeated);
      });

      it("after voting period when more users voted against = Defeated", async function () {
        const voteCount = this.quorumVotes
          .div(this.maxVoteWeight)
          .addn(1)
          .toNumber();
        await time.advanceBlock();
        await time.advanceBlock();
        for (let i = 0; i < voteCount; i += 1) {
          await this.contract.castVote(this.proposalId, false, {
            from: accounts[i],
          });
        }

        await time.advanceBlockTo(this.endBlock.addn(1));
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Defeated);
      });

      it("after voting period when more users voted for = Succeeded", async function () {
        const voteCount = this.quorumVotes
          .div(this.maxVoteWeight)
          .addn(1)
          .toNumber();
        await time.advanceBlock();
        for (let i = 0; i < voteCount; i++) {
          await this.contract.castVote(this.proposalId, true, {
            from: accounts[i],
          });
        }
        await time.advanceBlockTo(this.endBlock.addn(1));
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Succeeded);
      });

      it("when proposal is canceled = Canceled", async function () {
        await this.token.delegate(client);
        await time.increase(DAY.muln(15));
        await this.pool.withdraw(0);

        const event = await this.contract.cancel(this.proposalId);
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Canceled);
      });

      it("when proposal is executed = Executed", async function () {
        const voteCount = this.quorumVotes
          .div(this.maxVoteWeight)
          .addn(1)
          .toNumber();
        await time.advanceBlock();
        for (let i = 0; i < voteCount; i++) {
          await this.contract.castVote(this.proposalId, true, {
            from: accounts[i],
          });
        }
        await time.advanceBlockTo(this.endBlock.addn(1));
        await this.contract.execute(this.proposalId);
        expect(
          await this.contract.state(this.proposalId)
        ).to.be.bignumber.equal(ProposalState.Executed);
      });
    });
  });
});
