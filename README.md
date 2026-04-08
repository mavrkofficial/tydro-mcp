# tydro-mcp

![version](https://img.shields.io/npm/v/tydro-mcp?color=blue)
![license](https://img.shields.io/npm/l/tydro-mcp?color=green)

**The Tydro lending protocol MCP server** — gives any MCP-compatible AI agent (Claude Code, Cursor, Claude Desktop, Windsurf, VS Code, OpenClaw, etc.) live read + write access to all 12 [Tydro](https://app.tydro.com) reserves on [Ink](https://inkonchain.com). Tydro is an Aave V3 whitelabel, so everything you know about Aave V3 lending works here: supply, borrow, repay, withdraw, health factors, liquidation thresholds, variable-rate debt.

Part of the **Ink agent tooling stack** alongside [`inkonchain-mcp`](https://www.npmjs.com/package/inkonchain-mcp) and [`@nadohq/nado-mcp`](https://www.npmjs.com/package/@nadohq/nado-mcp):

```
┌─────────────────────────────────────────────────────────────┐
│                  Ink Agent Tooling Stack                    │
├─────────────────┬──────────────────┬────────────────────────┤
│  inkonchain-mcp │   tydro-mcp      │   @nadohq/nado-mcp     │
│                 │                  │                        │
│  Sentry / Tsu-  │  Tydro lending   │  NADO perpetuals +     │
│  nami / ZNS /   │  (Aave V3 on     │  spot DEX (Vertex on   │
│  ERC-8004 /     │  Ink) — this     │  Ink)                  │
│  DailyGM /      │  package         │                        │
│  Relay / utils  │                  │                        │
└─────────────────┴──────────────────┴────────────────────────┘
```

Install any combination. The three MCPs are designed to coexist with zero tool name collisions — install all three and your agent gets the full Ink DeFi surface area in one session.

> [!CAUTION]
> Experimental software. Interacts with the live Tydro lending pool on the Ink blockchain and can execute real financial transactions including supplies, borrows, repays, and withdrawals. Read the [Security](#security--key-management) section before using with real funds or AI agents.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Tool Catalog](#tool-catalog)
- [Supported Assets](#supported-assets)
- [MCP Client Setup](#mcp-client-setup)
- [HTTP/SSE Transport](#httpsse-transport)
- [Security & Key Management](#security--key-management)
- [Environment Variables](#environment-variables)
- [Example Prompts](#example-prompts)
- [Notes](#notes)
- [Contracts](#contracts-ink-mainnet)
- [The Ink Agent Tooling Stack](#the-ink-agent-tooling-stack)
- [Development](#development)
- [Disclaimer](#disclaimer)

---

## Quick Start

### 1. Install (no manual install needed)

MCP clients resolve the package automatically via `npx` when you add it to your config — see [MCP Client Setup](#mcp-client-setup) below.

### 2. Fund a dedicated dev wallet

**Do not use your main wallet private key with this MCP.** Create a fresh EVM wallet, fund it with a small amount of ETH on Ink (just enough for gas + your test positions), and use that key only.

### 3. Add to your MCP client config

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_DEV_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

Restart your MCP client. 7 tools become available to your agent.

### 4. (Optional) Use a private RPC endpoint

If you have a private Ink RPC (Gelato, Alchemy, QuickNode, etc.), set `TYDRO_RPC` for faster reads and higher rate limits:

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_DEV_WALLET_PRIVATE_KEY",
        "TYDRO_RPC": "https://your-private-ink-rpc.example.com"
      }
    }
  }
}
```

Falls back to `https://rpc-gel.inkonchain.com` when unset.

---

## Tool Catalog

**7 tools across read-only and write operations.** All target Ink mainnet (chain ID 57073).

### Read-only — no private key required

| Tool | Description |
|---|---|
| `get_reserve_data` | Live market data for any reserve: supply APY, borrow APY, total liquidity, total debt, available liquidity, utilization rate. |
| `get_user_account` | Full position overview for any wallet: collateral USD, debt USD, available borrow capacity, health factor, liquidation status, LTV, liquidation threshold. |
| `get_user_reserve` | Position in a specific reserve: amount supplied, variable debt, stable debt, collateral flag, current market APYs. |

### Write — requires `PRIVATE_KEY`

| Tool | Description |
|---|---|
| `supply` | Deposit an asset to earn interest. ERC20 approval handled automatically. |
| `borrow` | Borrow against deposited collateral. Variable rate only (Aave V3 deprecated stable rate). |
| `repay` | Repay borrowed debt. Pass `"max"` to repay the full balance including accrued interest. Auto-approves. |
| `withdraw` | Withdraw supplied assets. Pass `"max"` for the full aToken balance. |

---

### `get_reserve_data`

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

### `get_user_account`

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

### `get_user_reserve`

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

### `supply`

Deposit an asset into Tydro to earn interest. ERC20 approval is checked and submitted automatically if needed.

```json
{ "asset": "WETH",  "amount": "1.5"  }
{ "asset": "USDT0", "amount": "5000" }
{ "asset": "kBTC",  "amount": "0.01" }
```

---

### `borrow`

Borrow an asset against your deposited collateral. Variable rate only (stable rate deprecated in Aave V3).

```json
{ "asset": "USDT0", "amount": "1000" }
{ "asset": "GHO",   "amount": "500"  }
```

---

### `repay`

Repay borrowed assets. Pass `"max"` to repay the full debt balance including accrued interest. Auto-approves ERC20.

```json
{ "asset": "USDT0", "amount": "500" }
{ "asset": "WETH",  "amount": "max" }
```

---

### `withdraw`

Withdraw previously supplied assets. Pass `"max"` to withdraw your entire aToken balance.

```json
{ "asset": "USDT0", "amount": "2000" }
{ "asset": "WETH",  "amount": "max"  }
```

---

## Supported Assets

All 12 live Tydro reserves on Ink mainnet. Pass assets by symbol (`WETH`, `USDT0`) or raw contract address.

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

---

## MCP Client Setup

### Claude Code

Add to your project's `.mcp.json` (or to `~/.claude.json`):

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_DEV_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-level):

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_DEV_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_DEV_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

### Windsurf / VS Code / Codex

Any client that supports the standard MCP `stdio` transport. The command is always `npx tydro-mcp` with `PRIVATE_KEY` in the env block.

### Running the full Ink stack

Want all the Ink tooling in one session? Add all three MCPs:

```json
{
  "mcpServers": {
    "inkonchain": {
      "command": "npx",
      "args": ["inkonchain-mcp"]
    },
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_DEV_WALLET_PRIVATE_KEY"
      }
    },
    "nado": {
      "command": "npx",
      "args": ["@nadohq/nado-mcp"],
      "env": {
        "DATA_ENV": "nadoMainnet",
        "PRIVATE_KEY": "0xYOUR_LINKED_SIGNER_KEY",
        "SUBACCOUNT_OWNER": "0xYOUR_MAIN_WALLET"
      }
    }
  }
}
```

All three coexist with zero tool name collisions. Your agent gets the full Ink DeFi surface area in one session.

---

## HTTP/SSE Transport

`tydro-mcp` ships a **second binary** — `tydro-mcp-http` — that exposes the same tools over HTTP with SSE streaming instead of stdio. Use this when stdio isn't available, e.g. for agent-to-agent usage where a remote agent ([OpenClaw](https://openclaw.ai), self-hosted Railway/Fly agents, etc.) needs to call Tydro tools over the network.

### Start the HTTP server

```bash
TYDRO_NETWORK=mainnet \
PRIVATE_KEY=0xYOUR_DEV_WALLET_PRIVATE_KEY \
PORT=3100 \
npx -p tydro-mcp tydro-mcp-http
```

Or from a clone:

```bash
npm install && npm run build
PRIVATE_KEY=0x... PORT=3100 node build/http.js
```

### Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/sse` | `GET` | Server-Sent Events stream for MCP protocol messages |
| `/message` | `POST` | Client-to-server message delivery |

### Connect an agent

Configure your agent framework to connect to:

- **SSE endpoint**: `http://localhost:3100/sse`
- **POST endpoint**: `http://localhost:3100/message`

The tool surface is identical to the stdio variant — same 7 tools, same schemas, same env var requirements.

---

## Security & Key Management

MCP servers run **locally on your machine** as child processes spawned by the MCP client. Communication happens over stdio — there are no open ports and no network exposure. Environment variables like `PRIVATE_KEY` stay on your machine and are never sent to any AI provider; the model only sees tool definitions and tool results.

That said, **never put your main wallet private key in the MCP config.** The config file is stored in plain text on disk, readable by any process running as your user. If accidentally committed to version control, the key is permanently exposed.

### Recommended: dedicated dev wallet

Create a fresh EVM keypair specifically for use with `tydro-mcp`. Fund it with only the ETH you need for:
- Gas fees for the on-chain txs you're about to run
- The supply positions you intend to open

Treat the key as disposable. If it's compromised (accidental commit, disk leak, screen-share mistake), rotate it without losing significant funds.

### Generate a disposable hot key

Any of these work:

**Node.js (no extra install):**
```bash
node -e "const{generatePrivateKey,privateKeyToAddress}=require('viem/accounts');const k=generatePrivateKey();console.log('Address: '+privateKeyToAddress(k)+'\nPrivate key: '+k)"
```

**OpenSSL:**
```bash
openssl rand -hex 32 | awk '{print "0x"$1}'
```

**Foundry (`cast`):**
```bash
cast wallet new
```

Save the printed address and private key. Import the address into a watch-only tool if you want a UI view of the positions. Never reuse this key for anything else.

### Read-only mode (no key)

If you only want to read positions / reserve data and never execute writes, omit `PRIVATE_KEY` entirely. All read tools (`get_reserve_data`, `get_user_account`, `get_user_reserve`) work without a key.

```json
{
  "mcpServers": {
    "tydro": {
      "command": "npx",
      "args": ["tydro-mcp"]
    }
  }
}
```

Write tools (`supply`, `borrow`, `repay`, `withdraw`) will return a clear error if called without a key configured.

### What tydro-mcp cannot do

- **Liquidate other users.** Not exposed as a tool. Use the Tydro frontend or contract directly.
- **Flashloans.** Not exposed as a tool.
- **Set emode category.** Use the Tydro frontend.
- **Access anything outside Tydro.** For Tsunami, Sentry, ZNS, or Relay, install [`inkonchain-mcp`](https://www.npmjs.com/package/inkonchain-mcp). For NADO perps, install [`@nadohq/nado-mcp`](https://www.npmjs.com/package/@nadohq/nado-mcp).

---

## Environment Variables

Set these in the `"env"` block of your MCP client config. A `.env` file can be used as a fallback for local development.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PRIVATE_KEY` | For writes | — | EVM private key, `0x`-prefixed 32-byte hex. Omit for read-only mode. |
| `TYDRO_RPC` | No | `https://rpc-gel.inkonchain.com` | Custom Ink RPC endpoint override. Useful for private RPCs (Gelato, Alchemy, QuickNode, etc.) with higher rate limits or better reliability. |
| `TYDRO_NETWORK` | No | `mainnet` | Network selection. Currently only `mainnet` is supported — `testnet` throws on startup until testnet deployment is wired up. |
| `PORT` | No | `3100` | Listen port for the HTTP/SSE variant (`tydro-mcp-http`) only. Ignored by the stdio server. |

---

## Example Prompts

These work out of the box with Claude Code, Claude Desktop, or any MCP-compatible agent. Use them as starting points to see what Tydro tooling can do.

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

### Leveraged long ETH (cross-protocol)
> "Using Tydro, supply 0.1 WETH as collateral, borrow $100 of USDT0 against it, then tell me what my new health factor is and how much more USDT0 I could safely borrow." *(Combine with `inkonchain-mcp` to then swap the borrowed USDT0 back into more WETH via Tsunami or Relay.)*

### Yield carry check
> "Look up my current Tydro position and compute my net interest — how much am I earning per year on my supply positions minus what I'm paying on my borrows?"

---

## Notes

- **Decimals are asset-specific** — kBTC is 8, USDT0/USDC/USDG are 6, everything else is 18. The server handles conversion automatically, so always pass amounts in **human-readable units** (`"1.5"` for 1.5 WETH, not `"1500000000000000000"`).
- **Max repay / max withdraw** uses `type(uint256).max` — Aave caps at the actual balance/debt on-chain, so you can never over-repay or over-withdraw. Use `"max"` freely.
- **Health factor of ∞** means no debt — the wallet is fully collateralized with no borrows open.
- **Liquidation threshold is 1.0** — health factor below 1.0 means the position can be liquidated. Below 1.5 is the danger zone. Above 2.0 is generally considered safe for volatile collateral.
- **No stable rate** — Aave V3 deprecated stable rate borrowing. All borrows via tydro-mcp are variable rate.
- **Collateral flags are asset-specific** — some reserves (particularly stablecoins) may be listed as supply/borrow-only with LTV 0, meaning they earn yield but can't be used as collateral. Use `get_user_reserve` to check `usedAsCollateral` per asset.

---

## Contracts (Ink Mainnet)

| Contract | Address |
|---|---|
| Pool (Aave V3 L2Pool) | `0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA` |
| PoolDataProvider | `0x96086C25d13943C80Ff9a19791a40Df6aFC08328` |
| PoolAddressesProvider | `0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D` |
| UIPoolDataProvider | `0x39bc1bfDa2130d6Bb6DBEfd366939b4c7aa7C697` |
| Oracle | `0x4758213271BFdC72224A7a8742dC865fC97756e1` |
| WETHGateway | `0xDe090EfCD6ef4b86792e2D84E55a5fa8d49D25D2` |

---

## The Ink Agent Tooling Stack

`tydro-mcp` is the **lending** layer. For full Ink ecosystem coverage, pair it with:

### [inkonchain-mcp](https://www.npmjs.com/package/inkonchain-mcp)
The curated Ink ecosystem primitives — Sentry Launch Factory (permissionless + agent-gated token launches), Tsunami V3 DEX, ERC-8004 agent identity, ZNS `.ink` domains, DailyGM, Tsunami subgraph analytics, Relay cross-chain swaps, and ERC20/WETH utilities. ~54 tools across 8 modules. Maintained by MAVRK.

```json
{ "inkonchain": { "command": "npx", "args": ["inkonchain-mcp"] } }
```

### [@nadohq/nado-mcp](https://www.npmjs.com/package/@nadohq/nado-mcp)
Nado is a perpetuals and spot DEX on Ink, powered by the Vertex Protocol engine. Up to 20x leverage on a central limit order book. 38 tools including linked-signer support. Maintained by the Nado team (Ink Foundation).

```json
{
  "nado": {
    "command": "npx",
    "args": ["@nadohq/nado-mcp"],
    "env": {
      "DATA_ENV": "nadoMainnet",
      "PRIVATE_KEY": "0xYOUR_LINKED_SIGNER",
      "SUBACCOUNT_OWNER": "0xYOUR_MAIN_WALLET"
    }
  }
}
```

### Cross-protocol workflows

The real power shows up when you combine them. A few examples an agent can execute end-to-end once all three are installed:

- **Leveraged long ETH**: Supply WETH to Tydro → borrow USDC against it → swap USDC back to WETH via Tsunami (`inkonchain-mcp`) → supply the new WETH to Tydro → repeat. Effective 2-3x leverage on ETH exposure.
- **Stablecoin carry trade**: Supply stables to Tydro to earn yield, borrow kBTC at cheap rates (BTC borrow demand is typically low), sell the kBTC for more stables on Tsunami, supply those stables. Profitable as long as the Tydro stable supply APY > kBTC borrow APY + slippage.
- **Delta-neutral perp hedge**: Supply WETH to Tydro → borrow USDC → open an ETH short on NADO (`@nadohq/nado-mcp`) sized to your supplied WETH notional. Earn supply yield on WETH + (optionally) positive funding on the short, while being net-delta-neutral.
- **Bridge → supply**: Bridge ETH from Base/Arbitrum to Ink via Relay Protocol (`inkonchain-mcp`'s `relay_execute`), then immediately supply the arrived WETH to Tydro to earn yield.

None of these workflows require custom code — just a well-prompted agent with the three MCPs connected.

---

## Development

```bash
git clone https://github.com/mavrkofficial/tydro-mcp.git
cd tydro-mcp
npm install
npm run build
```

```bash
npm run build      # Compile TypeScript to build/
npm run dev        # Watch mode (tsc --watch)
npm run typecheck  # Typecheck without emitting files
```

### Local testing

Run the stdio server directly:

```bash
PRIVATE_KEY=0x... node build/index.js
```

Or the HTTP variant:

```bash
PRIVATE_KEY=0x... PORT=3100 node build/http.js
```

Then connect your MCP client to the local binary instead of via `npx`.

### Contributing

1. Fork the repo and create a feature branch
2. Make your changes and ensure `npm run typecheck && npm run build` passes
3. Open a pull request against `main`

Contributions welcome, especially:
- Testnet deployment wiring (currently `TYDRO_NETWORK=testnet` throws)
- Additional Aave V3 features (e.g. `setUserUseReserveAsCollateral`, `swapBorrowRateMode` — though stable rate is deprecated)
- Flashloan tool

---

## Disclaimer

This software is experimental and interacts with the live Ink blockchain. It can execute real financial transactions including supplying collateral, borrowing against that collateral, and withdrawing positions. These operations involve real funds and can result in liquidation if positions become undercollateralized.

- **No warranty.** MIT licensed, provided as-is.
- **No financial advice.** This is infrastructure tooling, not investment guidance. Supplying and borrowing on Tydro carries market risk, smart contract risk, and liquidation risk.
- **Verify everything.** Always review tool call parameters before approving execution, especially for writes that move funds or open debt positions.
- **Use a fresh dev wallet** with only the funds you're willing to lose. Never use your main wallet private key.
- **Monitor your health factor.** If it drops below 1.0, the position can be liquidated by anyone and you lose a portion of your collateral as a liquidation bonus to the liquidator.
- **The authors are not responsible** for losses incurred through use of this software.

By installing and using `tydro-mcp`, you accept these risks.

---

## License

MIT © MAVRK
