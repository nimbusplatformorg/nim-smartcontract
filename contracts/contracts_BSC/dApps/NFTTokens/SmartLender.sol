pragma solidity =0.8.0;


library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }
    function safeTransfer(address token, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }
    function safeTransferFrom(address token, address from, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }
    function safeTransferBNB(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: BNB_TRANSFER_FAILED');
    }
}

library Strings {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

    function toString(uint256 value) internal pure returns (string memory) {

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
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

contract ReentrancyGuard {
    /// @dev counter to allow mutex lock with only one SSTORE operation
    uint256 private _guardCounter;

    constructor () {
        // The counter starts at one to prevent changing it from zero to a non-zero
        // value, which is a more expensive operation.
        _guardCounter = 1;
    }

    modifier nonReentrant() {
        _guardCounter += 1;
        uint256 localCounter = _guardCounter;
        _;
        require(localCounter == _guardCounter, "ReentrancyGuard: reentrant call");
    }
}

library Address {
    function isContract(address account) internal view returns (bool) {

        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCall(target, data, "Address: low-level call failed");
    }

    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");

        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        require(isContract(target), "Address: static call to non-contract");

        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(isContract(target), "Address: delegate call to non-contract");

        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

interface IBEP165 {
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

abstract contract ERC165 is IBEP165 {
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IBEP165).interfaceId;
    }
}

interface IBEP721 is IBEP165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;
}

interface IBEP721Metadata is IBEP721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface IBEP20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
}

interface IRouter {
    function swapExactBNBForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
        
        function addLiquidityBNB(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountBNBMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountBNB, uint liquidity);
    function removeLiquidityBNB(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountBNBMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountBNB);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactTokensForBNB(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);

   function swapTokensForExactBNB(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
}

interface ILpStaking {
    function stakeNonces (address) external view returns (uint256);
    function stake(uint256 amount) external;
    function stakeFor(uint256 amount, address user) external;
    function getCurrentLPPrice() external view returns (uint);
    function getReward() external;
    function withdraw(uint256 nonce) external;
    function rewardDuration() external returns (uint256);
}

interface INimbusPair {
    function getReserves() external returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast);
    function token0() external returns (address);
    function token1() external returns (address);
}

interface IWBNB {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
    function approve(address spender, uint value) external returns (bool);
}

interface ILending {
    function mintWithBnb(address receiver) external payable returns (uint256 mintAmount);
    function tokenPrice() external view returns (uint256);
    function burnToBnb(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
    function mint( address receiver, uint256 depositAmount) external returns (uint256);
    function burn( address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
}

contract SmartLenderStorage is Ownable, Context, ERC165, ReentrancyGuard {    
    IWBNB public WBNB;
    IRouter public swapRouter;
    ILpStaking public lpStakingBnbNbu;
    ILpStaking public lpStakingNbuBusd;
    ILending public lendingContract;
    IBEP20 public nbuToken;
    IBEP20 public busdToken;
    address internal nbuBusdPair;
    address internal bnbNbuPair;
    
    uint public tokenCount;
    uint public minPurchaseAmount;
    uint256 public rewardDuration;
    
    struct UserSupply { 
      uint ProvidedBusd;
      uint NbuBnbLpAmount;
      uint NbuBusdLpAmount;
      uint LendedBusdAmount;
      uint PoolNbuAmount;
      uint PoolBnbAmount;
      uint PoolBusdAmount;
      uint LendedITokenAmount;
      uint NbuBnbStakeNonce;
      uint NbuBusdStakeNonce;
      uint SupplyTime;
      uint TokenId;
      bool IsActive;
    }
    
    mapping(uint => uint[]) internal _userRewards;
    mapping(uint => uint256) internal _balancesRewardEquivalentBnbNbu;
    mapping(uint => uint256) internal _balancesRewardEquivalentNbuBusd;
    mapping(uint => UserSupply) public tikSupplies;
    mapping(uint => uint256) public weightedStakeDate;

    string internal _name;
    string internal _symbol;

    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) internal _balances;
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(address => uint[]) internal _userTokens;
     
    event BuySmartLender(address indexed user, uint indexed tokenId, uint providedBnb, uint supplyTime);
    event WithdrawRewards(address indexed user, uint indexed tokenId, uint totalNbuReward);
    event BalanceRewardsNotEnough(address indexed user, uint indexed tokenId, uint totalNbuReward);
    event BurnSmartLender(uint indexed tokenId);
    event UpdateSwapRouter(address indexed newSwapRouterContract);
    event UpdateLpStakingBnbNbu(address indexed newLpStakingAContract);
    event UpdateLpStakingBnbGnbu(address indexed newLpStakingBContract);
    event UpdateLendingContract(address indexed newLending);
    event UpdateTokenNbu(address indexed newToken);
    event UpdateTokenGnbu(address indexed newToken);
    event UpdateMinPurchaseAmount(uint indexed newAmount);
    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed to, address indexed token, uint amount);
}

contract SmartLenderProxy is SmartLenderStorage {
    address public target;
    
    event SetTarget(address indexed newTarget);

    constructor(address _newTarget) SmartLenderStorage() {
        _setTarget(_newTarget);
    }

    fallback() external payable {
        if (gasleft() <= 2300) {
            revert();
        }

        address target_ = target;
        bytes memory data = msg.data;
        assembly {
            let result := delegatecall(gas(), target_, add(data, 0x20), mload(data), 0, 0)
            let size := returndatasize()
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }

    function setTarget(address _newTarget) external onlyOwner {
        _setTarget(_newTarget);
    }

    function _setTarget(address _newTarget) internal {
        require(Address.isContract(_newTarget), "Target not a contract");
        target = _newTarget;
        emit SetTarget(_newTarget);
    }
}

contract SmartLender is SmartLenderStorage, IBEP721, IBEP721Metadata {
    using Address for address;
    using Strings for uint256;
    
    address public target;

    function initialize(
        address _swapRouter, 
        address _wbnb, 
        address _nbuToken, 
        address _busdToken, 
        address _bnbNbuPair, 
        address _nbuBusdPair,
        address _lpStakingBnbNbu, 
        address _lpStakingNbuBusd, 
        address _lendingContract
    ) external onlyOwner {
        require(Address.isContract(_swapRouter), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_wbnb), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_nbuToken), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_busdToken), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_bnbNbuPair), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_nbuBusdPair), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_lpStakingBnbNbu), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_lpStakingNbuBusd), "NimbusSmartLender_V1: Not contract");
        require(Address.isContract(_lendingContract), "NimbusSmartLender_V1: Not contract");

        _name = "Smart LP";
        _symbol = "SL";
         
        swapRouter = IRouter(_swapRouter);
        WBNB = IWBNB(_wbnb);
        nbuToken = IBEP20(_nbuToken);
        busdToken = IBEP20(_busdToken);
        lpStakingBnbNbu = ILpStaking(_lpStakingBnbNbu);
        lpStakingNbuBusd = ILpStaking(_lpStakingNbuBusd);
        lendingContract = ILending(_lendingContract);
        nbuBusdPair = _nbuBusdPair;
        bnbNbuPair = _bnbNbuPair;
       
      
        rewardDuration = ILpStaking(_lpStakingBnbNbu).rewardDuration();
        minPurchaseAmount = 500000000000000000000;

        IBEP20(_nbuToken).approve(_swapRouter, type(uint256).max);
        IBEP20(_busdToken).approve(_swapRouter, type(uint256).max);
        IBEP20(_bnbNbuPair).approve(address(_swapRouter), type(uint256).max);
        IBEP20(_bnbNbuPair).approve(address(_lpStakingBnbNbu), type(uint256).max);
        IBEP20(_nbuBusdPair).approve(address(_lpStakingNbuBusd), type(uint256).max);  
        IBEP20(_nbuBusdPair).approve(address(_swapRouter), type(uint256).max);
        IBEP20(_busdToken).approve(address(_lendingContract), type(uint256).max); 

    }

    receive() external payable {
        assert(msg.sender == address(WBNB) || msg.sender == address(swapRouter));
    }




    // ========================== SmartLender functions ==========================

    function buySmartLender(uint amount) external {
      require(amount >= minPurchaseAmount, 'SmartLender: Token price is more than sent');
      TransferHelper.safeTransferFrom(address(busdToken), msg.sender, address(this), amount); 
      uint amountBusd = amount;
      tokenCount = ++tokenCount;
      
      address[] memory path = new address[](2);
      path[0] = address(busdToken);
      path[1] = address(nbuToken);

      (uint[] memory amountsBusdNbuSwap) = swapRouter.swapExactTokensForTokens((amount/6), 0, path, address(this), block.timestamp);    
      (uint[] memory amountsBusdNbuForBnbNbuPair) = swapRouter.swapExactTokensForTokens((amount/6) * 2,0, path, address(this), block.timestamp);

      amountBusd -= (amount/6) * 3;
      uint amountNbu = amountsBusdNbuSwap[1] + amountsBusdNbuForBnbNbuPair[1];
      path[0] = address(nbuToken);
      path[1] = address(WBNB);      
      (uint[] memory amountsNbuBnbForBnbNbuPair) = swapRouter.swapExactTokensForBNB(amountsBusdNbuForBnbNbuPair[1]/2,0, path, address(this), block.timestamp);
    
      amountNbu -= amountsNbuBnbForBnbNbuPair[0];

      (uint amountNbuBnb, , uint liquidityBnbNbu) = swapRouter.addLiquidityBNB{value: amountsNbuBnbForBnbNbuPair[1]}(address(nbuToken), amountsNbuBnbForBnbNbuPair[0], 0, 0, address(this), block.timestamp);
      amountNbu -= amountNbuBnb;
      
      ( uint amountNbuBusd, uint amountBusdNbu, uint liquidityBusdNbu) = swapRouter.addLiquidity(address(nbuToken), address(busdToken), amountNbu, amountBusd, 0, 0, address(this), block.timestamp);
      amountBusd -= amountBusdNbu;
      amountNbu -= amountNbuBusd;
      UserSupply storage userSupply = tikSupplies[tokenCount];
      userSupply.NbuBnbStakeNonce = lpStakingBnbNbu.stakeNonces(address(this));
      lpStakingBnbNbu.stake(liquidityBnbNbu);

      _balancesRewardEquivalentBnbNbu[tokenCount] += lpStakingBnbNbu.getCurrentLPPrice() * liquidityBnbNbu / 1e18;

      userSupply.NbuBusdStakeNonce = lpStakingNbuBusd.stakeNonces(address(this));
      lpStakingNbuBusd.stake(liquidityBusdNbu);

      _balancesRewardEquivalentNbuBusd[tokenCount] += lpStakingNbuBusd.getCurrentLPPrice() * liquidityBusdNbu / 1e18;
      
      userSupply.LendedITokenAmount = lendingContract.mint(address(this), amountBusd);

      userSupply.ProvidedBusd = amount;
      userSupply.IsActive = true;
      userSupply.PoolNbuAmount = amountsBusdNbuSwap[1] + amountsBusdNbuForBnbNbuPair[1];
      userSupply.PoolBnbAmount = amountsNbuBnbForBnbNbuPair[1];
      userSupply.PoolBusdAmount = amountBusdNbu;
      userSupply.NbuBusdLpAmount = liquidityBusdNbu;
      userSupply.NbuBnbLpAmount = liquidityBnbNbu;
      userSupply.LendedBusdAmount = amountBusd;
      userSupply.SupplyTime = block.timestamp;
      userSupply.TokenId = tokenCount;

      weightedStakeDate[tokenCount] = userSupply.SupplyTime;
      _userTokens[msg.sender].push(tokenCount); 
      _mint(msg.sender, tokenCount);
      
      emit BuySmartLender(msg.sender, tokenCount, amount, block.timestamp);
    }
    
    function withdrawUserRewards(uint tokenId) external nonReentrant {
        require(_owners[tokenId] == msg.sender, "SmartLender: Not token owner");
        UserSupply memory userSupply = tikSupplies[tokenId];
        require(userSupply.IsActive, "SmartLender: Not active");
        (uint nbuReward, ) = getTotalAmountsOfRewards(tokenId);
        _withdrawUserRewards(tokenId, nbuReward);
    }
    
    function burnSmartLender(uint tokenId) external nonReentrant {
        require(_owners[tokenId] == msg.sender, "SmartLender: Not token owner");
        UserSupply storage userSupply = tikSupplies[tokenId];
        require(userSupply.IsActive, "SmartLender: Token not active");
        (uint nbuReward, ) = getTotalAmountsOfRewards(tokenId);
        
        if(nbuReward > 0) {
            _withdrawUserRewards(tokenId, nbuReward);
        }

        lpStakingBnbNbu.withdraw(userSupply.NbuBnbStakeNonce);
        swapRouter.removeLiquidityBNB(address(nbuToken), userSupply.NbuBnbLpAmount, 0, 0,  msg.sender, block.timestamp);
        
        lpStakingNbuBusd.withdraw(userSupply.NbuBusdStakeNonce);
        swapRouter.removeLiquidity(address(busdToken), address(nbuToken), userSupply.NbuBusdLpAmount, 0, 0, msg.sender, block.timestamp);
        
        lendingContract.burn(msg.sender, userSupply.LendedITokenAmount);
        
        transferFrom(msg.sender, address(0x1), tokenId);
        userSupply.IsActive = false;
        
        emit BurnSmartLender(tokenId);      
    }



    function getTokenRewardsAmounts(uint tokenId) public view returns (uint lpBnbNbuUserRewards, uint lpNbuBusdUserRewards, uint lendedUserRewards) {
        UserSupply memory userSupply = tikSupplies[tokenId];
        require(userSupply.IsActive, "SmartLender: Not active");
        uint convertITokenToBusd = (userSupply.LendedITokenAmount * lendingContract.tokenPrice()) / 1e18;

        lpBnbNbuUserRewards = (_balancesRewardEquivalentBnbNbu[tokenId] * ((block.timestamp - weightedStakeDate[tokenId]) * 100)) / (100 * rewardDuration);
        lpNbuBusdUserRewards =(_balancesRewardEquivalentNbuBusd[tokenId] * ((block.timestamp - weightedStakeDate[tokenId]) * 100)) / (100 * rewardDuration);
        lendedUserRewards = (convertITokenToBusd > userSupply.LendedBusdAmount) ? (convertITokenToBusd - userSupply.LendedBusdAmount) : 0;
    }
    
    function getTotalAmountsOfRewards(uint tokenId) public view returns (uint nbuReward, uint busdReward) {
        (uint lpBnbNbuUserRewards, uint lpNbuBusdUserRewards, uint rewardsBusd) = getTokenRewardsAmounts(tokenId);
        nbuReward = lpBnbNbuUserRewards + lpNbuBusdUserRewards;
        busdReward = rewardsBusd;
    }
    
    function getUserTokens(address user) public view returns (uint[] memory) {
        return _userTokens[user];
    }

    function _getRequiredTokenValue (uint tokenAmount, address token, address pair) internal returns (uint requiredTokenAmount) {
        (uint112 _reserve0, uint112 _reserve1,) = INimbusPair(address(pair)).getReserves();

        if(address(INimbusPair(address(pair)).token0()) == address(token)) {
            requiredTokenAmount = tokenAmount * (_reserve0/_reserve1);
        } else {
            requiredTokenAmount = tokenAmount * (_reserve1/_reserve0);
        }
      }


    function _withdrawUserRewards(uint tokenId, uint totalNbuReward) private {
        require(totalNbuReward > 0, "SmartLender: Claim not enough");
        if (nbuToken.balanceOf(address(this)) < totalNbuReward) {
            lpStakingBnbNbu.getReward();
            if (nbuToken.balanceOf(address(this)) < totalNbuReward) {
                lpStakingNbuBusd.getReward();
            }

            emit BalanceRewardsNotEnough(msg.sender, tokenId, totalNbuReward);
        }

        TransferHelper.safeTransfer(address(nbuToken), msg.sender, totalNbuReward);
        weightedStakeDate[tokenId] = block.timestamp;

        emit WithdrawRewards(msg.sender, tokenId, totalNbuReward);
    }



    // ========================== EIP 721 functions ==========================

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IBEP165) returns (bool) {
        return
            interfaceId == type(IBEP721).interfaceId ||
            interfaceId == type(IBEP721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function approve(address to, uint256 tokenId) public virtual override {
        address owner = SmartLender.ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }
    
    
    
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }
    
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = SmartLender.ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    function _safeMint(address to, uint256 tokenId, bytes memory _data) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, _data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = SmartLender.ownerOf(tokenId);

        // Clear approvals
        _approve(address(0), tokenId);

        _balances[owner] -= 1;
        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: transfer to the zero address");
        require(SmartLender.ownerOf(tokenId) == from, "ERC721: transfer of token that is not owner");

        for (uint256 i; i < _userTokens[from].length; i++) {
            if(_userTokens[from][i] == tokenId) {
                _remove(i, from);
                break;
            }
        }
        // Clear approvals from the previous owner
        _approve(address(0), tokenId);
        _userTokens[to].push(tokenId);
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _remove(uint index, address tokenOwner) internal virtual {
        _userTokens[tokenOwner][index] = _userTokens[tokenOwner][_userTokens[tokenOwner].length - 1];
        _userTokens[tokenOwner].pop();
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(SmartLender.ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll( address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _checkOnERC721Received(address from, address to,uint256 tokenId, bytes memory _data) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }



    // ========================== Owner functions ==========================

    function rescue(address to, address tokenAddress, uint256 amount) external onlyOwner {
        require(to != address(0), "SmartLP: Cannot rescue to the zero address");
        require(amount > 0, "SmartLP: Cannot rescue 0");

        IBEP20(tokenAddress).transfer(to, amount);
        emit RescueToken(to, address(tokenAddress), amount);
    }

    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "SmartLP: Cannot rescue to the zero address");
        require(amount > 0, "SmartLP: Cannot rescue 0");

        to.transfer(amount);
        emit Rescue(to, amount);
    }

    function updateSwapRouter(address newSwapRouter) external onlyOwner {
        require(Address.isContract(newSwapRouter), "SmartLender: Not a contract");
        swapRouter = IRouter(newSwapRouter);
        emit UpdateSwapRouter(newSwapRouter);
    }
    
    function updateLpStakingBnbNbu(address newLpStaking) external onlyOwner {
        require(Address.isContract(newLpStaking), "SmartLender: Not a contract");
        lpStakingBnbNbu = ILpStaking(newLpStaking);
        emit UpdateLpStakingBnbNbu(newLpStaking);
    }
    
    function updateLpStakingBnbGnbu(address newLpStaking) external onlyOwner {
        require(Address.isContract(newLpStaking), "SmartLender: Not a contract");
        lpStakingNbuBusd = ILpStaking(newLpStaking);
        emit UpdateLpStakingBnbGnbu(newLpStaking);
    }
    
    function updateLendingContract(address newLendingContract) external onlyOwner {
        require(Address.isContract(newLendingContract), "SmartLender: Not a contract");
        lendingContract = ILending(newLendingContract);
        emit UpdateLendingContract(newLendingContract);
    }
    
    function updateTokenAllowance(address token, address spender, int amount) external onlyOwner {
        require(Address.isContract(token), "SmartLender: Not a contract");
        uint allowance;
        if (amount < 0) {
            allowance = type(uint256).max;
        } else {
            allowance = uint256(amount);
        }
        IBEP20(token).approve(spender, allowance);
    }
    
    function updateMinPurchaseAmount (uint newAmount) external onlyOwner {
        require(newAmount > 0, "SmartLender: Amount must be greater than zero");
        minPurchaseAmount = newAmount;
        emit UpdateMinPurchaseAmount(newAmount);
    }
}