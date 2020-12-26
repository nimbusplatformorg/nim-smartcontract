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
        require(msg.sender == owner, "LPReward: Caller is not the owner");
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

interface INBU {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function give(address recipient, uint256 amount) external returns (bool);
}

interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external  view returns (uint[] memory amounts);
}

interface INimbusFactory {
    function getPair(address tokenA, address tokenB) external  view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

library SafeMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'LPReward: ds-math-add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'LPReward: ds-math-sub-underflow');
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, 'LPReward: ds-math-mul-overflow');
    }
}

library Math {
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract LPReward is Ownable {
    using SafeMath for uint;

    uint public lpRewardMaxAmount = 100_000_000e18;
    uint public lpRewardUsed;
    uint public immutable startReward;
    uint public constant rewardPeriod = 365 days;

    address public NBU;
    address public swapRouter;
    INimbusFactory public swapFactory;

    mapping (address => mapping (address => uint)) public lpTokenAmounts;
    mapping (address => mapping (address => uint)) public weightedRatio;
    mapping (address => mapping (address => uint)) public ratioUpdateLast;
    mapping (address => mapping (address => mapping (uint => uint[]))) public unclaimedAmounts;
    mapping (address => mapping (address => uint)) public unclaimedNonces;
    mapping (address => bool) public allowedPairs;
    mapping (address => address[]) private _pairTokens;

    event RecordAddLiquidity(uint ratio, uint weightedRatio, uint oldWeighted, uint liquidity);
    event recordRemoveLiquidityUnclaimed(address recipient, uint amountA, uint amountB, uint liquidity);
    event recordRemoveLiquidityGiveNbu(address recipient, uint nbu, uint amountA, uint amountB, uint liquidity);
    event ClaimLiquidityNbu(address recipient, uint nbu, uint amountA, uint amountB);

    constructor(address nbu, address factory, address router) {
        swapRouter = router; 
        swapFactory = INimbusFactory(factory);
        NBU = nbu;
        startReward = block.timestamp;
    }
    
    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, "LPReward: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    modifier onlyRouter() {
        require(msg.sender == swapRouter, "Caller is not the allowed router");
        _;
    }
    
    function recordAddLiquidity(address recipient, address pair, uint amountA, uint amountB, uint liquidity) external onlyRouter {
        if (!allowedPairs[pair]) return;
        uint ratio = Math.sqrt(amountA.mul(amountB)) * 1e18 / liquidity;   
        uint previousRatio = weightedRatio[recipient][pair];
        if (ratio < previousRatio) {
            return;
        }
        uint previosAmount = lpTokenAmounts[recipient][pair];
        uint newAmount = previosAmount.add(liquidity);
        uint weighted =  (previousRatio.mul(previosAmount) / newAmount).add(ratio.mul(liquidity) / newAmount);
        weightedRatio[recipient][pair] = weighted;
        lpTokenAmounts[recipient][pair] = newAmount;
        ratioUpdateLast[recipient][pair] = block.timestamp;
        emit RecordAddLiquidity(ratio, weighted, previousRatio, liquidity);
    }

    function recordRemoveLiquidity(address recipient, address tokenA, address tokenB, uint amountA, uint amountB, uint liquidity) external lock onlyRouter { 
        address pair = swapFactory.getPair(tokenA, tokenB);
        if (!allowedPairs[pair]) return;
        uint amount0;
        uint amount1;
        {
        uint ratio = Math.sqrt(amountA.mul(amountB)) * 1e18 / liquidity;   
        uint previousRatio = weightedRatio[recipient][pair];
        if (previousRatio != 0 && ratio < previousRatio) return;
        uint difference = ratio.sub(previousRatio);
        uint previosAmount = lpTokenAmounts[recipient][pair];
        weightedRatio[recipient][pair] = (previousRatio.mul(previosAmount.sub(liquidity)) / previosAmount).add(ratio.mul(liquidity) / previosAmount);
        lpTokenAmounts[recipient][pair] = previosAmount.sub(liquidity);
        amount0 = amountA * difference / 1e18;
        amount1 = amountB * difference / 1e18; 
        }

        uint amountNbu;
        address tokenToNbuPair = swapFactory.getPair(tokenA, NBU);
        if (tokenToNbuPair != address(0)) {
            amountNbu = INimbusRouter(swapRouter).getAmountsOut(amount0, getPathForToken(tokenA))[1];
        }

        tokenToNbuPair = swapFactory.getPair(tokenB, NBU);
        if (tokenToNbuPair != address(0)) {
            if (amountNbu != 0) {
                amountNbu = amountNbu.add(INimbusRouter(swapRouter).getAmountsOut(amount1, getPathForToken(tokenB))[1]);
            } else  {
                amountNbu = INimbusRouter(swapRouter).getAmountsOut(amount1, getPathForToken(tokenB))[1].mul(2);
            }
        } else {
            amountNbu = amountNbu.mul(2);
        }

        if (amountNbu != 0 && amountNbu >= availableReward()) {
            INBU(NBU).give(recipient, amountNbu);
            lpRewardUsed = lpRewardUsed.add(amountNbu);
            emit recordRemoveLiquidityGiveNbu(recipient, amountNbu, amountA, amountB, liquidity);            
        } else {
            uint amountS0;
            uint amountS1;
            {
            (address token0,) = sortTokens(tokenA, tokenB);
            (amountS0, amountS1) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
            }
            uint nonce = ++unclaimedNonces[recipient][pair]; 
            unclaimedAmounts[recipient][pair][nonce].push(amountS0);
            unclaimedAmounts[recipient][pair][nonce].push(amountS1);
            emit recordRemoveLiquidityUnclaimed(recipient, amount0, amount1, liquidity);
        }
        ratioUpdateLast[recipient][pair] = block.timestamp;
    }
    
    function claimBonusBatch(address[] memory pairs, address recipient) external lock {
        for (uint i; i < pairs.length; i++) {
            claimBonus(pairs[i],recipient);
        }
    }
    
    function claimBonus(address pair, address recipient) public lock {
        require (allowedPairs[pair], "LPReward: Not allowed pair");
        uint nonce = unclaimedNonces[msg.sender][pair];
        require (nonce > 0, "LPReward: No undistributed fee bonuses");
        uint amountA;
        uint amountB;
        for (uint i = 1; i <= nonce; i++) {
            amountA = amountA.add(unclaimedAmounts[msg.sender][pair][i][0]);
            amountB = amountA.add(unclaimedAmounts[msg.sender][pair][i][1]);
            unclaimedAmounts[msg.sender][pair][i].pop();
            unclaimedAmounts[msg.sender][pair][i].pop();
        }

        uint amountNbu = nbuAmountForPair(pair, amountA, amountB);
        require (amountNbu > 0, "LPReward: No NBU pairs to token A and token B");
        require (amountNbu >= availableReward(), "LPReward: Available reward for the period is used");
        
        INBU(NBU).give(recipient, amountNbu);
        lpRewardUsed = lpRewardUsed.add(amountNbu);
        unclaimedNonces[msg.sender][pair] = 0;
        emit ClaimLiquidityNbu(recipient, amountNbu, amountA, amountB);            
    }

    function unclaimedAmountNbu(address recipient, address pair) external view returns (uint) {
        uint nonce = unclaimedNonces[recipient][pair];
        uint amountA;
        uint amountB;
        if (nonce != 0) {
            for (uint i = 1; i <= nonce; i++) {
                amountA = amountA.add(unclaimedAmounts[recipient][pair][i][0]);
                amountB = amountB.add(unclaimedAmounts[recipient][pair][i][1]);
            }
        } else  {
            return 0;
        }

        return nbuAmountForPair(pair, amountA, amountB);
    }

    function unclaimedAmount(address recipient, address pair) external view returns (uint amountA, uint amountB) {
        uint nonce = unclaimedNonces[recipient][pair];
        if (nonce != 0) {
            for (uint i = 1; i <= nonce; i++) {
                amountA = amountA.add(unclaimedAmounts[recipient][pair][i][0]);
                amountB = amountB.add(unclaimedAmounts[recipient][pair][i][1]);
            }
        }
    }

    function availableReward() public view returns (uint) {
        uint rewardForPeriod = lpRewardMaxAmount.mul(block.timestamp - startReward) / rewardPeriod;
        if (rewardForPeriod > lpRewardUsed) return rewardForPeriod.sub(lpRewardUsed);
        else return 0;
    }

    function nbuAmountForPair(address pair, uint amountA, uint amountB) private view returns (uint amountNbu) {
        address tokenA = _pairTokens[pair][0];
        address tokenB = _pairTokens[pair][1];
        address tokenToNbuPair = swapFactory.getPair(tokenA, NBU);
        if (tokenToNbuPair != address(0)) {
            amountNbu = INimbusRouter(swapRouter).getAmountsOut(amountA, getPathForToken(tokenA))[1];
        }

        tokenToNbuPair = swapFactory.getPair(tokenB, NBU);
        if (tokenToNbuPair != address(0)) {
            if (amountNbu != 0) {
                amountNbu = amountNbu.add(INimbusRouter(swapRouter).getAmountsOut(amountB, getPathForToken(tokenB))[1]);
            } else  {
                amountNbu = INimbusRouter(swapRouter).getAmountsOut(amountB, getPathForToken(tokenB))[1].mul(2);
            }
        } else {
            amountNbu = amountNbu.mul(2);
        }
    }

    function getPathForToken(address token) private view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = NBU;
        return path;
    }

    function sortTokens(address tokenA, address tokenB) private pure returns (address token0, address token1) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }




    function updateRouter(address newRouter) external onlyOwner {
        require (newRouter != address(0), "LPReward: Zero address");
        swapRouter = newRouter;
    }

    function updateAllowedPair(address tokenA, address tokenB, bool isAllowed) external onlyOwner {
        require (tokenA != address(0) && tokenB != address(0) && tokenA != tokenB, "LPReward: Wrong addresses");
        address pair = swapFactory.getPair(tokenA, tokenB);
        if (!allowedPairs[pair]) {
            (address token0, address token1) = sortTokens(tokenA, tokenB);
            _pairTokens[pair].push(token0);
            _pairTokens[pair].push(token1);
        }
        allowedPairs[pair] = isAllowed;
    }

    function updateRewardMaxAmount(uint newAmount) external onlyOwner {
        lpRewardMaxAmount = newAmount;
    }
}