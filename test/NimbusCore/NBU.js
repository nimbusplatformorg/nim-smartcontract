const NBU = artifacts.require("./NimbusCore/NBU.sol");
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const timeHelper = require("../utils/timeHelpers");
const DAY = new BN("86400");
const { utils } = require("ethers");
const { keccak256, defaultAbiCoder, toUtf8Bytes } = utils;

contract("NBU", (accounts) => {
  const [initialHolder, recipient, anotherAccount] = accounts;

  const name = "Nimbus";
  const symbol = "NBU";

  const initialSupply = new BN("1000000000000000000000000000");

  beforeEach(async function () {
    this.token = await NBU.new();
  });

  describe("core", function () {
    it("has a name", async function () {
      expect(await this.token.name()).to.equal(name);
    });

    it("has a symbol", async function () {
      expect(await this.token.symbol()).to.equal(symbol);
    });

    it("has 18 decimals", async function () {
      expect(await this.token.decimals()).to.be.bignumber.equal("18");
    });

    describe("total supply", function () {
      it("returns the total amount of tokens", async function () {
        expect(await this.token.totalSupply()).to.be.bignumber.equal(
          initialSupply
        );
      });
    });

    describe("balanceOf", function () {
      describe("when the requested account has no tokens", function () {
        it("returns zero", async function () {
          expect(
            await this.token.balanceOf(anotherAccount)
          ).to.be.bignumber.equal("0");
        });
      });

      describe("when the requested account has some tokens", function () {
        it("returns the total amount of tokens", async function () {
          expect(
            await this.token.balanceOf(initialHolder)
          ).to.be.bignumber.equal(initialSupply);
        });
      });
    });

    it("DOMAIN_SEPARATOR", async function () {
      const chainId = await web3.eth.getChainId();
      expect(await this.token.DOMAIN_SEPARATOR()).to.eq(
        keccak256(
          defaultAbiCoder.encode(
            ["bytes32", "bytes32", "uint256", "address"],
            [
              keccak256(
                toUtf8Bytes(
                  "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
                )
              ),
              keccak256(toUtf8Bytes(name)),
              chainId,
              this.token.address,
            ]
          )
        )
      );
    });

    it("PERMIT_TYPEHASH", async function () {
      expect(await this.token.PERMIT_TYPEHASH()).to.eq(
        keccak256(
          toUtf8Bytes(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
          )
        )
      );
    });
  });

  describe("transfer", function () {
    shouldBehaveLikeERC20Transfer(
      "NBU::_transfer",
      initialHolder,
      recipient,
      initialSupply,
      function (from, to, value) {
        return this.token.transfer(to, value, { from });
      }
    );
  });

  describe("transfer from", function () {
    const spender = recipient;

    describe("when the token owner is not the zero address", function () {
      const tokenOwner = initialHolder;

      describe("when the recipient is not the zero address", function () {
        const to = anotherAccount;

        describe("when the spender has enough approved balance", function () {
          beforeEach(async function () {
            await this.token.approve(spender, initialSupply, {
              from: initialHolder,
            });
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("transfers the requested amount", async function () {
              await this.token.transferFrom(tokenOwner, to, amount, {
                from: spender,
              });

              expect(
                await this.token.balanceOf(tokenOwner)
              ).to.be.bignumber.equal("0");

              expect(await this.token.balanceOf(to)).to.be.bignumber.equal(
                amount
              );
            });

            it("decreases the spender allowance", async function () {
              await this.token.transferFrom(tokenOwner, to, amount, {
                from: spender,
              });

              expect(
                await this.token.allowance(tokenOwner, spender)
              ).to.be.bignumber.equal("0");
            });

            it("emits a transfer event", async function () {
              const { logs } = await this.token.transferFrom(
                tokenOwner,
                to,
                amount,
                { from: spender }
              );

              expectEvent.inLogs(logs, "Transfer", {
                from: tokenOwner,
                to: to,
                value: amount,
              });
            });

            it("emits an approval event", async function () {
              const { logs } = await this.token.transferFrom(
                tokenOwner,
                to,
                amount,
                { from: spender }
              );

              expectEvent.inLogs(logs, "Approval", {
                owner: tokenOwner,
                spender: spender,
                value: await this.token.allowance(tokenOwner, spender),
              });
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply.addn(1);

            it("reverts", async function () {
              await expectRevert(
                this.token.transferFrom(tokenOwner, to, amount, {
                  from: spender,
                }),
                `NBU::_transfer: amount exceeds available for transfer balance`
              );
            });
          });
        });

        describe("when the spender does not have enough approved balance", function () {
          beforeEach(async function () {
            await this.token.approve(spender, initialSupply.subn(1), {
              from: tokenOwner,
            });
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("reverts", async function () {
              await expectRevert(
                this.token.transferFrom(tokenOwner, to, amount, {
                  from: spender,
                }),
                `NBU::transferFrom: transfer amount exceeds allowance`
              );
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply.addn(1);

            it("reverts", async function () {
              await expectRevert(
                this.token.transferFrom(tokenOwner, to, amount, {
                  from: spender,
                }),
                `NBU::_transfer: amount exceeds available for transfer balance`
              );
            });
          });
        });
      });

      describe("when the recipient is the zero address", function () {
        const amount = initialSupply;
        const to = ZERO_ADDRESS;

        beforeEach(async function () {
          await this.token.approve(spender, amount, { from: tokenOwner });
        });

        it("reverts", async function () {
          await expectRevert(
            this.token.transferFrom(tokenOwner, to, amount, { from: spender }),
            `NBU::_transfer: transfer to the zero address`
          );
        });
      });
    });

    describe("when the token owner is the zero address", function () {
      const amount = 0;
      const tokenOwner = ZERO_ADDRESS;
      const to = recipient;

      it("reverts", async function () {
        await expectRevert(
          this.token.transferFrom(tokenOwner, to, amount, { from: spender }),
          `NBU::_transfer: transfer from the zero address`
        );
      });
    });
  });

  describe("approve", function () {
    shouldBehaveLikeERC20Approve(
      "NBU::_approve",
      initialHolder,
      recipient,
      initialSupply,
      function (owner, spender, amount) {
        return this.token.approve(spender, amount, { from: owner });
      }
    );
  });

  describe("decrease allowance", function () {
    describe("when the spender is not the zero address", function () {
      const spender = recipient;

      function shouldDecreaseApproval(amount) {
        describe("when there was no approved amount before", function () {
          it("reverts", async function () {
            await expectRevert(
              this.token.decreaseAllowance(spender, amount, {
                from: initialHolder,
              }),
              "NBU::decreaseAllowance: decreased allowance below zero"
            );
          });
        });

        describe("when the spender had an approved amount", function () {
          const approvedAmount = amount;

          beforeEach(async function () {
            ({ logs: this.logs } = await this.token.approve(
              spender,
              approvedAmount,
              { from: initialHolder }
            ));
          });

          it("emits an approval event", async function () {
            const { logs } = await this.token.decreaseAllowance(
              spender,
              approvedAmount,
              { from: initialHolder }
            );

            expectEvent.inLogs(logs, "Approval", {
              owner: initialHolder,
              spender: spender,
              value: new BN(0),
            });
          });

          it("decreases the spender allowance subtracting the requested amount", async function () {
            await this.token.decreaseAllowance(
              spender,
              approvedAmount.subn(1),
              { from: initialHolder }
            );

            expect(
              await this.token.allowance(initialHolder, spender)
            ).to.be.bignumber.equal("1");
          });

          it("sets the allowance to zero when all allowance is removed", async function () {
            await this.token.decreaseAllowance(spender, approvedAmount, {
              from: initialHolder,
            });
            expect(
              await this.token.allowance(initialHolder, spender)
            ).to.be.bignumber.equal("0");
          });

          it("reverts when more than the full allowance is removed", async function () {
            await expectRevert(
              this.token.decreaseAllowance(spender, approvedAmount.addn(1), {
                from: initialHolder,
              }),
              "NBU::decreaseAllowance: decreased allowance below zero"
            );
          });
        });
      }

      describe("when the sender has enough balance", function () {
        const amount = initialSupply;

        shouldDecreaseApproval(amount);
      });

      describe("when the sender does not have enough balance", function () {
        const amount = initialSupply.addn(1);

        shouldDecreaseApproval(amount);
      });
    });

    describe("when the spender is the zero address", function () {
      const amount = initialSupply;
      const spender = ZERO_ADDRESS;

      it("reverts", async function () {
        await expectRevert(
          this.token.decreaseAllowance(spender, amount, {
            from: initialHolder,
          }),
          "NBU::decreaseAllowance: decreased allowance below zero"
        );
      });
    });
  });

  describe("increase allowance", function () {
    const amount = initialSupply;
    describe("when the spender is not the zero address", function () {
      const spender = recipient;

      describe("when the sender has enough balance", function () {
        it("emits an approval event", async function () {
          const { logs } = await this.token.increaseAllowance(spender, amount, {
            from: initialHolder,
          });
          expectEvent.inLogs(logs, "Approval", {
            owner: initialHolder,
            spender: spender,
            value: amount,
          });
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await this.token.increaseAllowance(spender, amount, {
              from: initialHolder,
            });
            expect(
              await this.token.allowance(initialHolder, spender)
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await this.token.approve(spender, new BN(1), {
              from: initialHolder,
            });
          });

          it("increases the spender allowance adding the requested amount", async function () {
            await this.token.increaseAllowance(spender, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, spender)
            ).to.be.bignumber.equal(amount.addn(1));
          });
        });
      });

      describe("when the sender does not have enough balance", function () {
        const amount = initialSupply.addn(1);

        it("emits an approval event", async function () {
          const { logs } = await this.token.increaseAllowance(spender, amount, {
            from: initialHolder,
          });

          expectEvent.inLogs(logs, "Approval", {
            owner: initialHolder,
            spender: spender,
            value: amount,
          });
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await this.token.increaseAllowance(spender, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, spender)
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await this.token.approve(spender, new BN(1), {
              from: initialHolder,
            });
          });

          it("increases the spender allowance adding the requested amount", async function () {
            await this.token.increaseAllowance(spender, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, spender)
            ).to.be.bignumber.equal(amount.addn(1));
          });
        });
      });
    });

    describe("when the spender is the zero address", function () {
      const spender = ZERO_ADDRESS;

      it("reverts", async function () {
        await expectRevert(
          this.token.increaseAllowance(spender, amount, {
            from: initialHolder,
          }),
          "NBU::_approve: approve to the zero address"
        );
      });
    });
  });

  describe("burnTokens", function () {
    describe("for a non zero account", async function () {
      it("rejects burning more than totalSupply", async function () {
        await expectRevert(
          this.token.burnTokens(initialSupply.addn(1), { from: initialHolder }),
          "NBU::burnTokens: exceeds available amount"
        );
      });

      it("rejects burning from not owner", async function () {
        await expectRevert(
          this.token.burnTokens(initialSupply.addn(1), { from: recipient }),
          "Ownable: Caller is not the owner"
        );
      });

      const describeBurn = function (description, amount) {
        describe(description, function () {
          beforeEach("burning", async function () {
            const { logs } = await this.token.burnTokens(amount, {
              from: initialHolder,
            });
            this.logs = logs;
          });

          it("decrements totalSupply", async function () {
            const expectedSupply = initialSupply.sub(amount);
            expect(await this.token.totalSupply()).to.be.bignumber.equal(
              expectedSupply
            );
          });

          it("decrements initialHolder balance", async function () {
            const expectedBalance = initialSupply.sub(amount);
            expect(
              await this.token.balanceOf(initialHolder)
            ).to.be.bignumber.equal(expectedBalance);
          });

          it("emits Transfer event", async function () {
            const event = expectEvent.inLogs(this.logs, "Transfer", {
              from: initialHolder,
              to: ZERO_ADDRESS,
            });

            expect(event.args.value).to.be.bignumber.equal(amount);
          });
        });
      };

      describeBurn("for entire balance", initialSupply);
      describeBurn("for less amount than balance", initialSupply.subn(1));
    });
  });

  describe("vest", function () {
    const vester = recipient;
    const client = anotherAccount;
    beforeEach(async function () {
      await this.token.updateVesters(vester, true, {
        from: initialHolder,
      });
    });

    it("when sender is not vester", async function () {
      await expectRevert(
        this.token.vest(client, initialSupply, { from: client }),
        "NBU::vest: not vester"
      );
    });

    describe("when sender is vester", function () {
      it("vest more then owner balance", async function () {
        await expectRevert(
          this.token.vest(client, initialSupply.addn(1), {
            from: vester,
          }),
          "revert"
        );
      });

      it("vest all owner balance", async function () {
        const { logs } = await this.token.vest(client, initialSupply, {
          from: vester,
        });

        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: client,
          value: initialSupply,
        });
      });

      it("vest less then owner balance", async function () {
        const { logs } = await this.token.vest(client, initialSupply.subn(1), {
          from: vester,
        });

        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: client,
          value: initialSupply.subn(1),
        });
      });
    });
  });

  describe("unvest", function () {
    const vester = initialHolder;
    const client = recipient;
    const amount = new BN("152");
    beforeEach(async function () {
      await this.token.updateVesters(vester, true, {
        from: initialHolder,
      });
    });

    it("where is no vested amount", async function () {
      await expectRevert(
        this.token.unvest({ from: client }),
        "NBU::unvest:No vested amount"
      );
    });

    describe("where is vested amount", function () {
      beforeEach(async function () {
        await this.token.vest(client, amount, { from: vester });
      });

      it("reject less vestingFirstPeriod", async function () {
        const { logs } = await this.token.unvest({ from: client });

        const event = expectEvent.inLogs(logs, "Unvest", {
          user: client,
        });
        expect(event.args.amount).to.be.bignumber.equal("0");
      });

      it("after 1 day vestingFirstPeriod", async function () {
        const time = DAY.muln(61).toNumber();
        const t = await timeHelper.increaseTime(time);
        const { logs } = await this.token.unvest({ from: client });

        const event = expectEvent.inLogs(logs, "Unvest", {
          user: client,
        });

        expect(event.args.amount).to.be.bignumber.equal("1");
      });

      it("after vestingSecondPeriod", async function () {
        const time = DAY.muln(152 + 61).toNumber();
        const t = await timeHelper.increaseTime(time);
        const { logs } = await this.token.unvest({ from: client });

        const event = expectEvent.inLogs(logs, "Unvest", {
          user: client,
        });

        expect(event.args.amount).to.be.bignumber.equal(amount);
      });
    });
  });

  describe("multivest", function () {
    const [owner, ...users] = accounts;
    const amount = new BN("152");
    it("when spender is not owner", async function () {
      await expectRevert(
        this.token.multivest(users, [], { from: recipient }),
        "Ownable: Caller is not the owner"
      );
    });

    it("when accounts more than 100", async function () {
      const usersMoreThan100 = [];
      const valuesMoreThan100 = [];
      accounts.forEach((e) => {
        usersMoreThan100.push(...accounts);
        usersMoreThan100.push(recipient);
        valuesMoreThan100.push(...accounts);
        valuesMoreThan100.push(recipient);
      });
      await expectRevert(
        this.token.multivest(usersMoreThan100, valuesMoreThan100, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("when accounts length not equal values length", async function () {
      const values = users.map((a) => {
        return amount;
      });
      await expectRevert(
        this.token.multivest(accounts, values, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("vest more than owner balance", async function () {
      await this.token.transfer(recipient, initialSupply.subn(5), {
        from: initialHolder,
      });
      const values = users.map((a) => {
        return amount;
      });
      await expectRevert(
        this.token.multivest(users, values, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("multivest for 9 users", async function () {
      const values = users.map((a) => {
        return amount;
      });

      const { logs } = await this.token.multivest(users, values, {
        from: initialHolder,
      });

      users.forEach((u) => {
        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: u,
          value: amount,
        });
      });
    });
  });

  describe("multisend", function () {
    const [owner, ...users] = accounts;
    const value = new BN("152");
    it("when spender is not owner", async function () {
      await expectRevert(
        this.token.multisend(users, [], { from: recipient }),
        "Ownable: Caller is not the owner"
      );
    });

    it("when accounts more than 100", async function () {
      const usersMoreThan100 = [];
      const valuesMoreThan100 = [];
      accounts.forEach((e) => {
        usersMoreThan100.push(...accounts);
        usersMoreThan100.push(recipient);
        valuesMoreThan100.push(...accounts);
        valuesMoreThan100.push(recipient);
      });
      await expectRevert(
        this.token.multisend(usersMoreThan100, valuesMoreThan100, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("when accounts length not equal values length", async function () {
      const values = users.map((a) => {
        return value;
      });
      await expectRevert(
        this.token.multisend(accounts, values, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("when transfer more than owner balance", async function () {
      await this.token.transfer(recipient, initialSupply.subn(5), {
        from: initialHolder,
      });
      const values = users.map((a) => {
        return value;
      });
      await expectRevert(
        this.token.multisend(users, values, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it(" for 9 users", async function () {
      const values = users.map((a) => {
        return value;
      });

      const { logs } = await this.token.multisend(users, values, {
        from: initialHolder,
      });

      users.forEach((u) => {
        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: u,
          value: value,
        });
      });
    });
  });
});

function shouldBehaveLikeERC20Transfer(
  errorPrefix,
  from,
  to,
  balance,
  transfer
) {
  describe("when the recipient is not the zero address", function () {
    describe("when the sender does not have enough balance", function () {
      const amount = balance.addn(1);

      it("reverts", async function () {
        await expectRevert(
          transfer.call(this, from, to, amount),
          `${errorPrefix}: amount exceeds available for transfer balance`
        );
      });
    });

    describe("when the sender transfers all balance", function () {
      const amount = balance;

      it("transfers the requested amount", async function () {
        await transfer.call(this, from, to, amount);

        expect(await this.token.balanceOf(from)).to.be.bignumber.equal("0");

        expect(await this.token.balanceOf(to)).to.be.bignumber.equal(amount);
      });

      it("emits a transfer event", async function () {
        const { logs } = await transfer.call(this, from, to, amount);

        expectEvent.inLogs(logs, "Transfer", {
          from,
          to,
          value: amount,
        });
      });
    });

    describe("when the sender transfers zero tokens", function () {
      const amount = new BN("0");

      it("transfers the requested amount", async function () {
        await transfer.call(this, from, to, amount);

        expect(await this.token.balanceOf(from)).to.be.bignumber.equal(balance);

        expect(await this.token.balanceOf(to)).to.be.bignumber.equal("0");
      });

      it("emits a transfer event", async function () {
        const { logs } = await transfer.call(this, from, to, amount);

        expectEvent.inLogs(logs, "Transfer", {
          from,
          to,
          value: amount,
        });
      });
    });
  });

  describe("when the recipient is the zero address", function () {
    it("reverts", async function () {
      await expectRevert(
        transfer.call(this, from, ZERO_ADDRESS, balance),
        `${errorPrefix}: transfer to the zero address`
      );
    });
  });
}

function shouldBehaveLikeERC20Approve(
  errorPrefix,
  owner,
  spender,
  supply,
  approve
) {
  describe("when the spender is not the zero address", function () {
    describe("when the sender has enough balance", function () {
      const amount = supply;

      it("emits an approval event", async function () {
        const { logs } = await approve.call(this, owner, spender, amount);

        expectEvent.inLogs(logs, "Approval", {
          owner: owner,
          spender: spender,
          value: amount,
        });
      });

      describe("when there was no approved amount before", function () {
        it("approves the requested amount", async function () {
          await approve.call(this, owner, spender, amount);

          expect(
            await this.token.allowance(owner, spender)
          ).to.be.bignumber.equal(amount);
        });
      });

      describe("when the spender had an approved amount", function () {
        beforeEach(async function () {
          await approve.call(this, owner, spender, new BN(1));
        });

        it("approves the requested amount and replaces the previous one", async function () {
          await approve.call(this, owner, spender, amount);

          expect(
            await this.token.allowance(owner, spender)
          ).to.be.bignumber.equal(amount);
        });
      });
    });

    describe("when the sender does not have enough balance", function () {
      const amount = supply.addn(1);

      it("emits an approval event", async function () {
        const { logs } = await approve.call(this, owner, spender, amount);

        expectEvent.inLogs(logs, "Approval", {
          owner: owner,
          spender: spender,
          value: amount,
        });
      });

      describe("when there was no approved amount before", function () {
        it("approves the requested amount", async function () {
          await approve.call(this, owner, spender, amount);

          expect(
            await this.token.allowance(owner, spender)
          ).to.be.bignumber.equal(amount);
        });
      });

      describe("when the spender had an approved amount", function () {
        beforeEach(async function () {
          await approve.call(this, owner, spender, new BN(1));
        });

        it("approves the requested amount and replaces the previous one", async function () {
          await approve.call(this, owner, spender, amount);

          expect(
            await this.token.allowance(owner, spender)
          ).to.be.bignumber.equal(amount);
        });
      });
    });
  });

  describe("when the spender is the zero address", function () {
    it("reverts", async function () {
      await expectRevert(
        approve.call(this, owner, ZERO_ADDRESS, supply),
        `${errorPrefix}: approve to the zero address`
      );
    });
  });
}
