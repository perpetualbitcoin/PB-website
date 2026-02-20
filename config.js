// ============================================
// Centralized Address Configuration
// Updated automatically by deployment scripts
// ============================================

// ── Set active network here ─────────────────
const NETWORK = "mainnet"; // "mainnet" or "testnet"

const NETWORKS = {
    mainnet: {
        chainId: 369,
        name: "PulseChain",
        rpc: "https://rpc.pulsechain.com",
        explorer: "https://scan.pulsechain.com",
    },
    testnet: {
        chainId: 943,
        name: "PulseChain Testnet v4",
        rpc: "https://rpc.testnet.pulsechain.com",
        explorer: "https://scan.testnet.pulsechain.com",
    },
};

const ADDRESSES_MAINNET = {
    "PRESALE_IOU": "0x0Cd8c626cbd99d0A7E3BB4Da29BA9E96614f656f",
    "USDL": "0x0dEEd1486bc52aA0d3E6f8849cEC5adD6598A162",
    "PULSEX_FACTORY": "0x29eA7545DEf87022BAdc76323F373EA1e707C523",
    "PULSEX_ROUTER": "0x165C3410fC91EF562C50559f7d2289fEbed552d9",
    "PB": "",
    "PBc": "",
    "PBt": "",
    "PBr": "",
    "PBi": "",
    "PB_USDL_PAIR": "",
    "PulseXInterface": "",
    "Vault": "",
    "LaunchConverter": ""
};

const ADDRESSES_TESTNET = {
    "PRESALE_IOU": "0xa2fCF3B771d4dA59910b42f0ce3f757EAC9a1F55",
    "USDL": "0x9259dF449e5a3c1abb405cd1B7A1015C606E3DFA",
    "PULSEX_FACTORY": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "PULSEX_ROUTER": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "PB": "0x4021c4dDfBDE05bddbC34Eb2A3C804BAeDfCd51B",
    "PBc": "0xBa0Bb89002f2B2FCb8C1534e952c1f3d1607e297",
    "PBt": "0xf9702df2f44D537A15D8ad48ca592cC0cafe87B9",
    "PBr": "0x82719C0CcF9b1B8f8f23077C36D06bD6Cc3D7976",
    "PBi": "0x05c0BFB87d29bA98c8e6B3664f5c928c60Cf3cce",
    "PB_USDL_PAIR": "0x8e8C8BAa9fd9523FDb128659373E2890527C9aA6",
    "PulseXInterface": "0xc6BB0831f646B34585e416984D74A91AEe3bF6A2",
    "Vault": "0x80CE66Fb3F294f492843E5aB21a7865dcFAE49C6",
    "LaunchConverter": "0xd3077CB0A69f0688F3A318bC2Fa698811C587Ca7"
};

// ── Active addresses (used by all pages) ────
const ADDRESSES = NETWORK === "mainnet" ? ADDRESSES_MAINNET : ADDRESSES_TESTNET;
const ACTIVE_NETWORK = NETWORKS[NETWORK];

console.log(`✅ Config loaded [${NETWORK}] chainId:${ACTIVE_NETWORK.chainId}`);
