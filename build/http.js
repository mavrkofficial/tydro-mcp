#!/usr/bin/env node
/**
 * Tydro MCP Server — HTTP/SSE Transport
 *
 * Exposes the same tools as the stdio server but over HTTP with SSE streaming.
 * Use this for agent-to-agent usage (e.g. OpenClaw agents on Railway) where
 * stdio is not available.
 *
 * Usage:
 *   TYDRO_NETWORK=mainnet PRIVATE_KEY=0x... PORT=3100 node build/http.js
 *
 * Then configure your OpenClaw agent to connect to:
 *   http://localhost:3100/sse  (SSE endpoint)
 *   http://localhost:3100/message  (POST endpoint)
 */
import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { ethers } from 'ethers';
import { TYDRO_ADDRESSES, resolveAsset } from './contracts/addresses.js';
import { POOL_ABI, DATA_PROVIDER_ABI, ERC20_ABI } from './contracts/abis.js';
// ─── Config ───────────────────────────────────────────────────────────────────
const NETWORK = (process.env.TYDRO_NETWORK ?? 'mainnet');
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PORT = parseInt(process.env.PORT ?? '3100', 10);
if (NETWORK === 'testnet') {
    throw new Error('Testnet not yet configured. Use TYDRO_NETWORK=mainnet.');
}
const mainnetConfig = TYDRO_ADDRESSES.mainnet;
const provider = new ethers.JsonRpcProvider(mainnetConfig.rpc);
const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
// ─── Helpers (shared with stdio server) ──────────────────────────────────────
function rayToAPY(ray) {
    const apy = Number((ray * 10000n) / BigInt(1e27)) / 100;
    return apy.toFixed(2) + '%';
}
function formatUSD(value) {
    return '$' + ethers.formatUnits(value, 8);
}
function validateAddress(addr, fieldName) {
    if (!ethers.isAddress(addr)) {
        throw new Error(`Invalid ${fieldName}: "${addr}" is not a valid Ethereum address`);
    }
    return addr;
}
function validateAmount(amount, fieldName = 'amount') {
    if (amount === 'max')
        return;
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) {
        throw new Error(`Invalid ${fieldName}: must be a positive number or "max", got "${amount}"`);
    }
}
async function ensureAllowance(tokenAddress, spender, requiredAmount, signer) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const current = await token.allowance(await signer.getAddress(), spender);
    if (current >= requiredAmount)
        return;
    const tx = await token.approve(spender, requiredAmount);
    await tx.wait();
}
// ─── MCP Server factory ───────────────────────────────────────────────────────
// Each SSE connection gets its own Server + Transport instance
function createMcpServer() {
    const server = new Server({ name: 'tydro-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
    // ── Tool Definitions ────────────────────────────────────────────────────────
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: 'get_reserve_data',
                description: `Get supply APY, borrow APY, total liquidity, utilization for a Tydro reserve. Assets: ${Object.keys(mainnetConfig.assets).join(', ')}.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        asset: { type: 'string', description: 'Asset symbol (WETH, USDT0, kBTC…) or address' },
                    },
                    required: ['asset'],
                },
            },
            {
                name: 'get_user_account',
                description: "Get user's total collateral, debt, borrow capacity, and health factor.",
                inputSchema: {
                    type: 'object',
                    properties: {
                        address: { type: 'string', description: 'User wallet address (0x...)' },
                    },
                    required: ['address'],
                },
            },
            {
                name: 'get_user_reserve',
                description: "Get user's supplied/borrowed position for a specific asset.",
                inputSchema: {
                    type: 'object',
                    properties: {
                        asset: { type: 'string', description: 'Asset symbol or address' },
                        address: { type: 'string', description: 'User wallet address (0x...)' },
                    },
                    required: ['asset', 'address'],
                },
            },
            {
                name: 'supply',
                description: 'Supply an asset to Tydro to earn interest. Requires PRIVATE_KEY.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        asset: { type: 'string', description: 'Asset symbol or address' },
                        amount: { type: 'string', description: 'Amount in human units (e.g. "1.5")' },
                    },
                    required: ['asset', 'amount'],
                },
            },
            {
                name: 'borrow',
                description: 'Borrow an asset from Tydro. Variable rate only. Requires PRIVATE_KEY.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        asset: { type: 'string', description: 'Asset symbol or address' },
                        amount: { type: 'string', description: 'Amount in human units' },
                    },
                    required: ['asset', 'amount'],
                },
            },
            {
                name: 'repay',
                description: 'Repay borrowed assets. Use "max" for full repay. Requires PRIVATE_KEY.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        asset: { type: 'string', description: 'Asset symbol or address' },
                        amount: { type: 'string', description: 'Amount or "max"' },
                    },
                    required: ['asset', 'amount'],
                },
            },
            {
                name: 'withdraw',
                description: 'Withdraw supplied assets. Use "max" for full withdrawal. Requires PRIVATE_KEY.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        asset: { type: 'string', description: 'Asset symbol or address' },
                        amount: { type: 'string', description: 'Amount or "max"' },
                    },
                    required: ['asset', 'amount'],
                },
            },
        ],
    }));
    // ── Tool Execution ──────────────────────────────────────────────────────────
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            const a = args;
            switch (name) {
                case 'get_reserve_data': {
                    if (!a.asset)
                        throw new Error('Missing required field: asset');
                    const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                    const dataProvider = new ethers.Contract(mainnetConfig.contracts.PoolDataProvider, DATA_PROVIDER_ABI, provider);
                    const data = await dataProvider.getReserveData(assetAddress);
                    const availableLiquidity = data.totalAToken - data.totalStableDebt - data.totalVariableDebt;
                    const totalLiquidity = data.totalAToken;
                    const utilizationRate = totalLiquidity > 0n
                        ? (Number((data.totalVariableDebt + data.totalStableDebt) * 10000n / totalLiquidity) / 100).toFixed(2) + '%'
                        : '0.00%';
                    return {
                        content: [{ type: 'text', text: JSON.stringify({
                                    asset: a.asset.toUpperCase(), address: assetAddress, decimals,
                                    supplyAPY: rayToAPY(data.liquidityRate),
                                    variableBorrowAPY: rayToAPY(data.variableBorrowRate),
                                    stableBorrowAPY: rayToAPY(data.stableBorrowRate),
                                    totalSupplied: ethers.formatUnits(data.totalAToken, decimals),
                                    totalVariableDebt: ethers.formatUnits(data.totalVariableDebt, decimals),
                                    totalStableDebt: ethers.formatUnits(data.totalStableDebt, decimals),
                                    availableLiquidity: ethers.formatUnits(availableLiquidity > 0n ? availableLiquidity : 0n, decimals),
                                    utilizationRate,
                                    lastUpdated: new Date(Number(data.lastUpdateTimestamp) * 1000).toISOString(),
                                }, null, 2) }],
                    };
                }
                case 'get_user_account': {
                    if (!a.address)
                        throw new Error('Missing required field: address');
                    validateAddress(a.address, 'address');
                    const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, provider);
                    const data = await pool.getUserAccountData(a.address);
                    const healthFactorRaw = data.healthFactor;
                    const healthFactorNum = healthFactorRaw === 0n ? null : Number(healthFactorRaw) / 1e18;
                    const isAtRisk = healthFactorNum !== null && healthFactorNum < 1.5;
                    return {
                        content: [{ type: 'text', text: JSON.stringify({
                                    address: a.address,
                                    totalCollateral: formatUSD(data.totalCollateralBase),
                                    totalDebt: formatUSD(data.totalDebtBase),
                                    availableToBorrow: formatUSD(data.availableBorrowsBase),
                                    healthFactor: healthFactorNum === null ? '∞ (no debt)' : healthFactorNum.toFixed(4),
                                    status: healthFactorNum === null ? '✅ No debt'
                                        : healthFactorNum < 1.0 ? '🔴 LIQUIDATABLE'
                                            : isAtRisk ? '⚠️ At risk — consider adding collateral or repaying'
                                                : '✅ Healthy',
                                    ltv: (Number(data.ltv) / 100).toFixed(2) + '%',
                                    liquidationThreshold: (Number(data.currentLiquidationThreshold) / 100).toFixed(2) + '%',
                                }, null, 2) }],
                    };
                }
                case 'get_user_reserve': {
                    if (!a.asset)
                        throw new Error('Missing required field: asset');
                    if (!a.address)
                        throw new Error('Missing required field: address');
                    validateAddress(a.address, 'address');
                    const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                    const dataProvider = new ethers.Contract(mainnetConfig.contracts.PoolDataProvider, DATA_PROVIDER_ABI, provider);
                    const [userData, reserveData] = await Promise.all([
                        dataProvider.getUserReserveData(assetAddress, a.address),
                        dataProvider.getReserveData(assetAddress),
                    ]);
                    const hasVariableDebt = userData.currentVariableDebt > 0n;
                    const hasStableDebt = userData.currentStableDebt > 0n;
                    return {
                        content: [{ type: 'text', text: JSON.stringify({
                                    asset: a.asset.toUpperCase(), address: a.address,
                                    supplied: ethers.formatUnits(userData.currentATokenBalance, decimals),
                                    variableDebt: ethers.formatUnits(userData.currentVariableDebt, decimals),
                                    stableDebt: ethers.formatUnits(userData.currentStableDebt, decimals),
                                    usedAsCollateral: userData.usageAsCollateralEnabled,
                                    marketSupplyAPY: rayToAPY(reserveData.liquidityRate),
                                    marketVariableBorrowAPY: rayToAPY(reserveData.variableBorrowRate),
                                    userStableBorrowAPY: hasStableDebt ? rayToAPY(userData.stableBorrowRate) : null,
                                    activeBorrowType: hasVariableDebt ? 'variable' : hasStableDebt ? 'stable' : 'none',
                                }, null, 2) }],
                    };
                }
                case 'supply': {
                    if (!signer)
                        throw new Error('PRIVATE_KEY not set — read-only mode.');
                    if (!a.asset || !a.amount)
                        throw new Error('Missing required fields: asset, amount');
                    validateAmount(a.amount);
                    const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                    const amount = ethers.parseUnits(a.amount, decimals);
                    await ensureAllowance(assetAddress, mainnetConfig.contracts.Pool, amount, signer);
                    const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                    const tx = await pool.supply(assetAddress, amount, await signer.getAddress(), 0);
                    const receipt = await tx.wait();
                    return { content: [{ type: 'text', text: JSON.stringify({ status: '✅ Supply successful', asset: a.asset.toUpperCase(), amount: a.amount, txHash: receipt.hash, blockNumber: receipt.blockNumber }, null, 2) }] };
                }
                case 'borrow': {
                    if (!signer)
                        throw new Error('PRIVATE_KEY not set — read-only mode.');
                    if (!a.asset || !a.amount)
                        throw new Error('Missing required fields: asset, amount');
                    validateAmount(a.amount);
                    const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                    const amount = ethers.parseUnits(a.amount, decimals);
                    const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                    const tx = await pool.borrow(assetAddress, amount, 2, 0, await signer.getAddress());
                    const receipt = await tx.wait();
                    return { content: [{ type: 'text', text: JSON.stringify({ status: '✅ Borrow successful', asset: a.asset.toUpperCase(), amount: a.amount, rateMode: 'variable', txHash: receipt.hash, blockNumber: receipt.blockNumber }, null, 2) }] };
                }
                case 'repay': {
                    if (!signer)
                        throw new Error('PRIVATE_KEY not set — read-only mode.');
                    if (!a.asset || !a.amount)
                        throw new Error('Missing required fields: asset, amount');
                    validateAmount(a.amount);
                    const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                    const isMax = a.amount === 'max';
                    const amount = isMax ? ethers.MaxUint256 : ethers.parseUnits(a.amount, decimals);
                    await ensureAllowance(assetAddress, mainnetConfig.contracts.Pool, amount, signer);
                    const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                    const tx = await pool.repay(assetAddress, amount, 2, await signer.getAddress());
                    const receipt = await tx.wait();
                    return { content: [{ type: 'text', text: JSON.stringify({ status: '✅ Repay successful', asset: a.asset.toUpperCase(), amount: isMax ? 'max (full debt)' : a.amount, txHash: receipt.hash, blockNumber: receipt.blockNumber }, null, 2) }] };
                }
                case 'withdraw': {
                    if (!signer)
                        throw new Error('PRIVATE_KEY not set — read-only mode.');
                    if (!a.asset || !a.amount)
                        throw new Error('Missing required fields: asset, amount');
                    validateAmount(a.amount);
                    const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                    const isMax = a.amount === 'max';
                    const amount = isMax ? ethers.MaxUint256 : ethers.parseUnits(a.amount, decimals);
                    const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                    const tx = await pool.withdraw(assetAddress, amount, await signer.getAddress());
                    const receipt = await tx.wait();
                    return { content: [{ type: 'text', text: JSON.stringify({ status: '✅ Withdraw successful', asset: a.asset.toUpperCase(), amount: isMax ? 'max (full balance)' : a.amount, txHash: receipt.hash, blockNumber: receipt.blockNumber }, null, 2) }] };
                }
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { content: [{ type: 'text', text: JSON.stringify({ error: message, tool: name, args }, null, 2) }], isError: true };
        }
    });
    return server;
}
// ─── HTTP Server ──────────────────────────────────────────────────────────────
const transports = new Map();
const httpServer = createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    // Health check
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', network: NETWORK, signer: !!signer }));
        return;
    }
    // SSE endpoint — client connects here to receive events
    if (req.url === '/sse' && req.method === 'GET') {
        const transport = new SSEServerTransport('/message', res);
        transports.set(transport.sessionId, transport);
        res.on('close', () => {
            transports.delete(transport.sessionId);
        });
        const server = createMcpServer();
        await server.connect(transport);
        console.error(`[tydro-mcp] SSE client connected: ${transport.sessionId}`);
        return;
    }
    // Message endpoint — client POSTs tool calls here
    if (req.url?.startsWith('/message') && req.method === 'POST') {
        const sessionId = new URL(req.url, `http://localhost`).searchParams.get('sessionId');
        if (!sessionId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing sessionId' }));
            return;
        }
        const transport = transports.get(sessionId);
        if (!transport) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
        }
        await transport.handlePostMessage(req, res);
        return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});
httpServer.listen(PORT, () => {
    console.error(`Tydro MCP HTTP server listening on port ${PORT}`);
    console.error(`  SSE:     http://localhost:${PORT}/sse`);
    console.error(`  Health:  http://localhost:${PORT}/health`);
    console.error(`  Network: ${NETWORK} | Signer: ${signer ? 'yes' : 'read-only'}`);
});
