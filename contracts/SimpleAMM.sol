//SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "./interfaces/IERC20.sol";

/**
 * @title SimpleAMM
 * @notice A simplified Automated Market Maker (constant product formula: x * y = k)
 * @dev This AMM is intentionally vulnerable to price manipulation due to:
 *   - No TWAP (Time-Weighted Average Price) mechanism
 *   - No minimum liquidity requirements
 *   - Spot price directly used by external consumers (lending protocols)
 *
 *   A large swap in a shallow-liquidity pool drastically moves the spot price,
 *   which can be exploited by protocols using this AMM as a price oracle.
 */
contract SimpleAMM {
    address public USDCAddress;

    constructor(address USDC) {
        USDCAddress = USDC;
    }

    function balanceETH() public view returns (uint256) {
        return address(this).balance;
    }

    function balanceUSDC() public view returns (uint256) {
        return IERC20(USDCAddress).balanceOf(address(this));
    }

    /// @notice Returns the spot price of USDC in terms of ETH
    /// @dev VULNERABLE: This spot price is directly manipulable via large swaps
    function priceUSDCETH() external view returns (uint256) {
        return ((balanceETH() * 1e18) / balanceUSDC());
    }

    function priceETHUSDC() external view returns (uint256) {
        return (balanceUSDC() / balanceETH()) * 1e18;
    }

    function getEstimatedEthForUSDC(uint256 amountFrom)
        public
        view
        returns (uint256)
    {
        return (balanceETH() * amountFrom) / (balanceUSDC() + amountFrom);
    }

    function getEstimatedUSDCForEth(uint256 amountFrom)
        public
        view
        returns (uint256)
    {
        return (balanceUSDC() * amountFrom) / (balanceETH() + amountFrom);
    }

    function swap(address fromToken, uint256 amountFrom)
        external
        payable
        returns (uint256)
    {
        uint256 ethBalance = balanceETH();
        uint256 usdcBalance = balanceUSDC();

        uint256 toAmount;
        if (fromToken == USDCAddress) {
            toAmount = (ethBalance * amountFrom) / (usdcBalance + amountFrom);
            IERC20(USDCAddress).transferFrom(
                msg.sender,
                address(this),
                amountFrom
            );
            (bool success, ) = msg.sender.call{value: toAmount}(new bytes(0));
            require(success, "Failed to transfer ETH");
        } else {
            toAmount = (usdcBalance * amountFrom) / (ethBalance);
            require(
                msg.value == amountFrom,
                "amountFrom does not match eth sent"
            );
            IERC20(USDCAddress).transfer(msg.sender, toAmount);
        }
        return toAmount;
    }

    receive() external payable {}
}
