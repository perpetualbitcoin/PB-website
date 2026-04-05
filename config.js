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
    "PB": "0x411d2fDdbD944894E8aAa3c4b5563B66C5dC6346",
    "PBc": "0xdFB9331CBcd56056D9c1867eA2CfC76a4CB8dD29",
    "PBt": "0x8e30de415E73Ce911D62601dC3d8672F473af15d",
    "PBr": "0x9Da558E2CD81C625a44dC1E4e21998969828635C",
    "PBi": "0x0DfB176e60B48fE4c2454c69dDa58c6bD604f10d",
    "PB_USDL_PAIR": "0x9F4676f51665a0d460135B2bc01077a50198b525",
    "PulseXInterface": "0xa9Fa914781a9200e9643551eA08A8784Bb6eeEd5",
    "Vault": "0xd770e1918e4202C3F6a9Fc0F91bd8BB941CC910a",
    "LaunchConverter": "0x7e615c458095233D2FE39e2432235B6Ad5e4063B",
    "PBRemoveUserLP": "0x2bb6e888a52B726c0E073AF6C266C8597C8c0bB6",
    "VaultViews": "0xb5DBD3F473b92aC3c612bC7E564B65178c6B70B7"
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

// ── Site distribution links ─────────────────
const IPFS_CID = "QmfUADtmQDMhjwT6exHcFVUTxnfAy2SMKAofF3zAin9kzw";
const GITHUB_DOWNLOAD = "https://github.com/perpetualbitcoin/PB-website/archive/refs/heads/main.zip";

console.log(`✅ Config loaded [${NETWORK}] chainId:${ACTIVE_NETWORK.chainId}`);
