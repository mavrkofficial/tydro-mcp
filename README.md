# Tydro MCP Server

MCP server for the [Tydro](https://app.tydro.com) lending protocol on Ink (Aave V3 whitelabel).

All 12 live reserves supported. Contract addresses verified on-chain.

## Supported Assets

| Symbol  | Decimals | Address |
|---------|----------|---------|
| WETH    | 18       | `0x4200000000000000000000000000000000000006` |
| kBTC    | 8        | `0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98` |
| USDT0   | 6        | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| USDG    | 6        | `0xe343167631d89b6ffc58b88d6b7fb0228795491d` |
| GHO     | 18       | `0xfc421ad3c883bf9e7c4f42de845c4e4405799e73` |
| USDC    | 6        | `0x2d270e6886d130d724215a266106e6832161eaed` |
| weETH   | 18       | `0xa3d68b74bf0528fdd07263c60d6488749044914b` |
| wrsETH  | 18       | `0x9f0a74a92287e323eb95c1cd9ecdbeb0e397cae4` |
| ezETH   | 18       | `0x2416092f143378750bb29b79ed961ab195cceea5` |
| sUSDe   | 18       | `0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2` |
| USDe    | 18       | `0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34` |
| SolvBTC | 18       | `0xae4efbc7736f963982aacb17efa37fcbab924cb3` |

## Installation

```bash
npm install
npm run build
```

## Configuration

```bash
# Required: network (mainnet only for now)
export TYDRO_NETWORK=mainnet

# Optional: only needed for write operations (supply/borrow/repay/withdraw)
export PRIVATE_KEY=0x...
```

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "tydro": {
      "command": "node",
      "args": ["/path/to/tydro-mcp/build/index.js"],
      "env": {
        "TYDRO_NETWORK": "mainnet",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Tools

### `get_reserve_data`
Get supply/borrow APYs, liquidity, and utilization for any reserve.
```json
{ "asset": "WETH" }
{ "asset": "kBTC" }
{ "asset": "USDT0" }
```

### `get_user_account`
Get overall health factor, collateral, debt, and borrow capacity.
```json
{ "address": "0x..." }
```

### `get_user_reserve`
Get a user's position for a specific asset (supplied, borrowed, collateral status).
```json
{ "asset": "USDT0", "address": "0x..." }
```

### `supply`
Deposit assets to earn interest. Auto-approves if needed.
```json
{ "asset": "USDT0", "amount": "1000" }
{ "asset": "WETH",  "amount": "0.5"  }
```

### `borrow`
Borrow against collateral. Variable rate only (stable rate deprecated in Aave V3).
```json
{ "asset": "USDT0", "amount": "500" }
```

### `repay`
Repay borrowed assets. Use `"max"` to repay full debt including accrued interest.
```json
{ "asset": "USDT0", "amount": "500"  }
{ "asset": "WETH",  "amount": "max"  }
```

### `withdraw`
Withdraw supplied assets. Use `"max"` to withdraw full aToken balance.
```json
{ "asset": "USDT0", "amount": "max" }
```

## Notes

- **Read-only tools** (`get_reserve_data`, `get_user_account`, `get_user_reserve`) work without `PRIVATE_KEY`
- **Write tools** (`supply`, `borrow`, `repay`, `withdraw`) require `PRIVATE_KEY`
- Approvals are checked before sending — no redundant approval transactions
- Max repay/withdraw uses `type(uint256).max` — Aave caps at actual balance/debt
- Health factor warnings trigger below 1.5 (liquidation threshold is 1.0)
