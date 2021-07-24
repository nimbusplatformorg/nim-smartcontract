const fs = require('fs');

let Protocol = artifacts.require("Protocol");
let addresses = require('../addresses_eth.json');

module.exports = function (deployer) {
    deployer.then(async () => {
        console.log(deployer.network)
        console.log("===== Start deploying protocol =====");
        await deployer.deploy(Protocol);
        let protocol = await Protocol.deployed();
        console.log(`protocol address: ${protocol.address}`);
        addresses.protocol = protocol.address;
        fs.writeFileSync('./addresses_eth.json', JSON.stringify(addresses));
    });
}