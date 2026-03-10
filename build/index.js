#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { ethers } from 'ethers';
import { TYDRO_ADDRESSES, resolveAsset } from './contracts/addresses.js';
import { POOL_ABI, DATA_PROVIDER_ABI, ERC20_ABI } from './contracts/abis.js';
// ─── Config ──────────────────────────────────────────────────────────────────
const NETWORK = (process.env.TYDRO_NETWORK ?? 'mainnet');
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const config = TYDRO_ADDRESSES[NETWORK];
if (!config) {
    throw new Error(`Invalid TYDRO_NETWORK: "${NETWORK}". Expected: mainnet | testnet`);
}
// Guard: testnet is not yet configured
if (NETWORK === 'testnet') {
    throw new Error('Testnet addresses are not yet configured. Set TYDRO_NETWORK=mainnet or contribute testnet addresses.');
}
// Mainnet config is now guaranteed
const mainnetConfig = TYDRO_ADDRESSES.mainnet;
const provider = new ethers.JsonRpcProvider(mainnetConfig.rpc);
const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Convert Aave ray (27-decimal fixed point) to APY percentage string */
function rayToAPY(ray) {
    // Use integer math to avoid float precision issues
    const apy = Number((ray * 10000n) / BigInt(1e27)) / 100;
    return apy.toFixed(2) + '%';
}
/** Format oracle base currency value (8 decimals) as USD string */
function formatUSD(value) {
    return '$' + ethers.formatUnits(value, 8);
}
/** Validate an Ethereum address */
function validateAddress(addr, fieldName) {
    if (!ethers.isAddress(addr)) {
        throw new Error(`Invalid ${fieldName}: "${addr}" is not a valid Ethereum address`);
    }
    return addr;
}
/** Validate a positive numeric amount string */
function validateAmount(amount, fieldName = 'amount') {
    if (amount === 'max')
        return;
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) {
        throw new Error(`Invalid ${fieldName}: must be a positive number or "max", got "${amount}"`);
    }
}
/**
 * Ensure ERC20 allowance >= required amount.
 * Only sends approval tx if current allowance is insufficient.
 */
async function ensureAllowance(tokenAddress, spender, requiredAmount, signer) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const current = await token.allowance(await signer.getAddress(), spender);
    if (current >= requiredAmount)
        return; // already sufficient
    const tx = await token.approve(spender, requiredAmount);
    await tx.wait();
}
// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server({ name: 'tydro-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
// ─── Tool Definitions ─────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'get_reserve_data',
            description: 'Get supply APY, borrow APY, total liquidity, utilization, and available liquidity for any Tydro reserve. ' +
                `Supported assets: ${Object.keys(mainnetConfig.assets).join(', ')}.`,
            inputSchema: {
                type: 'object',
                properties: {
                    asset: {
                        type: 'string',
                        description: 'Asset symbol (e.g. WETH, USDT0, kBTC) or raw contract address',
                    },
                },
                required: ['asset'],
            },
        },
        {
            name: 'get_user_account',
            description: 'Get a user\'s overall Tydro position: total collateral, total debt, borrowing capacity, health factor, and liquidation risk.',
            inputSchema: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'User wallet address (0x...)',
                    },
                },
                required: ['address'],
            },
        },
        {
            name: 'get_user_reserve',
            description: 'Get a user\'s position for a specific asset: how much they\'ve supplied, borrowed, and whether it\'s used as collateral.',
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
            description: 'Supply (deposit) an asset to Tydro to earn interest. Requires PRIVATE_KEY env var. ' +
                'Automatically approves the Pool to spend your tokens if needed.',
            inputSchema: {
                type: 'object',
                properties: {
                    asset: { type: 'string', description: 'Asset symbol or address to supply' },
                    amount: { type: 'string', description: 'Amount to supply in human units (e.g. "1.5" for 1.5 WETH)' },
                },
                required: ['asset', 'amount'],
            },
        },
        {
            name: 'borrow',
            description: 'Borrow an asset from Tydro. Requires existing collateral and PRIVATE_KEY env var. ' +
                'Only variable rate (mode 2) is supported — stable rate borrowing is deprecated in Aave V3.',
            inputSchema: {
                type: 'object',
                properties: {
                    asset: { type: 'string', description: 'Asset symbol or address to borrow' },
                    amount: { type: 'string', description: 'Amount to borrow in human units' },
                },
                required: ['asset', 'amount'],
            },
        },
        {
            name: 'repay',
            description: 'Repay borrowed assets. Use amount "max" to repay the full debt. Requires PRIVATE_KEY env var.',
            inputSchema: {
                type: 'object',
                properties: {
                    asset: { type: 'string', description: 'Asset symbol or address to repay' },
                    amount: {
                        type: 'string',
                        description: 'Amount to repay in human units, or "max" to repay full debt',
                    },
                },
                required: ['asset', 'amount'],
            },
        },
        {
            name: 'withdraw',
            description: 'Withdraw supplied assets from Tydro. Use amount "max" to withdraw full balance. Requires PRIVATE_KEY env var.',
            inputSchema: {
                type: 'object',
                properties: {
                    asset: { type: 'string', description: 'Asset symbol or address to withdraw' },
                    amount: {
                        type: 'string',
                        description: 'Amount to withdraw in human units, or "max" to withdraw all',
                    },
                },
                required: ['asset', 'amount'],
            },
        },
    ],
}));
// ─── Tool Execution ───────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        // All args come in untyped — cast and validate per tool
        const a = args;
        switch (name) {
            // ── get_reserve_data ────────────────────────────────────────────────────
            case 'get_reserve_data': {
                if (!a.asset)
                    throw new Error('Missing required field: asset');
                const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                const dataProvider = new ethers.Contract(mainnetConfig.contracts.PoolDataProvider, DATA_PROVIDER_ABI, provider);
                const data = await dataProvider.getReserveData(assetAddress);
                // Available liquidity = totalAToken - totalStableDebt - totalVariableDebt
                const availableLiquidity = data.totalAToken - data.totalStableDebt - data.totalVariableDebt;
                // Utilization = variableDebt / (variableDebt + stableDebt + availableLiquidity)
                // Keep as BigInt to avoid precision loss; scale numerator before dividing
                const totalLiquidity = data.totalAToken;
                const utilizationRate = totalLiquidity > 0n
                    ? (Number((data.totalVariableDebt + data.totalStableDebt) * 10000n / totalLiquidity) / 100).toFixed(2) + '%'
                    : '0.00%';
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                asset: a.asset.toUpperCase(),
                                address: assetAddress,
                                decimals,
                                supplyAPY: rayToAPY(data.liquidityRate),
                                variableBorrowAPY: rayToAPY(data.variableBorrowRate),
                                stableBorrowAPY: rayToAPY(data.stableBorrowRate),
                                totalSupplied: ethers.formatUnits(data.totalAToken, decimals),
                                totalVariableDebt: ethers.formatUnits(data.totalVariableDebt, decimals),
                                totalStableDebt: ethers.formatUnits(data.totalStableDebt, decimals),
                                availableLiquidity: ethers.formatUnits(availableLiquidity > 0n ? availableLiquidity : 0n, decimals),
                                utilizationRate,
                                lastUpdated: new Date(Number(data.lastUpdateTimestamp) * 1000).toISOString(),
                            }, null, 2),
                        }],
                };
            }
            // ── get_user_account ────────────────────────────────────────────────────
            case 'get_user_account': {
                if (!a.address)
                    throw new Error('Missing required field: address');
                validateAddress(a.address, 'address');
                const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, provider);
                const data = await pool.getUserAccountData(a.address);
                const healthFactorRaw = data.healthFactor;
                // healthFactor is in 18-decimal fixed point; 0 means no debt (infinite HF)
                const healthFactorNum = healthFactorRaw === 0n ? null : Number(healthFactorRaw) / 1e18;
                const isAtRisk = healthFactorNum !== null && healthFactorNum < 1.5;
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                address: a.address,
                                totalCollateral: formatUSD(data.totalCollateralBase),
                                totalDebt: formatUSD(data.totalDebtBase),
                                availableToBorrow: formatUSD(data.availableBorrowsBase),
                                healthFactor: healthFactorNum === null ? '∞ (no debt)' : healthFactorNum.toFixed(4),
                                status: healthFactorNum === null
                                    ? '✅ No debt'
                                    : healthFactorNum < 1.0
                                        ? '🔴 LIQUIDATABLE'
                                        : isAtRisk
                                            ? '⚠️ At risk — consider adding collateral or repaying'
                                            : '✅ Healthy',
                                ltv: (Number(data.ltv) / 100).toFixed(2) + '%',
                                liquidationThreshold: (Number(data.currentLiquidationThreshold) / 100).toFixed(2) + '%',
                            }, null, 2),
                        }],
                };
            }
            // ── get_user_reserve ────────────────────────────────────────────────────
            case 'get_user_reserve': {
                if (!a.asset)
                    throw new Error('Missing required field: asset');
                if (!a.address)
                    throw new Error('Missing required field: address');
                validateAddress(a.address, 'address');
                const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                const dataProvider = new ethers.Contract(mainnetConfig.contracts.PoolDataProvider, DATA_PROVIDER_ABI, provider);
                // Fetch user reserve data AND current reserve rates (for variable borrow APY)
                const [userData, reserveData] = await Promise.all([
                    dataProvider.getUserReserveData(assetAddress, a.address),
                    dataProvider.getReserveData(assetAddress),
                ]);
                const hasVariableDebt = userData.currentVariableDebt > 0n;
                const hasStableDebt = userData.currentStableDebt > 0n;
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                asset: a.asset.toUpperCase(),
                                address: a.address,
                                supplied: ethers.formatUnits(userData.currentATokenBalance, decimals),
                                variableDebt: ethers.formatUnits(userData.currentVariableDebt, decimals),
                                stableDebt: ethers.formatUnits(userData.currentStableDebt, decimals),
                                usedAsCollateral: userData.usageAsCollateralEnabled,
                                // Supply APY: current market rate (from reserveData)
                                marketSupplyAPY: rayToAPY(reserveData.liquidityRate),
                                // Borrow APYs: variable from reserveData (market rate), stable is user's personal rate
                                marketVariableBorrowAPY: rayToAPY(reserveData.variableBorrowRate),
                                userStableBorrowAPY: hasStableDebt ? rayToAPY(userData.stableBorrowRate) : null,
                                activeBorrowType: hasVariableDebt ? 'variable' : hasStableDebt ? 'stable' : 'none',
                            }, null, 2),
                        }],
                };
            }
            // ── supply ──────────────────────────────────────────────────────────────
            case 'supply': {
                if (!signer)
                    throw new Error('PRIVATE_KEY not set — read-only mode. Set PRIVATE_KEY to execute transactions.');
                if (!a.asset)
                    throw new Error('Missing required field: asset');
                if (!a.amount)
                    throw new Error('Missing required field: amount');
                validateAmount(a.amount);
                const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                const amount = ethers.parseUnits(a.amount, decimals);
                // Approve only if allowance is insufficient — saves gas on repeat calls
                await ensureAllowance(assetAddress, mainnetConfig.contracts.Pool, amount, signer);
                const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                const tx = await pool.supply(assetAddress, amount, await signer.getAddress(), 0);
                const receipt = await tx.wait();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: '✅ Supply successful',
                                asset: a.asset.toUpperCase(),
                                amount: a.amount,
                                txHash: receipt.hash,
                                blockNumber: receipt.blockNumber,
                            }, null, 2),
                        }],
                };
            }
            // ── borrow ──────────────────────────────────────────────────────────────
            case 'borrow': {
                if (!signer)
                    throw new Error('PRIVATE_KEY not set — read-only mode. Set PRIVATE_KEY to execute transactions.');
                if (!a.asset)
                    throw new Error('Missing required field: asset');
                if (!a.amount)
                    throw new Error('Missing required field: amount');
                validateAmount(a.amount);
                const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                const amount = ethers.parseUnits(a.amount, decimals);
                const rateMode = 2; // Variable only — stable rate deprecated in Aave V3
                const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                const tx = await pool.borrow(assetAddress, amount, rateMode, 0, await signer.getAddress());
                const receipt = await tx.wait();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: '✅ Borrow successful',
                                asset: a.asset.toUpperCase(),
                                amount: a.amount,
                                rateMode: 'variable',
                                txHash: receipt.hash,
                                blockNumber: receipt.blockNumber,
                            }, null, 2),
                        }],
                };
            }
            // ── repay ───────────────────────────────────────────────────────────────
            case 'repay': {
                if (!signer)
                    throw new Error('PRIVATE_KEY not set — read-only mode. Set PRIVATE_KEY to execute transactions.');
                if (!a.asset)
                    throw new Error('Missing required field: asset');
                if (!a.amount)
                    throw new Error('Missing required field: amount');
                validateAmount(a.amount);
                const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                const isMax = a.amount === 'max';
                const amount = isMax ? ethers.MaxUint256 : ethers.parseUnits(a.amount, decimals);
                const rateMode = 2; // Variable only
                // Always approve — even for max repay, ERC20 approval is required
                // For max repay, approve MaxUint256 so it covers the accrued interest delta
                await ensureAllowance(assetAddress, mainnetConfig.contracts.Pool, amount, signer);
                const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                const tx = await pool.repay(assetAddress, amount, rateMode, await signer.getAddress());
                const receipt = await tx.wait();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: '✅ Repay successful',
                                asset: a.asset.toUpperCase(),
                                amount: isMax ? 'max (full debt)' : a.amount,
                                txHash: receipt.hash,
                                blockNumber: receipt.blockNumber,
                            }, null, 2),
                        }],
                };
            }
            // ── withdraw ────────────────────────────────────────────────────────────
            case 'withdraw': {
                if (!signer)
                    throw new Error('PRIVATE_KEY not set — read-only mode. Set PRIVATE_KEY to execute transactions.');
                if (!a.asset)
                    throw new Error('Missing required field: asset');
                if (!a.amount)
                    throw new Error('Missing required field: amount');
                validateAmount(a.amount);
                const { address: assetAddress, decimals } = resolveAsset(a.asset, mainnetConfig);
                const isMax = a.amount === 'max';
                const amount = isMax ? ethers.MaxUint256 : ethers.parseUnits(a.amount, decimals);
                const pool = new ethers.Contract(mainnetConfig.contracts.Pool, POOL_ABI, signer);
                const tx = await pool.withdraw(assetAddress, amount, await signer.getAddress());
                const receipt = await tx.wait();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: '✅ Withdraw successful',
                                asset: a.asset.toUpperCase(),
                                amount: isMax ? 'max (full balance)' : a.amount,
                                txHash: receipt.hash,
                                blockNumber: receipt.blockNumber,
                            }, null, 2),
                        }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ error: message, tool: name, args }, null, 2),
                }],
            isError: true,
        };
    }
});
// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Tydro MCP server running | network: ${NETWORK} | signer: ${signer ? 'yes' : 'read-only'}`);
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
