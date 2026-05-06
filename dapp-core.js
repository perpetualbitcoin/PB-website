(function () {
    const CHAIN_ID = ACTIVE_NETWORK.chainId;
    const CHAIN_NAME = ACTIVE_NETWORK.name;
    const RPC_URL = ACTIVE_NETWORK.rpc;
    const INDEXER_URL = ACTIVE_NETWORK.apiBase;

    const TVault = ADDRESSES.Vault;
    const TVaultViews = ADDRESSES.VaultViews;
    const TPB = ADDRESSES.PB;
    const TPBc = ADDRESSES.PBc;
    const TPBt = ADDRESSES.PBt;
    const TPBr = ADDRESSES.PBr;
    const TPBi = ADDRESSES.PBi;
    const TUSDL = ADDRESSES.USDL;
    const TPBRemoveUserLP = ADDRESSES.PBRemoveUserLP;
    const PULSEX_ROUTER = ADDRESSES.PULSEX_ROUTER;
    const PULSEX_PAIR = ADDRESSES.PB_USDL_PAIR;
    const VAULT_EVENT_FROM_BLOCK = (typeof VAULT_DEPLOY_BLOCK !== 'undefined' && VAULT_DEPLOY_BLOCK) || 0;

    const VAULT_ABI = [
        'function buyPBDirect(uint256 usdlAmount, uint256 minPBOut, address recipient, uint256[] unlockIds) returns (uint256)',
        'function pbtRegistry(uint256 pbtId) view returns (uint256 buyPrice, uint256 pbAmount, uint256 pbcLocked, uint256 nextUnlockIndex, uint256 nextTriggerPrice, uint256 mintBlock, address holder, address payoutAddress)',
        'function setRecoveryAddress(uint256 pbtId, address recoveryAddr, bytes32 passwordHash, string message)',
        'function activateRecovery(uint256 pbtId, string password)',
        'function setInheritanceAddress(uint256 pbtId, address inheritanceAddr, bytes32 passwordHash, string message)',
        'function activateInheritance(uint256 pbtId, string password)',
        'function voluntaryLock(uint256 pbAmount) returns (uint256)',
        'function harvestLPRewards()',
        'function claimLPFeesFor(uint256 pbtId) returns (uint256 usdlPaid, uint256 pbPaid)',
        'function vaultPBBalance() view returns (uint256)',
        'function vaultPBcBalance() view returns (uint256)',
        'function totalUSDLDistributed() view returns (uint256)',
        'function isDistributionPhase() view returns (bool)',
        'function pbtIdCounter() view returns (uint256)',
        'function buyCount() view returns (uint256)',
        'event VLockExecuted(address indexed user, uint256 indexed pbtId, uint256 pbAmount, uint256 usdlBonusPaid, uint256 pbBonusPaid)',
        'event VLockBonusPaid(address indexed user, uint256 usdlAmount, uint256 pbAmount)',
        'event UnlockTriggered(uint256 indexed pbtId, uint256 unlockIndex, uint256 pbUnlocked, uint256 usdlProceeds, address payoutAddress, uint256 newTriggerPrice, uint256 remainingPBcLocked)',
        'event UnlockNetted(uint256 indexed pbtId, uint256 unlockIndex, uint256 pbcSettled, uint256 usdlPaid, address payoutAddress, uint256 settlementPrice, uint256 newTriggerPrice, uint256 remainingPBcLocked)'
    ];

    const VAULT_VIEWS_ABI = [
        'function getUserPBtIds(address user) view returns (uint256[])',
        'function getPositionUnlockStatus(uint256 pbtId) view returns (uint256 index, uint256 nextPrice, bool eligible, uint256 pbcRemaining)',
        'function computeNextTriggerPrice(uint256 buyPrice, uint256 unlockIndex) view returns (uint256)',
        'function getPBQuote(uint256 usdlAmount) view returns (uint256 pb, uint256 liquid, uint256 locked)',
        'function getUserTotalValue(address user) view returns (uint256 total, uint256 liquid, uint256 locked, uint256 usdl)',
        'function getCurrentLPProceeds() view returns (uint256 usdl, uint256 pb)',
        'function getLPTokenBalance() view returns (uint256)',
        'function getActivePositionCount() view returns (uint256)',
        'function totalOutstandingPBc() view returns (uint256)',
        'function totalOutstandingPB() view returns (uint256)',
        'function getPBtData(uint256 pbtId) view returns (uint256 buyPrice, uint256 pbAmount, uint256 pbcLocked, uint256 nextUnlockIndex, uint256 nextTriggerPrice, uint256 mintBlock, address holder, address payoutAddress)',
        'function getRecoveryData(uint256 pbtId) view returns (address recoveryAddress, bytes32 passwordHash, bool activated)',
        'function getInheritanceData(uint256 pbtId) view returns (address inheritanceAddress, bytes32 passwordHash, bool activated)',
        'function getVlockParameters() view returns (uint256 minBonusUsdl, uint256 bonusPct, uint256 pctDenom, uint256 minTwapWindow)'
    ];

    const TOKEN_ABI = [
        'function balanceOf(address) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function transferFrom(address from, address to, uint256 amount) returns (bool)'
    ];

    const PAIR_ABI = [
        'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
        'function totalSupply() view returns (uint256)',
        'function balanceOf(address owner) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)'
    ];

    const REMOVE_USER_LP_ABI = [
        'function removeUserPBLP(uint256 lpAmount, uint256 minPB, uint256 minUSDL, uint256 deadline) returns (uint256 pbAmount, uint256 usdlAmount)',
        'event UserLPRemoved(address indexed user, uint256 lpAmount, uint256 pbAmount, uint256 usdlAmount)'
    ];

    const ROUTER_ABI = [
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
        'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)'
    ];

    const NFT_ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
    ];

    const BADGE_ABI = [
        'function balanceOf(address account, uint256 id) view returns (uint256)',
        'function getBadgeIds(address holder) view returns (uint256[])'
    ];

    const ERC1155_ABI = [
        'function balanceOf(address account, uint256 id) view returns (uint256)'
    ];

    const ERC20_MINT_ABI = [
        'function mint(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
    ];

    function hasInjectedWallet() {
        return typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.request === 'function';
    }

    async function addChain(params) {
        if (!hasInjectedWallet()) {
            alert('No injected wallet detected. Please install MetaMask or a compatible wallet.');
            return;
        }
        try {
            await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [params] });
        } catch (err) {
            console.error('addEthereumChain error:', err);
            alert('Wallet rejected or does not support adding networks.');
        }
    }

    async function addPulseMainnet() {
        await addChain({
            chainId: '0x171',
            chainName: 'PulseChain',
            nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
            rpcUrls: ['https://rpc.pulsechain.com'],
            blockExplorerUrls: ['https://scan.pulsechain.com']
        });
    }

    async function addPulseTestnet() {
        await addChain({
            chainId: '0x3AF',
            chainName: 'PulseChain Testnet v4',
            nativeCurrency: { name: 'tPLS', symbol: 'tPLS', decimals: 18 },
            rpcUrls: ['https://rpc.v4.testnet.pulsechain.com'],
            blockExplorerUrls: ['https://scan.v4.testnet.pulsechain.com']
        });
    }

    function hexChainId(n) {
        try {
            return '0x' + Number(n).toString(16);
        } catch {
            return '0x0';
        }
    }

    async function ensureWalletOnChain(targetCid) {
        if (!window.ethereum) return false;
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId(targetCid) }]
            });
            console.log('Switched to chain:', targetCid);
            return true;
        } catch (err) {
            if (err && (err.code === 4902 || String(err.message || '').includes('Unrecognized'))) {
                try {
                    const params = targetCid === 943 ? [{
                        chainId: hexChainId(943),
                        chainName: 'PulseChain Testnet v4',
                        nativeCurrency: { name: 'tPLS', symbol: 'tPLS', decimals: 18 },
                        rpcUrls: ['https://rpc.v4.testnet.pulsechain.com'],
                        blockExplorerUrls: ['https://scan.v4.testnet.pulsechain.com']
                    }] : [{
                        chainId: hexChainId(369),
                        chainName: 'PulseChain',
                        nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
                        rpcUrls: ['https://rpc.pulsechain.com'],
                        blockExplorerUrls: ['https://scan.pulsechain.com']
                    }];

                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params
                    });
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: hexChainId(targetCid) }]
                    });
                    console.log('Added and switched to chain:', targetCid);
                    return true;
                } catch {
                    return false;
                }
            }
            return false;
        }
    }

    function bigIntSqrt(x) {
        if (x < 0n) throw new Error('sqrt negative');
        if (x < 2n) return x;
        let z = x;
        let y = (x + 1n) >> 1n;
        while (y < z) {
            z = y;
            y = (x / y + y) >> 1n;
        }
        return z;
    }

    function getAmountOut(amountIn, reserveIn, reserveOut) {
        const amountInWithFee = amountIn * 997n;
        return (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
    }

    function getAmountIn(amountOut, reserveIn, reserveOut) {
        if (amountOut <= 0n || amountOut >= reserveOut) return 0n;
        return ((reserveIn * amountOut * 1000n) / ((reserveOut - amountOut) * 997n)) + 1n;
    }

    function computeUSDLForPrice(reservePB, reserveUSDL, targetPrice) {
        const currentPrice = (reserveUSDL * (10n ** 18n)) / reservePB;
        if (currentPrice >= targetPrice) return 0n;
        const b = reserveUSDL * 1997n;
        const absC = (targetPrice * reservePB * reserveUSDL * 1000n / (10n ** 18n)) - (reserveUSDL * reserveUSDL * 1000n);
        const disc = b * b + 4n * 997n * absC;
        const sqrtDisc = bigIntSqrt(disc);
        return (sqrtDisc - b) / (2n * 997n) + 1n;
    }

    function getErrorData(err) {
        if (!err) return null;
        if (typeof err.data === 'string' && err.data.startsWith('0x')) return err.data;
        if (typeof err?.info?.error?.data === 'string' && err.info.error.data.startsWith('0x')) return err.info.error.data;
        if (typeof err?.error?.data === 'string' && err.error.data.startsWith('0x')) return err.error.data;
        return null;
    }

    function decodeVaultCustomError(err) {
        const data = getErrorData(err);
        if (!data || data.length < 10) return null;

        const selector = data.slice(0, 10).toLowerCase();
        const known = {
            '0x2c5211c6': 'InvalidAmount',
            '0x00bfc921': 'InvalidPrice',
            '0x82b42900': 'Unauthorized',
            '0xc0e7c301': 'InsufficientBalance',
            '0xf4d678b8': 'TransferFailed',
            '0x1ea663b5': 'NotExist'
        };

        return known[selector] || null;
    }

    function formatNumber(num, decimals) {
        if (decimals === undefined) decimals = 2;
        if (!num) return '0';
        const parsed = parseFloat(num);
        return parsed.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
    }

    function formatPrice(price) {
        if (!price || parseFloat(price) === 0) return '$0';
        const parsed = parseFloat(price);
        const decimals = parsed < 1 ? 6 : 5;
        return '$' + formatNumber(price, decimals);
    }

    function showStatus(elementId, message, type) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerText = message;
            el.style.color = type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : type === 'warning' ? '#FFC107' : '#2196F3';
        }
    }

    function showQuoteStatus(nettingMessage, ammMessage, ammType) {
        if (ammType === undefined) ammType = 'neutral';
        const el = document.getElementById('buy-quote-status');
        if (!el) return;
        const ammColor = ammType === 'buy' ? '#4CAF50' : ammType === 'sell' ? '#F44336' : '#aaa';
        el.innerHTML = '<span style="color:#8ad1ff;">' + nettingMessage + '</span><span style="color:#777;"> + </span><span style="color:' + ammColor + ';">' + ammMessage + '</span>';
    }

    async function copyToClipboard(value) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (err) {
            console.error('Clipboard write failed:', err);
            return false;
        }
    }

    function showTransactionStatus(elementId, message, type, txHash, explorerBaseUrl) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const color = type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : type === 'warning' ? '#FFC107' : '#2196F3';
        if (!txHash) {
            el.innerText = message;
            el.style.color = color;
            return;
        }

        const linkHref = explorerBaseUrl ? explorerBaseUrl.replace(/\/$/, '') + '/tx/' + txHash : '#';
        const shortHash = txHash.slice(0, 10) + '...' + txHash.slice(-6);
        el.style.color = color;
        el.innerHTML =
            '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
                '<span>' + message + '</span>' +
                '<a href="' + linkHref + '" target="_blank" rel="noopener noreferrer" style="color:' + color + ';text-decoration:underline;font-family:monospace;">' + shortHash + '</a>' +
                '<button type="button" data-copy-tx="' + txHash + '" style="padding:2px 8px;font-size:0.75rem;border:1px solid ' + color + ';background:transparent;color:' + color + ';border-radius:999px;cursor:pointer;">Copy tx</button>' +
            '</div>';

        const button = el.querySelector('[data-copy-tx]');
        if (button) {
            button.addEventListener('click', async () => {
                const copied = await copyToClipboard(txHash);
                const originalText = button.innerText;
                button.innerText = copied ? 'Copied' : 'Copy failed';
                setTimeout(() => {
                    button.innerText = originalText;
                }, 1500);
            });
        }
    }

    function escapeTerminalHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatTerminalInline(value) {
        const text = String(value ?? '');
        if (/^0x[a-fA-F0-9]{40}$/.test(text) || /^0x[a-fA-F0-9]{64}$/.test(text)) {
            return `<span class="terminal-address">${escapeTerminalHtml(text)}</span>`;
        }
        if (/^(approve|voluntaryLock|harvestLPRewards|addLiquidity|removeUserPBLP|setRecoveryAddress|setInheritanceAddress|activateRecovery|activateInheritance)$/.test(text)) {
            return `<span class="terminal-function">${escapeTerminalHtml(text)}</span>`;
        }
        return `<span class="terminal-value">${escapeTerminalHtml(text)}</span>`;
    }

    function renderOperationTerminalPreview(state) {
        const lines = [];
        lines.push(`<div class="terminal-line"><span class="terminal-prefix">$</span><span class="terminal-function">mode</span> <span class="terminal-key">=</span> ${formatTerminalInline(state.mode || 'Waiting')}</div>`);

        (state.summaryRows || []).forEach(([label, value]) => {
            lines.push(`<div class="terminal-line"><span class="terminal-prefix">></span><span class="terminal-key">${escapeTerminalHtml(label)}:</span> ${formatTerminalInline(value)}</div>`);
        });

        if ((state.steps || []).length) {
            lines.push('<div class="terminal-line"><span class="terminal-prefix">#</span><span class="terminal-muted">predicted sequence</span></div>');
        }

        (state.steps || []).forEach((step, index) => {
            lines.push(`<div class="terminal-line"><span class="terminal-prefix">${index + 1}.</span><span class="terminal-function">${escapeTerminalHtml(step.title)}</span> <span class="terminal-muted">[${escapeTerminalHtml(step.badge || 'Step')}]</span></div>`);
            lines.push(`<div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-muted">${escapeTerminalHtml(step.body || '')}</span></div>`);
            (step.details || []).forEach(([detailLabel, detailValue]) => {
                lines.push(`<div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-key">${escapeTerminalHtml(detailLabel)}:</span> ${formatTerminalInline(detailValue)}</div>`);
            });
        });

        if ((state.addresses || []).length) {
            lines.push('<div class="terminal-line"><span class="terminal-prefix">@</span><span class="terminal-muted">addresses / contracts</span></div>');
        }

        (state.addresses || []).forEach(([label, value]) => {
            lines.push(`<div class="terminal-line"><span class="terminal-prefix">@</span><span class="terminal-key">${escapeTerminalHtml(label)}:</span> ${formatTerminalInline(value)}</div>`);
        });

        return lines.join('');
    }

    function renderOperationTerminalChain(entries) {
        if (!entries.length) {
            return '<div class="terminal-line"><span class="terminal-prefix">$</span><span class="terminal-muted">No execution yet.</span></div>';
        }

        return entries.map((entry) => {
            const toneClass = entry.tone === 'success'
                ? 'terminal-success'
                : entry.tone === 'error'
                    ? 'terminal-error'
                    : entry.tone === 'warning'
                        ? 'terminal-warning'
                        : 'terminal-value';

            const detailsHtml = (entry.details || []).map(([label, value]) => `
                <div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-key">${escapeTerminalHtml(label)}:</span> ${formatTerminalInline(value)}</div>
            `).join('');

            return `
                <div class="terminal-line"><span class="terminal-prefix">$</span><span class="${toneClass}">${escapeTerminalHtml(entry.title)}</span></div>
                <div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-muted">${escapeTerminalHtml(entry.body || '')}</span></div>
                ${detailsHtml}
            `;
        }).join('');
    }

    function createOperationTerminal(config) {
        const defaultMode = config?.defaultMode || 'Operation';
        const defaultStatus = config?.defaultStatus || 'Waiting for input';
        const containerId = config?.containerId;
        const modeId = config?.modeId;
        let previewState = {
            mode: `${defaultMode} preview`,
            summaryRows: [['Status', defaultStatus]],
            steps: [],
            addresses: config?.addresses || [],
        };
        let chainEntries = [];

        function render() {
            const container = document.getElementById(containerId);
            const modeEl = modeId ? document.getElementById(modeId) : null;
            if (modeEl) modeEl.textContent = previewState.modeLabel || defaultMode;
            if (!container) return;
            container.innerHTML = `
                <div class="terminal-divider">Prediction</div>
                ${renderOperationTerminalPreview(previewState)}
                <div class="terminal-divider">On-Chain</div>
                ${renderOperationTerminalChain(chainEntries)}
            `;
        }

        function setMode(label) {
            previewState.modeLabel = label || defaultMode;
            previewState.mode = `${previewState.modeLabel} preview`;
            render();
        }

        function setPreview(nextState) {
            previewState = {
                mode: nextState?.mode || previewState.mode || `${defaultMode} preview`,
                modeLabel: nextState?.modeLabel || previewState.modeLabel || defaultMode,
                summaryRows: nextState?.summaryRows || [],
                steps: nextState?.steps || [],
                addresses: nextState?.addresses || config?.addresses || [],
            };
            render();
        }

        function resetChain() {
            chainEntries = [];
            render();
        }

        function pushChainEvent(title, body, tone, details) {
            chainEntries.push({
                title,
                body,
                tone: tone || 'info',
                details: details || [],
            });
            render();
        }

        function resetPreview(statusMessage) {
            previewState = {
                mode: `${previewState.modeLabel || defaultMode} preview`,
                modeLabel: previewState.modeLabel || defaultMode,
                summaryRows: [['Status', statusMessage || defaultStatus]],
                steps: [],
                addresses: config?.addresses || [],
            };
            render();
        }

        render();

        return {
            setMode,
            setPreview,
            resetPreview,
            resetChain,
            pushChainEvent,
            render,
        };
    }

    window.addPulseMainnet = addPulseMainnet;
    window.addPulseTestnet = addPulseTestnet;

    // ── GitHub hints fallback ────────────────────────────────────────────────
    // Used when the indexer is unreachable. Downloads the pre-sorted snapshot,
    // decompresses it, and returns a compatible response object.
    // The full sorted list is safe to pass to the vault — the contract ignores
    // hints that aren't yet eligible. Capped at 500 to match normal hint limit.
    async function fetchHintsGithubFallback(usdlWei) {
        const urls = [
            (typeof HINTS_GITHUB_URL !== 'undefined' && HINTS_GITHUB_URL) || 'https://raw.githubusercontent.com/perpetualbitcoin/PB-hints/main/hints-latest.json.gz',
            (typeof HINTS_JSDELIVR_URL !== 'undefined' && HINTS_JSDELIVR_URL) || 'https://cdn.jsdelivr.net/gh/perpetualbitcoin/PB-hints@main/hints-latest.json.gz',
        ];
        let lastErr;
        for (const url of urls) {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const buf = await resp.arrayBuffer();
                const ds = new DecompressionStream('gzip');
                const writer = ds.writable.getWriter();
                writer.write(new Uint8Array(buf));
                writer.close();
                const reader = ds.readable.getReader();
                const chunks = [];
                let done = false;
                while (!done) {
                    const { value, done: d } = await reader.read();
                    if (value) chunks.push(value);
                    done = d;
                }
                const text = new TextDecoder().decode(
                    chunks.reduce((acc, c) => {
                        const merged = new Uint8Array(acc.length + c.length);
                        merged.set(acc);
                        merged.set(c, acc.length);
                        return merged;
                    }, new Uint8Array(0))
                );
                const { rows } = JSON.parse(text);
                if (!Array.isArray(rows)) throw new Error('No rows in hint snapshot');

                // Filter to only hints reachable by this buy amount.
                // Fetch live reserves, compute the max price this usdlWei can push to,
                // then keep only rows whose nextTriggerPrice <= that max price.
                let filtered = rows;
                if (usdlWei && usdlWei > 0n) {
                    try {
                        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
                        const pair = new ethers.Contract(PULSEX_PAIR, PAIR_ABI, provider);
                        const [r0, r1] = await pair.getReserves();
                        // PB/USDL pair: token0 order depends on address sort
                        // Use reservePB and reserveUSDL via getAmountOut to find post-buy price
                        const reservePB = BigInt(r0.toString());
                        const reserveUSDL = BigInt(r1.toString());
                        const pbOut = getAmountOut(usdlWei, reserveUSDL, reservePB);
                        // Post-swap spot price — same formula as computeEstimatedMaxPrice
                        const newReservePB = reservePB - pbOut;
                        const newReserveUSDL = reserveUSDL + usdlWei;
                        const maxPrice = newReservePB > 0n
                            ? (newReserveUSDL * (10n ** 18n)) / newReservePB
                            : (reserveUSDL * (10n ** 18n)) / reservePB;
                        filtered = rows.filter(r => BigInt(r.nextTriggerPrice) <= maxPrice);
                    } catch (_) {
                        // reserves unavailable — fall back to full list capped at 500
                    }
                }

                const capped = filtered.slice(0, 500);
                return {
                    unlockIds: capped.map(r => r.pbtId),
                    rows: capped,
                    coreCount: capped.length,
                    overflowCount: 0,
                    hasPartial: false,
                    truncated: false,
                    source: 'github-fallback',
                };
            } catch (e) {
                lastErr = e;
            }
        }
        throw new Error(`GitHub hints fallback failed: ${lastErr?.message}`);
    }

    // ── Quick netting simulation ─────────────────────────────────────────────
    // Runs the core netting loop against hint rows (from GitHub snapshot or live).
    // rows: [{nextTriggerPrice, pbcLocked}] sorted by nextTriggerPrice asc.
    // Returns {nettedCount, nettedPBc, ammPBOut, totalPB, avgPrice} all BigInt
    // except nettedCount (number). Skips LP contribution and post-AMM unlocks.
    function simulateNettingQuick(usdlWei, reservePB, reserveUSDL, rows) {
        const TRANCHE_FRAC = 3n;
        const DUST = 15n;
        let vPB = reservePB;
        let vUSDL = reserveUSDL;
        let budget = usdlWei;
        let nettedCount = 0;
        let nettedPBc = 0n;
        let totalNettedSettlement = 0n; // only settlement USDL paid to netting, not vBuy

        for (let i = 0; i < rows.length; i++) {
            const triggerPrice = BigInt(rows[i].nextTriggerPrice || rows[i].liveTrigger || 0);
            const pbcLocked = BigInt(rows[i].pbcLocked || rows[i].liveRemaining || 0);
            if (pbcLocked <= 0n) continue;

            const vBuy = computeUSDLForPrice(vPB, vUSDL, triggerPrice);
            const tranche = pbcLocked < DUST ? pbcLocked : pbcLocked / TRANCHE_FRAC;
            const settlement = (tranche * triggerPrice) / (10n ** 18n);

            if (budget < vBuy || (budget - vBuy) < settlement) {
                if (budget >= vBuy) {
                    if (vBuy > 0n) {
                        const pb = getAmountOut(vBuy, vUSDL, vPB);
                        vUSDL += vBuy; vPB -= pb; budget -= vBuy;
                    }
                    const partial = settlement > 0n ? (tranche * budget) / settlement : 0n;
                    nettedPBc += partial;
                    totalNettedSettlement += budget; // partial settlement
                    nettedCount += 1;
                    budget = 0n;
                }
                break;
            }

            budget -= (vBuy + settlement);
            totalNettedSettlement += settlement; // only track settlement, vBuy stays in AMM
            if (vBuy > 0n) {
                const pb = getAmountOut(vBuy, vUSDL, vPB);
                vUSDL += vBuy; vPB -= pb;
            }
            nettedPBc += tranche;
            nettedCount += 1;
        }

        // AMM receives everything except netting settlements (vBuy amounts are also AMM buys)
        const ammBuyAmount = usdlWei - totalNettedSettlement;
        const ammPBOut = ammBuyAmount > 0n ? getAmountOut(ammBuyAmount, vUSDL, vPB) : 0n;
        const totalPB = nettedPBc + ammPBOut;
        const avgPrice = totalPB > 0n ? (usdlWei * (10n ** 18n)) / totalPB : 0n;
        return { nettedCount, nettedPBc, ammPBOut, totalPB, avgPrice };
    }

    window.PBTestDapp = {
        ACTIVE_NETWORK_KEY,
        CHAIN_ID,
        CHAIN_NAME,
        RPC_URL,
        INDEXER_URL,
        TVault,
        TVaultViews,
        TPB,
        TPBc,
        TPBt,
        TPBr,
        TPBi,
        TUSDL,
        TPBRemoveUserLP,
        PULSEX_ROUTER,
        PULSEX_PAIR,
        VAULT_EVENT_FROM_BLOCK,
        VAULT_ABI,
        VAULT_VIEWS_ABI,
        TOKEN_ABI,
        PAIR_ABI,
        REMOVE_USER_LP_ABI,
        ROUTER_ABI,
        NFT_ABI,
        BADGE_ABI,
        ERC1155_ABI,
        ERC20_MINT_ABI,
        hexChainId,
        ensureWalletOnChain,
        bigIntSqrt,
        getAmountOut,
        getAmountIn,
        computeUSDLForPrice,
        getErrorData,
        decodeVaultCustomError,
        formatNumber,
        formatPrice,
        showStatus,
        showQuoteStatus,
        showTransactionStatus,
        createOperationTerminal,
        fetchHintsGithubFallback,
        simulateNettingQuick,
    };
})();