pragma solidity =0.8.0;

interface IBEP20 {
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function getOwner() external view returns (address);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Ownable {
    address public owner;
    address public newOwner;

    event OwnershipTransferred(address indexed from, address indexed to);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    modifier onlyOwner {
        require(msg.sender == owner, "Ownable: Caller is not the owner");
        _;
    }

    function getOwner() external view returns (address) {
        return owner;
    }

    function transferOwnership(address transferOwner) external onlyOwner {
        require(transferOwner != newOwner);
        newOwner = transferOwner;
    }

    function acceptOwnership() virtual external {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}

abstract contract Pausable is Ownable {
    event Paused(address account);
    event Unpaused(address account);

    bool private _paused;

    constructor () {
        _paused = false;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }


    function pause() external onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}

interface INBU is IBEP20 {
    function give(address recipient, uint256 amount, uint vesterId) external;
}

interface INimbusReferralProgram {
    function userSponsorByAddress(address user)  external view returns (uint);
    function userIdByAddress(address user) external view returns (uint);
    function userAddressById(uint id) external view returns (address);
    function userSponsorAddressByAddress(address user) external view returns (address);
}

interface INimbusStakingPool {
    function stakeFor(uint amount, address user) external;
    function balanceOf(address account) external view returns (uint256);
    function stakingToken() external view returns (IBEP20);
}

interface INBU_WBNB {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}

interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

interface INimbusReferralProgramMarketing {
    function registerUser(address user, uint sponsorId) external returns(uint userId);
    function updateReferralProfitAmount(address user, address token, uint amount) external;
}

contract NimbusInitialAcquisition is Ownable, Pausable {
    INBU public immutable SYSTEM_TOKEN;
    address public immutable NBU_WBNB;
    INimbusReferralProgram public referralProgram;
    INimbusReferralProgramMarketing public referralProgramMarketing;
    INimbusStakingPool[] public stakingPoolsSponsor;   //staking pools for checking sponsor balances

    bool public allowAccuralMarketingReward;

    mapping(uint => INimbusStakingPool) public stakingPools;

    address public recipient;                      
   
    INimbusRouter public swapRouter;                
    mapping (address => bool) public allowedTokens;
    address public swapToken;                       
    uint public swapTokenAmountForBonusThreshold;  
    
    uint public sponsorBonus;
    mapping(address => uint) public unclaimedBonusBases;

    bool public useWeightedRates;
    mapping(address => uint) public weightedTokenSystemTokenExchangeRates;

    event BuySystemTokenForToken(address indexed token, uint tokenAmount, uint systemTokenAmount, address indexed systemTokenRecipient);
    event BuySystemTokenForBnb(uint bnbAmount, uint systemTokenAmount, address indexed systemTokenRecipient);
    event ProcessSponsorBonus(address indexed sponsor, address indexed user, uint bonusAmount);
    event AddUnclaimedSponsorBonus(address indexed user, uint systemTokenAmount);

    event UpdateTokenSystemTokenWeightedExchangeRate(address indexed token, uint newRate);
    event ToggleUseWeightedRates(bool useWeightedRates);
    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed token, address indexed to, uint amount); 

    constructor (address systemToken, address router, address nbuWbnb, address) {
        SYSTEM_TOKEN = INBU(systemToken);
        NBU_WBNB = nbuWbnb;
        sponsorBonus = 10;
        swapRouter = INimbusRouter(router);
        recipient = address(this);
    }

    function availableInitialSupply() external view returns (uint) {
        return SYSTEM_TOKEN.balanceOf(address(this));
    }

    function getSystemTokenAmountForToken(address token, uint tokenAmount) public view returns (uint) { 
        if (!useWeightedRates) {
            address[] memory path = new address[](2);
            path[0] = token;
            path[1] = address(SYSTEM_TOKEN);
            return swapRouter.getAmountsOut(tokenAmount, path)[1];
        } else {
            return tokenAmount * weightedTokenSystemTokenExchangeRates[token] / 1e18;
        }  
    }

    function getSystemTokenAmountForBnb(uint bnbAmount) public view returns (uint) { 
        return getSystemTokenAmountForToken(NBU_WBNB, bnbAmount); 
    }

    function getTokenAmountForSystemToken(address token, uint systemTokenAmount) public view returns (uint) { 
        if (!useWeightedRates) { 
            address[] memory path = new address[](2);
            path[0] = address(SYSTEM_TOKEN);
            path[1] = token;
            return swapRouter.getAmountsOut(systemTokenAmount, path)[1];
        } else {
            return systemTokenAmount * 1e18 / weightedTokenSystemTokenExchangeRates[token];
        }
    }

    function getBnbAmountForSystemToken(uint systemTokenAmount) public view returns (uint) { 
        return getTokenAmountForSystemToken(NBU_WBNB, systemTokenAmount);
    }

    function currentBalance(address token) external view returns (uint) { 
        return INBU(token).balanceOf(address(this));
    }

    function _buySystemToken(address token, uint tokenAmount, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) private {
        stakingPools[stakingPoolId].stakeFor(systemTokenAmount, systemTokenRecipient);
        
        if(allowAccuralMarketingReward) {
            referralProgramMarketing.updateReferralProfitAmount(systemTokenRecipient, address(SYSTEM_TOKEN), systemTokenAmount);
        }

        emit BuySystemTokenForToken(token, tokenAmount, systemTokenAmount, systemTokenRecipient);
        _processSponsor(systemTokenAmount);
    }

    function _processSponsor(uint systemTokenAmount) private {
        address sponsorAddress = _getUserSponsorAddress();
        if (sponsorAddress != address(0)) { 
            uint minSystemTokenAmountForBonus = getSystemTokenAmountForToken(swapToken, swapTokenAmountForBonusThreshold);
            if (systemTokenAmount > minSystemTokenAmountForBonus) {
                uint sponsorAmount = SYSTEM_TOKEN.balanceOf(sponsorAddress);
                for (uint i; i < stakingPoolsSponsor.length; i++) {
                    if (sponsorAmount > minSystemTokenAmountForBonus) break;
                    sponsorAmount += stakingPoolsSponsor[i].balanceOf(sponsorAddress);
                }
                
                if (sponsorAmount > minSystemTokenAmountForBonus) {
                    uint bonusBase = systemTokenAmount + unclaimedBonusBases[msg.sender];
                    uint sponsorBonusAmount = bonusBase * sponsorBonus / 100;
                    SYSTEM_TOKEN.give(sponsorAddress, sponsorBonusAmount, 3);
                    unclaimedBonusBases[msg.sender] = 0;
                    emit ProcessSponsorBonus(sponsorAddress, msg.sender, sponsorBonusAmount);
                } else {
                    unclaimedBonusBases[msg.sender] += systemTokenAmount;
                    emit AddUnclaimedSponsorBonus(msg.sender, systemTokenAmount);
                }
            } else {
                unclaimedBonusBases[msg.sender] += systemTokenAmount;
                emit AddUnclaimedSponsorBonus(msg.sender, systemTokenAmount);
            }
        } else {
            unclaimedBonusBases[msg.sender] += systemTokenAmount;
            emit AddUnclaimedSponsorBonus(msg.sender, systemTokenAmount);
        }
    }

    function _getUserSponsorAddress() private view returns (address) {
        if (address(referralProgram) == address(0)) {
            return address(0);
        } else {
            return referralProgram.userSponsorAddressByAddress(msg.sender);
        } 
    }

    function buyExactSystemTokenForTokensAndRegister(address token, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId, uint sponsorId) external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgramMarketing.registerUser(msg.sender, sponsorId);
        buyExactSystemTokenForTokens(token, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForTokensAndRegister(address token, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) external whenNotPaused {
        referralProgramMarketing.registerUser(msg.sender, 1000000001);
        buyExactSystemTokenForTokens(token, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForBnbAndRegister(uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId, uint sponsorId) external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgramMarketing.registerUser(msg.sender, sponsorId);
        buyExactSystemTokenForBnb(systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForBnbAndRegister(uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) external whenNotPaused {
        referralProgramMarketing.registerUser(msg.sender, 1000000001);
        buyExactSystemTokenForBnb(systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactBnbAndRegister(address systemTokenRecipient, uint stakingPoolId, uint sponsorId) payable external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgramMarketing.registerUser(msg.sender, sponsorId);
        buySystemTokenForExactBnb(systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactBnbAndRegister(address systemTokenRecipient, uint stakingPoolId) payable external whenNotPaused {
        referralProgramMarketing.registerUser(msg.sender, 1000000001);
        buySystemTokenForExactBnb(systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactTokensAndRegister(address token, uint tokenAmount, address systemTokenRecipient, uint stakingPoolId, uint sponsorId) external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgramMarketing.registerUser(msg.sender, sponsorId);
        buySystemTokenForExactTokens(token, tokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactTokensAndRegister(address token, uint tokenAmount, address systemTokenRecipient, uint stakingPoolId) external whenNotPaused {
        referralProgramMarketing.registerUser(msg.sender, 1000000001);
        buySystemTokenForExactTokens(token, tokenAmount, systemTokenRecipient, stakingPoolId);
    }
    
    function buyExactSystemTokenForTokens(address token, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[token], "NimbusInitialAcquisition: Not allowed token");
        uint tokenAmount = getTokenAmountForSystemToken(token, systemTokenAmount);
        TransferHelper.safeTransferFrom(token, msg.sender, recipient, tokenAmount);
        _buySystemToken(token, tokenAmount, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactTokens(address token, uint tokenAmount, address systemTokenRecipient, uint stakingPoolId) public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[token], "NimbusInitialAcquisition: Not allowed token");
        uint systemTokenAmount = getSystemTokenAmountForToken(token, tokenAmount);
        TransferHelper.safeTransferFrom(token, msg.sender, recipient, tokenAmount);
        _buySystemToken(token, tokenAmount, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactBnb(address systemTokenRecipient, uint stakingPoolId) payable public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[NBU_WBNB], "NimbusInitialAcquisition: Not allowed purchase for BNB");
        uint systemTokenAmount = getSystemTokenAmountForBnb(msg.value);
        INBU_WBNB(NBU_WBNB).deposit{value: msg.value}();
        _buySystemToken(NBU_WBNB, msg.value, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForBnb(uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) payable public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[NBU_WBNB], "NimbusInitialAcquisition: Not allowed purchase for BNB");
        uint systemTokenAmountMax = getSystemTokenAmountForBnb(msg.value);
        require(systemTokenAmountMax >= systemTokenAmount, "NimbusInitialAcquisition: Not enough BNB");
        uint bnbAmount = systemTokenAmountMax == systemTokenAmount ? msg.value : getBnbAmountForSystemToken(systemTokenAmount);
        INBU_WBNB(NBU_WBNB).deposit{value: bnbAmount}();
        _buySystemToken(NBU_WBNB, bnbAmount, systemTokenAmount, systemTokenRecipient, stakingPoolId);
        // refund dust bnb, if any
        if (systemTokenAmountMax > systemTokenAmount) TransferHelper.safeTransferBNB(msg.sender, msg.value - bnbAmount);
    }

    function claimSponsorBonusesBatch(address[] memory users) external { 
        for (uint i; i < users.length; i++) {
            claimSponsorBonuses(users[i]);
        }
    }

    function claimSponsorBonuses(address user) public {
        require(unclaimedBonusBases[user] > 0, "NimbusInitialAcquisition: No unclaimed bonuses");
        uint userSponsor = referralProgram.userSponsorByAddress(user);
        require(userSponsor == referralProgram.userIdByAddress(msg.sender) && userSponsor != 0, "NimbusInitialAcquisition: Not user sponsor");
        
        uint minSystemTokenAmountForBonus = getSystemTokenAmountForToken(swapToken, swapTokenAmountForBonusThreshold);
        uint bonusBase = unclaimedBonusBases[user];
        require (bonusBase >= minSystemTokenAmountForBonus, "NimbusInitialAcquisition: Bonus threshold not met");

        uint sponsorAmount = SYSTEM_TOKEN.balanceOf(msg.sender);
        for (uint i; i < stakingPoolsSponsor.length; i++) {
            if (sponsorAmount > minSystemTokenAmountForBonus) break;
            sponsorAmount += stakingPoolsSponsor[i].balanceOf(msg.sender);
        }
        
        require (sponsorAmount > minSystemTokenAmountForBonus, "NimbusInitialAcquisition: Sponsor balance threshold for bonus not met");
        uint sponsorBonusAmount = bonusBase * sponsorBonus / 100;
        SYSTEM_TOKEN.give(msg.sender, sponsorBonusAmount, 3);
        unclaimedBonusBases[user] = 0;
        emit ProcessSponsorBonus(msg.sender, user, sponsorBonusAmount);
    }
    


    //Admin functions
    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "NimbusInitialAcquisition: Can't be zero address");
        require(amount > 0, "NimbusInitialAcquisition: Should be greater than 0");
        TransferHelper.safeTransferBNB(to, amount);
        emit Rescue(to, amount);
    }

    function rescue(address to, address token, uint256 amount) external onlyOwner {
        require(to != address(0), "NimbusInitialAcquisition: Can't be zero address");
        require(amount > 0, "NimbusInitialAcquisition: Should be greater than 0");
        TransferHelper.safeTransfer(token, to, amount);
        emit RescueToken(token, to, amount);
    }

    function updateAccuralMarketingRewardAllowance(bool isAllowed) external onlyOwner {
        allowAccuralMarketingReward = isAllowed;
    }

    function updateStakingPool(uint id, address stakingPool) public onlyOwner {
        _updateStakingPool(id, stakingPool);
    }

    function updateStakingPool(uint[] memory ids, address[] memory _stakingPools) external onlyOwner {
        require(ids.length == _stakingPools.length, "NimbusInitialAcquisition: Ids and staking pools arrays have different size.");
        
        for(uint i = 0; i < ids.length; i++) {
            _updateStakingPool(ids[i], _stakingPools[i]);
        }
    }

    function updateAllowedTokens(address token, bool isAllowed) external onlyOwner {
        require (token != address(0), "NimbusInitialAcquisition: Wrong addresses");
        allowedTokens[token] = isAllowed;
    }
    
    function updateRecipient(address recipientAddress) external onlyOwner {
        require(recipientAddress != address(0), "NimbusInitialAcquisition: Address is zero");
        recipient = recipientAddress;
    } 

    function updateSponsorBonus(uint bonus) external onlyOwner {
        sponsorBonus = bonus;
    }

    function updateReferralProgramContract(address newReferralProgramContract) external onlyOwner {
        require(newReferralProgramContract != address(0), "NimbusInitialAcquisition: Address is zero");
        referralProgram = INimbusReferralProgram(newReferralProgramContract);
    }

    function updateReferralProgramMarketingContract(address newReferralProgramMarketingContract) external onlyOwner {
        require(newReferralProgramMarketingContract != address(0), "NimbusInitialAcquisition: Address is zero");
        referralProgramMarketing = INimbusReferralProgramMarketing(newReferralProgramMarketingContract);
    }

    function updateStakingPoolAdd(address newStakingPool) external onlyOwner {
        INimbusStakingPool pool = INimbusStakingPool(newStakingPool);
        require (pool.stakingToken() == SYSTEM_TOKEN, "NimbusInitialAcquisition: Wrong pool staking tokens");

        for (uint i; i < stakingPoolsSponsor.length; i++) {
            require (address(stakingPoolsSponsor[i]) != newStakingPool, "NimbusInitialAcquisition: Pool exists");
        }
        stakingPoolsSponsor.push(pool);
    }

    function updateStakingPoolRemove(uint poolIndex) external onlyOwner {
        stakingPoolsSponsor[poolIndex] = stakingPoolsSponsor[stakingPoolsSponsor.length - 1];
        stakingPoolsSponsor.pop();
    }

    function updateSwapRouter(address newSwapRouter) external onlyOwner {
        require(newSwapRouter != address(0), "NimbusInitialAcquisition: Address is zero");
        swapRouter = INimbusRouter(newSwapRouter);
    }

    function updateSwapToken(address newSwapToken) external onlyOwner {
        require(newSwapToken != address(0), "NimbusInitialAcquisition: Address is zero");
        swapToken = newSwapToken;
    }

    function updateSwapTokenAmountForBonusThreshold(uint threshold) external onlyOwner {
        swapTokenAmountForBonusThreshold = threshold;
    }

    function updateTokenSystemTokenWeightedExchangeRate(address token, uint rate) external onlyOwner {
        weightedTokenSystemTokenExchangeRates[token] = rate;
        emit UpdateTokenSystemTokenWeightedExchangeRate(token, rate);
    }

    function toggleUseWeightedRates() external onlyOwner {
        useWeightedRates = !useWeightedRates;
        emit ToggleUseWeightedRates(useWeightedRates);
    }

    function _updateStakingPool(uint id, address stakingPool) private {
        require(id != 0, "NimbusInitialAcquisition: Staking pool id cant be equal to 0.");
        require(stakingPool != address(0), "NimbusInitialAcquisition: Staking pool address cant be equal to address(0).");

        stakingPools[id] = INimbusStakingPool(stakingPool);
        require(SYSTEM_TOKEN.approve(stakingPool, type(uint256).max), "NimbusInitialAcquisition: Error on approving");
    }
}

library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }

    function safeTransfer(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    function safeTransferBNB(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: BNB_TRANSFER_FAILED');
    }
}