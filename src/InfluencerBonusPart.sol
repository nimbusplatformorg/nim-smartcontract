pragma solidity =0.8.0;

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

    function transferOwnership(address transferOwner) public onlyOwner {
        require(transferOwner != newOwner);
        newOwner = transferOwner;
    }

    function acceptOwnership() virtual public {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        return a / b;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

interface INBU {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function give(address recipient, uint256 amount) external;
}

interface INimbusStakingPool {
    function balanceOf(address account) external view returns (uint256);
}

interface INimbusReferralProgram {
    function userSponsorByAddress(address user) external view returns (uint);
    function userIdByAddress(address user) external view returns (uint);
}

interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract NBUInfluencerBonusPart is Ownable {
    using SafeMath for uint;
    
    INBU public NBU;
    
    uint public nbuBonusAmount;
    INimbusReferralProgram public referralProgram;
    INimbusStakingPool[] public stakingPools;
    
    INimbusRouter public swapRouter;                
    address public swapToken;                       
    uint public swapTokenAmountForBonusThreshold;  
    
    mapping (address => bool) public influencers;
    mapping (address => mapping (address => bool)) public processedUsers;

    event ProcessInfluencerBonus(address influencer, address user, uint userAmount, uint influencerBonus);

    constructor(address nbu, address router, address referral) {
        NBU = INBU(nbu);
        swapRouter = INimbusRouter(router);
        referralProgram = INimbusReferralProgram(referral);
        nbuBonusAmount = 5 * 10 ** 18;
    }

    function claimBonus(address[] memory users) external {
        for (uint i; i < users.length; i++) {
            claimBonus(users[i]);
        }
    }

    function claimBonus(address user) public {
        require(influencers[msg.sender], "Not influencer");
        require(!processedUsers[msg.sender][user], "Bonus for user already received");
        require(referralProgram.userSponsorByAddress(user) == referralProgram.userIdByAddress(msg.sender), "Not user sponsor");
        uint amount;
        for (uint i; i < stakingPools.length; i++) {
            amount = amount.add(stakingPools[i].balanceOf(user));
        }

        address[] memory path = new address[](2);
        path[0] = swapToken;
        path[1] = address(NBU);
        uint minNbuAmountForBonus = swapRouter.getAmountsOut(swapTokenAmountForBonusThreshold, path)[1];
        require (amount >= minNbuAmountForBonus, "Bonus threshold not met");
        NBU.give(msg.sender, nbuBonusAmount);
        processedUsers[msg.sender][user] = true;
        emit ProcessInfluencerBonus(msg.sender, user, amount, nbuBonusAmount);
    }

    function isBonusForUserAllowed(address influencer, address user) external view returns (bool) {
        if (!influencers[influencer]) return false;
        if (processedUsers[influencer][user]) return false;
        if (referralProgram.userSponsorByAddress(user) != referralProgram.userIdByAddress(influencer)) return false;
        uint amount;
        for (uint i; i < stakingPools.length; i++) {
            amount = amount.add(stakingPools[i].balanceOf(user));
        }

        address[] memory path = new address[](2);
        path[0] = swapToken;
        path[1] = address(NBU);
        uint minNbuAmountForBonus = swapRouter.getAmountsOut(swapTokenAmountForBonusThreshold, path)[1];
        return amount >= minNbuAmountForBonus;
    }




    function updateSwapRouter(address newSwapRouter) external onlyOwner {
        require(newSwapRouter != address(0), "Address is zero");
        swapRouter = INimbusRouter(newSwapRouter);
    }
    
    function updateStakingPoolAdd(address newStakingPool) external onlyOwner {
        for (uint i; i < stakingPools.length; i++) {
            require (address(stakingPools[i]) != newStakingPool, "Pool exists");
        }
        stakingPools.push(INimbusStakingPool(newStakingPool));
    }

    function updateStakingPoolRemove(uint poolIndex) external onlyOwner {
        stakingPools[poolIndex] = stakingPools[stakingPools.length - 1];
        stakingPools.pop();
    }

    function updateInfluencer(address influencer, bool isActive) external onlyOwner {
        influencers[influencer] = isActive;
    }

    function updateNbuBonusAmount(uint newAmount) external onlyOwner {
        nbuBonusAmount = newAmount;
    }

    function updateSwapToken(address newSwapToken) external onlyOwner {
        require(newSwapToken != address(0), "Address is zero");
        swapToken = newSwapToken;
    }

    function updateSwapTokenAmountForBonusThreshold(uint threshold) external onlyOwner {
        swapTokenAmountForBonusThreshold = threshold;
    }
}