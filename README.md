# Oracle Manipulation Attack Demo

[![Solidity](https://img.shields.io/badge/Solidity-0.8.13-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-Testing-yellow)](https://hardhat.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built in](https://img.shields.io/badge/Built%20in-2025-blue)](https://github.com/yuzgecoguz/oracle-manipulation-attack-demo)

> End-to-end demonstration of a flash loan oracle manipulation attack on a DeFi lending protocol, with full Hardhat test suite. Developed in **2025** as part of MSc Cyber Security research.

## The Attack: 2 ETH In, 4.8 ETH Out

This project demonstrates how an attacker can exploit a lending protocol that uses a shallow-liquidity AMM as its price oracle. By manipulating the spot price through a large swap, the attacker can overborrow and extract **2.8 ETH profit** from a single transaction.

## Attack Flow

```
                    BEFORE ATTACK                          AFTER ATTACK
              ┌─────────────────────┐              ┌─────────────────────┐
   AMM Pool   │  1 ETH  +  3000 USDC│   AMM Pool   │  3 ETH  +  1000 USDC│
              │  Price: 1 USDC =     │              │  Price: 1 USDC =     │
              │  0.00033 ETH         │              │  0.003 ETH (9x!)     │
              └─────────────────────┘              └─────────────────────┘

Step 1: Flash Loan 2 ETH
         │
         ▼
Step 2: Swap 2 ETH → 2000 USDC in AMM
        (Price impact: USDC/ETH inflated 9x)
         │
         ▼
Step 3: Deposit 2000 USDC as collateral
        (Valued at manipulated price: 2000 * 0.003 = 6 ETH worth!)
         │
         ▼
Step 4: Borrow 4.8 ETH (80% of 6 ETH collateral value)
        (Fair value would only allow ~0.53 ETH)
         │
         ▼
Step 5: Repay 2 ETH flash loan
         │
         ▼
    ✅ NET PROFIT: 2.8 ETH
```

## Contracts

| Contract | Purpose |
|----------|---------|
| `SimpleAMM.sol` | Constant-product AMM (x * y = k) — the vulnerable price oracle |
| `SimpleLender.sol` | Lending protocol using AMM spot price as oracle |
| `Attacker.sol` | Single-transaction attack contract |
| `TestUSDC.sol` | Mock ERC20 token for testing |

## Quick Start

### Prerequisites

- Node.js >= 14.x
- npm or yarn

### Setup & Run Tests

```bash
# Clone the repository
git clone https://github.com/yuzgecoguz/oracle-manipulation-attack-demo.git
cd oracle-manipulation-attack-demo

# Install dependencies
npm install

# Run the test suite
npx hardhat test
```

### Expected Output

```
Oracle Manipulation Attack
  ✓ Should perform basic AMM swap correctly
  ✓ Should calculate and borrow max amount correctly
  ✓ Should execute oracle manipulation attack (multi-tx breakdown)
  ✓ Should execute oracle manipulation attack (single-tx flash loan)

4 passing
```

## Test Scenarios

### 1. Basic AMM Swap
Verifies the constant-product AMM works correctly with proper price calculations.

### 2. Normal Borrow Flow
At fair market price (1 ETH = 3000 USDC), depositing 3000 USDC as collateral allows borrowing ~0.8 ETH (80% collateralization ratio).

### 3. Multi-Transaction Attack (Step-by-Step)
Breaks down the attack into individual transactions for educational clarity:
- Flash loan simulation → AMM swap → Collateral deposit → Overborrow → Repay → Profit

### 4. Single-Transaction Attack (Atomic)
The same attack executed atomically through the `Attacker.sol` contract, demonstrating how flash loans enable risk-free exploitation.

## Why This Works

The vulnerability exists because the lending protocol reads the AMM's **spot price** as its oracle:

```solidity
// SimpleLender.sol — vulnerable oracle call
function getPriceUSDCETH() public view returns (uint256) {
    return ISimpleAMM(ammAddress).priceUSDCETH(); // Single-source spot price!
}
```

A single large swap in a shallow-liquidity pool can move the spot price dramatically, and the lending protocol has no protection against this.

## Defense Mechanisms

| Defense | How It Works |
|---------|-------------|
| **TWAP Oracle** | Uses time-weighted average price over multiple blocks, making single-block manipulation impractical |
| **Chainlink Price Feeds** | Decentralized oracle network aggregating data from multiple sources |
| **Minimum Liquidity Threshold** | Reject price data from pools below a certain liquidity level |
| **Price Deviation Circuit Breaker** | Pause operations if oracle price deviates >X% from a reference |
| **Multi-Source Aggregation** | Combine prices from multiple independent AMMs/oracles |

## Real-World Incidents

| Protocol | Date | Loss | Attack Vector |
|----------|------|------|--------------|
| Mango Markets | Oct 2022 | ~$114M | Oracle price manipulation via thin markets |
| Harvest Finance | Oct 2020 | ~$34M | Flash loan oracle manipulation on Curve |
| bZx Protocol | Feb 2020 | ~$8M | Flash loan + oracle manipulation |
| Cream Finance | Oct 2021 | ~$130M | Flash loan price manipulation |

## Project Structure

```
oracle-manipulation-attack-demo/
├── contracts/
│   ├── Attacker.sol              # Attack contract
│   ├── SimpleAMM.sol             # Vulnerable AMM (price oracle)
│   ├── SimpleLender.sol          # Vulnerable lending protocol
│   ├── TestUSDC.sol              # Mock ERC20 token
│   └── interfaces/
│       ├── IERC20.sol
│       ├── ISimpleAMM.sol
│       └── ISimpleLender.sol
├── test/
│   ├── OracleAttack.test.js      # Full test suite
│   └── utils.js                  # Helper functions
├── scripts/
│   └── deploy.js                 # Deployment script
├── hardhat.config.js
└── package.json
```

## Related

- [ethereum-smart-contract-security-audit](https://github.com/yuzgecoguz/ethereum-smart-contract-security-audit) — Comprehensive benchmark of 5 vulnerability detection tools

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**Oguzhan Yuzgec** — MSc Cyber Security, Hoca Ahmet Yesevi International University

- GitHub: [@yuzgecoguz](https://github.com/yuzgecoguz)
- LinkedIn: [oguzhan-yuzgec](https://www.linkedin.com/in/oguzhan-yuzgec-a72988182/)
