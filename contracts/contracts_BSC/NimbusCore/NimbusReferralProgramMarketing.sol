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
    function vest(address user, uint amount) external;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface INimbusReferralProgramUsers {
    function userSponsor(uint user) external view returns (uint);
    function registerUser(address user, uint category) external returns (uint); //public
    function userIdByAddress(address user) external view returns (uint);
    function userAddressById(uint id) external view returns (address);
    function userSponsorAddressByAddress(address user) external view returns (address);
}

interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function pairFor(address tokenA, address tokenB) external view returns (address);
}

interface INimbusPair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
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

library Address {
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(account) }
        return size > 0;
    }
}

contract NimbusReferralProgramMarketing is Ownable {

    struct ProfitAmount {
        uint NBU;
        uint GNBU;
        uint SwapToken;
    }

    struct Qualification {
        uint Number;
        uint TotalTurnover;
        uint VestingAmount;
        uint FreePaymentAmount;
    }

    uint constant month = 30 days;

    INimbusReferralProgramUsers rpUsers;
    INimbusRouter swapRouter;
    IBEP20 NBU;
    IBEP20 GNBU;
    IBEP20 swapToken; 

    uint public lastLeaderReferralLine;
    uint public qualificationsCount;
    uint public managerRewardPercent;
    bool public allowLeaderlessPurchases;

    mapping(address => uint) public userLine;

    mapping(address => bool) public isManager;
    mapping(address => bool) public isLeader;

    mapping(address => address) public userLeader;
    mapping(address => address) public userManager;

    mapping(address => bool) public canClaimReward;
    
    mapping(address => uint) managerCurrenPeriodTimestamp;
    mapping(address => uint) leaderCurrenPeriodTimestamp;

    mapping(address => uint[]) public leaderCheckpoints;

    mapping(address => mapping(uint => ProfitAmount)) leaderTurnoverForPeriod;
 
    mapping(address => ProfitAmount) public managerTotalTurnover;

    mapping(uint => Qualification) public qualifications;

    mapping(address => uint) public leaderQualificationLevel;
    mapping(address => mapping(uint => uint)) public leaderFreePaymentReward;
    mapping(address => mapping(uint => uint)) public leaderVestingReward;
    mapping(address => mapping(uint => uint)) public leaderClaimedReward;

    mapping(address => uint) public managerClaimedReward;

    mapping(address => bool) public isAllowedContract;

    mapping(address => uint) public leaderLastWithdrawalAmount;

    mapping(address => bool) public registrators;

    event QualificationUpdated(address indexed user, uint indexed qualificationNumber);
    event LeaderRewardClaimed(address indexed leader, uint rewardAmount, uint previousQualification, uint currentQualification);
    event ManagerRewardClaimed(address indexed manager, uint rewardAmount);
    event UserRegistered(address user, uint sponsorId);

    constructor(address _nbu, address _gnbu, address _rpUsers, address _swapRouter, address _swapToken) {
        NBU = IBEP20(_nbu);
        GNBU = IBEP20(_gnbu);
        rpUsers = INimbusReferralProgramUsers(_rpUsers);
        swapRouter = INimbusRouter(_swapRouter);
        swapToken = IBEP20(_swapToken);
        lastLeaderReferralLine = 6;
    }

    modifier onlyAllowedContract() {
        require(isAllowedContract[msg.sender] == true, "NimbusReferralProgramMarketing: Provided address is not an allowed contract");
        _;
    }

    modifier onlyRegistrators() {
        require(registrators[msg.sender] == true, "NimbusReferralProgramMarketing: Provided address is not a registrator");
        _;
    }

    function claimLeaderRewardForPeriod(uint checkpoint) public {
        require(isLeader[msg.sender], "NimbusReferralProgramMarketing: User is not a leader");

        uint previousQualificationLevel = leaderQualificationLevel[msg.sender];
        _updateLeaderQualification(msg.sender);
        uint currentQualificationLevel = leaderQualificationLevel[msg.sender];

        uint leaderFreePaymentRewardForPeriod = leaderFreePaymentReward[msg.sender][checkpoint];
        require(leaderFreePaymentRewardForPeriod != 0, "NimbusReferralProgramMarketing: Leader has no free payment reward");

        NBU.transfer(msg.sender, leaderFreePaymentRewardForPeriod);
        leaderClaimedReward[msg.sender][checkpoint] += leaderFreePaymentRewardForPeriod;
        leaderFreePaymentRewardForPeriod = 0;
        emit LeaderRewardClaimed(msg.sender, leaderFreePaymentRewardForPeriod, previousQualificationLevel, currentQualificationLevel);
    }

    function claimManagerReward() public {
        require(isManager[msg.sender], "NimbusReferralProgramMarketing: User is not a manager");
        uint rewardAmount = (managerTotalTurnover[msg.sender].NBU * managerRewardPercent) / 100;

        if(managerClaimedReward[msg.sender] > 0) {
            rewardAmount -= managerClaimedReward[msg.sender];
        }

        NBU.transfer(msg.sender, rewardAmount);
        managerClaimedReward[msg.sender] += rewardAmount;
        ManagerRewardClaimed(msg.sender, rewardAmount);

    }

    function canQualificationBeUpgraded(address leader) public view returns(bool) {
        if(getTurnoverQualification(leader) > leaderQualificationLevel[leader]) {
            return true;
        } else {
            return false;
        }
    }

    function getTurnoverQualification(address leader) public view returns(uint turnoverQualification) {
        uint turnover = leaderTotalTurnover(leader, address(swapToken));
        return _getUserQualificationLevel(turnover);
    }

    function register(uint sponsorId) external returns(uint userId) {
        return _register(msg.sender, sponsorId);
    }

    function registerUser(address user, uint sponsorId) external onlyRegistrators returns(uint userId) {
        return _register(user, sponsorId);
    }

    function updateReferralProfitAmount(address user, address token, uint amount) external onlyAllowedContract {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not a part of referral program");
        require(token == address(NBU) || token == address(GNBU), "NimbusReferralProgramMarketing: Invalid staking token");

        _updateTokenProfitAmount(user, token, amount);
    }

    function leaderTotalTurnover(address leader, address token) public view returns (uint turnover) {
        require(token == address(NBU) || token == address(GNBU) || token == address(swapToken), "NimbusReferralProgramMarketing: Invalid token");
        require(isLeader[leader], "NimbusReferralProgramMarketing: User is not leader");

        if(token == address(NBU)) {
            for(uint i = 0; i < leaderCheckpoints[leader].length; i++) {
                turnover += leaderTurnoverForPeriod[leader][leaderCheckpoints[leader][i]].NBU;
            }
        } else if(token == address(GNBU)) {
            for(uint i = 0; i < leaderCheckpoints[leader].length; i++) {
                turnover += leaderTurnoverForPeriod[leader][leaderCheckpoints[leader][i]].GNBU;
            }
        } else if(token == address(swapToken)) {
            for(uint i = 0; i < leaderCheckpoints[leader].length; i++) {
                turnover += leaderTurnoverForPeriod[leader][leaderCheckpoints[leader][i]].SwapToken;
            }
        }
    }

    function updateManagerRewardPercent(uint percent) external onlyOwner {
        require(percent > 0, "NimbusReferralProgramMarketing: reward percent must be grater then 0");
        managerRewardPercent = percent;
    }

    function updateLeaderlessPurchasesAllowance(bool allowance) external onlyOwner {
        allowLeaderlessPurchases = allowance;
    }

    function updateRegistrator(address registrator, bool isActive) external onlyOwner {
        require(registrator != address(0), "NimbusReferralProgramMarketing: Registrator address is equal to 0");

        registrators[registrator] = isActive;
    }

    function updateAllowanceforClamingReward(address user, bool allowance) external onlyOwner {
        require(isLeader[user] || isManager[user], "NimbusReferralProgramMarketing: user is not a leader or a manager");
        canClaimReward[user] = allowance;
    }

    function updateQualifications(uint[] memory totalTurnoverAmounts, uint[] memory vestingAmounts, uint[] memory freePaymentAmounts) external onlyOwner {
        require(totalTurnoverAmounts.length == vestingAmounts.length && totalTurnoverAmounts.length == freePaymentAmounts.length, "NimbusReferralProgramMarketing: Arrays length are not equal");

        for(uint i = 0; i < totalTurnoverAmounts.length; i++) {
            _updateQualification(totalTurnoverAmounts[i], vestingAmounts[i], freePaymentAmounts[i]);
        }
    }

    function updateLastLeaderReferralLine(uint _lastLeaderReferralLine) external onlyOwner {
        require(_lastLeaderReferralLine > 0, "NimbusReferralProgramMarketing: Last leader referral line can't be lower than one");
        lastLeaderReferralLine = _lastLeaderReferralLine;
    }
   
    function updateAllowedContract(address _contract, bool _isAllowed) external onlyOwner {
        require(Address.isContract(_contract), "NimbusReferralProgramMarketing: Provided address is not a contract");
        isAllowedContract[_contract] = _isAllowed;
    }

    function updateLeader(address user, bool _isLeader) external onlyOwner {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not registered");

        if(_isLeader) {
            leaderCurrenPeriodTimestamp[user] = block.timestamp;
            leaderCheckpoints[user].push(block.timestamp);
            uint swapTokenAmount = qualifications[0].VestingAmount;
            uint nbuAmount = _getEquivalentMainTokenAmount(address(NBU), swapTokenAmount);
            NBU.vest(user, nbuAmount);
            leaderVestingReward[user][block.timestamp] += swapTokenAmount;

            emit QualificationUpdated(user, leaderQualificationLevel[user]);
        }

        isLeader[user] = _isLeader;
    }

    function updateLeaderForUsers(address leader, address[] memory users) external onlyOwner {
        for(uint i = 0; i < users.length; i++) {
            _updateLeaderForUser(users[i], leader);
        }
    }
    
    function updateLeadersForUsers(address[] memory leaders, address[] memory users) external onlyOwner {
        require(leaders.length == users.length, "NimbusReferralProgramMarketing: Leaders and users arrays length are not equal");
        for(uint i = 0; i < users.length; i++) {
            _updateLeaderForUser(users[i], leaders[i]);
        }
    }

    function updateManager(address user, bool _isManager) external onlyOwner {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not registered");

        if(_isManager == true) {
            managerCurrenPeriodTimestamp[user] = block.timestamp;
        }

        isManager[user] = _isManager;
    }

    function updateManagerForUsers(address manager, address[] memory users) external onlyOwner {
        for(uint i = 0; i < users.length; i++) {
            _updateManagerForUser(users[i], manager);
        }
    }

    function updateManagersForUsers(address[] memory managers, address[] memory users) external onlyOwner {
        require(managers.length == users.length, "NimbusReferralProgramMarketing: Managers and users arrays length are not equal.");
        for(uint i = 0; i < users.length; i++) {
            _updateManagerForUser(users[i], managers[i]);
        }
    }

    function updateManagerForUser(address user, address manager) public onlyOwner {
        _updateManagerForUser(user, manager);
    }

    function updateLeaderForUser(address user, address leader) public onlyOwner {
        _updateLeaderForUser(user, leader);
    }

    function _updateQualification(uint totalTurnoverAmount, uint vestingAmount, uint freePaymentAmount) internal onlyOwner {
        require(totalTurnoverAmount > 0, "NimbusReferralProgramMarketing: Total turnover amount can't be lower then one");
        qualificationsCount = ++qualificationsCount;
        qualifications[qualificationsCount] = Qualification(qualificationsCount, totalTurnoverAmount, vestingAmount, freePaymentAmount);
    }

    function _updateTokenProfitAmount(address user, address token, uint amount) internal {
        address leader = userLeader[user];

        if(allowLeaderlessPurchases) {
            return;
        } else {
            require(leader != address(0), "NimbusReferralProgramMarketing: User leader address is equal to 0");
        }

        require(isLeader[leader], "NimbusReferralProgramMarketing: User is not leader");
        require(userManager[leader] != address(0), "NimbusReferralProgramMarketing: Leader has no manager");

        address leaderManager = userManager[leader];

        _updateCurrentPeriodTimestampIfNeeded(leader, leaderCurrenPeriodTimestamp);

        if(token == address(NBU)) {
            if(userLine[user] <= lastLeaderReferralLine) {
                leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].NBU += amount;
            }

            managerTotalTurnover[leaderManager].NBU += amount;
        } else if(token == address(GNBU)) {
            if(userLine[user] <= lastLeaderReferralLine) {
                leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].GNBU += amount;
            }

            managerTotalTurnover[leaderManager].GNBU += amount;
        }

        uint swapTokenEquivalentAmount = _getEquivalentSwapTokenAmount(address(GNBU), amount);
        leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].SwapToken += swapTokenEquivalentAmount;
        managerTotalTurnover[leaderManager].SwapToken += swapTokenEquivalentAmount;
    }

    function _updateCurrentPeriodTimestampIfNeeded(address user, mapping(address => uint) storage currentPeriod) internal {
        if(currentPeriod[user] + month < block.timestamp) {
            uint passedperiods = (block.timestamp - currentPeriod[user]) / month;
            currentPeriod[user] = currentPeriod[user] + passedperiods * month;

            if(isLeader[user]) {
                leaderCheckpoints[user].push(currentPeriod[user]);
                leaderQualificationLevel[user] = 0;
            }
        }
    }

    function _setUserReferralLine(address user) internal {
        address sponsorAddress = rpUsers.userSponsorAddressByAddress(user);

        if(isLeader[sponsorAddress]) {
            userLine[user] = 1;
        } else if(isManager[sponsorAddress]) {
            userLine[user] = 0;
        } else {
            userLine[user] = ++userLine[sponsorAddress];
        }
    }

    function _updateLeaderQualification(address leader) internal {
        uint totalTurnoverEquivalent = leaderTotalTurnover(leader, address(swapToken));
        uint actualQualificationLevel = _getUserQualificationLevel(totalTurnoverEquivalent);

        if(canQualificationBeUpgraded(leader)) {
            while(leaderQualificationLevel[leader] < actualQualificationLevel) {
                uint storedQualificationLevel = leaderQualificationLevel[leader];
                _setLeaderReward(leader, ++storedQualificationLevel);
                leaderQualificationLevel[leader] =storedQualificationLevel;
            }

            leaderQualificationLevel[leader] = actualQualificationLevel;
            emit QualificationUpdated(leader, leaderQualificationLevel[leader]);
        }
    }

    function _setLeaderReward(address leader, uint qualificationLevel) internal {
        if(qualifications[qualificationLevel].VestingAmount > 0) {
            uint swapTokenAmount = qualifications[qualificationLevel].VestingAmount;
            uint nbuAmount = _getEquivalentMainTokenAmount(address(NBU), swapTokenAmount);
            NBU.vest(leader, nbuAmount);
            leaderVestingReward[leader][leaderCurrenPeriodTimestamp[leader]] += swapTokenAmount;
        }

        if(qualifications[qualificationLevel].FreePaymentAmount > 0) {
            leaderFreePaymentReward[leader][leaderCurrenPeriodTimestamp[leader]] += qualifications[qualificationLevel].FreePaymentAmount;
        }   
    }

    function _getUserQualificationLevel(uint totalTurnover) internal view returns(uint qualificationNumber) {
        for(uint i = 0; i < qualificationsCount; i++) {
            if(qualifications[i+1].TotalTurnover < totalTurnover) {
                return i;
            }
        }
    }

    function _getEquivalentSwapTokenAmount(address token, uint mainTokenAmount) internal view returns (uint swapTokenAmount) {
        (uint mainTokenReserve, uint swapTokenReserve) = _getPairReserves(token);

        if(mainTokenReserve != 0 && swapTokenReserve != 0) {
            swapTokenAmount = (mainTokenAmount * swapTokenReserve) / mainTokenReserve;
        } else {
            return 0;
        }
    }

    function _getEquivalentMainTokenAmount(address token, uint swapTokenAmount) internal view returns (uint mainTokenAmount) {
        (uint mainTokenReserve, uint swapTokenReserve) = _getPairReserves(token);

        if(mainTokenReserve != 0 && swapTokenReserve != 0) {
            mainTokenAmount = (swapTokenAmount * mainTokenReserve) / swapTokenReserve;
        } else {
            return 0;
        }
    }

    function _getPairReserves(address token) private view returns(uint mainTokenReserve, uint swapTokenReserve){
        address pairAddress = swapRouter.pairFor(token, address(swapToken));
        INimbusPair pair = INimbusPair(pairAddress);
        
        if(token == pair.token0()) {
            (mainTokenReserve, swapTokenReserve, ) = pair.getReserves();
        } else {
            (swapTokenReserve, mainTokenReserve, ) = pair.getReserves();
        }
    }

    function _updateLeaderForUser(address user, address leader) private { 
        require(user != address(0), "NimbusReferralProgramMarketing: User address is equal to 0");
        require(leader != address(0), "NimbusReferralProgramMarketing: Leader address is equal to 0");

        userLeader[user] = leader;
    }

    function _updateManagerForUser(address user, address manager) private { 
        require(user != address(0), "NimbusReferralProgramMarketing: User address is equal to 0");
        require(manager != address(0), "NimbusReferralProgramMarketing: Manager address is equal to 0");

        userManager[user] = manager;
    }

    function _register(address user, uint sponsorId) private returns(uint userId) {
        require(rpUsers.userIdByAddress(user) == 0, "NimbusReferralProgramMarketing: User already registered");
        address sponsorAddress = rpUsers.userAddressById(sponsorId);
        require(sponsorAddress != address(0), "NimbusReferralProgramMarketing: User sponsor address is equal to 0");

        if (isLeader[sponsorAddress] == true) {
            updateLeaderForUser(user, sponsorAddress);
            updateManagerForUser(user, userManager[sponsorAddress]);
        } else {
            updateLeaderForUser(user, userLeader[sponsorAddress]);
            updateManagerForUser(user, userManager[userLeader[sponsorAddress]]);
        }

        _setUserReferralLine(user);
        emit UserRegistered(user, sponsorId);   
        return rpUsers.registerUser(user, sponsorId);
    }
}