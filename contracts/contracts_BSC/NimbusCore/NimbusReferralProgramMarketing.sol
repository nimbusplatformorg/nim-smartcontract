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

contract NimbusReferralProgramMarketing is Ownable {

    struct ProfitAmount {
        uint NBU;
        uint GNBU;
    }

    struct Qualification {
        uint Number;
        uint TotalTurnover;
        uint VestingAmount;
        uint FreePaymentAmount;
    }

    INimbusReferralProgramUsers rpUsers;
    INimbusRouter swapRouter;
    IBEP20 NBU;
    IBEP20 GNBU;
    IBEP20 swapToken; 

    uint lastLeaderReferralLine = 6;
    mapping(address => uint) public userLine;

    mapping(address => bool) public isManager;
    mapping(address => bool) public isLeader;

    mapping(address => address) public userLeader;
    mapping(address => address) public userManager;

    mapping(address => uint) managerRegistrationTimestamp;
    mapping(address => uint) leaderRegistrationTimestamp;
    
    mapping(address => uint) managerCurrenPeriodTimestamp;
    mapping(address => uint) leaderCurrenPeriodTimestamp;

    mapping(address => uint[]) leaderCheckpoints;
    mapping(address => uint[]) managerCheckpoints;

    mapping(address => mapping(uint => ProfitAmount)) managerTurnoverForPeriod;
    mapping(address => mapping(uint => ProfitAmount)) leaderTurnoverForPeriod;
 
    mapping(address => ProfitAmount) public leaderTotalTurnover;
    mapping(address => ProfitAmount) public managerTotalTurnover;

    mapping(uint => Qualification) public qualifications;

    uint qualificationsCount;

    mapping(address => uint) public leaderQualificationLevel;
    mapping(address => uint) public leaderFreePaymentReward;
    mapping(address => uint) public leaderVestingReward;
    mapping(address => uint) public leaderClaimedReward;

    mapping(address => bool) public isAllowedContract;

    event QualificationUpdated(address user, uint qualificationNumber);
    event RewardClaimed(address leader, uint rewardAmount);

    constructor(address _nbu, address _gnbu, address _rpUsers, uint _lastLeaderReferralLine, address _swapRouter, address _swapToken) {
        NBU = IBEP20(_nbu);
        GNBU = IBEP20(_gnbu);
        rpUsers = INimbusReferralProgramUsers(_rpUsers);
        lastLeaderReferralLine = _lastLeaderReferralLine;
        swapRouter = INimbusRouter(_swapRouter);
        swapToken = IBEP20(_swapToken);
    }

    modifier onlyAllowedContract() {
        require(isAllowedContract[msg.sender] == true, "NimbusReferralProgramMarketing: Provided address is not an allowed contract");
        _;
    }

    function updateQualifications(uint[] memory totalTurnoverAmounts, uint[] memory vestingAmounts, uint[] memory freePaymentAmounts) external onlyOwner {
        require(totalTurnoverAmounts.length == vestingAmounts.length && totalTurnoverAmounts.length == freePaymentAmounts.length, "NimbusReferralProgramMarketing: Arrays length are not equal.");

        for(uint i = 0; i < totalTurnoverAmounts.length; i++) {
            _updateQualification(totalTurnoverAmounts[i], vestingAmounts[i], freePaymentAmounts[i]);
        }
    }

    function updateLastLeaderReferralLine(uint _lastLeaderReferralLine) external onlyOwner {
        require(_lastLeaderReferralLine > 0, "NimbusReferralProgramMarketing: Last leader referral line can't be lower than one.");
        lastLeaderReferralLine = _lastLeaderReferralLine;
    }
   
    function updateAllowedContract(address _contract, bool isAllowed) external onlyOwner {
        require(_isContract(_contract), "NimbusReferralProgramMarketing: Provided address is not a contract.");
        isAllowedContract[_contract] = isAllowed;
    }

    function updateLeader(address user, bool _isLeader) external onlyOwner {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not registered.");

        if(_isLeader == true) {
            leaderRegistrationTimestamp[user] = block.timestamp;
            leaderCurrenPeriodTimestamp[user] = block.timestamp;
            leaderCheckpoints[user].push(block.timestamp);
            uint swapTokenAmount = qualifications[0].VestingAmount * swapToken.decimals();
            leaderQualificationLevel[user] = 0;
            uint nbuAmount = _getEquivalentMainTokenAmount(address(NBU), swapTokenAmount);
            NBU.vest(user, nbuAmount);
            leaderVestingReward[user] += qualifications[0].VestingAmount * swapToken.decimals();

            emit QualificationUpdated(user, leaderQualificationLevel[user]);
        }

        isLeader[user] = _isLeader;
    }

    function updateLeaderForUser(address user, address leader) public onlyOwner {
        require(user != address(0), "NimbusReferralProgramMarketing: User address is equal to 0");
        require(leader != address(0), "NimbusReferralProgramMarketing: Leader address is equal to 0");

        userLeader[user] = leader;
    }

    function updateLeaderForUsers(address leader, address[] memory users) external onlyOwner {
        for(uint i = 0; i < users.length; i++) {
            updateLeaderForUser(users[i], leader);
        }
    }
    
    function updateLeadersForUsers(address[] memory leaders, address[] memory users) external onlyOwner {
        require(leaders.length == users.length, "NimbusReferralProgramMarketing: Leaders and users arrays length are not equal.");
        for(uint i = 0; i < users.length; i++) {
            updateLeaderForUser(users[i], leaders[i]);
        }
    }

    function updateManager(address user, bool _isManager) external onlyOwner {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not registered.");

        if(_isManager == true) {
            managerRegistrationTimestamp[user] = block.timestamp;
            managerCurrenPeriodTimestamp[user] = block.timestamp;
            managerCheckpoints[user].push(block.timestamp);
        }

        isManager[user] = _isManager;
    }

    function updateManagerForUser(address user, address manager) public onlyOwner {
        require(user != address(0), "NimbusReferralProgramMarketing: User address is equal to 0");
        require(manager != address(0), "NimbusReferralProgramMarketing: Manager address is equal to 0");

        userManager[user] = manager;
    }

    function updateManagerForUsers(address manager, address[] memory users) external onlyOwner {
        for(uint i = 0; i < users.length; i++) {
            updateManagerForUser(users[i], manager);
        }
    }

    function updateManagerssForUsers(address[] memory managers, address[] memory users) external onlyOwner {
        require(managers.length == users.length, "NimbusReferralProgramMarketing: Managers and users arrays length are not equal.");
        for(uint i = 0; i < users.length; i++) {
            updateManagerForUser(users[i], managers[i]);
        }
    }

    function registerUser(address user, uint sponsorId) external returns(uint userId){
        address sponsorAddress = rpUsers.userAddressById(sponsorId);

        if (isLeader[sponsorAddress] == true) {
            updateLeaderForUser(user, sponsorAddress);
            updateManagerForUser(user, userManager[sponsorAddress]);
            return rpUsers.registerUser(user, sponsorId);
        } else {
            updateLeaderForUser(user, userLeader[sponsorAddress]);
            updateManagerForUser(user, userManager[userLeader[sponsorAddress]]);
            return rpUsers.registerUser(user, sponsorId);
        }
    }

    function updateReferralProfitAmount(address user, address token, uint amount) external onlyAllowedContract {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not a part of referral program.");
        require(token == address(NBU) || token == address(GNBU), "NimbusReferralProgramMarketing: Invalid staking token.");

        _updateTokenProfitAmount(user, userLeader[user], token, amount);
    }
    
    function _isContract(address _contract) internal view returns (bool isContract){
        uint32 size;
        assembly {
            size := extcodesize(_contract)
        }
        return (size > 0);
    }

    function _updateTokenProfitAmount(address user, address leader, address token, uint amount) internal {
        require(isLeader[leader] == true, "NimbusReferralProgramMarketing: User is not leader.");
        require(userManager[leader] != address(0), "NimbusReferralProgramMarketing: Leader has no manager.");

        address manager = userManager[leader];

        _updateCurrentPeriodTimestamp(leader, leaderCurrenPeriodTimestamp);
        _updateCurrentPeriodTimestamp(manager, managerCurrenPeriodTimestamp);

        if(token == address(NBU)) {
            if(userLine[user] <= lastLeaderReferralLine) {
                leaderTotalTurnover[leader].NBU += amount;
                leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].NBU += amount;
                uint totalTurnover = leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].NBU;
                _updateLeaderQualification(leader, address(NBU), totalTurnover);
            }

            managerTotalTurnover[userManager[leader]].NBU += amount;
            managerTurnoverForPeriod[manager][managerCurrenPeriodTimestamp[manager]].NBU += amount;
        } else if(token == address(GNBU)) {

            if(userLine[user] <= lastLeaderReferralLine) {
                leaderTotalTurnover[leader].GNBU += amount;
                leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].GNBU += amount;
                uint totalTurnover = leaderTurnoverForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].GNBU;
                _updateLeaderQualification(leader, address(GNBU), totalTurnover);
            }

            managerTotalTurnover[userManager[leader]].GNBU += amount;
            managerTurnoverForPeriod[manager][managerCurrenPeriodTimestamp[manager]].GNBU += amount;
        }
    }

    function _updateCurrentPeriodTimestamp(address user, mapping(address => uint) storage currentPeriod) internal {
        if(currentPeriod[user] + 30 days < block.timestamp) {
            uint difference = (currentPeriod[user] - block.timestamp ) / 30 days;
            currentPeriod[user] = currentPeriod[user] + difference * 30 days;

            if(isLeader[user]) {
                leaderCheckpoints[user].push(currentPeriod[user]);
                leaderQualificationLevel[user] = 0;
            } else if(isManager[user]) {
                managerCheckpoints[user].push(currentPeriod[user]);
            }
        }
    }

    function _setUserReferralLine(address user) internal {
        address sponsorAddress = rpUsers.userSponsorAddressByAddress(user);

        if(sponsorAddress != address(0)) {

            if(isLeader[sponsorAddress]) {
                userLine[user] = 1;
            } else if(isManager[sponsorAddress]) {
                userLine[user] = 0;
            } else {
                userLine[user] += userLine[sponsorAddress];
            }

        } else {
            userLine[user] = 0;
        }
    }

    function _getEquivalentSwapTokenAmount(address token, uint mainTokenAmount) internal view returns (uint swapTokenAmount) {
        address pairAddress = swapRouter.pairFor(token, address(swapToken));
        INimbusPair pair = INimbusPair(pairAddress);

        uint mainTokenReserve = 0;
        uint swapTokenReserve = 0;
        
        if(token == pair.token0()) {
            (mainTokenReserve, swapTokenReserve, ) = pair.getReserves();
        } else {
            (swapTokenReserve, mainTokenReserve, ) = pair.getReserves();
        }

        swapTokenAmount = (mainTokenAmount * swapTokenReserve) / mainTokenReserve;
    }

    function _getEquivalentMainTokenAmount(address token, uint swapTokenAmount) internal view returns (uint mainTokenAmount) {
        address pairAddress = swapRouter.pairFor(token, address(swapToken));
        INimbusPair pair = INimbusPair(pairAddress);

        uint mainTokenReserve = 0;
        uint swapTokenReserve = 0;
        
        if(token == pair.token0()) {
            (mainTokenReserve, swapTokenReserve, ) = pair.getReserves();
        } else {
            (swapTokenReserve, mainTokenReserve, ) = pair.getReserves();
        }

        mainTokenAmount = (swapTokenAmount * mainTokenReserve) / swapTokenReserve;
    }

    function _updateQualification(uint totalTurnoverAmount, uint vestingAmount, uint freePaymentAmount) internal onlyOwner returns(Qualification memory qualification) {
        require(totalTurnoverAmount > 0, "NimbusReferralProgramMarketing: Total turnover amount can't be lower then one.");
        qualificationsCount = ++qualificationsCount;

        qualifications[qualificationsCount] = Qualification(qualificationsCount, totalTurnoverAmount, vestingAmount, freePaymentAmount);

        return qualifications[qualificationsCount];
    }

    function _updateLeaderQualification(address leader, address token, uint totalTurnover) internal {
        uint totalTurnoverEquivalent = _getEquivalentSwapTokenAmount(token, totalTurnover);

        uint qualificationLevel = _getUserQualificationLevel(totalTurnoverEquivalent);

        if(leaderQualificationLevel[leader] < qualificationLevel) {
            leaderQualificationLevel[leader] = qualificationLevel;
            _setLeaderReward(leader, leaderQualificationLevel[leader]);
            emit QualificationUpdated(leader, leaderQualificationLevel[leader]);
        }
    }

    function _setLeaderReward(address leader, uint qualificationLevel) internal {
        if(qualifications[qualificationLevel].VestingAmount > 0) {
            uint swapTokenAmount = qualifications[qualificationLevel].VestingAmount * swapToken.decimals();
            uint nbuAmount = _getEquivalentMainTokenAmount(address(NBU), swapTokenAmount);
            NBU.vest(leader, nbuAmount);
            leaderVestingReward[leader] += qualifications[qualificationLevel].VestingAmount * swapToken.decimals();
        }

        if(qualifications[qualificationLevel].FreePaymentAmount > 0) {
            leaderFreePaymentReward[leader] += qualifications[qualificationLevel].FreePaymentAmount * swapToken.decimals();
        }   
    }

    function _getUserQualificationLevel(uint totalTurnover) internal view returns(uint qualificationNumber){
        for(uint i = 0; i < qualificationsCount; i++) {
            if(qualifications[i].TotalTurnover < totalTurnover) {
                return i - 1;
            }
        }
    }

    function claimReward() external {
        require(isLeader[msg.sender], "NimbusReferralProgramMarketing: User is not a leader.");
        require(leaderFreePaymentReward[msg.sender] != 0, "NimbusReferralProgramMarketing: Leader has no free payment reward");

        swapToken.transfer(msg.sender, leaderFreePaymentReward[msg.sender]);
        leaderClaimedReward[msg.sender] += leaderFreePaymentReward[msg.sender];
        leaderFreePaymentReward[msg.sender] = 0;
        emit RewardClaimed(msg.sender, leaderFreePaymentReward[msg.sender]);
    }
}