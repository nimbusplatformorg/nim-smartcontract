pragma solidity 0.5.17;

import "../core/Constants.sol";
import "../openzeppelin/SafeBEP20.sol";


contract VaultController is Constants {
    using SafeBEP20 for IBEP20;

    event VaultDeposit(
        address indexed asset,
        address indexed from,
        uint256 amount
    );
    event VaultWithdraw(
        address indexed asset,
        address indexed to,
        uint256 amount
    );

    function vaultBnbDeposit(
        address from,
        uint256 value)
        internal
    {
        IWbnbBEP20 _wbnbToken = wbnbToken;
        _wbnbToken.deposit.value(value)();

        emit VaultDeposit(
            address(_wbnbToken),
            from,
            value
        );
    }

    function vaultBnbWithdraw(
        address to,
        uint256 value)
        internal
    {
        if (value != 0) {
            IWbnbBEP20 _wbnbToken = wbnbToken;
            uint256 balance = address(this).balance;
            if (value > balance) {
                _wbnbToken.withdraw(value - balance);
            }
            Address.sendValue(to, value);

            emit VaultWithdraw(
                address(_wbnbToken),
                to,
                value
            );
        }
    }

    function vaultDeposit(
        address token,
        address from,
        uint256 value)
        internal
    {
        if (value != 0) {
            IBEP20(token).safeTransferFrom(
                from,
                address(this),
                value
            );

            emit VaultDeposit(
                token,
                from,
                value
            );
        }
    }

    function vaultWithdraw(
        address token,
        address to,
        uint256 value)
        internal
    {
        if (value != 0) {
            IBEP20(token).safeTransfer(
                to,
                value
            );

            emit VaultWithdraw(
                token,
                to,
                value
            );
        }
    }

    function vaultTransfer(
        address token,
        address from,
        address to,
        uint256 value)
        internal
    {
        if (value != 0) {
            if (from == address(this)) {
                IBEP20(token).safeTransfer(
                    to,
                    value
                );
            } else {
                IBEP20(token).safeTransferFrom(
                    from,
                    to,
                    value
                );
            }
        }
    }

    function vaultApprove(
        address token,
        address to,
        uint256 value)
        internal
    {
        if (value != 0 && IBEP20(token).allowance(address(this), to) != 0) {
            IBEP20(token).safeApprove(to, 0);
        }
        IBEP20(token).safeApprove(to, value);
    }
}
