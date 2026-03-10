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
    "PRESALE_IOU": "0x8C079EBE9d6FAFaD044e857A45A249151Fe723c9",
    "USDL": "0x9259dF449e5a3c1abb405cd1B7A1015C606E3DFA",
    "PULSEX_FACTORY": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "PULSEX_ROUTER": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "PB": "0x1256B6687a2cBD97908692ADce1D0da16ecb841c",
    "PBc": "0xE381302986DECaa0D7ec311F99803951Df027C09",
    "PBt": "0x984F5e4E288d3B2A8903542f9EFF22d540423e67",
    "PBr": "0xA8675a5F6832f251A72A26654bA022711930f651",
    "PBi": "0xBdEa881970bFf975041386D5EAe8D10963D55d70",
    "PB_USDL_PAIR": "0xb38F547E499474EfBdDFD012835160b7145C8343",
    "PulseXInterface": "0x16E6Adc03153d43433C4A211dF11336065e23727",
    "Vault": "0xC4Daff917311AD2DAC0e3Ab9b6aBa203F992e68C",
    "LaunchConverter": "0x1f5a7161D754d56004943ca2481179Cad3390067"
};

// ── Active addresses (used by all pages) ────
const ADDRESSES = NETWORK === "mainnet" ? ADDRESSES_MAINNET : ADDRESSES_TESTNET;
const ACTIVE_NETWORK = NETWORKS[NETWORK];

// ── Site distribution links ─────────────────
const IPFS_CID = "QmfBezegWQKCkf5YDQ2rLrgU8W9jivS8C9KJxte563UTmQ";
const GITHUB_DOWNLOAD = "https://github.com/perpetualbitcoin/PB-website/archive/refs/heads/main.zip";

console.log(`✅ Config loaded [${NETWORK}] chainId:${ACTIVE_NETWORK.chainId}`);
