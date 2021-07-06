//truffle migrate -f 7 --to 7 --network testnet --dry-run

const fs = require('fs');
const { CLIENT_RENEG_LIMIT } = require('tls');
const Web3 = require('web3');

const OWNER = "0xD3BbF6AFC5286D245aCC947F4c5Bcff4FF3726e2";
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

let BEP20 = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/BEP20.sol");
//let WETH = artifacts.require("./contracts/WETH.sol");
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
let PriceFeed = artifacts.require("./contracts/contracts_BSC/dApps/RevenueChannels/feeds/testnet/PriceFeedsLocal.sol");

//let addresses = {}; // require('./addresses.json');
let addresses = require('../addresses.json');

//#region TOKENS
let wbnb = { address: "0xa2ca18fc541b7b101c64e64bbc2834b05066248b" };
let busd;
let btcb;
let loanTokenLogicStandard;
let loanTokenLogicWbnb;
let ibusd;
let ibtcb;
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

//#region INFO
/*
✓ Deploy tokens
✓ Depoly Logic
✓ Deploy iTokens (3)
✓ Deploy bzxProtocol (Proxy)
✓ Deploy all main logic contracts
    ✓ LoanOpenings
    ✓ LoanMaintenance
    ✓ LoanClosings
    ✓ LoanClosingsWithGasToken
    ✓ ProtocolSettings
    ✓ SwapsExternal
    ✓ LoanSettings
    ✓ PriceFeeds
    ✓ LoanTokenSettings
    ✓ LoanTokenSettingsLowerAdmin

Bzx:
    ✓ replaceContract: LoanOpenings        https://etherscan.io/tx/0xe6361eea48a780f9ec56094914c141d797f740fe18a1e1337a869e7b2e318dcd
    ✓ replaceContract: LoanMaintenance     https://etherscan.io/tx/0x24ec2f66f6273a841856b793a2f099b52a2d458bc807ef5cf8872c60af4b0e42
    ✓ replaceContract: ProtocolSettings    https://etherscan.io/tx/0xe5a95bb3991eeba9df692118bc3791f489663f28b628a8fc4e86a282b3a49802
    ✓ replaceContract: ProtocolSettings    https://etherscan.io/tx/0x94e5b4c8c43b39c1c21301d58a6fc86bc87d0de767fd3ad2d4add07ffa74e245
    ✓ replaceContract: LoanClosings        https://etherscan.io/tx/0x93c113c8bc6ebe0222a0b61fcd3500aed8eb39a87f2d9308284e03d3315a6b96
    ✓ replaceContract: LoanClosingsWithGasToken https://etherscan.io/tx/0xf974054c7268084c0d08f336ad056cad28f6c8fa4e2f1e4f62e854ac9f5fe075
    ✓ replaceContract: SwapsExternal        https://etherscan.io/tx/0xd4d4dfce5a0e79e78229cd960e6bd43d8e96a3792e175c66687ef35f78453249
    ✓ replaceContract: LoanSettings         https://etherscan.io/tx/0x50ed7e11e116c0fabe7c49f037c30e01bc801e6cb02fa76c6ddd069c6ee9bbc9
    ✓ setPriceFeedContract                  https://etherscan.io/address/0xaaA601aE20077F9fae80494DDC36BB39C952c2d0 https://etherscan.io/tx/0xf8ffa0a19888c8249baa988ec1a7bcd32b37c77de9a2399a03bd31e28a9bf47f
    - set decimals
    - setPriceFeed
    ✓ setSwapsImplContract                                 https://etherscan.io/tx/0xc9cebc0a4f34c47f088063cc3cfb74d3b1f433b95b5fb86775960039b6df54f1
    ✓ setSupportedTokens //real tokens                     https://etherscan.io/tx/0xd751746c786f4fce2867e0772d2c4dfb1072b2d9b4e8e4755ea4b0355aa45d6d  https://etherscan.io/tx/0x926c7f416152b13091c33a214e4d3d86b6a036925be3d87f6df3307001796eda https://etherscan.io/tx/0x847f7aa00b2869355fffdff6e8563932d8e6ffe066c6bfba132635b9d277cc96
    ✓ setLiquidationIncentivePercent realToken /5000000000000000000  https://etherscan.io/tx/0xbe6b72bc875866cabdf88fe8eb16cea7d2229bdb3102f4e7c0723f666c88ec22 https://etherscan.io/tx/0x810183b175b6b79f0e2efee6a5a68ac6cc9af38eda4dc358e41a723f5dc7d5dd https://etherscan.io/tx/0x4b4f98f54e83c73eb5d09be113d0e2c41265738897e023cc5a4fafd01706af82 https://etherscan.io/tx/0x4fc50f1710be74f569131e8d37ade35a4232a0ac550398f60618604dd1ca81c7
    ✓ setFeesController //owner address                     https://etherscan.io/tx/0x478c89e84dab4ba49e2c638486b2cb1b92741576129f99eaa3c3eef20dddf513
    ✓ setLoanPool itoken / realToken                        https://etherscan.io/tx/0xeec59004c6048269b1aac2e7d9c5ba0d29de5cecaebfcb54f688c7ef9643122f
    //- LoanTokenSettingsLowerAdmin
    ??? depositProtocolToken (vbzrx) 
    ??? setTargets -> setLiquidationIncentivePercent(address[],uint256[]), 	0x0000000000000000000000000000000000000000 https://etherscan.io/tx/0x244c3bc748703776dd03509f39926144d344578d83af40fc59ad17de450b933e

On every iToken:
    ✓ initialize
    ✓ set target (logic)
    ✓ updateSettings -> setupLoanParams https://web3js.readthedocs.io/en/v1.2.11/web3-eth-abi.html#encodefunctioncall https://docs.soliditylang.org/en/v0.5.3/abi-spec.html
    ✓ updateSettings -> setDemandCurve
    - updateSettings -> disableLoanParams ?
    
???:
withdrawFees
depositCollateral
remove vbzx, 
*/
//#endregion

module.exports = function (deployer) {
    const web3 = new Web3(`https://data-seed-prebsc-1-s1.binance.org:8545`);

    const deployParams = {
        deployTokens: false,
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
        if (deployParams.deployTokens) {
            console.log("===== Start deploying tokens (1/11) =====");
            await deployer.deploy(BEP20, "16000000" + "000000000000000000", "BTCB", "BTCB", 18);
            btcb = await BEP20.deployed();
            await deployer.deploy(BEP20, "1000000000" + "000000000000000000", "BUSD", "BUSD", 18);
            busd = await BEP20.deployed();
            //await deployer.deploy(WETH);
            //weth = await WETH.deployed();

            addresses.wbnb = wbnb.address;
            addresses.busd = busd.address;
            addresses.btcb = btcb.address;
            fs.writeFileSync('./addresses.json', JSON.stringify(addresses));
        } else {
            busd = { address: addresses.busd };
            btcb = { address: addresses.btcb };
            wbnb = { address: "0xa2ca18fc541b7b101c64e64bbc2834b05066248b" };
        }
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
            fs.writeFileSync('./addresses.json', JSON.stringify(addresses));
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
            fs.writeFileSync('./addresses.json', JSON.stringify(addresses));
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
            ibtcb = await LoanToken.deployed();
            await deployer.deploy(LoanToken, OWNER, loanTokenSettings.address);
            ibusd = await LoanToken.deployed();

            addresses.loanTokenSettings = loanTokenSettings.address;
            addresses.iwbnb = iwbnb.address;
            addresses.ibusd = ibusd.address;
            addresses.ibtcb = ibtcb.address;
            fs.writeFileSync('./addresses.json', JSON.stringify(addresses));
        } else {
            loanTokenSettings = await LoanTokenSettings.at(addresses.loanTokenSettings);
            iwbnb = { address: addresses.iwbnb };
            ibusd = { address: addresses.ibusd };
            ibtcb = { address: addresses.ibtcb };
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
            await protocolAsProtocolSettings.setSupportedTokens([wbnb.address, busd.address, btcb.address], [true, true, true]);
            await protocolAsProtocolSettings.setFeesController(OWNER);
            await protocolAsProtocolSettings.setLoanPool([iwbnb.address, ibusd.address, ibtcb.address], [wbnb.address, busd.address, btcb.address]);
            await protocolAsProtocolSettings.setLiquidationIncentivePercent([wbnb.address, wbnb.address, busd.address, busd.address, btcb.address, btcb.address], [busd.address, btcb.address, wbnb.address, btcb.address, wbnb.address, busd.address], ["5000000000000000000", "5000000000000000000", "5000000000000000000", "5000000000000000000", "5000000000000000000", "5000000000000000000"]);
        }
        //#endregion


        //#region SET TESTNET PRICES 8/11
        if (deployParams.setPicesForTestnet) {
            console.log("===== Start setting price feeds (8/11) =====");
            if (!priceFeed.setDecimals) priceFeed = await PriceFeed.at(addresses.priceFeed);

            await priceFeed.setDecimals([wbnb.address, busd.address, btcb.address]);
            await priceFeed.setRates(wbnb.address, busd.address, "280" + "000000000000000000");
            await priceFeed.setRates(busd.address, wbnb.address, "357" + "0000000000000");
            await priceFeed.setRates(wbnb.address, btcb.address, "504" + "0000000000000");
            await priceFeed.setRates(btcb.address, wbnb.address, "198412" + "000000000000000");
            await priceFeed.setRates(btcb.address, busd.address, "55000" + "000000000000000000");
            await priceFeed.setRates(busd.address, btcb.address, "18" + "000000000000");
        }
        //#endregion


        //#region INITIALIZE iTOKENS 9/11
        if (deployParams.initializeITokenContracts) {
            console.log("===== Start initialize iTokens (9/11) =====");
            let iwbnbAsAsLoanTokenSettings = await LoanTokenSettings.at(iwbnb.address);
            await iwbnbAsAsLoanTokenSettings.initialize(wbnb.address, "WBNB iToken", "iWBNB");

            let ibusdAsLoanTokenSettings = await LoanTokenSettings.at(ibusd.address);
            await ibusdAsLoanTokenSettings.initialize(busd.address, "BUSD iToken", "iBUSD");

            let ibtcbAsLoanTokenSettings = await LoanTokenSettings.at(ibtcb.address);
            await ibtcbAsLoanTokenSettings.initialize(btcb.address, "BTCB iToken", "iBTCB");

            await iwbnb.setTarget(loanTokenLogicWbnb.address);
            await ibusd.setTarget(loanTokenLogicStandard.address);
            await ibtcb.setTarget(loanTokenLogicStandard.address);
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

            loanAsLogic = await LoanTokenLogicStandard.at(ibtcb.address);
            calldataDemandCurve = await web3.eth.abi.encodeFunctionCall(demandCurveJsonObject, ["0", "3750000000000000000", "0", "0", "80000000000000000000", "80000000000000000000", "120000000000000000000"]);
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
            let settings2 = [
                ZERO_BYTES32,
                true,
                iwbnb.address,
                wbnb.address,
                btcb.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200"
            ]

            let loanAsLogic = await LoanTokenLogicStandard.at(iwbnb.address);
            let protocolFromAddress = await loanAsLogic.revenueChannelsProtocol();
            console.log(`revenueChannelsProtocol on iwbnb loanAsLogic: ${protocolFromAddress}`);
            if (protocolFromAddress === '0x0000000000000000000000000000000000000000') {
                console.log("No protocol address");
                return;
            }
            let lowerAdmin = await LoanTokenSettingsLowerAdmin.at(loanTokenSettingsLowerAdmin.address);
            console.log(`revenueChannelsProtocol on lowerAdmin: ${await lowerAdmin.revenueChannelsProtocol()}`);
            let calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1, settings2], true]);
            // console.log(calldataSetupLoanParams);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1, settings2], false]);
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
            settings2 = [
                ZERO_BYTES32,
                true,
                ibusd.address,
                busd.address,
                btcb.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200",
            ]
            loanAsLogic = await LoanTokenLogicStandard.at(ibusd.address);
            console.log(`revenueChannelsProtocol on ibusd loanAsLogic: ${await loanAsLogic.revenueChannelsProtocol()}`);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1, settings2], true]);
            //console.log(calldataSetupLoanParams);
            console.log("   Settings ibusd setupLoanParams");
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1, settings2], false]);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);

            settings1 = [
                ZERO_BYTES32,
                true,
                ibtcb.address,
                btcb.address,
                wbnb.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200"
            ];
            settings2 = [
                ZERO_BYTES32,
                true,
                ibtcb.address,
                btcb.address,
                busd.address,
                "20000000000000000000",
                "15000000000000000000",
                "2419200",
            ]
            loanAsLogic = await LoanTokenLogicStandard.at(ibtcb.address);
            console.log(`revenueChannelsProtocol on ibtcb loanAsLogic: ${await loanAsLogic.revenueChannelsProtocol()}`);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1, settings2], true]);
            console.log("   Settings ibtcb setupLoanParams");
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
            calldataSetupLoanParams = await web3.eth.abi.encodeFunctionCall(loanParamsJsonObject, [[settings1, settings2], false]);
            await loanAsLogic.updateSettings(loanTokenSettingsLowerAdmin.address, calldataSetupLoanParams);
        }
        //#endregion

        console.log("Here we are:");
        // let protocolAsProtocolSettings = await ProtocolSettings.at(protocol.address);
        // await protocolAsProtocolSettings.setLoanPool([iweth.address, iusdc.address, iwbtc.address], [weth.address, usdc.address, wbtc.address]);

        console.log("=============== That's all folks ===============");
    });
};