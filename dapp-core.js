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
        createOperationTerminal
    };
})();