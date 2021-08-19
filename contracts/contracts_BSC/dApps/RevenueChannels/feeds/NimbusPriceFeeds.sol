pragma solidity 0.5.17;

import "../openzeppelin/Ownable.sol";
import "./IPriceFeedsExt.sol";

contract NimbusPriceFeed is IPriceFeedsExt, Ownable {
    
    int256 private _latestRate;
    uint256 private _lastUpdateTimestamp;
    
    function setLatestAnswer(int256 rate) external onlyOwner {
        _lastUpdateTimestamp = block.timestamp;
        _latestRate = rate;
    }
    
    function lastUpdateTimestamp() external view returns (uint256) {
        return _lastUpdateTimestamp;
    } 
    
    function latestAnswer() external view returns (int256) {
        return _latestRate;
    }
}