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
    function give(address recipient, uint256 amount, uint vesterId) external;
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
    mapping (address => mapping (address => uint[])) public unclaimedAmounts;
    mapping (address => bool) public allowedPairs;
    mapping (address => address[]) public pairTokens;

    event RecordAddLiquidity(uint ratio, uint weightedRatio, uint oldWeighted, uint liquidity);
    event RecordRemoveLiquidityUnclaimed(address recipient, address pair, uint amountA, uint amountB, uint liquidity);
    event RecordRemoveLiquidityGiveNbu(address recipient, address pair, uint nbu, uint amountA, uint amountB, uint liquidity);
    event ClaimLiquidityNbu(address recipient, uint nbu, uint amountA, uint amountB);
    event Rescue(address to, uint amount);
    event RescueToken(address token, address to, uint amount); 

    constructor(address nbu, address factory) {
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
        if (tokenA != NBU) {
            address tokenToNbuPair = swapFactory.getPair(tokenA, NBU);
            if (tokenToNbuPair != address(0)) {
                amountNbu = INimbusRouter(swapRouter).getAmountsOut(amount0, getPathForToken(tokenA))[1];
            }
        } else {
            amountNbu = amount0;
        }
        
        if (tokenB != NBU) {
            address tokenToNbuPair = swapFactory.getPair(tokenB, NBU);
            if (tokenToNbuPair != address(0)) {
                if (amountNbu != 0) {
                    amountNbu = amountNbu.add(INimbusRouter(swapRouter).getAmountsOut(amount1, getPathForToken(tokenB))[1]);
                } else  {
                    amountNbu = INimbusRouter(swapRouter).getAmountsOut(amount1, getPathForToken(tokenB))[1].mul(2);
                }
            } else {
                amountNbu = amountNbu.mul(2);
            }
        } else {
            if (amountNbu != 0) { 
                amountNbu = amountNbu.add(amount1);
            } else {
                amountNbu = amount1.mul(2);
            }
        }

        if (amountNbu != 0 && amountNbu >= availableReward()) {
            INBU(NBU).give(recipient, amountNbu, 2);
            lpRewardUsed = lpRewardUsed.add(amountNbu);
            emit RecordRemoveLiquidityGiveNbu(recipient, pair, amountNbu, amountA, amountB, liquidity);            
        } else {
            uint amountS0;
            uint amountS1;
            {
            (address token0,) = sortTokens(tokenA, tokenB);
            (amountS0, amountS1) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
            }
            if (unclaimedAmounts[recipient][pair].length == 0) { 
                unclaimedAmounts[recipient][pair].push(amountS0);
                unclaimedAmounts[recipient][pair].push(amountS1);
            } else {
                unclaimedAmounts[recipient][pair][0] = unclaimedAmounts[recipient][pair][0].add(amountS0);
                unclaimedAmounts[recipient][pair][1] = unclaimedAmounts[recipient][pair][1].add(amountS1);
            }
            
            emit RecordRemoveLiquidityUnclaimed(recipient, pair, amount0, amount1, liquidity);
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
        require (unclaimedAmounts[recipient][pair].length > 0 && (unclaimedAmounts[recipient][pair][0] > 0 || unclaimedAmounts[recipient][pair][1] > 0), "LPReward: No undistributed fee bonuses");
        uint amountA;
        uint amountB;
        amountA = unclaimedAmounts[msg.sender][pair][0];
        amountB = unclaimedAmounts[msg.sender][pair][1];
        unclaimedAmounts[msg.sender][pair][0] = 0;
        unclaimedAmounts[msg.sender][pair][1] = 0;

        uint amountNbu = nbuAmountForPair(pair, amountA, amountB);
        require (amountNbu > 0, "LPReward: No NBU pairs to token A and token B");
        require (amountNbu >= availableReward(), "LPReward: Available reward for the period is used");
        
        INBU(NBU).give(recipient, amountNbu, 2);
        lpRewardUsed = lpRewardUsed.add(amountNbu);
        emit ClaimLiquidityNbu(recipient, amountNbu, amountA, amountB);            
    }

    function unclaimedAmountNbu(address recipient, address pair) external view returns (uint) {
        uint amountA;
        uint amountB;
        if (unclaimedAmounts[recipient][pair].length != 0) {
            amountA = unclaimedAmounts[recipient][pair][0];
            amountB = unclaimedAmounts[recipient][pair][1];
        } else  {
            return 0;
        }

        return nbuAmountForPair(pair, amountA, amountB);
    }

    function unclaimedAmount(address recipient, address pair) external view returns (uint amountA, uint amountB) {
        if (unclaimedAmounts[recipient][pair].length != 0) {
            amountA = unclaimedAmounts[recipient][pair][0];
            amountB = unclaimedAmounts[recipient][pair][1];
        }
    }

    function availableReward() public view returns (uint) {
        uint rewardForPeriod = lpRewardMaxAmount.mul(block.timestamp - startReward) / rewardPeriod;
        if (rewardForPeriod > lpRewardUsed) return rewardForPeriod.sub(lpRewardUsed);
        else return 0;
    }

    function nbuAmountForPair(address pair, uint amountA, uint amountB) private view returns (uint amountNbu) {
        address tokenA = pairTokens[pair][0];
        address tokenB = pairTokens[pair][1];
        if (tokenA != NBU) {
            address tokenToNbuPair = swapFactory.getPair(tokenA, NBU);
            if (tokenToNbuPair != address(0)) {
                amountNbu = INimbusRouter(swapRouter).getAmountsOut(amountA, getPathForToken(tokenA))[1];
            }
        } else {
            amountNbu = amountA;
        }

        if (tokenB != NBU) {
            address tokenToNbuPair = swapFactory.getPair(tokenB, NBU);
            if (tokenToNbuPair != address(0)) {
                if (amountNbu != 0) {
                    amountNbu = amountNbu.add(INimbusRouter(swapRouter).getAmountsOut(amountB, getPathForToken(tokenB))[1]);
                } else  {
                    amountNbu = INimbusRouter(swapRouter).getAmountsOut(amountB, getPathForToken(tokenB))[1].mul(2);
                }
            } else {
                amountNbu = amountNbu.mul(2);
            }
        } else {
            if (amountNbu != 0) {
                amountNbu = amountNbu.add(amountB);
            } else {
                amountNbu = amountB.mul(2);
            }
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



    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "LPReward: Address is zero");
        require(amount > 0, "LPReward: Should be greater than 0");
        TransferHelper.safeTransferETH(to, amount);
        emit Rescue(to, amount);
    }

    function rescue(address to, address token, uint256 amount) external onlyOwner {
        require(to != address(0), "LPReward: Address is zero");
        require(amount > 0, "LPReward: Should be greater than 0");
        TransferHelper.safeTransfer(token, to, amount);
        emit RescueToken(token, to, amount);
    }

    function updateRouter(address newRouter) external onlyOwner {
        require (newRouter != address(0), "LPReward: Zero address");
        swapRouter = newRouter;
    }

    function updateAllowedPair(address tokenA, address tokenB, bool isAllowed) external onlyOwner {
        require (tokenA != address(0) && tokenB != address(0) && tokenA != tokenB, "LPReward: Wrong addresses");
        address pair = swapFactory.getPair(tokenA, tokenB);
        require (pair != address(0), "LPReward: Pair not exists");
        if (!allowedPairs[pair]) {
            (address token0, address token1) = sortTokens(tokenA, tokenB);
            pairTokens[pair].push(token0);
            pairTokens[pair].push(token1);
        }
        allowedPairs[pair] = isAllowed;
    }

    function updateRewardMaxAmount(uint newAmount) external onlyOwner {
        lpRewardMaxAmount = newAmount;
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

    function safeTransferETH(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
    }
}