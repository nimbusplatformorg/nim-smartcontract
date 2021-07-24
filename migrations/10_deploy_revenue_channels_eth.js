const fs = require('fs');
const Web3 = require('web3');

const projectId = "727c7cf911354e518b345ee71943c66d";
const OWNER = "0x2cdB5d54109771602D998D7047618b17f87b7190";
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

let LoanToken = artifacts.require("LoanToken");
let LoanTokenLogicStandard = artifacts.require("LoanTokenLogicStandard");
let LoanTokenLogicWeth = artifacts.require("LoanTokenLogicWeth");
let LoanTokenSettings = artifacts.require("LoanTokenSettings");
let LoanTokenSettingsLowerAdmin = artifacts.require("LoanTokenSettingsLowerAdmin");
let Protocol = artifacts.require("Protocol");
let LoanOpenings = artifacts.require("LoanOpenings");
let LoanMaintenance = artifacts.require("LoanMaintenance");
let ProtocolSettings = artifacts.require("ProtocolSettings");
let LoanClosings = artifacts.require("LoanClosings");
let LoanClosingsWithGasToken = artifacts.require("LoanClosingsWithGasToken");
let LoanSettings = artifacts.require("LoanSettings");
let SwapsExternal = artifacts.require("SwapsExternal");
let PriceFeed = artifacts.require("PriceFeedsLocal");

let addresses = require('../addresses_eth.json');

let providers = {
    ethereum: `https://mainnet.infura.io/v3/${projectId}`,
    ropsten: `https://ropsten.infura.io/v3/${projectId}`,
    kovan: `https://kovan.infura.io/v3/${projectId}`
}

let weth = { address: "0x0BCd83DF58a1BfD25b1347F9c9dA1b7118b648a6" };
let usdt = { address: "0xdac17f958d2ee523a2206206994597c13d831ec7" };
let loanTokenLogicStandard;
let loanTokenLogicWeth;
let iusdt;
let iweth;
let protocol;
let loanTokenSettingsLowerAdmin;
let loanOpenings;
let loanMaintenance;
let protocolSettings;
let loanClosings;
let loanClosingsWithGasToken;
let loanSettings;
let swapsExternal;
let priceFeed;

module.exports = function (deployer) {
    let currentProvider;

    switch(deployer.network) {
        case "ethereum": {
            currentProvider = providers.ethereum;
            break;
        }
        case "kovan": {
            currentProvider = providers.kovan;
            break;
        }
        case "ropsten-fork": {
            currentProvider = providers.ropsten;
            break;
        }
        default: {
            return;
        }
    }

    const web3 = new Web3(currentProvider);

    const deployParams = {
        depolyMainProtocolContract: false,
        depolyLogicContracts: true,
        deployCoreProtocolContracts: true,
        replaceContracts: true,
        setupProtocolContracts: true,
        setPicesForTestnet: true,
        deployITokens: true,
        initializeITokenContracts: true,
        setupITokenContractsDemandCurve: true,
        setupITokenContractsLoanParams: true,
    }

    deployer.then(async () => {
        //#region DEPLOY TOKENS 1/11
        console.log("===== Start deploying tokens (1/11) =====");
        addresses.weth = weth.address;
        addresses.usdt = usdt.address;
        fs.writeFileSync('./addresses_eth.json', JSON.stringify(addresses));
        //#endregion

        //#region DEPLOY PROCOL MAIN PROXY 2/11
        if (deployParams.depolyMainProtocolContract) { 
            console.log("===== Start deploying protocol (2/11) =====");
            await deployer.deploy(Protocol);
            protocol = await Protocol.deployed();
            console.log(`protocol address: ${protocol.address}`);
            addresses.protocol = protocol.address;
        } else {
            protocol = { address: addresses.protocol };
        }
        //#endregion

        //#region DEPLOY LOGIC CONTRACTS 3/11
        if (deployParams.depolyLogicContracts) {
            console.log("===== Start deploying logic contracts (3/11) =====");
            await deployer.deploy(LoanTokenLogicStandard, OWNER);
            loanTokenLogicStandard = await LoanTokenLogicStandard.deployed();
            await deployer.deploy(LoanTokenLogicWeth, OWNER);
            loanTokenLogicWeth = await LoanTokenLogicWeth.deployed();

            addresses.protocol = protocol.address;
            addresses.loanTokenLogicStandard = loanTokenLogicStandard.address;
            addresses.loanTokenLogicWeth = loanTokenLogicWeth.address;
            fs.writeFileSync('./addresses_eth.json', JSON.stringify(addresses));
        } else {
            loanTokenLogicStandard = { address: addresses.loanTokenLogicStandard };
            loanTokenLogicWeth = { address: addresses.loanTokenLogicWeth };

        }
        //#endregion


        //#region DEPLOY CORE PROTOCOL CONTRACTS 4/11
        if (deployParams.deployCoreProtocolContracts) {
            console.log("===== Start deploying core protocol contracts (4/11) =====");
            await deployer.deploy(LoanTokenSettingsLowerAdmin, protocol.address);
            loanTokenSettingsLowerAdmin = await LoanTokenSettingsLowerAdmin.deployed();

            await deployer.deploy(LoanSettings);
            loanSettings = await LoanSettings.deployed();
            await deployer.deploy(ProtocolSettings);
            protocolSettings = await ProtocolSettings.deployed();

            await deployer.deploy(LoanOpenings);
            loanOpenings = await LoanOpenings.deployed();
            await deployer.deploy(LoanMaintenance);
            loanMaintenance = await LoanMaintenance.deployed();
            await deployer.deploy(LoanClosings);
            loanClosings = await LoanClosings.deployed();
            await deployer.deploy(LoanClosingsWithGasToken);
            loanClosingsWithGasToken = await LoanClosingsWithGasToken.deployed();
            await deployer.deploy(SwapsExternal);
            swapsExternal = await SwapsExternal.deployed();
            await deployer.deploy(PriceFeed);
            priceFeed = await PriceFeed.deployed();

            addresses.loanTokenSettingsLowerAdmin = loanTokenSettingsLowerAdmin.address;
            addresses.loanOpenings = loanOpenings.address;
            addresses.loanMaintenance = loanMaintenance.address;
            addresses.protocolSettings = protocolSettings.address;
            addresses.loanClosings = loanClosings.address;
            addresses.loanClosingsWithGasToken = loanClosingsWithGasToken.address;
            addresses.loanSettings = loanSettings.address;
            addresses.swapsExternal = swapsExternal.address;
            addresses.priceFeed = priceFeed.address;
            fs.writeFileSync('./addresses_eth.json', JSON.stringify(addresses));
        } else {
            loanTokenSettingsLowerAdmin = { address: addresses.loanTokenSettingsLowerAdmin }
            loanSettings = { address: addresses.loanSettings };
            protocolSettings = { address: addresses.protocolSettings };
            loanOpenings = { address: addresses.loanOpenings };
            loanMaintenance = { address: addresses.loanMaintenance };
            loanClosings = { address: addresses.loanClosings };
            loanClosingsWithGasToken = { address: addresses.loanClosingsWithGasToken };
            swapsExternal = { address: addresses.swapsExternal };
            priceFeed = { address: addresses.priceFeed };
        }
        //#endregion


        //#region DEPLOY iTOKENS 5/11
        if (deployParams.deployITokens) {
            console.log("===== Start deploying iToken Proxies (5/11) =====");
            await deployer.deploy(LoanTokenSettings);
            loanTokenSettings = await LoanTokenSettings.deployed();

            await deployer.deploy(LoanToken, OWNER, loanTokenSettings.address);
            iweth = await LoanToken.deployed();
            await deployer.deploy(LoanToken, OWNER, loanTokenSettings.address);
            iusdt = await LoanToken.deployed();

            addresses.loanTokenSettings = loanTokenSettings.address;
            addresses.iweth = iweth.address;
            addresses.iusdt = iusdt.address;
            fs.writeFileSync('./addresses_eth.json', JSON.stringify(addresses));
        } else {
            loanTokenSettings = await LoanTokenSettings.at(addresses.loanTokenSettings);
            iweth = { address: addresses.iweth };
            iusdt = { address: addresses.iusdt };
        }
        //#endregion


        //#region REGISTER CONTRACTS 6/11
        if (deployParams.replaceContracts) {
            console.log("===== Start registering contracts (6/11) =====");
            if (!protocol.replaceContract) protocol = await Protocol.at(addresses.protocol);

            await protocol.replaceContract(protocolSettings.address);
            await protocol.replaceContract(loanSettings.address);
            await protocol.replaceContract(loanOpenings.address);
            await protocol.replaceContract(loanMaintenance.address);
            await protocol.replaceContract(loanClosings.address);
            await protocol.replaceContract(loanClosingsWithGasToken.address);
            await protocol.replaceContract(swapsExternal.address);
        }
        //#endregion
   
        
        //#region SETUP PROTOCOL 7/11
        if (deployParams.setupProtocolContracts) {
            console.log("===== Start setuping protocol contract (7/11) =====");
            let protocolAsProtocolSettings = await ProtocolSettings.at(protocol.address);

            await protocolAsProtocolSettings.setPriceFeedContract(priceFeed.address);
            await protocolAsProtocolSettings.setSwapsImplContract(swapsExternal.address);
            await protocolAsProtocolSettings.setSupportedTokens([weth.address, usdt.address], [true, true]);
            await protocolAsProtocolSettings.setFeesController(OWNER);
            await protocolAsProtocolSettings.setLoanPool([iweth.address, iusdt.address], [weth.address, usdt.address]);
            await protocolAsProtocolSettings.setLiquidationIncentivePercent([weth.address, usdt.address], [usdt.address, weth.address], ["5000000000000000000", "5000000000000000000"]);
        }
        //#endregion


        //#region SET TESTNET PRICES 8/11
        if (deployParams.setPicesForTestnet) {
            console.log("===== Start setting price feeds (8/11) =====");
            if (!priceFeed.setDecimals) priceFeed = await PriceFeed.at(addresses.priceFeed);

            await priceFeed.setDecimals([weth.address, usdt.address]);
            await priceFeed.setPriceFeed([usdt.address], ["0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46"]);
        }
        //#endregion


        //#region INITIALIZE iTOKENS 9/11
        if (deployParams.initializeITokenContracts) {
            console.log("===== Start initialize iTokens (9/11) =====");
            let iwethAsAsLoanTokenSettings = await LoanTokenSettings.at(iweth.address);
            await iwethAsAsLoanTokenSettings.initialize(weth.address, "WETH iToken", "iWETH");

            let iusdtAsLoanTokenSettings = await LoanTokenSettings.at(iusdt.address);
            await iusdtAsLoanTokenSettings.initialize(usdt.address, "USDT iToken", "iUSDT");

            await iweth.setTarget(loanTokenLogicWeth.address);
            await iusdt.setTarget(loanTokenLogicStandard.address);
        }
        //#endregion


        //#region SETUP iTOKENS DEMAND CURVE 10/11
        if (deployParams.setupITokenContractsDemandCurve) {
            console.log("===== Start update iToken settings: setup demand curve (10/11) =====");
            const demandCurveJsonObject = {
                name: 'setDemandCurve',
                type: 'function',
                inputs: [{
                    name: '_baseRate',
                    type: 'uint256'
                }, {
                    name: '_rateMultiplier',
                    type: 'uint256'
                },
                {
                    name: '_lowUtilBaseRate',
                    type: 'uint256'
                },
                {
                    name: '_lowUtilRateMultiplier',
                    type: 'uint256'
                },
                {
                    name: '_targetLevel',
                    type: 'uint256'
                },
                {
                    name: '_kinkLevel',
                    type: 'uint256'
                },
                {
                    name: '_maxScaleRate',
                    type: 'uint256'
                }]
            }

            let loanAsLogic = await LoanTokenLogicStandard.at(iweth.address);
            let calldataDemandCurve = await web3.eth.abi.encodeFunctionCall(demandCurveJsonObject, ["0", "7500000000000000000", "0", "0", "80000000000000000000", "80000000000000000000", "120000000000000000000"]);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataDemandCurve);

            loanAsLogic = await LoanTokenLogicStandard.at(iusdt.address);
            calldataDemandCurve = await web3.eth.abi.encodeFunctionCall(demandCurveJsonObject, ["0", "23750000000000000000", "0", "0", "80000000000000000000", "80000000000000000000", "120000000000000000000"]);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataDemandCurve);
        }
        //#endregion


        //#region SETUP iTOKENS LOAN PARAMS 11/11
        if (deployParams.setupITokenContractsLoanParams) {
            console.log("===== Start update iToken settings: setup loan params (11/11) =====");
            const loanParamsJsonObject = {
                name: 'setupLoanParams',
                type: 'function',
                inputs: [{
                    name: 'loanParamsList',
                    type: 'tuple[]',
                    components: [
                        {
                            "name": "id",
                            "type": "bytes32"
                        },
                        {
                            "name": "active",
                            "type": "bool"
                        },
                        {
                            "name": "owner",
                            "type": "address"
                        },
                        {
                            "name": "loanToken",
                            "type": "address"
                        },
                        {
                            "name": "collateralToken",
                            "type": "address"
                        },
                        {
                            "name": "minInitialMargin",
                            "type": "uint256"
                        },
                        {
                            "name": "maintenanceMargin",
                            "type": "uint256"
                        },
                        {
                            "name": "maxLoanTerm",
                            "type": "uint256"
                        }
                    ]
                }, {
                    name: 'areLoans',
                    type: 'bool'
                }]
            };
            let settings1 = [
                ZERO_BYTES32,
                true,
                iweth.address,
                weth.address,
                usdt.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200"
            ];

            let loanAsLogic = await LoanTokenLogicStandard.at(iweth.address);
            let protocolFromAddress = await loanAsLogic.revenueChannelsProtocol();
            console.log(`revenueChannelsProtocol on iweth loanAsLogic: ${protocolFromAddress}`);
            if (protocolFromAddress === '0x0000000000000000000000000000000000000000') {
                console.log("No protocol address");
                return;
            }
            let lowerAdmin = await LoanTokenSettingsLowerAdmin.at(loanTokenSettingsLowerAdmin.address);
            console.log(`revenueChannelsProtocol on lowerAdmin: ${await lowerAdmin.revenueChannelsProtocol()}`);
            let calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1], true]);
            // console.log(calldataSetupLoanParams);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1], false]);
            // console.log(calldataSetupLoanParams);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);

            settings1 = [
                ZERO_BYTES32,
                true,
                iusdt.address,
                usdt.address,
                weth.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200",
            ];

            loanAsLogic = await LoanTokenLogicStandard.at(iusdt.address);
            console.log(`revenueChannelsProtocol on iusdt loanAsLogic: ${await loanAsLogic.revenueChannelsProtocol()}`);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1], true]);
            //console.log(calldataSetupLoanParams);
            console.log("   Settings iusdt setupLoanParams");
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1], false]);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
        }
        //#endregion

        console.log("Here we are:");
        // let protocolAsProtocolSettings = await ProtocolSettings.at(protocol.address);
        // await protocolAsProtocolSettings.setLoanPool([iweth.address, iusdc.address], [weth.address, usdc.address]);

        console.log("=============== That's all folks ===============");
    });
};