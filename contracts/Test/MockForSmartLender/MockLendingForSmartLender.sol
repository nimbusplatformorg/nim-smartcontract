pragma solidity =0.8.0;

library TransferHelper {
    function safeApprove(
        address token,
        address to,
        uint256 value
    ) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x095ea7b3, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: APPROVE_FAILED"
        );
    }

    function safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: TRANSFER_FAILED"
        );
    }

    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: TRANSFER_FROM_FAILED"
        );
    }

    function safeTransferBNB(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "TransferHelper: BNB_TRANSFER_FAILED");
    }
}

library Address {
    function isContract(address account) internal view returns (bool) {
        // This method relies in extcodesize, which returns 0 for contracts in construction,
        // since the code is only stored at the end of the constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}

library SafeBEP20 {
    using Address for address;

    function safeTransfer(
        IBEP20 token,
        address to,
        uint256 value
    ) internal {
        callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transfer.selector, to, value)
        );
    }

    function safeTransferFrom(
        IBEP20 token,
        address from,
        address to,
        uint256 value
    ) internal {
        callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transferFrom.selector, from, to, value)
        );
    }

    function safeApprove(
        IBEP20 token,
        address spender,
        uint256 value
    ) internal {
        require(
            (value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeBEP20: approve from non-zero to non-zero allowance"
        );
        callOptionalReturn(
            token,
            abi.encodeWithSelector(token.approve.selector, spender, value)
        );
    }

    function safeIncreaseAllowance(
        IBEP20 token,
        address spender,
        uint256 value
    ) internal {
        uint256 newAllowance = token.allowance(address(this), spender) + value;
        callOptionalReturn(
            token,
            abi.encodeWithSelector(
                token.approve.selector,
                spender,
                newAllowance
            )
        );
    }

    function safeDecreaseAllowance(
        IBEP20 token,
        address spender,
        uint256 value
    ) internal {
        uint256 newAllowance = token.allowance(address(this), spender) - value;
        callOptionalReturn(
            token,
            abi.encodeWithSelector(
                token.approve.selector,
                spender,
                newAllowance
            )
        );
    }

    function callOptionalReturn(IBEP20 token, bytes memory data) private {
        require(address(token).isContract(), "SafeBEP20: call to non-contract");

        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeBEP20: low-level call failed");

        if (returndata.length > 0) {
            require(
                abi.decode(returndata, (bool)),
                "SafeBEP20: BEP20 operation did not succeed"
            );
        }
    }
}

interface IBEP20 {
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    function name() external view returns (string memory);

    function decimals() external view returns (uint8);

    function symbol() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function balanceOf(address owner) external view returns (uint256);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transfer(address to, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

contract MockLendingforSmartLender {
    using SafeBEP20 for IBEP20;
    address public immutable BUSD;
    address public immutable I_TOKEN;
    address public immutable OWNER;
    uint256 public price = 1;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "NimbusRouter: EXPIRED");
        _;
    }

    constructor(
        address _BUSD,
        address _I_TOKEN,
        address _OWNER
    ) {
        BUSD = _BUSD;
        I_TOKEN = _I_TOKEN;
        OWNER = _OWNER;
        // price = 1;
    }

    receive() external payable {
        assert(msg.sender == OWNER);
    }

    function mintWithBnb(address receiver)
        external
        payable
        returns (uint256 mintAmount)
    {
        IBEP20(I_TOKEN).approve(receiver, type(uint256).max);
        IBEP20(I_TOKEN).transfer(receiver, 1000000000000000000);
        mintAmount = 1000000000000000000;
        return mintAmount;
    }

    function mint(address receiver, uint256 depositAmount)
        external
        returns (
            uint256 // mintAmount
        )
    {
        IBEP20(I_TOKEN).approve(receiver, type(uint256).max);
        IBEP20(I_TOKEN).transfer(receiver, 500000000000000000000);
        return 500000000000000000000;
    }

    function tokenPrice() public view returns (uint256) {
        // uint price = 0;

        return price;
    }

    function setTokenPrice(uint256 newPrice) external {
        price = newPrice;
    }

    function burnToBnb(address receiver, uint256 burnAmount)
        external
        returns (uint256 loanAmountPaid)
    {
        IBEP20(I_TOKEN).approve(receiver, type(uint256).max);
        IBEP20(I_TOKEN).transfer(receiver, 1000000000000000000);
    }

    function burn(address receiver, uint256 burnAmount)
        external
        returns (uint256 loanAmountPaid)
    {
        IBEP20(I_TOKEN).approve(receiver, type(uint256).max);
        IBEP20(I_TOKEN).transfer(receiver, 500000000000000000000);
    }
}
