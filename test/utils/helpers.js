const { BN } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
function getEvents(logs, event) {
  return logs.filter((e) => e.event === event);
}

function getEventArgs(logs, event, index) {
  const events = logs.filter((e) => e.event === event);
  return events[index].args;
}

function getPowerBN(base, power) {
  if (typeof base === "string") {
    const t = base.split("e");
    return new BN(t[0]).mul(new BN(10).pow(new BN(t[1])));
  } else {
    return new BN(base).pow(new BN(power));
  }
}

function getEventsFromRawLogs(tx, event) {
  const kessakEvent = web3.utils.sha3(event);
  return tx.receipt.rawLogs.filter((e) => e.topics[0] === kessakEvent);
}

function expectEventFromRawLogs(tx, eventName, arguments) {
  const kessakEvent = web3.utils.sha3(eventName);
  const eventArgs = [kessakEvent, ...arguments];
  const events = tx.receipt.rawLogs.filter((e) => e.topics[0] === kessakEvent);
  expect(events.length > 0).to.equal(true, `No '${eventName}' events found`);

  const exception = [];
  const event = events.find(function (e) {
    Object.values(eventArgs).forEach((v, index) => {
      try {
        expect(v).to.be.equal(
          e.topics[index].toUpperCase(),
          `expected event argument 'topic[${index}]' to have value ${v} but got ${e.topics[index]}`
        );
      } catch (error) {
        exception.push(error);
        return false;
      }
    });
    return true;
  });

  if (event === undefined) {
    throw exception[0];
  }

  return event;
}

module.exports = {
  getEventArgs,
  getEvents,
  getPowerBN,
  getEventsFromRawLogs,
  expectEventFromRawLogs,
};
