//SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "./interfaces/IERC20.sol";
import "./interfaces/ISimpleAMM.sol";

/**
 * @title SimpleLender
 * @notice A simplified lending protocol that uses an AMM spot price as its oracle
 * @dev VULNERABLE: Uses SimpleAMM.priceUSDCETH() as the sole price oracle.
 *   Since the AMM's spot price is directly manipulable via large swaps,
 *   an attacker can:
 *   1. Inflate the USDC/ETH price via a large swap
 *   2. Deposit USDC as collateral (now valued at the inflated price)
 *   3. Borrow far more ETH than the real collateral value justifies
 */
contract SimpleLender {
    address public USDCAddress;
    address public ammAddress;
    uint16 public collateralizationRatio;
    mapping(address => uint256) public USDCdeposits;

    constructor(
        address usdc,
        address amm,
        uint16 collat
    ) {
        USDCAddress = usdc;
        ammAddress = amm;
        collateralizationRatio = collat; // in basis points (8000 = 80%)
    }

    function depositUSDC(uint256 amount) external {
        IERC20(USDCAddress).transferFrom(msg.sender, address(this), amount);
        USDCdeposits[msg.sender] += amount;
    }

    /// @notice Gets the USDC/ETH price from the AMM
    /// @dev VULNERABLE: Single-source spot price oracle, easily manipulated
    function getPriceUSDCETH() public view returns (uint256) {
        return ISimpleAMM(ammAddress).priceUSDCETH();
    }

    function maxBorrowAmount() public view returns (uint256) {
        uint256 depositedUSDC = USDCdeposits[msg.sender];
        uint256 equivalentEthValue = (depositedUSDC * getPriceUSDCETH()) / 1e18;
        return (equivalentEthValue * collateralizationRatio) / 10000;
    }

    function borrowETH(uint256 amount) external {
        require(
            amount <= maxBorrowAmount(),
            "amount exceeds max borrow amount"
        );
        (bool success, ) = msg.sender.call{value: amount}(new bytes(0));
        require(success, "Failed to transfer ETH");
    }

    receive() external payable {}
}
