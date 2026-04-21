// ============================================
// Centralized Address Configuration
// Updated automatically by deployment scripts
// ============================================

const NETWORK_OVERRIDE_KEY = 'pbPreferredNetwork';

const NETWORKS = {
    mainnet: {
        chainId: 369,
        name: "PulseChain",
        rpc: "https://rpc.pulsechain.com",
        explorer: "https://scan.pulsechain.com",
        apiBase: "https://perpetualbitcoin.io/MN-api",
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
    "PB": "0xb47Fa3fdA09E61a68A8089E1f4d0F44bd993E6B9",
    "PBc": "0x18E89DfC638a61eC010Fb269F0C7289D71555D69",
    "PBt": "0xA0044761afC6D07cd16B46d8859a948e0E9cB814",
    "PBr": "0x97b4fec5214E99fc92452614f98C89DB55584aFe",
    "PBi": "0xC4F586C1AD85E33276E70ea3B39DfA2291f75DB4",
    "PB_USDL_PAIR": "0x3533719b2F72cB55E19dA72155E2FC5eC0BCA4F1",
    "PulseXInterface": "0x9526B745052D259AdD5dC79bcDC61D0EdC68F84B",
    "Vault": "0x0E04D1CaC6212447447ad66A5e57a8910425975F",
    "LaunchConverter": "0x596963B0506A1ECC06334290C0AF22c0b72bf4A7",
    "PBRemoveUserLP": "0x8fD587ffC5f1e342A33DA87995d0E7AAB58C2dcE",
    "VaultViews": "0x2E1efb6a3B471464D6d5D87314b3469709f76F4a"
};

const ADDRESSES_TESTNET = {
    "PRESALE_IOU": "0x5CdA70a70FF44bd1d459429D49a5c077d27F22B3",
    "USDL": "0x9259dF449e5a3c1abb405cd1B7A1015C606E3DFA",
    "PULSEX_FACTORY": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "PULSEX_ROUTER": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "PB": "0x9C27Dfcd81e8BD39c7826dA5b9A5FA4150cd76BE",
    "PBc": "0x1A3F02a39C5dB9cB6d0c01864CD011bD82BE03fF",
    "PBt": "0x4a7277737264Efe03C20f32d9791c6753243f3e7",
    "PBr": "0xB93761a1251Baede71594808aF137916b880Bae4",
    "PBi": "0x1f251e99e7501e9AEa96AF1796fE409658377719",
    "PB_USDL_PAIR": "0x593D31Ef190BCF3a7dbF01a713FC9a38D740b7d6",
    "PulseXInterface": "0xD7f984A6CEA767189124a96C7642adEFCCE22b75",
    "Vault": "0x81a951eCAe3b14a02d7677A68AE701c3b075ae2D",
    "LaunchConverter": "0x05572F1006BdA8eA5B7B44Cc24370A4d204A8693",
    "PBRemoveUserLP": "0x731ed4f738DB902C314CE23CeaB55Ed7E1BE1eF5",
    "VaultViews": "0xF3097D7D0980a37268303c19226454394Df2bfCc"
};

const DEPLOY_BLOCKS_MAINNET = {
    "PB": 26240755,
    "PBc": 26240758,
    "PBt": 26240772,
    "PBr": 26240794,
    "PBi": 26240807,
    "PB_USDL_PAIR": 26240809,
    "PulseXInterface": 26240862,
    "Vault": 26240864,
    "V1MigrationIOU": 26241389,
    "LaunchConverter": 26241410,
    "PBRemoveUserLP": 26241438,
    "VaultViews": 26241454
};

const DEPLOY_BLOCKS_TESTNET = {
    "Vault": 24190647
};

function hasLiveDeployment(addressBook) {
    return Boolean(
        addressBook
        && addressBook.PB
        && addressBook.PBc
        && addressBook.PBt
        && addressBook.Vault
        && addressBook.VaultViews
        && addressBook.PB_USDL_PAIR
        && addressBook.PulseXInterface
    );
}

const DEFAULT_NETWORK = hasLiveDeployment(ADDRESSES_MAINNET) ? "mainnet" : "testnet";
let NETWORK = DEFAULT_NETWORK;

try {
    const preferredNetwork = window.localStorage.getItem(NETWORK_OVERRIDE_KEY);
    if (preferredNetwork === 'mainnet' || preferredNetwork === 'testnet') {
        NETWORK = preferredNetwork;
    }
} catch (err) {
    console.warn('Unable to read preferred network from localStorage:', err);
}

if (NETWORK === 'mainnet' && !hasLiveDeployment(ADDRESSES_MAINNET)) {
    NETWORK = 'testnet';
}

// ── Active addresses (used by all pages) ────
const ACTIVE_NETWORK_KEY = NETWORK;
const ADDRESSES = NETWORK === "mainnet" ? ADDRESSES_MAINNET : ADDRESSES_TESTNET;
const ACTIVE_NETWORK = NETWORKS[NETWORK];
const DEPLOY_BLOCKS = NETWORK === "mainnet" ? DEPLOY_BLOCKS_MAINNET : DEPLOY_BLOCKS_TESTNET;
const VAULT_DEPLOY_BLOCK = (DEPLOY_BLOCKS && DEPLOY_BLOCKS.Vault) || 0;

// ── Site distribution links ─────────────────
const IPFS_CID = "QmVnfQXaiYMoLRStLPzoKuexb5LpopTeQZ8jbVho1sAZvR";
const GITHUB_DOWNLOAD = "https://github.com/perpetualbitcoin/PB-website/archive/refs/heads/main.zip";

console.log(`✅ Config loaded [${NETWORK}] chainId:${ACTIVE_NETWORK.chainId}`);
