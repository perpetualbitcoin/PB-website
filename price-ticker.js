// Shared price ticker — fetches PB/USDL spot price via read-only RPC
// Requires: ethers (v5 or v6) + config.js (ADDRESSES) loaded before this script
(function () {
    const TICKER_NETWORK = (typeof NETWORKS !== 'undefined' && NETWORKS && NETWORKS.mainnet)
        ? NETWORKS.mainnet
        : { rpc: 'https://rpc.pulsechain.com', chainId: 369 };
    const TICKER_ADDRESSES = (typeof ADDRESSES_MAINNET !== 'undefined' && ADDRESSES_MAINNET)
        ? ADDRESSES_MAINNET
        : (typeof ADDRESSES !== 'undefined' ? ADDRESSES : {});

    const PAIR_ABI = [
        'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32)',
        'function token0() view returns (address)'
    ];

    function formatPrice(n) {
        if (!n || n === 0) return '$0';
        const d = n < 1 ? 6 : 5;
        return '$' + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
    }

    function toNumber(bn) {
        // ethers v6: formatEther exists on ethers
        if (ethers.formatEther) return Number(ethers.formatEther(bn));
        // ethers v5: utils.formatEther
        return Number(ethers.utils.formatEther(bn));
    }

    function getProvider() {
        const rpcUrl = TICKER_NETWORK.rpc;
        const chainId = TICKER_NETWORK.chainId;
        // ethers v6
        if (ethers.JsonRpcProvider) return new ethers.JsonRpcProvider(rpcUrl, chainId);
        // ethers v5
        return new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
    }

    async function fetchPrice() {
        try {
            if (typeof ethers === 'undefined') return;
            const provider = getProvider();
            const pair = new ethers.Contract(TICKER_ADDRESSES.PB_USDL_PAIR, PAIR_ABI, provider);
            const reserves = await pair.getReserves();
            const token0 = await pair.token0();

            let pbR, usdlR;
            if (token0.toLowerCase() === TICKER_ADDRESSES.PB.toLowerCase()) {
                pbR = toNumber(reserves[0]);
                usdlR = toNumber(reserves[1]);
            } else {
                pbR = toNumber(reserves[1]);
                usdlR = toNumber(reserves[0]);
            }

            const price = usdlR / pbR;
            const el = document.getElementById('nav-price');
            if (el) el.innerText = formatPrice(price);
        } catch (e) {
            console.warn('Price ticker:', e.message);
        }
    }

    // Fetch on load, then every 15 seconds
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchPrice);
    } else {
        fetchPrice();
    }
    setInterval(fetchPrice, 15000);
})();
