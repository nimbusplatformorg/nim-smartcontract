/**
 *Submitted for verification at Etherscan.io on 2020-11-20
*/

pragma solidity 0.7.5;

// "SPDX-License-Identifier: MIT"

library SafeMath {
    function add(uint a, uint b) internal pure returns (uint c) { c = a + b; require(c >= a); }
    function sub(uint a, uint b) internal pure returns (uint c) { require(a >= b); c = a - b; }
    function mul(uint a, uint b) internal pure returns (uint c) { c = a * b; require(a == 0 || c / a == b); }
    function div(uint a, uint b) internal pure returns (uint c) { require(b > 0); c = a / b; }
}

abstract contract Interface {
    function getAmountsOut(uint amountIn, address[] calldata path) public virtual view returns (uint[] memory amounts);
}

abstract contract Token {
    function tokensBurner(uint96 tokens) public virtual returns (bool success);
}

contract Owned {
    address public owner;
    address public newOwner;
    address public NUSITERATOR;
    
    event OwnershipTransferred(address indexed from, address indexed to);
    
    constructor() {
        owner = NUSITERATOR = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }
    
    function transferOwnership(address transferOwner) public onlyOwner {
        require(transferOwner != newOwner);
        newOwner = transferOwner;
    }

    function acceptOwnership() public {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}

contract NUS_WETH is Owned {
    using SafeMath for uint;
    string public name     = "Nimbus Wrapped Ether";
    string public symbol   = "NWETH";
    uint8  public decimals = 18;

    event  Approval(address indexed src, address indexed guy, uint wad);
    event  Transfer(address indexed src, address indexed dst, uint wad);
    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    mapping (address => uint)                       public  balanceOf;
    mapping (address => mapping (address => uint))  public  allowance;
    
    receive() payable external {
        deposit();
    }
    
    function deposit() public payable {
        balanceOf[msg.sender] = balanceOf[msg.sender].add(msg.value);
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(wad);
        msg.sender.transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    function totalSupply() public view returns (uint) {
        return address(this).balance;
    }

    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        require(balanceOf[src] >= wad);
        if (src != msg.sender && allowance[src][msg.sender] != uint(-1)) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] = balanceOf[src].sub(wad);
        balanceOf[dst] = balanceOf[dst].add(wad);
        emit Transfer(src, dst, wad);
        return true;
    }
    
    ////

    uint public outAmount;
    address public SWAPROUTER    = 0x249B4A10DfDeBbA9Dca4fD071D17821364Cbffc8;
    address public NUSTOKEN      = 0x7369C4Dba15bbd2d492609Da6a2ECB3242f34020;
    address public NUSWETH       = address(this);
    
    function changeAddr(address swap, address token) public onlyOwner returns (bool success)  {
        SWAPROUTER = swap;
        NUSTOKEN = token;
        return true;
    }
    
    function changeIterator(address iterator) public onlyOwner returns (bool success)  {
        NUSITERATOR = iterator;
        return true;
    }
    
    modifier onlyIterator {
        require(msg.sender == NUSITERATOR);
        _;
    }
    
    function totalOut() public view returns (uint) {
        return outAmount;
    }
    
    function availableOut() public view returns (uint) {
        require((address(this).balance.add(outAmount)).div(8) > outAmount, '0');
        return (address(this).balance.add(outAmount)).div(8).sub(outAmount);
    }
  
    function getOut(uint Amount) public onlyIterator returns (bool success) {
        require((address(this).balance.add(outAmount)).div(8) >= Amount.add(outAmount), 'TOO MUCH');
        outAmount = outAmount.add(Amount);
        (bool succ, ) = payable(msg.sender).call{value: Amount}(abi.encodeWithSignature("transfer()"));
        require(succ, "Transfer failed.");
        uint toBurn = getEstimatedTOKENforETH(Amount)[1];
        Token(NUSTOKEN).tokensBurner(uint96(toBurn));
        return true;
    }
    
    function getOut125() public onlyOwner returns (bool success) {
        require((address(this).balance.add(outAmount)).div(8) > outAmount, '0');
        uint Amount = (address(this).balance.add(outAmount)).div(8).sub(outAmount);
        outAmount = outAmount.add(Amount);
        (bool succ, ) = payable(msg.sender).call{value: Amount}("");
        require(succ, "Transfer failed.");
        uint toBurn = getEstimatedTOKENforETH(Amount)[1];
        Token(NUSTOKEN).tokensBurner(uint96(toBurn));
        return true;
    }
  
    function getIn() public payable returns (bool success) {
        require(msg.value > 0 && outAmount >= msg.value);
        outAmount = outAmount.sub(msg.value);
        return true;
    }
  
    function getEstimatedTOKENforETH(uint ethAmount) public view returns (uint[] memory) {
        return Interface(SWAPROUTER).getAmountsOut(ethAmount, getPathForWETHtoTOKEN());
    }

    function getPathForWETHtoTOKEN() private view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = NUSWETH;
        path[1] = NUSTOKEN;
        return path;
    }
    
}