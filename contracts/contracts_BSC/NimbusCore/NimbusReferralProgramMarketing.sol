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

interface INimbusReferralProgramUsers {
    function userSponsor(uint user) external view returns (uint);
    function registerUser(address user, uint category) external returns (uint); //public
    function userIdByAddress(address user) external view returns (uint);
    function userAddressById(uint id) external view returns (address);
    function userSponsorAddressByAddress(address user) external view returns (address);
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

    struct StakingAmount {
        uint NBU;
        uint GNBU;
    }

    INimbusReferralProgramUsers rpUsers;
    IBEP20 NBU;
    IBEP20 GNBU;

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

    mapping(address => mapping(uint => StakingAmount)) managerProfitAmountForPeriod;
    mapping(address => mapping(uint => StakingAmount)) leaderProfitAmountForPeriod;
 
    mapping(address => StakingAmount) public leaderTotalProfitAmount;
    mapping(address => StakingAmount) public managerTotalProfitAmount;

    mapping(address => bool) public isAllowedContract;

    constructor(address _nbu, address _gnbu, address _rpUsers, uint _lastLeaderReferralLine) {
        NBU = IBEP20(_nbu);
        GNBU = IBEP20(_gnbu);
        rpUsers = INimbusReferralProgramUsers(_rpUsers);
        lastLeaderReferralLine = _lastLeaderReferralLine;
    }

    modifier onlyAllowedContract() {
        require(isAllowedContract[msg.sender] == true, "NimbusReferralProgramMarketing: Provided address is not an allowed contract");
        _;
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
        }

        isLeader[user] = _isLeader;
    }

    function updateLeaderForUser(address user, address leader) public {
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
        }

        isManager[user] = _isManager;
    }

    function updateManagerForUser(address user, address manager) public {
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

    function updateReferralStakingAmount(address user, address token, uint amount) external onlyAllowedContract {
        require(rpUsers.userIdByAddress(user) != 0, "NimbusReferralProgramMarketing: User is not a part of referral program.");
        require(token == address(NBU) || token == address(GNBU), "NimbusReferralProgramMarketing: Invalid staking token.");

        _updateTokenStakingAmount(user, userLeader[user], token, amount);
    }
    
    function _isContract(address _contract) internal view returns (bool isContract){
        uint32 size;
        assembly {
            size := extcodesize(_contract)
        }
        return (size > 0);
    }

    function _updateTokenStakingAmount(address user, address leader, address token, uint amount) internal {
        require(isLeader[leader] == true, "NimbusReferralProgramMarketing: User is not leader.");
        require(userManager[leader] != address(0), "NimbusReferralProgramMarketing: Leader has no manager.");

        address manager = userManager[leader];

        _updateCurrentPeriodTimestamp(leader, leaderCurrenPeriodTimestamp);
        _updateCurrentPeriodTimestamp(manager, managerCurrenPeriodTimestamp);

        if(token == address(NBU)) {
            if(userLine[user] <= 6) {
                leaderTotalProfitAmount[leader].NBU += amount;
                leaderProfitAmountForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].NBU += amount;
            }

            managerTotalProfitAmount[userManager[leader]].NBU += amount;
            managerProfitAmountForPeriod[manager][managerCurrenPeriodTimestamp[manager]].NBU += amount;
        }

        if(token == address(GNBU)) {

            if(userLine[user] <= 6) {
                leaderTotalProfitAmount[leader].GNBU += amount;
                leaderProfitAmountForPeriod[leader][leaderCurrenPeriodTimestamp[leader]].GNBU += amount;
            }

            managerTotalProfitAmount[userManager[leader]].GNBU += amount;
            managerProfitAmountForPeriod[manager][managerCurrenPeriodTimestamp[manager]].GNBU += amount;
        }
    }

    function _updateCurrentPeriodTimestamp(address user, mapping(address => uint) storage currentPeriod) internal {
        if(currentPeriod[user] + 30 days < block.timestamp) {
            uint difference = (currentPeriod[user] - block.timestamp ) / 30 days;
            currentPeriod[user] = currentPeriod[user] + difference * 30 days;
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
}