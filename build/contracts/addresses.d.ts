export declare const TYDRO_ADDRESSES: {
    readonly mainnet: {
        readonly chainId: 57073;
        readonly rpc: "https://rpc-gel.inkonchain.com";
        readonly contracts: {
            readonly Pool: "0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA";
            readonly L2PoolInstance: "0x2aB3580a805fB10CbAd567212C70e26C1B6769eC";
            readonly PoolAddressesProvider: "0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D";
            readonly PoolDataProvider: "0x96086C25d13943C80Ff9a19791a40Df6aFC08328";
            readonly UIPoolDataProvider: "0x39bc1bfDa2130d6Bb6DBEfd366939b4c7aa7C697";
            readonly Oracle: "0x4758213271BFdC72224A7a8742dC865fC97756e1";
            readonly WETHGateway: "0xDe090EfCD6ef4b86792e2D84E55a5fa8d49D25D2";
        };
        readonly assets: {
            readonly WETH: {
                readonly address: "0x4200000000000000000000000000000000000006";
                readonly decimals: 18;
            };
            readonly kBTC: {
                readonly address: "0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98";
                readonly decimals: 8;
            };
            readonly USDT0: {
                readonly address: "0x0200C29006150606B650577BBE7B6248F58470c1";
                readonly decimals: 6;
            };
            readonly USDG: {
                readonly address: "0xe343167631d89b6ffc58b88d6b7fb0228795491d";
                readonly decimals: 6;
            };
            readonly GHO: {
                readonly address: "0xfc421ad3c883bf9e7c4f42de845c4e4405799e73";
                readonly decimals: 18;
            };
            readonly USDC: {
                readonly address: "0x2d270e6886d130d724215a266106e6832161eaed";
                readonly decimals: 6;
            };
            readonly weETH: {
                readonly address: "0xa3d68b74bf0528fdd07263c60d6488749044914b";
                readonly decimals: 18;
            };
            readonly wrsETH: {
                readonly address: "0x9f0a74a92287e323eb95c1cd9ecdbeb0e397cae4";
                readonly decimals: 18;
            };
            readonly ezETH: {
                readonly address: "0x2416092f143378750bb29b79ed961ab195cceea5";
                readonly decimals: 18;
            };
            readonly sUSDe: {
                readonly address: "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2";
                readonly decimals: 18;
            };
            readonly USDe: {
                readonly address: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34";
                readonly decimals: 18;
            };
            readonly SolvBTC: {
                readonly address: "0xae4efbc7736f963982aacb17efa37fcbab924cb3";
                readonly decimals: 18;
            };
        };
    };
    readonly testnet: {
        readonly chainId: 763373;
        readonly rpc: "https://rpc-gel-sepolia.inkonchain.com";
        readonly contracts: {};
        readonly assets: {};
    };
};
export type Network = keyof typeof TYDRO_ADDRESSES;
export type AssetSymbol = keyof typeof TYDRO_ADDRESSES.mainnet.assets;
export declare function resolveAsset(asset: string, config: typeof TYDRO_ADDRESSES.mainnet): {
    address: string;
    decimals: number;
};
