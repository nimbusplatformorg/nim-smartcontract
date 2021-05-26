pragma solidity 0.5.17;

import "../PriceFeeds.sol";


contract PriceFeedsLocal is PriceFeeds {

    mapping (address => mapping (address => uint256)) public rates;

    function _getFastGasPrice()
        internal
        view
        returns (uint256 gasPrice)
    {
        return 10 * 10**9;
    }

    function _queryRate(
        address sourceToken,
        address destToken)
        internal
        view
        returns (uint256 rate, uint256 precision)
    {
        if (sourceToken == destToken) {
            rate = WEI_PRECISION;
            precision = WEI_PRECISION;
        } else {
            if (rates[sourceToken][destToken] != 0) {
                rate = rates[sourceToken][destToken];
            } else {
                uint256 sourceToBnb = rates[sourceToken][address(wbnbToken)] != 0 ?
                    rates[sourceToken][address(wbnbToken)] :
                    WEI_PRECISION;
                uint256 bnbToDest = rates[address(wbnbToken)][destToken] != 0 ?
                    rates[address(wbnbToken)][destToken] :
                    WEI_PRECISION;

                rate = sourceToBnb.mul(bnbToDest).div(WEI_PRECISION);
            }
            precision = _getDecimalPrecision(sourceToken, destToken);
        }
    }


    function setRates(
        address sourceToken,
        address destToken,
        uint256 rate)
        public
    {
        if (sourceToken != destToken) {
            rates[sourceToken][destToken] = rate;
            rates[destToken][sourceToken] = SafeMath.div(10**36, rate);
        }
    }
}