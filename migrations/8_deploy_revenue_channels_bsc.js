const fs = require('fs');
const Web3 = require('web3');

const OWNER = "0x2cdB5d54109771602D998D7047618b17f87b7190";
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

let LoanToken = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/loantoken/LoanToken.sol");
let LoanTokenLogicStandard = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/loantoken/LoanTokenLogicStandard.sol");
let LoanTokenLogicWbnb = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/loantoken/LoanTokenLogicWbnb.sol");
let LoanTokenSettings = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/loantoken/LoanTokenSettings.sol");
let LoanTokenSettingsLowerAdmin = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/loantoken/LoanTokenSettingsLowerAdmin.sol");
let Protocol = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/Protocol.sol");
let LoanOpenings = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/LoanOpenings/LoanOpenings.sol");
let LoanMaintenance = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/LoanMaintenance/LoanMaintenance.sol");
let ProtocolSettings = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/ProtocolSettings/ProtocolSettings.sol");
let LoanClosings = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/LoanClosings/LoanClosings.sol");
let LoanClosingsWithGasToken = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/LoanClosings/LoanClosingsWithGasToken.sol");
let LoanSettings = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/LoanSettings/LoanSettings.sol");
let SwapsExternal = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/core/SwapsExternal/SwapsExternal.sol");
let PriceFeed = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/feeds/PriceFeeds.sol");

let addresses = require('../addresses_bsc.json');

let providers = {
    binance: `https://bsc-dataseed1.binance.org`,
    binance_testnet: `https://data-seed-prebsc-1-s1.binance.org:8545`
}

let wbnb = { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" };
let busd = { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" };
let loanTokenLogicStandard;
let loanTokenLogicWbnb;
let ibusd;
let iwbnb;
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
        case "bsc-fork": {
            currentProvider = providers.binance;
            break;
        };
        case "bsc_testnet-fork": {
            currentProvider = providers.binance_testnet;
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
        addresses.wbnb = wbnb.address;
        addresses.busd = busd.address;
        fs.writeFileSync('./addresses_bsc.json', JSON.stringify(addresses));
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
            await deployer.deploy(LoanTokenLogicWbnb, OWNER);
            loanTokenLogicWbnb = await LoanTokenLogicWbnb.deployed();

            addresses.protocol = protocol.address;
            addresses.loanTokenLogicStandard = loanTokenLogicStandard.address;
            addresses.loanTokenLogicWbnb = loanTokenLogicWbnb.address;
            fs.writeFileSync('./addresses_bsc.json', JSON.stringify(addresses));
        } else {
            loanTokenLogicStandard = { address: addresses.loanTokenLogicStandard };
            loanTokenLogicWbnb = { address: addresses.loanTokenLogicWbnb };

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
            fs.writeFileSync('./addresses_bsc.json', JSON.stringify(addresses));
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
            iwbnb = await LoanToken.deployed();
            await deployer.deploy(LoanToken, OWNER, loanTokenSettings.address);
            ibusd = await LoanToken.deployed();

            addresses.loanTokenSettings = loanTokenSettings.address;
            addresses.iwbnb = iwbnb.address;
            addresses.ibusd = ibusd.address;
            fs.writeFileSync('./addresses_bsc.json', JSON.stringify(addresses));
        } else {
            loanTokenSettings = await LoanTokenSettings.at(addresses.loanTokenSettings);
            iwbnb = { address: addresses.iwbnb };
            ibusd = { address: addresses.ibusd };
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
            await protocolAsProtocolSettings.setSupportedTokens([wbnb.address, busd.address], [true, true]);
            await protocolAsProtocolSettings.setFeesController(OWNER);
            await protocolAsProtocolSettings.setLoanPool([iwbnb.address, ibusd.address], [wbnb.address, busd.address]);
            await protocolAsProtocolSettings.setLiquidationIncentivePercent([wbnb.address, busd.address], [busd.address, wbnb.address], ["5000000000000000000", "5000000000000000000"]);
        }
        //#endregion


        //#region SET TESTNET PRICES 8/11
        if (deployParams.setPicesForTestnet) {
            console.log("===== Start setting price feeds (8/11) =====");
            if (!priceFeed.setDecimals) priceFeed = await PriceFeed.at(addresses.priceFeed);
            await priceFeed.setDecimals([wbnb.address, busd.address]);
            await priceFeed.setPriceFeed([busd.address], ["0x87Ea38c9F24264Ec1Fff41B04ec94a97Caf99941"]);
        }
        //#endregion


        //#region INITIALIZE iTOKENS 9/11
        if (deployParams.initializeITokenContracts) {
            console.log("===== Start initialize iTokens (9/11) =====");
            let iwbnbAsAsLoanTokenSettings = await LoanTokenSettings.at(iwbnb.address);
            await iwbnbAsAsLoanTokenSettings.initialize(wbnb.address, "WBNB iToken", "iWBNB");

            let ibusdAsLoanTokenSettings = await LoanTokenSettings.at(ibusd.address);
            await ibusdAsLoanTokenSettings.initialize(busd.address, "BUSD iToken", "iBUSD");

            await iwbnb.setTarget(loanTokenLogicWbnb.address);
            await ibusd.setTarget(loanTokenLogicStandard.address);
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

            let loanAsLogic = await LoanTokenLogicStandard.at(iwbnb.address);
            let calldataDemandCurve = await web3.eth.abi.encodeFunctionCall(demandCurveJsonObject, ["0", "7500000000000000000", "0", "0", "80000000000000000000", "80000000000000000000", "120000000000000000000"]);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataDemandCurve);

            loanAsLogic = await LoanTokenLogicStandard.at(ibusd.address);
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
                iwbnb.address,
                wbnb.address,
                busd.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200"
            ];

            let loanAsLogic = await LoanTokenLogicStandard.at(iwbnb.address);
            let protocolFromAddress = await loanAsLogic.revenueChannelsProtocol();
            console.log(`revenueChannelsProtocol on iwbnb loanAsLogic: ${protocolFromAddress}`);
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
                ibusd.address,
                busd.address,
                wbnb.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200",
            ];

            loanAsLogic = await LoanTokenLogicStandard.at(ibusd.address);
            console.log(`revenueChannelsProtocol on ibusd loanAsLogic: ${await loanAsLogic.revenueChannelsProtocol()}`);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1], true]);
            //console.log(calldataSetupLoanParams);
            console.log("   Settings ibusd setupLoanParams");
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