pragma solidity =0.8.0;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IERC20WithPermit { 
    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;
}

interface IBurnable is IERC20, IERC20WithPermit {
    function burnTokens(uint96 _tokens) external returns (bool success);
}

contract Ownable {
    address public owner;
    address public newOwner;

    event OwnershipTransferred(address indexed from, address indexed to);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
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

contract NbuTokenExchanger is Ownable {
    IBurnable public immutable legacyNbu;
    IERC20 public immutable updatedNbu;

    event Exchange(address owner, uint amout);

    constructor(address legacyToken, address updatedToken) {
        legacyNbu = IBurnable(legacyToken);
        updatedNbu = IERC20(updatedToken);
    }

    function exchange(uint amount) external {
        legacyNbu.transferFrom(msg.sender, address(this), amount);
        updatedNbu.transfer(msg.sender, amount);
        legacyNbu.burnTokens(uint96(amount));
        emit Exchange(msg.sender, amount);
    }

    function exchangeWithPermit(uint amount, uint deadline, uint8 v, bytes32 r, bytes32 s) external {
        legacyNbu.permit(msg.sender, address(this), amount, deadline, v, r, s);
        legacyNbu.transferFrom(msg.sender, address(this), amount);
        updatedNbu.transfer(msg.sender, amount);
        legacyNbu.burnTokens(uint96(amount));
        emit Exchange(msg.sender, amount);
    }

    function availableForExchange() external view returns (uint) {
        return updatedNbu.balanceOf(address(this));
    }

    function withdrawTokens(address recipient) external onlyOwner {
        uint amount = updatedNbu.balanceOf(address(this));
        updatedNbu.transfer(recipient, amount);
    }
}