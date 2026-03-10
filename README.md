# tydro-mcp

MCP server for the [Tydro](https://app.tydro.com) lending protocol on [Ink](https://inkonchain.com) — an Aave V3 whitelabel.

Gives any MCP-compatible AI agent (Claude Desktop, Cursor, Codex, OpenClaw, etc.) live read/write access to all 12 Tydro reserves: rates, positions, health factors, and full execution.

---

## Supported Assets

| Symbol  | Decimals | Contract Address |
|---------|:--------:|------------------|
| WETH    | 18 | `0x4200000000000000000000000000000000000006` |
| kBTC    | 8  | `0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98` |
| USDT0   | 6  | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| USDG    | 6  | `0xe343167631d89b6ffc58b88d6b7fb0228795491d` |
| GHO     | 18 | `0xfc421ad3c883bf9e7c4f42de845c4e4405799e73` |
| USDC    | 6  | `0x2d270e6886d130d724215a266106e6832161eaed` |
| weETH   | 18 | `0xa3d68b74bf0528fdd07263c60d6488749044914b` |
| wrsETH  | 18 | `0x9f0a74a92287e323eb95c1cd9ecdbeb0e397cae4` |
| ezETH   | 18 | `0x2416092f143378750bb29b79ed961ab195cceea5` |
| sUSDe   | 18 | `0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2` |
| USDe    | 18 | `0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34` |
| SolvBTC | 18 | `0xae4efbc7736f963982aacb17efa37fcbab924cb3` |

Pass assets by symbol (`WETH`, `USDT0`) or raw contract address.

---

## Installation

```bash
npx tydro-mcp
```

Or clone and build:

```bash
git clone https://github.com/mavrkofficial/tydro-mcp.git
cd tydro-mcp
npm install && npm run build
node build/index.js
```

---

## Configuration

```bash
# Optional: custom RPC (defaults to https://rpc-gel.inkonchain.com)
export TYDRO_RPC=https://rpc-gel.inkonchain.com

# Required for write tools (supply/borrow/repay/withdraw)
export PRIVATE_KEY=0x...
```

---

## Claude Desktop

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

---

## Tools

### Read-only — no private key required

#### `get_reserve_data`
Live market data for any reserve: supply APY, borrow APY, total liquidity, total debt, available liquidity, and utilization rate.

```json
{ "asset": "WETH" }
{ "asset": "kBTC" }
{ "asset": "0x0200C29006150606B650577BBE7B6248F58470c1" }
```

**Returns:**
```json
{
  "asset": "WETH",
  "supplyAPY": "2.14%",
  "variableBorrowAPY": "3.87%",
  "totalSupplied": "1482.33",
  "totalVariableDebt": "610.17",
  "availableLiquidity": "872.16",
  "utilizationRate": "41.17%",
  "lastUpdated": "2026-03-10T20:00:00.000Z"
}
```

---

#### `get_user_account`
Full position overview for any wallet: collateral value, debt, available borrow capacity, health factor, and liquidation status.

```json
{ "address": "0xYourWalletAddress" }
```

**Returns:**
```json
{
  "address": "0x...",
  "totalCollateral": "$4820.00",
  "totalDebt": "$1200.00",
  "availableToBorrow": "$1250.00",
  "healthFactor": "2.8731",
  "status": "✅ Healthy",
  "ltv": "80.00%",
  "liquidationThreshold": "82.50%"
}
```

---

#### `get_user_reserve`
Position in a specific reserve for any wallet: amount supplied, amount borrowed, collateral flag, and current market APYs.

```json
{ "asset": "USDT0", "address": "0xYourWalletAddress" }
```

**Returns:**
```json
{
  "asset": "USDT0",
  "supplied": "5000.00",
  "variableDebt": "0.00",
  "stableDebt": "0.00",
  "usedAsCollateral": true,
  "marketSupplyAPY": "4.21%",
  "marketVariableBorrowAPY": "6.83%",
  "activeBorrowType": "none"
}
```

---

### Write — requires `PRIVATE_KEY`

#### `supply`
Deposit an asset into Tydro to earn interest. ERC20 approval is checked and submitted automatically if needed.

```json
{ "asset": "WETH",  "amount": "1.5"    }
{ "asset": "USDT0", "amount": "5000"   }
{ "asset": "kBTC",  "amount": "0.01"   }
```

---

#### `borrow`
Borrow an asset against your deposited collateral. Variable rate only (stable rate deprecated in Aave V3).

```json
{ "asset": "USDT0", "amount": "1000" }
{ "asset": "GHO",   "amount": "500"  }
```

---

#### `repay`
Repay borrowed assets. Pass `"max"` to repay the full debt balance including accrued interest. Auto-approves ERC20.

```json
{ "asset": "USDT0", "amount": "500" }
{ "asset": "WETH",  "amount": "max" }
```

---

#### `withdraw`
Withdraw previously supplied assets. Pass `"max"` to withdraw your entire aToken balance.

```json
{ "asset": "USDT0", "amount": "2000" }
{ "asset": "WETH",  "amount": "max"  }
```

---

## Example Prompts

These work out of the box with Claude Desktop or any MCP-compatible agent.

### Yield comparison across all assets
> "What are the current supply APYs for WETH, USDT0, sUSDe, and GHO on Tydro? Rank them best to worst."

### Safe borrow sizing
> "I want to supply 2 WETH to Tydro and borrow USDT0 against it. What's the current WETH supply APY, what's the USDT0 borrow APY, and how much USDT0 can I safely borrow while keeping my health factor above 2.0?"

### Wallet health check
> "Check this wallet's Tydro health factor and tell me if it's at liquidation risk: `0x...`"

### Full position audit
> "Give me a complete breakdown of this wallet's Tydro positions — every asset they've supplied and borrowed, their health factor, and how close they are to liquidation: `0x...`"

### Rate arbitrage scout
> "Compare Tydro's USDT0 and USDC borrow APYs. Which is cheaper to borrow right now, and what's the spread?"

### Liquidation monitor
> "Check these three wallets on Tydro and flag any with a health factor below 1.5: `0x...`, `0x...`, `0x...`"

---

## Notes

- **Decimals are asset-specific** — kBTC is 8, USDT0/USDC/USDG are 6, everything else is 18. The server handles conversion automatically.
- **Max repay / max withdraw** uses `type(uint256).max` — Aave caps at actual balance/debt on-chain, so you never over-repay or over-withdraw.
- **Health factor of ∞** means no debt — the wallet is fully collateralized with no borrows open.
- **Liquidation threshold is 1.0** — health factor below 1.0 means the position can be liquidated. Below 1.5 is the warning zone.
- **No stable rate** — Aave V3 deprecated stable rate borrowing. All borrows are variable.

---

## Contracts (Ink Mainnet)

| Contract | Address |
|----------|---------|
| Pool (Aave V3) | `0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA` |
| PoolDataProvider | `0x96086C25d13943C80Ff9a19791a40Df6aFC08328` |

---

## License

MIT
