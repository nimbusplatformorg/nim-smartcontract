pragma solidity 0.5.17;

import "../core/State.sol";
import "../interfaces/IBEP20.sol";
import "../feeds/IPriceFeeds.sol";
import "../openzeppelin/SafeBEP20.sol";
import "./ISwapsImpl.sol";

interface INimbusRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract SwapsImplNimbus_BSC is State, ISwapsImpl {
    using SafeBEP20 for IBEP20;

    address public constant nimbusRouter = 0x2C6cF65f3cD32a9Be1822855AbF2321F6F8f6b24;    
    address public constant busd = 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56;

    function dexSwap(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount)
        public
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(sourceTokenAddress != destTokenAddress, "source == dest");
        require(supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress], "invalid tokens");

        IBEP20 sourceToken = IBEP20(sourceTokenAddress);
        address _thisAddress = address(this);

        (sourceTokenAmountUsed, destTokenAmountReceived) = _swapWithNimbus(
            sourceTokenAddress,
            destTokenAddress,
            receiverAddress,
            minSourceTokenAmount,
            maxSourceTokenAmount,
            requiredDestTokenAmount
        );

        if (returnToSenderAddress != _thisAddress && sourceTokenAmountUsed < maxSourceTokenAmount) {
            // send unused source token back
            sourceToken.safeTransfer(
                returnToSenderAddress,
                maxSourceTokenAmount-sourceTokenAmountUsed
            );
        }
    }

    function dexExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount)
        public
        view
        returns (uint256 expectedRate)
    {
        uint256 sourceToDestPrecision = IPriceFeeds(priceFeeds).queryPrecision(
            sourceTokenAddress,
            destTokenAddress
        );
        if (sourceToDestPrecision == 0) {
            return 0;
        }

        (uint256 amountOut,) = dexAmountOut(
            sourceTokenAddress,
            destTokenAddress,
            sourceTokenAmount);
        return amountOut
            .mul(sourceToDestPrecision)
            .div(sourceTokenAmount);
    }

    function dexAmountOut(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 amountIn)
        public
        view
        returns (uint256 amountOut, address midToken)
    {
        if (sourceTokenAddress == destTokenAddress) {
            amountOut = amountIn;
        } else if (amountIn != 0) {
            uint256 tmpValue;

            address[] memory path = new address[](2);
            path[0] = sourceTokenAddress;
            path[1] = destTokenAddress;
            amountOut = _getAmountOut(amountIn, path);

            path = new address[](3);
            path[0] = sourceTokenAddress;
            path[2] = destTokenAddress;
            
            if (sourceTokenAddress != address(wbnbToken) && destTokenAddress != address(wbnbToken)) {
                path[1] = address(wbnbToken);
                tmpValue = _getAmountOut(amountIn, path);
                if (tmpValue > amountOut) {
                    amountOut = tmpValue;
                    midToken = address(wbnbToken);
                }
            }

            if (sourceTokenAddress != busd && destTokenAddress != busd) {
                path[1] = busd;
                tmpValue = _getAmountOut(amountIn, path);
                if (tmpValue > amountOut) {
                    amountOut = tmpValue;
                    midToken = busd;
                }
            }
        }
    }

    function dexAmountIn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 amountOut)
        public
        view
        returns (uint256 amountIn, address midToken)
    {
        if (sourceTokenAddress == destTokenAddress) {
            amountIn = amountOut;
        } else if (amountOut != 0) {
            uint256 tmpValue;

            address[] memory path = new address[](2);
            path[0] = sourceTokenAddress;
            path[1] = destTokenAddress;
            amountIn = _getAmountIn(amountOut, path);

            path = new address[](3);
            path[0] = sourceTokenAddress;
            path[2] = destTokenAddress;
            
            if (sourceTokenAddress != address(wbnbToken) && destTokenAddress != address(wbnbToken)) {
                path[1] = address(wbnbToken);
                tmpValue = _getAmountIn(amountOut, path);
                if (tmpValue < amountIn) {
                    amountIn = tmpValue;
                    midToken = address(wbnbToken);
                }
            }

            if (sourceTokenAddress != busd && destTokenAddress != busd) {
                path[1] = busd;
                tmpValue = _getAmountIn(amountOut, path);
                if (tmpValue < amountIn) {
                    amountIn = tmpValue;
                    midToken = busd;
                }
            }

            if (amountIn == uint256(-1)) {
                amountIn = 0;
            }
        }
    }

    function _getAmountOut(
        uint256 amountIn,
        address[] memory path)
        public
        view
        returns (uint256 amountOut)
    {
        (bool success, bytes memory data) = nimbusRouter.staticcall(
            abi.encodeWithSelector(
                0xd06ca61f, // keccak("getAmountsOut(uint256,address[])")
                amountIn,
                path
            )
        );
        if (success) {
            uint256 len = data.length;
            assembly {
                amountOut := mload(add(data, len)) // last amount value array
            }
        }
    }

    function _getAmountIn(
        uint256 amountOut,
        address[] memory path)
        public
        view
        returns (uint256 amountIn)
    {
        (bool success, bytes memory data) = nimbusRouter.staticcall(
            abi.encodeWithSelector(
                0x1f00ca74, // keccak("getAmountsIn(uint256,address[])")
                amountOut,
                path
            )
        );
        if (success) {
            assembly {
                amountIn := mload(add(data, 96)) // first amount value in array
            }
        }
        if (amountIn == 0) {
            amountIn = uint256(-1);
        }
    }

    function setSwapApprovals(
        address[] memory tokens)
        public
    {
        for (uint256 i = 0; i < tokens.length; i++) {
            IBEP20(tokens[i]).safeApprove(nimbusRouter, 0);
            IBEP20(tokens[i]).safeApprove(nimbusRouter, uint256(-1));
        }
    }

    function _swapWithNimbus(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount)
        internal
        returns (uint256 sourceTokenAmountUsed, uint256 destTokenAmountReceived)
    {
        address midToken;
        if (requiredDestTokenAmount != 0) {
            (sourceTokenAmountUsed, midToken) = dexAmountIn(
                sourceTokenAddress,
                destTokenAddress,
                requiredDestTokenAmount
            );
            if (sourceTokenAmountUsed == 0) {
                return (0, 0);
            }
            require(sourceTokenAmountUsed <= maxSourceTokenAmount, "source amount too high");
        } else {
            sourceTokenAmountUsed = minSourceTokenAmount;
            (destTokenAmountReceived, midToken) = dexAmountOut(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmountUsed
            );
            if (destTokenAmountReceived == 0) {
                return (0, 0);
            }
        }

        address[] memory path;
        if (midToken != address(0)) {
            path = new address[](3);
            path[0] = sourceTokenAddress;
            path[1] = midToken;
            path[2] = destTokenAddress;
        } else {
            path = new address[](2);
            path[0] = sourceTokenAddress;
            path[1] = destTokenAddress;
        }

        uint256[] memory amounts = INimbusRouter(nimbusRouter).swapExactTokensForTokens(
            sourceTokenAmountUsed,
            1, // amountOutMin
            path,
            receiverAddress,
            block.timestamp
        );

        destTokenAmountReceived = amounts[amounts.length - 1];
    }
}
