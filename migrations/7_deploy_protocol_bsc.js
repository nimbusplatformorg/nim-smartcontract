const fs = require('fs');

let Protocol = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/Protocol.sol");
let addresses = require('../addresses_bsc.json');

module.exports = function (deployer) {
    deployer.then(async () => {
        console.log("===== Start deploying protocol =====");
        await deployer.deploy(Protocol);
        let protocol = await Protocol.deployed();
        console.log(`protocol address: ${protocol.address}`);
        addresses.protocol = protocol.address;
        fs.writeFileSync('./addresses_bsc.json', JSON.stringify(addresses));
    });
}