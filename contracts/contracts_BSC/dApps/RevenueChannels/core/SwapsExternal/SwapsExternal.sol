pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../core/State.sol";
import "../../mixins/VaultController.sol";
import "../../swaps/SwapsUser.sol";
import "../../swaps/ISwapsImpl.sol";
import "../../gastoken/GasTokenUser.sol";


contract SwapsExternal is State, VaultController, SwapsUser, GasTokenUser {

    function initialize(
        address target)
        external
        onlyOwner
    {
        _setTarget(this.swapExternal.selector, target);
        _setTarget(this.swapExternalWithGasToken.selector, target);
        _setTarget(this.getSwapExpectedReturn.selector, target);
    }

    function swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bytes memory swapData)
        public
        payable
        nonReentrant
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        return _swapExternal(
            sourceToken,
            destToken,
            receiver,
            returnToSender,
            sourceTokenAmount,
            requiredDestTokenAmount,
            swapData
        );
    }

    function swapExternalWithGasToken(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        address gasTokenUser,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bytes calldata swapData)
        external
        payable
        usesGasToken(gasTokenUser)
        nonReentrant
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        return _swapExternal(
            sourceToken,
            destToken,
            receiver,
            returnToSender,
            sourceTokenAmount,
            requiredDestTokenAmount,
            swapData
        );
    }

    function _swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bytes memory swapData)
        internal
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(sourceTokenAmount != 0, "sourceTokenAmount == 0");

        if (msg.value != 0) {
            if (sourceToken == address(0)) {
                sourceToken = address(wbnbToken);
            } else {
                require(sourceToken == address(wbnbToken), "sourceToken mismatch");
            }
            require(msg.value == sourceTokenAmount, "sourceTokenAmount mismatch");
            wbnbToken.deposit.value(sourceTokenAmount)();
        } else {
            IBEP20 sourceTokenContract = IBEP20(sourceToken);

            uint256 balanceBefore = sourceTokenContract.balanceOf(address(this));

            sourceTokenContract.safeTransferFrom(
                msg.sender,
                address(this),
                sourceTokenAmount
            );

            // explicit balance check so that we can support deflationary tokens
            sourceTokenAmount = sourceTokenContract.balanceOf(address(this))
                .sub(balanceBefore);
        }

        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall(
            [
                sourceToken,
                destToken,
                receiver,
                returnToSender,
                msg.sender // user
            ],
            [
                sourceTokenAmount, // minSourceTokenAmount
                sourceTokenAmount, // maxSourceTokenAmount
                requiredDestTokenAmount
            ],
            0, // loanId (not tied to a specific loan)
            false, // bypassFee
            swapData
        );

        emit ExternalSwap(
            msg.sender, // user
            sourceToken,
            destToken,
            sourceTokenAmountUsed,
            destTokenAmountReceived
        );
    }

    function getSwapExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount)
        external
        view
        returns (uint256)
    {
        return _swapsExpectedReturn(
            sourceToken,
            destToken,
            sourceTokenAmount
        );
    }
}