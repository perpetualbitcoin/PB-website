// ============================================
// Centralized Address Configuration
// Updated automatically by deployment scripts
// ============================================

// ── Set active network here ─────────────────
const NETWORK = "testnet"; // "mainnet" or "testnet"

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
        rpc: "https://rpc.v4.testnet.pulsechain.com",
        explorer: "https://scan.v4.testnet.pulsechain.com",
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
    "PRESALE_IOU": "0x221d7886F115e474e828db221C6d196F4e127BA4",
    "USDL": "0x9259dF449e5a3c1abb405cd1B7A1015C606E3DFA",
    "PULSEX_FACTORY": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "PULSEX_ROUTER": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "PB": "0x3009727Dea4EBa7495Ecb651712B5D77a5279003",
    "PBc": "0x8FD92E50BfB4c36eF353DA03424168C54ae7DB62",
    "PBt": "0x3fF81EDB25D8D26294343F43dD215871657F96e0",
    "PBr": "0x8cCE92d4A3CF8762Fdd9b2Dbc303391B59c248Bd",
    "PBi": "0xEAed847163a9F7d1d78910e0087a891b95837ad1",
    "PB_USDL_PAIR": "0x67A9136bc95B40d1558D241e8f7e4CF17f01601d",
    "PulseXInterface": "0x7B47A7D63f4e2d255F804d277e4Ce46bc7C5164C",
    "Vault": "0xB17fcbca2F87b1a837d05BfBCc191e167dB097ac",
    "LaunchConverter": "0x7A634F4169B5408612417365243aeF38FEaC9069"
};

// ── Active addresses (used by all pages) ────
const ADDRESSES = NETWORK === "mainnet" ? ADDRESSES_MAINNET : ADDRESSES_TESTNET;
const ACTIVE_NETWORK = NETWORKS[NETWORK];

console.log(`✅ Config loaded [${NETWORK}] chainId:${ACTIVE_NETWORK.chainId}`);
