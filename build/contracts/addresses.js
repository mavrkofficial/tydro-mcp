// ─── Tydro Contract Addresses ────────────────────────────────────────────────
// All addresses verified on-chain from Tydro Pool.getReservesList()
// Ink Mainnet (57073) · March 2026
export const TYDRO_ADDRESSES = {
    mainnet: {
        chainId: 57073,
        rpc: 'https://rpc-gel.inkonchain.com',
        contracts: {
            Pool: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
            L2PoolInstance: '0x2aB3580a805fB10CbAd567212C70e26C1B6769eC',
            PoolAddressesProvider: '0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D',
            PoolDataProvider: '0x96086C25d13943C80Ff9a19791a40Df6aFC08328',
            UIPoolDataProvider: '0x39bc1bfDa2130d6Bb6DBEfd366939b4c7aa7C697',
            Oracle: '0x4758213271BFdC72224A7a8742dC865fC97756e1',
            WETHGateway: '0xDe090EfCD6ef4b86792e2D84E55a5fa8d49D25D2',
        },
        // All 12 live reserves — addresses + decimals verified on-chain
        assets: {
            WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
            kBTC: { address: '0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98', decimals: 8 },
            USDT0: { address: '0x0200C29006150606B650577BBE7B6248F58470c1', decimals: 6 },
            USDG: { address: '0xe343167631d89b6ffc58b88d6b7fb0228795491d', decimals: 6 },
            GHO: { address: '0xfc421ad3c883bf9e7c4f42de845c4e4405799e73', decimals: 18 },
            USDC: { address: '0x2d270e6886d130d724215a266106e6832161eaed', decimals: 6 },
            weETH: { address: '0xa3d68b74bf0528fdd07263c60d6488749044914b', decimals: 18 },
            wrsETH: { address: '0x9f0a74a92287e323eb95c1cd9ecdbeb0e397cae4', decimals: 18 },
            ezETH: { address: '0x2416092f143378750bb29b79ed961ab195cceea5', decimals: 18 },
            sUSDe: { address: '0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2', decimals: 18 },
            USDe: { address: '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34', decimals: 18 },
            SolvBTC: { address: '0xae4efbc7736f963982aacb17efa37fcbab924cb3', decimals: 18 },
        },
    },
    testnet: {
        chainId: 763373,
        rpc: 'https://rpc-gel-sepolia.inkonchain.com',
        contracts: {
        // Testnet addresses not yet configured — contributions welcome
        // See https://docs.tydro.com for testnet deployment info
        },
        assets: {},
    },
};
// Helper: resolve symbol or raw address → { address, decimals }
export function resolveAsset(asset, config) {
    if (asset.startsWith('0x')) {
        // Raw address — find decimals from registry or default 18
        const match = Object.values(config.assets).find((a) => a.address.toLowerCase() === asset.toLowerCase());
        if (!match) {
            throw new Error(`Address ${asset} is not in the Tydro reserve registry. ` +
                `Pass a known symbol (${Object.keys(config.assets).join(', ')}) or a registered asset address.`);
        }
        return match;
    }
    const key = asset.toUpperCase();
    const entry = config.assets[key];
    if (!entry) {
        const known = Object.keys(config.assets).join(', ');
        throw new Error(`Unknown asset symbol: "${asset}". Known assets: ${known}`);
    }
    return entry;
}
