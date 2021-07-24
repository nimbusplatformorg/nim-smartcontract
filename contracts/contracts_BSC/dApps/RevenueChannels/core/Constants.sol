pragma solidity 0.5.17;

import "../interfaces/IWbnbBEP20.sol";


contract Constants {

    uint256 internal constant WEI_PRECISION = 10**18;
    uint256 internal constant WEI_PERCENT_PRECISION = 10**20;

    uint256 internal constant DAYS_IN_A_YEAR = 365;
    uint256 internal constant ONE_MONTH = 2628000; // approx. seconds in a month

    string internal constant UserRewardsID = "UserRewards";
    string internal constant LoanDepositValueID = "LoanDepositValue";

    IWbnbBEP20 public constant wbnbToken = IWbnbBEP20(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    address public constant nbuTokenAddress = 0x5f20559235479F5B6abb40dFC6f55185b74E7b55;
}
