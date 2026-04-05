// ================================================================
// TICKER BAR — self-contained, read-only, no wallet needed
// Requires: ethers (v5 or v6) UMD + config.js loaded before this script
// Injects its own HTML + CSS — pages only need the <script> tag
// ================================================================
(function () {
    var TICKER_NETWORK = (typeof NETWORKS !== 'undefined' && NETWORKS && NETWORKS.mainnet)
        ? NETWORKS.mainnet
        : { rpc: 'https://rpc.pulsechain.com', chainId: 369 };
    var TICKER_ADDRESSES = (typeof ADDRESSES_MAINNET !== 'undefined' && ADDRESSES_MAINNET)
        ? ADDRESSES_MAINNET
        : (typeof ADDRESSES !== 'undefined' ? ADDRESSES : {});

    // ── Ticker items: edit this array to add/remove/reorder stats ──
    // id = unique element id, label = display text, color = value color
    // bold = true for larger/bolder values
    var ITEMS = [
        { id: 'tick-price',       label: 'Price',       color: '#4CAF50', bold: true  },
        { id: 'tick-gain',        label: '% Since Deploy', color: '#4CAF50', bold: true },
        { id: 'tick-distributed', label: 'Distributed to Holders', color: '#4CAF50', bold: true  },
        { id: 'tick-lp',          label: 'LP',          color: '#FFD700', bold: false },
        { id: 'tick-mc',          label: 'Total MC',    color: '#FFD700', bold: false },
        { id: 'tick-mc-users',    label: 'MC Users',    color: '#4CAF50', bold: false },
    ];

    // ── Build HTML from ITEMS array ──
    function buildSpans(useId) {
        return ITEMS.map(function (item) {
            var valStyle = 'font-weight:' + (item.bold ? '700' : '600') + ';';
            if (item.bold) valStyle += 'font-size:0.95rem;';
            if (item.color) valStyle += 'color:' + item.color + ';';
            var attr = useId ? 'id="' + item.id + '"' : 'class="' + item.id + '-dup"';
            return '<span class="tick-item">' + item.label + ': <span ' + attr + ' style="' + valStyle + '">$\u2014</span></span>';
        }).join('');
    }

    function injectTicker() {
        // Skip if already injected
        if (document.getElementById('ticker-bar')) return;
        var bar = document.createElement('div');
        bar.id = 'ticker-bar';
        var content = document.createElement('div');
        content.id = 'ticker-content';
        content.innerHTML = buildSpans(true) + buildSpans(false);
        bar.appendChild(content);
        document.body.insertBefore(bar, document.body.firstChild);
    }

    // ── Contract ABIs ──
    var PAIR_ABI = [
        'function getReserves() view returns (uint112, uint112, uint32)',
        'function token0() view returns (address)',
    ];
    var VAULT_ABI = [
        'function totalUSDLDistributed() view returns (uint256)',
    ];
    var VAULT_VIEWS_ABI = [
        'function totalOutstandingPBc() view returns (uint256)',
    ];

    // ── ethers v5/v6 compat ──
    function isV6() { return typeof ethers.JsonRpcProvider === 'function'; }
    function makeProvider() {
        return isV6()
            ? new ethers.JsonRpcProvider(TICKER_NETWORK.rpc, TICKER_NETWORK.chainId)
            : new ethers.providers.JsonRpcProvider(TICKER_NETWORK.rpc, TICKER_NETWORK.chainId);
    }
    function fmtEther(val) {
        return isV6() ? ethers.formatEther(val) : ethers.utils.formatEther(val);
    }

    // ── Formatters ──
    function fmtNum(n, d) {
        if (isNaN(n)) return '\u2014';
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    }
    function fmtPrice(p) {
        if (isNaN(p) || p === 0) return '$\u2014';
        if (p < 0.001) return '$' + p.toFixed(8);
        if (p < 1)     return '$' + p.toFixed(6);
        if (p < 10)    return '$' + p.toFixed(4);
        return '$' + fmtNum(p, 2);
    }

    // ── DOM helpers ──
    function set(id, txt)             { var el = document.getElementById(id); if (el) el.innerText = txt; }
    function setC(id, txt, color)     { var el = document.getElementById(id); if (el) { el.innerText = txt; el.style.color = color; } }
    function setAll(sel, txt)         { document.querySelectorAll(sel).forEach(function (el) { el.innerText = txt; }); }
    function setAllC(sel, txt, color) { document.querySelectorAll(sel).forEach(function (el) { el.innerText = txt; el.style.color = color; }); }

    // ── Fetch on-chain data & update ticker ──
    async function updateTicker() {
        try {
            if (typeof ethers === 'undefined') return;
            var rpc = makeProvider();
            var pairC  = new ethers.Contract(TICKER_ADDRESSES.PB_USDL_PAIR, PAIR_ABI, rpc);
            var vaultC = new ethers.Contract(TICKER_ADDRESSES.Vault, VAULT_ABI, rpc);
            var vaultViewsC = new ethers.Contract(TICKER_ADDRESSES.VaultViews, VAULT_VIEWS_ABI, rpc);

            var results = await Promise.all([
                pairC.getReserves(), pairC.token0(),
                vaultC.totalUSDLDistributed(), vaultViewsC.totalOutstandingPBc()
            ]);
            var reserves = results[0], token0 = results[1],
                totalUSDLDist = results[2], totalOutPBc = results[3];

            var pbRes, usdlRes;
            if (token0.toLowerCase() === TICKER_ADDRESSES.PB.toLowerCase()) {
                pbRes  = Number(fmtEther(reserves[0]));
                usdlRes = Number(fmtEther(reserves[1]));
            } else {
                pbRes  = Number(fmtEther(reserves[1]));
                usdlRes = Number(fmtEther(reserves[0]));
            }

            var price    = usdlRes / pbRes;
            var poolVal  = usdlRes * 2;
            var mc       = 21000000 * price;
            var lockedPBc = Number(fmtEther(totalOutPBc));
            var liquidPB  = lockedPBc * (3.69 / 96.31);
            var mcUsers   = Math.max((liquidPB + lockedPBc - pbRes) * price, 0);
            var dist      = Number(fmtEther(totalUSDLDist));
            var gainPct   = ((price - (90000 / 1620000)) / (90000 / 1620000)) * 100;
            var gainStr   = (gainPct >= 0 ? '+' : '') + gainPct.toFixed(2) + '%';
            var gainColor = gainPct >= 0 ? '#4CAF50' : '#F44336';

            // Primary IDs
            set('tick-price', fmtPrice(price));
            set('tick-lp', '$' + fmtNum(poolVal, 0));
            setC('tick-gain', gainStr, gainColor);
            set('tick-mc', '$' + fmtNum(mc, 0));
            set('tick-mc-users', '$' + fmtNum(mcUsers, 0));
            set('tick-distributed', '$' + fmtNum(dist, 2));
            // Duplicate classes (seamless scroll loop)
            setAll('.tick-price-dup', fmtPrice(price));
            setAll('.tick-lp-dup', '$' + fmtNum(poolVal, 0));
            setAllC('.tick-gain-dup', gainStr, gainColor);
            setAll('.tick-mc-dup', '$' + fmtNum(mc, 0));
            setAll('.tick-mc-users-dup', '$' + fmtNum(mcUsers, 0));
            setAll('.tick-distributed-dup', '$' + fmtNum(dist, 2));
        } catch (err) {
            console.warn('Ticker update failed:', err.message);
        }
    }

    // ── Bootstrap ──
    function start() {
        injectTicker();
        updateTicker();
        setInterval(updateTicker, 20000);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
