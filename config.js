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
        apiBase: "https://perpetualbitcoin.io/api",
    },
    testnet: {
        chainId: 943,
        name: "PulseChain Testnet v4",
        rpc: "https://rpc.v4.testnet.pulsechain.com",
        explorer: "https://scan.v4.testnet.pulsechain.com",
        apiBase: "https://perpetualbitcoin.io/api",
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
    "PRESALE_IOU": "0x3E7e2D0B627F2F37105C6C818a1F8Bceb3444867",
    "USDL": "0x9259dF449e5a3c1abb405cd1B7A1015C606E3DFA",
    "PULSEX_FACTORY": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "PULSEX_ROUTER": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "PB": "0x050d113Dbe0A0FC40469fF8dFfAdE0e689c185F4",
    "PBc": "0x86fA9EA7eAA6297BC4F16eAce9F794B08eb2bb32",
    "PBt": "0x991b8DaE33cDAA58D28819Ab4F5126CC2B34D7e7",
    "PBr": "0xaA79B2B4fF2A8cBEebaCffB10f899499aE0F8237",
    "PBi": "0xDe89cA1BE564deC8657A00f89Db3FeEE3B24d3f8",
    "PB_USDL_PAIR": "0xDcfdFCB0f94fB2A40558604e752A92f3c0c1e3bB",
    "PulseXInterface": "0x04D6816ef9b6764fB69Bf45Cba92A7269962c151",
    "Vault": "0x9D293951CED4800E0101fA5702467EaEFFFb9bd6",
    "LaunchConverter": "0xE840A0e4d27386F89Dcc2671B364BBd42c783131"
};

// ── Active addresses (used by all pages) ────
const ADDRESSES = NETWORK === "mainnet" ? ADDRESSES_MAINNET : ADDRESSES_TESTNET;
const ACTIVE_NETWORK = NETWORKS[NETWORK];

// ── Site distribution links ─────────────────
const IPFS_CID = "Qmbg3FZEgf3UttVntzViWLQ31sPMJjTqwvUrX9CfMLNWTa";
const GITHUB_DOWNLOAD = "https://github.com/perpetualbitcoin/PB-website/archive/refs/heads/main.zip";

console.log(`✅ Config loaded [${NETWORK}] chainId:${ACTIVE_NETWORK.chainId}`);
