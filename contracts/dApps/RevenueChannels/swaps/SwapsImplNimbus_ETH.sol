pragma solidity 0.5.17;

import "../core/State.sol";
import "../feeds/IPriceFeeds.sol";
import "../openzeppelin/SafeERC20.sol";
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

contract SwapsImplNimbus_ETH is State, ISwapsImpl {
    using SafeERC20 for IERC20;

    // mainnet
    address public constant nimbusRouter = 0x05F6BB6b96ca657a3666d2f1bCA302b999a671b4;
    address public constant usdt = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

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

        IERC20 sourceToken = IERC20(sourceTokenAddress);
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
            
            if (sourceTokenAddress != address(wethToken) && destTokenAddress != address(wethToken)) {
                path[1] = address(wethToken);
                tmpValue = _getAmountOut(amountIn, path);
                if (tmpValue > amountOut) {
                    amountOut = tmpValue;
                    midToken = address(wethToken);
                }
            }

            if (sourceTokenAddress != usdt && destTokenAddress != usdt) {
                path[1] = usdt;
                tmpValue = _getAmountOut(amountIn, path);
                if (tmpValue > amountOut) {
                    amountOut = tmpValue;
                    midToken = usdt;
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
            
            if (sourceTokenAddress != address(wethToken) && destTokenAddress != address(wethToken)) {
                path[1] = address(wethToken);
                tmpValue = _getAmountIn(amountOut, path);
                if (tmpValue < amountIn) {
                    amountIn = tmpValue;
                    midToken = address(wethToken);
                }
            }

            if (sourceTokenAddress != usdt && destTokenAddress != usdt) {
                path[1] = usdt;
                tmpValue = _getAmountIn(amountOut, path);
                if (tmpValue < amountIn) {
                    amountIn = tmpValue;
                    midToken = usdt;
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
            IERC20(tokens[i]).safeApprove(nimbusRouter, 0);
            IERC20(tokens[i]).safeApprove(nimbusRouter, uint256(-1));
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
