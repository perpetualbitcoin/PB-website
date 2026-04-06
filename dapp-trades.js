(function () {
    const {
        INDEXER_URL,
        TVault,
        TPB,
        TPBc,
        TPBt,
        TUSDL,
        PULSEX_ROUTER,
        PULSEX_PAIR,
        NFT_ABI,
        getAmountOut,
        getAmountIn,
        computeUSDLForPrice,
        decodeVaultCustomError,
        formatNumber,
        formatPrice,
        showStatus,
        showQuoteStatus,
        showTransactionStatus,
    } = window.PBTestDapp;

    function create(app) {
        const AUTO_CHUNK_THRESHOLD = 3000;
        const AUTO_CHUNK_MAX = 3000;
        const INDEXER_CHECKPOINT_POLL_MS = 1500;
        const INDEXER_CHECKPOINT_TIMEOUT_MS = 20000;
        let buyQuoteRefreshTimer = null;
        let lastBuyQuoteTimestamp = null;
        let lastBuyQuoteAmount = null;
        let lastBuyPreview = null;
        let lastSellPreview = null;
        let lastBuyPreviewTerminalState = createEmptyPreviewState('Buy');
        let lastBuyChainTerminalEntries = [];
        let lastSellPreviewTerminalState = createEmptyPreviewState('Sell');
        let lastSellChainTerminalEntries = [];
        let activeTerminalMode = 'buy';
        let buyQuoteInFlight = false;
        let buyExecutionInFlight = false;
        let nettingPreviewEndpointMissing = false;
        const receiptVaultInterface = new ethers.Interface([
            'event UnlockNetted(uint256 indexed pbtId, uint256 unlockIndex, uint256 pbcSettled, uint256 usdlPaid, address payoutAddress, uint256 settlementPrice, uint256 newTriggerPrice, uint256 remainingPBcLocked)',
            'event BuyWithNetting(address indexed buyer, address indexed recipient, uint256 indexed pbtId, uint256 usdlIn, uint256 totalPBOut, uint256 nettedPB, uint256 ammPB, uint256 lpPB, uint256 lpUSDL, uint256 unlocksNetted)'
        ]);
        const receiptErc20Interface = new ethers.Interface([
            'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]);
        const receiptPbtInterface = new ethers.Interface([
            'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
        ]);
        const erc20TransferTopic = ethers.id('Transfer(address,address,uint256)');
        const pbtTransferTopic = ethers.id('Transfer(address,address,uint256)');

        function createEmptyPreviewState(label) {
            return {
                mode: `${label} preview`,
                summaryRows: [['Status', 'Waiting for quote']],
                steps: [],
                addresses: [],
            };
        }

        function summarizeIds(ids, limit = 12) {
            if (!Array.isArray(ids) || !ids.length) return 'None';
            const head = ids.slice(0, limit).join(', ');
            return ids.length > limit ? `${head} ...` : head;
        }

        function escapeHtml(value) {
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
                return `<span class="terminal-address">${escapeHtml(text)}</span>`;
            }
            if (/^(Vault\.buyPBDirect|swapExactTokensForTokens|approve|buyPBDirect)$/.test(text)) {
                return `<span class="terminal-function">${escapeHtml(text)}</span>`;
            }
            return `<span class="terminal-value">${escapeHtml(text)}</span>`;
        }

        function setText(id, value) {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        }

        function setTerminal(id, html) {
            const element = document.getElementById(id);
            if (element) element.innerHTML = html;
        }

        function setTerminalMode(mode) {
            activeTerminalMode = mode === 'sell' ? 'sell' : 'buy';
            const label = activeTerminalMode === 'sell' ? 'Sell' : 'Buy';
            setText('route-terminal-mode', label);
            setText('route-terminal-title-mode', label);
        }

        function renderPreviewTerminal(state) {
            const lines = [];
            lines.push(`<div class="terminal-line"><span class="terminal-prefix">$</span><span class="terminal-function">mode</span> <span class="terminal-key">=</span> ${formatTerminalInline(state.mode || 'Waiting')}</div>`);

            (state.summaryRows || []).forEach(([label, value]) => {
                lines.push(`<div class="terminal-line"><span class="terminal-prefix">&gt;</span><span class="terminal-key">${escapeHtml(label)}:</span> ${formatTerminalInline(value)}</div>`);
            });

            if ((state.steps || []).length) {
                lines.push('<div class="terminal-line"><span class="terminal-prefix">#</span><span class="terminal-muted">predicted sequence</span></div>');
            }

            (state.steps || []).forEach((step, index) => {
                lines.push(`<div class="terminal-line"><span class="terminal-prefix">${index + 1}.</span><span class="terminal-function">${escapeHtml(step.title)}</span> <span class="terminal-muted">[${escapeHtml(step.badge || 'Step')}]</span></div>`);
                lines.push(`<div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-muted">${escapeHtml(step.body || '')}</span></div>`);
                (step.details || []).forEach(([detailLabel, detailValue]) => {
                    lines.push(`<div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-key">${escapeHtml(detailLabel)}:</span> ${formatTerminalInline(detailValue)}</div>`);
                });
            });

            if ((state.addresses || []).length) {
                lines.push('<div class="terminal-line"><span class="terminal-prefix">@</span><span class="terminal-muted">addresses / contracts</span></div>');
            }

            (state.addresses || []).forEach(([label, value]) => {
                lines.push(`<div class="terminal-line"><span class="terminal-prefix">@</span><span class="terminal-key">${escapeHtml(label)}:</span> ${formatTerminalInline(value)}</div>`);
            });

            return lines.join('');
        }

        function renderChainTerminal(entries) {
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
                    <div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-key">${escapeHtml(label)}:</span> ${formatTerminalInline(value)}</div>
                `).join('');
                return `
                    <div class="terminal-line"><span class="terminal-prefix">$</span><span class="${toneClass}">${escapeHtml(entry.title)}</span></div>
                    <div class="terminal-line"><span class="terminal-prefix">|</span><span class="terminal-muted">${escapeHtml(entry.body || '')}</span></div>
                    ${detailsHtml}
                `;
            }).join('');
        }

        function pushChainEvent(mode, title, body, tone = 'info', details = []) {
            const target = mode === 'sell' ? lastSellChainTerminalEntries : lastBuyChainTerminalEntries;
            target.push({ title, body, tone, details });
            renderActiveTerminals();
        }

        function resetChainEvents(mode) {
            if (mode === 'sell') {
                lastSellChainTerminalEntries = [];
            } else {
                lastBuyChainTerminalEntries = [];
            }
            renderActiveTerminals();
        }

        function renderActiveTerminals() {
            const previewState = activeTerminalMode === 'sell'
                ? lastSellPreviewTerminalState
                : lastBuyPreviewTerminalState;
            const chainEntries = activeTerminalMode === 'sell'
                ? lastSellChainTerminalEntries
                : lastBuyChainTerminalEntries;
            const previewHtml = renderPreviewTerminal(previewState);
            const chainHtml = renderChainTerminal(chainEntries);
            const combined = `
                <div class="terminal-divider">Prediction</div>
                ${previewHtml}
                <div class="terminal-divider">On-Chain</div>
                ${chainHtml}
            `;
            setTerminal('route-terminal', combined);
        }

        function shortHash(hash) {
            if (!hash) return '-';
            return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
        }

        function diffBalance(next, prev) {
            return BigInt(next || 0n) - BigInt(prev || 0n);
        }

        function formatSignedTokenAmount(value, decimals = 18, digits = 4) {
            const amount = BigInt(value || 0n);
            const sign = amount < 0n ? '-' : '+';
            const absolute = amount < 0n ? -amount : amount;
            return `${sign}${formatNumber(ethers.formatUnits(absolute, decimals), digits)}`;
        }

        function formatSignedCount(value) {
            const amount = BigInt(value || 0n);
            if (amount === 0n) return '0';
            return `${amount > 0n ? '+' : ''}${amount.toString()}`;
        }

        function unitsFloat(value, decimals = 18) {
            return Number(ethers.formatUnits(value || 0n, decimals));
        }

        function formatUsd(value, decimals = 2) {
            return '$' + formatNumber(Number(value || 0), decimals);
        }

        function getContractMethodName(contractMethod) {
            return contractMethod?.fragment?.name
                || contractMethod?.name
                || '';
        }

        function getFallbackGasLimit(methodName, args) {
            if (methodName === 'approve') {
                return 120000n;
            }

            if (methodName === 'buyPBDirect') {
                const hintedIds = Array.isArray(args?.[3]) ? args[3] : [];
                const boundedHintCount = Math.min(hintedIds.length, 12);
                return 1200000n + (BigInt(boundedHintCount) * 250000n);
            }

            return null;
        }

        function computeBuyValueMetrics(pbAmount, pbcAmount, startPrice, finalPrice, usdlSpent) {
            const pbTotal = BigInt(pbAmount || 0n) + BigInt(pbcAmount || 0n);
            const pbTotalFloat = unitsFloat(pbTotal, 18);
            const spentFloat = unitsFloat(usdlSpent || 0n, 18);
            return {
                pbTotal,
                pbTotalFloat,
                startValue: pbTotalFloat * Number(startPrice || 0),
                finalValue: pbTotalFloat * Number(finalPrice || 0),
                avgPrice: pbTotalFloat > 0 ? spentFloat / pbTotalFloat : 0,
            };
        }

        async function buildWriteOverrides(contractMethod, args) {
            const overrides = {};
            const methodName = getContractMethodName(contractMethod);
            const feeProvider = (typeof app.getReadProvider === 'function' ? app.getReadProvider() : null)
                || (typeof app.getWeb3 === 'function' ? app.getWeb3() : null)
                || app.getSigner()?.provider
                || null;

            if (feeProvider && typeof feeProvider.getFeeData === 'function') {
                try {
                    const feeData = await feeProvider.getFeeData();
                    if (feeData?.gasPrice && feeData.gasPrice > 0n) {
                        overrides.gasPrice = feeData.gasPrice;
                    } else {
                        if (feeData?.maxFeePerGas && feeData.maxFeePerGas > 0n) {
                            overrides.maxFeePerGas = feeData.maxFeePerGas;
                        }
                        if (feeData?.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n) {
                            overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                        }
                    }
                } catch (err) {
                    console.warn('Unable to load fee data for write transaction:', err);
                }
            }

            if (contractMethod && typeof contractMethod.estimateGas === 'function') {
                try {
                    const estimatedGas = await contractMethod.estimateGas(...args, overrides);
                    overrides.gasLimit = estimatedGas + (estimatedGas / 5n) + 10000n;
                } catch (err) {
                    console.warn('Unable to estimate gas for write transaction:', err);
                    if (!overrides.gasLimit) {
                        const fallbackGasLimit = getFallbackGasLimit(methodName, args);
                        if (fallbackGasLimit) {
                            // Some wallet providers fail preflight estimateGas even for valid writes.
                            // Supplying a conservative gas limit allows the wallet prompt to open anyway.
                            overrides.gasLimit = fallbackGasLimit;
                        }
                    }
                }
            }

            return overrides;
        }

        async function sendContractWrite(contractMethod, args) {
            const overrides = await buildWriteOverrides(contractMethod, args);
            return contractMethod(...args, overrides);
        }

        async function captureRecipientBalances(address) {
            const pbContract = app.contractLayer.getReadContract('pb');
            const pbcContract = app.contractLayer.getReadContract('pbc');
            const tusdlContract = app.contractLayer.getReadContract('tusdl');
            const pbtContract = app.contractLayer.getReadContract('pbt', NFT_ABI);

            const [pb, pbc, usdl, pbt] = await Promise.all([
                pbContract.balanceOf(address),
                pbcContract.balanceOf(address),
                tusdlContract.balanceOf(address),
                pbtContract.balanceOf(address),
            ]);

            return { pb, pbc, usdl, pbt };
        }

        function decodeBuyReceiptLogs(receipt) {
            const decoded = {
                buyWithNetting: [],
                unlockNetted: [],
                pbtMints: [],
            };

            for (const log of receipt?.logs || []) {
                const address = String(log.address || '').toLowerCase();

                if (address === String(TVault).toLowerCase()) {
                    try {
                        const parsed = receiptVaultInterface.parseLog(log);
                        const name = parsed?.name || parsed?.fragment?.name;
                        if (name === 'BuyWithNetting') decoded.buyWithNetting.push(parsed.args);
                        if (name === 'UnlockNetted') decoded.unlockNetted.push(parsed.args);
                    } catch {}
                }

                if (address === String(TPBt).toLowerCase() && log.topics?.[0] === pbtTransferTopic) {
                    try {
                        const parsed = receiptPbtInterface.parseLog(log);
                        if (String(parsed.args.from).toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
                            decoded.pbtMints.push({
                                to: String(parsed.args.to),
                                tokenId: parsed.args.tokenId,
                            });
                        }
                    } catch {}
                }

                if (log.topics?.[0] !== erc20TransferTopic) continue;
                if (address !== String(TPB).toLowerCase() && address !== String(TPBc).toLowerCase() && address !== String(TUSDL).toLowerCase()) {
                    continue;
                }
                try {
                    receiptErc20Interface.parseLog(log);
                } catch {}
            }

            return decoded;
        }

        function getBuyRecipientLabel() {
            const gift = document.getElementById('gift-buy-checkbox');
            const giftRecipient = document.getElementById('gift-recipient');
            if (gift?.checked) {
                return giftRecipient?.value?.trim() || 'Gift recipient not set';
            }
            return 'Connected wallet';
        }

        function getBuyRouteLabel(preview) {
            if (!preview) return '-';
            if (preview.nettedCount > 0 && preview.ammSellPB > 0n) return 'Mixed settlement';
            if (preview.nettedCount > 0) return 'Netting + AMM';
            return 'AMM only';
        }

        function getBuyRouteExplanation(preview) {
            const reasons = [];
            if (preview.chunkPlan.length > 1) {
                reasons.push(`split into ${preview.chunkPlan.length} sequential calls`);
            }
            if (preview.nettedCount > 0) {
                reasons.push(`${preview.nettedCount} position(s) are expected to net before or during the AMM leg`);
            }
            if (preview.ammSellPB > 0n) {
                reasons.push('the route includes mixed internal settlement instead of a clean AMM buy');
            } else {
                reasons.push('the remainder should execute through the AMM after internal netting');
            }
            if (getBuyRecipientLabel() !== 'Connected wallet') {
                reasons.push('output is directed to a gift recipient');
            }
            return reasons.join('; ') + '.';
        }

        function renderBuySigningPreview(preview) {
            setTerminalMode('buy');
            renderActiveTerminals();
        }

        function refreshBuySigningPreview() {
            renderBuySigningPreview(lastBuyPreview);
        }

        function renderSellSigningPreview(preview) {
            setTerminalMode('sell');
            renderActiveTerminals();
        }

        function getAutoChunkElements() {
            return {
                wrap: document.getElementById('buy-autochunk-wrap'),
                checkbox: document.getElementById('buy-autochunk-checkbox'),
                plan: document.getElementById('buy-autochunk-plan'),
            };
        }

        function buildChunkPlan(amountStr) {
            const normalized = normalizeBuyAmount(amountStr);
            if (!normalized) return [];

            const totalAmount = parseFloat(normalized);
            if (!Number.isFinite(totalAmount) || totalAmount <= AUTO_CHUNK_THRESHOLD) {
                return [normalized];
            }

            const chunkCount = Math.ceil(totalAmount / AUTO_CHUNK_MAX);
            const totalMicros = ethers.parseUnits(normalized, 6);
            const baseChunkMicros = totalMicros / BigInt(chunkCount);
            const remainderMicros = totalMicros % BigInt(chunkCount);
            const chunks = [];

            for (let index = 0; index < chunkCount; index++) {
                const chunkMicros = baseChunkMicros + (index < Number(remainderMicros) ? 1n : 0n);
                chunks.push(ethers.formatUnits(chunkMicros, 6));
            }

            return chunks;
        }

        function updateBuyAutoChunkUI() {
            const { wrap, checkbox, plan } = getAutoChunkElements();
            if (!wrap || !checkbox || !plan) return;

            const normalized = normalizeBuyAmount(document.getElementById('buy-amount')?.value || '');
            const totalAmount = normalized ? parseFloat(normalized) : 0;

            if (!normalized || totalAmount <= AUTO_CHUNK_THRESHOLD) {
                wrap.style.display = 'none';
                checkbox.checked = false;
                delete checkbox.dataset.touched;
                plan.textContent = '';
                return;
            }

            const chunks = buildChunkPlan(normalized);
            const chunkCount = chunks.length;
            const firstChunk = chunkCount > 0 ? parseFloat(chunks[0]) : 0;
            if (checkbox.dataset.touched !== 'true') checkbox.checked = true;
            wrap.style.display = '';
            plan.textContent = `${checkbox.checked ? 'Enabled' : 'Optional'}: ${chunkCount} buy${chunkCount === 1 ? '' : 's'} of about $${formatNumber(firstChunk, 2)} each.`;
        }

        async function fetchUnlockSelection(usdlWei, quoteContext) {
            showStatus('buy-status', `⏳ Fetching exact netting hints from indexer... ${quoteContext}`, 'info');

            let resp;
            try {
                resp = await fetch(`${INDEXER_URL}/unlock-ids?usdl=${usdlWei.toString()}&limit=500&strict=true`);
            } catch (indexerErr) {
                console.warn('Strict unlock selection failed:', indexerErr.message);
                throw new Error(`Indexer unavailable for safe netting selection: ${indexerErr.message}`);
            }

            let data = {};
            try {
                data = await resp.json();
            } catch (parseErr) {
                data = {};
            }

            if (!resp.ok) {
                const message = data.message || data.error || `Indexer returned ${resp.status}`;
                throw new Error(message);
            }

            const unlockIds = Array.isArray(data.unlockIds) ? data.unlockIds : [];
            if (data.truncated) {
                throw new Error('Unlock selection was truncated; refusing unsafe partial netting hints.');
            }

            if (unlockIds.length > 0) {
                const partialText = data.hasPartial ? ' including the final partial trigger' : '';
                showStatus('buy-status', `📊 ${unlockIds.length} positions selected for netting${partialText}`, 'info');
            } else {
                showStatus('buy-status', '📊 No eligible netting positions for this buy', 'info');
            }

            return data;
        }

        async function prepareSingleBuy(usdlWei, quoteContext) {
            const selection = await fetchUnlockSelection(usdlWei, quoteContext);
            const unlockIds = selection.unlockIds || [];
            return { selection, unlockIds };
        }

        async function executeSingleBuy(vaultContract, usdlWei, usdlDisplay, recipient, quoteContext, chunkLabel, preparedSelection = null) {
            const prepared = preparedSelection || await prepareSingleBuy(usdlWei, quoteContext);
            const unlockIds = prepared.unlockIds || [];
            let attemptedUnlockIds = unlockIds;
            showStatus('buy-status', `⏳ Executing ${chunkLabel}: $${usdlDisplay} USDL with ${unlockIds.length} netting hints. ${quoteContext}`, 'info');

            let buyResult;
            try {
                buyResult = await submitVaultBuy(vaultContract, usdlWei, recipient, attemptedUnlockIds);
            } catch (err) {
                if (!shouldRetryBuyWithoutHints(err, attemptedUnlockIds)) {
                    throw err;
                }

                const refreshed = await prepareSingleBuy(usdlWei, `${quoteContext} Refreshing hints after estimate failure.`);
                const refreshedUnlockIds = refreshed.unlockIds || [];
                const hintsChanged = JSON.stringify(refreshedUnlockIds) !== JSON.stringify(attemptedUnlockIds);

                if (!refreshedUnlockIds.length) {
                    throw new Error('Refreshed netting hints came back empty after an estimate failure. Buy aborted instead of stripping hints.');
                }

                if (!hintsChanged) {
                    throw err;
                }

                pushChainEvent('buy', 'Hints refreshed', 'The first hinted buy failed during estimation, so the dapp fetched a fresh hint set and retried.', 'warning', [
                    ['Chunk', chunkLabel],
                    ['Original hints', summarizeIds(attemptedUnlockIds)],
                    ['Refreshed hints', summarizeIds(refreshedUnlockIds)],
                ]);

                attemptedUnlockIds = refreshedUnlockIds;
                buyResult = await submitVaultBuy(vaultContract, usdlWei, recipient, attemptedUnlockIds);
            }

            const { buyTx, minPBOut, rawPB, usedUnlockIds } = buyResult;
            const receipt = await buyTx.wait();
            return { receipt, txHash: buyTx.hash, unlockIds: usedUnlockIds, minPBOut, rawPB };
        }

        async function fetchIndexerHealth() {
            const response = await fetch(`${INDEXER_URL}/health`);
            if (!response.ok) {
                throw new Error(`Indexer health returned ${response.status}`);
            }

            return response.json();
        }

        async function waitForIndexerCheckpoint(targetBlock, chunkLabel) {
            if (!Number.isFinite(targetBlock) || targetBlock <= 0) return;

            const startedAt = Date.now();
            let lastCheckpoint = 0;
            let lastError = null;

            pushChainEvent('buy', 'Waiting for indexer sync', 'The next chunk will not fetch new hints until the DB checkpoint reaches the confirmed chunk block.', 'warning', [
                ['Chunk', chunkLabel],
                ['Target block', String(targetBlock)],
                ['Source', '/api/health checkpoint'],
            ]);

            while ((Date.now() - startedAt) < INDEXER_CHECKPOINT_TIMEOUT_MS) {
                try {
                    const health = await fetchIndexerHealth();
                    lastCheckpoint = Number(health.checkpoint || 0);
                    if (lastCheckpoint >= targetBlock) {
                        pushChainEvent('buy', 'Indexer synced', 'The DB has indexed the confirmed chunk block before the next hint fetch.', 'success', [
                            ['Chunk', chunkLabel],
                            ['Target block', String(targetBlock)],
                            ['Indexer checkpoint', String(lastCheckpoint)],
                        ]);
                        return true;
                    }
                } catch (err) {
                    lastError = err;
                }

                showStatus('buy-status', `⏳ Waiting for indexer to catch up after ${chunkLabel} (checkpoint ${lastCheckpoint}/${targetBlock})...`, 'info');
                await new Promise((resolve) => setTimeout(resolve, INDEXER_CHECKPOINT_POLL_MS));
            }

            pushChainEvent('buy', 'Indexer wait timed out', 'Proceeding with the next chunk before the DB checkpoint fully caught up.', 'warning', [
                ['Chunk', chunkLabel],
                ['Target block', String(targetBlock)],
                ['Last checkpoint', String(lastCheckpoint)],
                ['Reason', lastError?.message || 'Checkpoint timeout'],
            ]);
            return false;
        }

        function showNettingPreviewUnavailable(message) {
            showStatus('buy-status', message || '⚠️ Netting preview endpoint is not deployed yet - quote without netting', 'warning');
        }

        function shouldRetryBuyWithoutHints(err, unlockIds) {
            if (!Array.isArray(unlockIds) || unlockIds.length === 0) return false;

            const message = String(err?.reason || err?.message || '').toLowerCase();
            const decoded = String(decodeVaultCustomError(err) || '').toLowerCase();

            return (
                decoded === 'invalidamount'
                || decoded === 'notexist'
                || message.includes('estimategas')
                || message.includes('missing revert data')
                || message.includes('call_exception')
            );
        }

        async function submitVaultBuy(vaultContract, usdlWei, recipient, unlockIds) {
            const pairContract = app.contractLayer.getReadContract('pair');
            const [r0, r1] = await pairContract.getReserves();
            const t0 = await pairContract.token0();
            const rUSDL = t0.toLowerCase() === TPB.toLowerCase() ? r1 : r0;
            const rPB = t0.toLowerCase() === TPB.toLowerCase() ? r0 : r1;
            const rawPB = getAmountOut(usdlWei, rUSDL, rPB);
            const minPBOut = rawPB * 50n / 100n;

            const hintedUnlockIds = Array.isArray(unlockIds) ? unlockIds : [];

            const buyTx = await sendContractWrite(vaultContract.buyPBDirect, [usdlWei, minPBOut, recipient, hintedUnlockIds]);
            return { buyTx, minPBOut, rawPB, usedUnlockIds: hintedUnlockIds };
        }

        function normalizeBuyAmount(value) {
            const amount = parseFloat(value);
            if (!value || !Number.isFinite(amount) || amount <= 0) return null;
            return amount.toFixed(6);
        }

        function clearBuyQuoteRefreshTimer() {
            if (buyQuoteRefreshTimer) {
                clearInterval(buyQuoteRefreshTimer);
                buyQuoteRefreshTimer = null;
            }
        }

        function getQuoteAgeText(timestamp) {
            const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
            if (seconds < 60) return `${seconds}s ago`;
            const minutes = Math.floor(seconds / 60);
            const remSeconds = seconds % 60;
            return `${minutes}m ${remSeconds}s ago`;
        }

        function setBuyQuoteMeta(message, state = 'idle') {
            const el = document.getElementById('buy-quote-meta');
            if (!el) return;
            el.textContent = message;
            el.classList.remove('is-idle', 'is-stale');
            if (state === 'idle' || state === 'stale') {
                el.classList.add(state === 'idle' ? 'is-idle' : 'is-stale');
            }
        }

        function updateBuyQuoteMeta(extraMessage = '') {
            const currentAmount = normalizeBuyAmount(document.getElementById('buy-amount')?.value || '');
            if (!lastBuyQuoteTimestamp || !lastBuyQuoteAmount) {
                setBuyQuoteMeta(extraMessage || 'No quote fetched yet. Refreshes every 30s after a quote is loaded.', 'idle');
                return;
            }

            const timeText = new Date(lastBuyQuoteTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const ageText = getQuoteAgeText(lastBuyQuoteTimestamp);
            const amountChanged = currentAmount !== lastBuyQuoteAmount;

            if (amountChanged) {
                setBuyQuoteMeta(
                    extraMessage || `Input changed since last quote. Last update: ${timeText} (${ageText}) for ${parseFloat(lastBuyQuoteAmount).toFixed(2)} USDL.`,
                    'stale'
                );
                return;
            }

            const isStale = (Date.now() - lastBuyQuoteTimestamp) >= 30000;
            setBuyQuoteMeta(
                extraMessage || `Last update: ${timeText} (${ageText}). Auto-refreshes every 30s while connected.`,
                isStale ? 'stale' : 'fresh'
            );
        }

        function getBuyQuoteExecutionContext() {
            const currentAmount = normalizeBuyAmount(document.getElementById('buy-amount')?.value || '');
            if (!lastBuyQuoteTimestamp || !lastBuyQuoteAmount) {
                return 'No prior quote loaded in this session.';
            }
            const ageText = getQuoteAgeText(lastBuyQuoteTimestamp);
            if (currentAmount !== lastBuyQuoteAmount) {
                return `Last quote is stale for the current input. Previous quote refreshed ${ageText}.`;
            }
            return `Last quote refreshed ${ageText}.`;
        }

        function shouldAutoRefreshBuyQuote() {
            const currentAmount = normalizeBuyAmount(document.getElementById('buy-amount')?.value || '');
            return Boolean(
                app.getAccount() &&
                lastBuyQuoteTimestamp &&
                lastBuyQuoteAmount &&
                currentAmount &&
                currentAmount === lastBuyQuoteAmount &&
                !buyQuoteInFlight &&
                !buyExecutionInFlight
            );
        }

        function scheduleBuyQuoteRefresh() {
            clearBuyQuoteRefreshTimer();
            if (!shouldAutoRefreshBuyQuote()) return;
            buyQuoteRefreshTimer = setInterval(() => {
                if (!shouldAutoRefreshBuyQuote()) return;
                getQuote({ silent: true });
            }, 30000);
        }

        function handleBuyAmountInputChange() {
            updateBuyAutoChunkUI();
            updateBuyQuoteMeta();
            refreshBuySigningPreview();
            scheduleBuyQuoteRefresh();
        }

        async function getQuote(options = {}) {
            const { silent = false } = options;
            if (!app.getAccount()) {
                if (!silent) alert('Connect wallet first');
                return;
            }
            if (buyQuoteInFlight) return;
            try {
                const usdlAmountStr = document.getElementById('buy-amount').value;
                updateBuyAutoChunkUI();
                if (!usdlAmountStr || parseFloat(usdlAmountStr) <= 0) {
                    clearBuyQuoteRefreshTimer();
                    updateBuyQuoteMeta();
                    if (!silent) alert('Enter valid USDL amount');
                    return;
                }
                buyQuoteInFlight = true;
                const usdlWei = ethers.parseEther(usdlAmountStr);
                let quoteWarningShown = false;

                if (!silent) {
                    showStatus('buy-status', '⏳ Simulating netting quote...', 'info');
                }

                const pairContract = app.contractLayer.getReadContract('pair');
                const [reserve0, reserve1] = await pairContract.getReserves();
                const token0 = await pairContract.token0();
                let reservePB;
                let reserveUSDL;
                if (token0.toLowerCase() === TPB.toLowerCase()) {
                    reservePB = reserve0;
                    reserveUSDL = reserve1;
                } else {
                    reservePB = reserve1;
                    reserveUSDL = reserve0;
                }

                let positions = [];
                if (nettingPreviewEndpointMissing) {
                    showNettingPreviewUnavailable();
                    quoteWarningShown = true;
                } else {
                    try {
                        const resp = await fetch(`${INDEXER_URL}/netting-positions?usdl=${usdlWei.toString()}`);
                        if (resp.ok) {
                            const data = await resp.json();
                            positions = (data.positions || []).map((p) => ({
                                id: p.id,
                                triggerPrice: BigInt(p.triggerPrice),
                                nextTriggerUSDL: BigInt(p.nextTriggerUSDL || '0'),
                                nextTriggerPBc: BigInt(p.nextTriggerPBc || '0'),
                                pbcRemaining: BigInt(p.pbcLocked),
                            }));
                        } else if (resp.status === 404) {
                            nettingPreviewEndpointMissing = true;
                            showNettingPreviewUnavailable('⚠️ Netting preview endpoint is not deployed yet - quote without netting');
                            quoteWarningShown = true;
                        } else if (!silent) {
                            showNettingPreviewUnavailable('⚠️ Netting preview unavailable - quote without netting');
                            quoteWarningShown = true;
                        }
                    } catch (fetchErr) {
                        console.warn('Indexer fetch failed for netting positions:', fetchErr.message);
                        if (!silent) {
                            showNettingPreviewUnavailable('⚠️ Netting preview unavailable - quote without netting');
                            quoteWarningShown = true;
                        }
                    }
                }

                let vReservePB = reservePB;
                let vReserveUSDL = reserveUSDL;
                let budget = usdlWei;
                let totalNettedSettlement = 0n;
                let absorbedPBc = 0n;
                let nettedCount = 0;
                let partialPBc = 0n;
                let unsettledPBc = 0n;
                let unsettledOwed = 0n;
                let hasPartial = false;
                const E18 = 10n ** 18n;
                const TRANCHE_FRACTION = 3n;

                for (const pos of positions) {
                    const triggerPrice = pos.triggerPrice;
                    const pbcLocked = pos.pbcRemaining;
                    if (pbcLocked === 0n) continue;

                    const vBuy = computeUSDLForPrice(vReservePB, vReserveUSDL, triggerPrice);
                    const tranche = pos.nextTriggerPBc > 0n ? pos.nextTriggerPBc : (pbcLocked / TRANCHE_FRACTION);
                    const settlement = pos.nextTriggerUSDL > 0n ? pos.nextTriggerUSDL : ((tranche * triggerPrice) / E18);

                    if (budget < vBuy + settlement) {
                        if (budget >= vBuy) {
                            if (vBuy > 0n) {
                                const pbBought = getAmountOut(vBuy, vReserveUSDL, vReservePB);
                                vReserveUSDL += vBuy;
                                vReservePB -= pbBought;
                                budget -= vBuy;
                            }
                            const partialPayment = budget;
                            partialPBc = settlement > 0n ? (tranche * partialPayment) / settlement : 0n;
                            unsettledPBc = tranche - partialPBc;
                            unsettledOwed = settlement - partialPayment;
                            budget = 0n;
                            totalNettedSettlement += partialPayment;
                            absorbedPBc += partialPBc;
                            nettedCount++;
                            hasPartial = true;
                        }
                        break;
                    }

                    budget -= (vBuy + settlement);
                    totalNettedSettlement += settlement;

                    if (vBuy > 0n) {
                        const pbBought = getAmountOut(vBuy, vReserveUSDL, vReservePB);
                        vReserveUSDL += vBuy;
                        vReservePB -= pbBought;
                    }

                    absorbedPBc += tranche;
                    nettedCount++;
                }

                let ammBuyAmount = usdlWei - totalNettedSettlement;
                let internalPBc = 0n;
                let ammSellPB = 0n;

                if (hasPartial && unsettledOwed > 0n && ammBuyAmount > 0n) {
                    const internalUSDL = ammBuyAmount < unsettledOwed ? ammBuyAmount : unsettledOwed;
                    internalPBc = (unsettledPBc * internalUSDL) / unsettledOwed;
                    unsettledOwed -= internalUSDL;
                    ammBuyAmount -= internalUSDL;
                }

                let ammPBOut = 0n;
                let ammDetailText = 'AMM Buy: 0 PB';
                let ammDetailType = 'buy';
                const isNetBuy = ammBuyAmount > unsettledOwed;
                const isNetSell = ammBuyAmount < unsettledOwed;

                if (isNetBuy) {
                    let netAMM = ammBuyAmount - unsettledOwed;
                    const usdlForLP = (netAMM * 3690n) / 10000n;
                    netAMM -= usdlForLP;
                    if (netAMM > 0n) {
                        ammPBOut = getAmountOut(netAMM, reserveUSDL, reservePB);
                    }
                    if (usdlForLP > 0n) {
                        ammPBOut += (usdlForLP * reservePB) / reserveUSDL;
                    }
                    ammDetailText = `AMM Buy: ${formatNumber(ethers.formatEther(ammPBOut), 2)} PB`;
                    ammDetailType = 'buy';
                } else if (isNetSell) {
                    const netSellUSDL = unsettledOwed - ammBuyAmount;
                    ammSellPB = getAmountIn(netSellUSDL, reservePB, reserveUSDL);
                    ammDetailText = `AMM Sell: ${formatNumber(ethers.formatEther(ammSellPB), 2)} PB`;
                    ammDetailType = 'sell';
                }

                const totalNettedPBc = absorbedPBc + internalPBc;
                const totalPB = totalNettedPBc + ammPBOut;
                const liquid = (totalPB * 369n) / 10000n;
                const locked = totalPB - liquid;

                const totalFormatted = formatNumber(ethers.formatEther(totalPB), 2);
                const liquidFormatted = formatNumber(ethers.formatEther(liquid), 2);
                const lockedFormatted = formatNumber(ethers.formatEther(locked), 2);
                const totalPBFloat = parseFloat(ethers.formatEther(totalPB));
                const currentPrice = reservePB > 0n
                    ? parseFloat(ethers.formatEther(reserveUSDL)) / parseFloat(ethers.formatEther(reservePB))
                    : 0;
                const predictedValue = totalPBFloat * currentPrice;
                const avgPrice = totalPBFloat > 0 ? parseFloat(usdlAmountStr) / totalPBFloat : 0;
                document.getElementById('quote-pb').innerText = '~' + totalFormatted;
                document.getElementById('quote-liquid').innerText = liquidFormatted + ' PB';
                document.getElementById('quote-locked').innerText = lockedFormatted + ' PBc';
                document.getElementById('quote-avg-price').innerText = totalPBFloat > 0 ? formatPrice(avgPrice) : '-';
                const selection = await fetchUnlockSelection(usdlWei, getBuyQuoteExecutionContext());
                const unlockIds = Array.isArray(selection.unlockIds) ? selection.unlockIds : [];
                const rawPB = getAmountOut(usdlWei, reserveUSDL, reservePB);
                const minPBOut = rawPB * 50n / 100n;
                lastBuyPreview = {
                    usdlDisplay: parseFloat(usdlAmountStr),
                    recipient: getBuyRecipientLabel(),
                    totalPB,
                    liquid,
                    locked,
                    minPBOut,
                    rawPB,
                    unlockIds,
                    nettedCount,
                    currentPrice,
                    predictedValue,
                    avgPrice,
                    totalNettedSettlement,
                    absorbedPBc,
                    internalPBc,
                    ammPBOut,
                    ammSellPB,
                    chunkPlan: document.getElementById('buy-autochunk-checkbox')?.checked ? buildChunkPlan(usdlAmountStr) : [normalizeBuyAmount(usdlAmountStr)],
                };
                lastBuyPreviewTerminalState = {
                    mode: 'Buy preview',
                    summaryRows: [
                        ['Action', 'Buy PB'],
                        ['Input', '$' + formatNumber(parseFloat(usdlAmountStr), 2) + ' USDL'],
                        ['Current Price', formatPrice(currentPrice)],
                        ['Expected PB', formatNumber(ethers.formatEther(totalPB), 4) + ' PB'],
                        ['Predicted $', '$' + formatNumber(predictedValue, 2)],
                        ['Liquid / Locked', `${formatNumber(ethers.formatEther(liquid), 2)} / ${formatNumber(ethers.formatEther(locked), 2)}`],
                        ['Recipient', getBuyRecipientLabel()],
                        ['Netting hints', unlockIds.length ? unlockIds.length + ' IDs' : 'No hint IDs'],
                    ],
                    steps: [
                        {
                            title: 'What you will sign',
                            badge: 'Signer',
                            body: lastBuyPreview.chunkPlan.length > 1
                                ? `The wallet should sign ${lastBuyPreview.chunkPlan.length} sequential Vault.buyPBDirect calls.`
                                : 'The wallet should sign one Vault.buyPBDirect call.',
                            details: [
                                ['Function', 'Vault.buyPBDirect'],
                                ['Contract', TVault],
                                ['Spend USDL', '$' + formatNumber(parseFloat(usdlAmountStr), 2)],
                                ['Recipient', getBuyRecipientLabel()],
                                ['Hinted positions', String(unlockIds.length)],
                                ['Hint IDs', summarizeIds(unlockIds)],
                                ['Raw PB Out', formatNumber(ethers.formatEther(rawPB), 4)],
                                ['Min PB Out', formatNumber(ethers.formatEther(minPBOut), 4)],
                            ]
                        },
                        {
                            title: 'Why this route looks like this',
                            badge: 'Explain',
                            body: getBuyRouteExplanation(lastBuyPreview),
                            details: [
                                ['Chunk mode', lastBuyPreview.chunkPlan.length > 1 ? `${lastBuyPreview.chunkPlan.length} chunks` : 'Single call'],
                                ['Netting hints', unlockIds.length ? `${unlockIds.length} IDs` : 'No hint IDs'],
                                ['Quote freshness', lastBuyQuoteTimestamp ? `Updated ${getQuoteAgeText(lastBuyQuoteTimestamp)} ago` : 'Freshly quoted'],
                            ]
                        },
                        {
                            title: 'Netting and internal settlement',
                            badge: nettedCount ? 'Netting' : 'AMM only',
                            body: nettedCount
                                ? `${nettedCount} position(s) are expected to settle before or during the AMM leg.`
                                : 'No netting positions are expected for this quote.',
                            details: [
                                ['Settlement USDL', '$' + formatNumber(ethers.formatEther(totalNettedSettlement), 2)],
                                ['Netted PBc', formatNumber(ethers.formatEther(absorbedPBc + internalPBc), 2)],
                                ['AMM buy PB', formatNumber(ethers.formatEther(ammPBOut), 2)],
                                ['AMM sell PB', formatNumber(ethers.formatEther(ammSellPB), 2)],
                            ]
                        },
                        {
                            title: 'Mint result and value view',
                            badge: 'Output',
                            body: 'If execution matches the preview, the route should end with freshly split PB and PBc output.',
                            details: [
                                ['Predicted avg / PB', formatPrice(avgPrice)],
                                ['Expected PB liquid', formatNumber(ethers.formatEther(liquid), 2)],
                                ['Expected PBc locked', formatNumber(ethers.formatEther(locked), 2)],
                                ['Predicted $ value', '$' + formatNumber(predictedValue, 2)],
                            ]
                        },
                        {
                            title: 'Chunking plan',
                            badge: lastBuyPreview.chunkPlan.length > 1 ? 'Chunked' : 'Single',
                            body: lastBuyPreview.chunkPlan.length > 1
                                ? 'Each chunk requeries safe netting hints at execution time and waits for the indexer checkpoint before the next chunk starts.'
                                : 'This input is configured as one direct buy call.',
                            details: lastBuyPreview.chunkPlan.map((chunk, index) => [`Chunk ${index + 1}`, '$' + formatNumber(chunk, 2)]),
                        },
                        {
                            title: 'Trust note',
                            badge: 'Sync',
                            body: lastBuyPreview.chunkPlan.length > 1
                                ? 'Chunked buys do not rely on wallet-signing time to refresh hints. After each confirmed chunk, the UI waits for the indexer DB checkpoint to catch up before fetching the next chunk\'s hint set.'
                                : 'Single-call buys fetch one hint set immediately before execution. There is no inter-chunk sync wait because only one vault call is sent.',
                            details: lastBuyPreview.chunkPlan.length > 1
                                ? [
                                    ['Guard', 'Wait for /api/health checkpoint'],
                                    ['Reason', 'Avoid stale DB hints between confirmed chunks'],
                                ]
                                : [
                                    ['Guard', 'One hint fetch right before execution'],
                                    ['Reason', 'Single vault call, no chunk handoff'],
                                ],
                        }
                    ],
                    addresses: [
                        ['Wallet', app.getAccount() || '-'],
                        ['Recipient', getBuyRecipientLabel()],
                        ['Vault', TVault],
                        ['USDL', TUSDL],
                        ['PB', TPB],
                        ['PBc', TPBc],
                        ['PBt', TPBt],
                        ['PulseX Router', PULSEX_ROUTER],
                        ['PB/USDL Pair', PULSEX_PAIR],
                    ],
                };
                setTerminalMode('buy');
                lastBuyQuoteTimestamp = Date.now();
                lastBuyQuoteAmount = normalizeBuyAmount(usdlAmountStr);
                updateBuyQuoteMeta();
                renderBuySigningPreview(lastBuyPreview);
                scheduleBuyQuoteRefresh();
                showQuoteStatus(
                    `Netting (${nettedCount}) trigger${nettedCount === 1 ? '' : 's'}`,
                    ammDetailText,
                    ammDetailType
                );
                if (!quoteWarningShown) {
                    const buyStatusEl = document.getElementById('buy-status');
                    if (buyStatusEl && buyStatusEl.innerText.trim().startsWith('⏳ Simulating netting quote')) {
                        buyStatusEl.innerText = '';
                    }
                }
            } catch (err) {
                console.error('Quote failed:', err);
                if (!silent) {
                    showStatus('buy-status', 'Quote failed: ' + err.message, 'error');
                }
                updateBuyQuoteMeta('Auto-refresh failed. Last displayed quote may be stale.');
            } finally {
                buyQuoteInFlight = false;
            }
        }

        async function executeBuy() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            buyExecutionInFlight = true;
            clearBuyQuoteRefreshTimer();
            try {
                const usdlAmountStr = document.getElementById('buy-amount').value;
                const usdlAmountNum = parseFloat(usdlAmountStr);
                const quoteContext = getBuyQuoteExecutionContext();
                const autoChunkEnabled = Boolean(document.getElementById('buy-autochunk-checkbox')?.checked);

                if (!usdlAmountStr || usdlAmountNum <= 0) {
                    alert('Enter valid USDL amount');
                    return;
                }

                const giftCheckbox = document.getElementById('gift-buy-checkbox');
                let giftRecipient = '0x0000000000000000000000000000000000000000';
                if (giftCheckbox && giftCheckbox.checked) {
                    const addr = document.getElementById('gift-recipient').value.trim();
                    if (!addr || !addr.match(/^0x[a-fA-F0-9]{40}$/)) {
                        alert('Enter a valid recipient address');
                        return;
                    }
                    if (addr.toLowerCase() === app.getAccount().toLowerCase()) {
                        alert("That's your own address - uncheck gift buy to send to yourself");
                        return;
                    }
                    giftRecipient = addr;
                }

                setTerminalMode('buy');
                resetChainEvents('buy');

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tusdlContract = app.contractLayer.getWriteContract('tusdl');
                const tusdlReadContract = app.contractLayer.getReadContract('tusdl');
                const normalizedTotal = normalizeBuyAmount(usdlAmountNum.toFixed(6));
                const buyChunks = autoChunkEnabled ? buildChunkPlan(normalizedTotal) : [normalizedTotal];
                const totalUsdlWei = ethers.parseEther(normalizedTotal);
                const walletUsdlBalance = await tusdlReadContract.balanceOf(app.getAccount());

                if (walletUsdlBalance < totalUsdlWei) {
                    const availableUsdl = ethers.formatEther(walletUsdlBalance);
                    const requiredUsdl = ethers.formatEther(totalUsdlWei);
                    pushChainEvent('buy', 'Insufficient USDL balance', 'The wallet does not hold enough USDL for this buy size.', 'error', [
                        ['Available USDL', formatNumber(availableUsdl, 4)],
                        ['Required USDL', formatNumber(requiredUsdl, 4)],
                    ]);
                    showStatus(
                        'buy-status',
                        `❌ Insufficient USDL balance. Wallet has ${formatNumber(availableUsdl, 4)} USDL, but this buy needs ${formatNumber(requiredUsdl, 4)} USDL.`,
                        'error'
                    );
                    return;
                }

                const currentAllowance = await tusdlContract.allowance(app.getAccount(), TVault);
                pushChainEvent('buy', 'Buy execution started', 'Preparing allowance and vault call flow.', 'info', [
                    ['Account', app.getAccount()],
                    ['Spend', '$' + formatNumber(usdlAmountNum, 2) + ' USDL'],
                    ['Recipient', giftRecipient === '0x0000000000000000000000000000000000000000' ? app.getAccount() : giftRecipient],
                    ['Quote context', quoteContext],
                ]);
                if (currentAllowance < totalUsdlWei) {
                    pushChainEvent('buy', 'Approval required', 'Wallet must approve the vault to spend USDL before the buy call.', 'warning', [
                        ['Token', TUSDL],
                        ['Spender', TVault],
                        ['Allowance', ethers.formatEther(currentAllowance)],
                        ['Required', ethers.formatEther(totalUsdlWei)],
                    ]);
                    showStatus('buy-status', `⏳ Approving $${usdlAmountNum.toFixed(2)} USDL...`, 'info');
                    try {
                        const approveTx = await sendContractWrite(tusdlContract.approve, [TVault, totalUsdlWei]);
                        pushChainEvent('buy', 'Approval submitted', 'Allowance transaction sent to chain.', 'warning', [
                            ['Tx hash', approveTx.hash],
                        ]);
                        await approveTx.wait();
                        pushChainEvent('buy', 'Approval confirmed', 'Vault can now pull the requested USDL.', 'success', [
                            ['Spender', TVault],
                        ]);
                        showStatus('buy-status', '✅ Approval confirmed!', 'success');
                    } catch (approveErr) {
                        pushChainEvent('buy', 'Approval failed', approveErr.reason || approveErr.message, 'error');
                        showStatus('buy-status', `⚠️ Approval failed: ${approveErr.reason || approveErr.message}`, 'error');
                        throw approveErr;
                    }
                } else {
                    pushChainEvent('buy', 'Allowance ok', 'Existing allowance is sufficient, approval skipped.', 'success', [
                        ['Allowance', ethers.formatEther(currentAllowance)],
                    ]);
                    showStatus('buy-status', '✅ Allowance sufficient - skipping approve', 'success');
                }

                try {
                    let lastReceipt = null;

                    for (let index = 0; index < buyChunks.length; index++) {
                        const chunkAmount = buyChunks[index];
                        const chunkUsdlWei = ethers.parseEther(chunkAmount);
                        const chunkLabel = buyChunks.length > 1
                            ? `chunk ${index + 1}/${buyChunks.length}`
                            : 'buy';
                        const recipientAddress = giftRecipient === '0x0000000000000000000000000000000000000000'
                            ? app.getAccount()
                            : giftRecipient;
                        const balanceBefore = await captureRecipientBalances(recipientAddress);
                        const startPool = await app.contractLayer.getPoolSnapshot();
                        const preparedSelection = await prepareSingleBuy(chunkUsdlWei, quoteContext);
                        pushChainEvent('buy', 'Refreshed trigger hints', 'Fresh indexer-synced trigger IDs were loaded before the wallet signature prompt.', 'info', [
                            ['Chunk', chunkLabel],
                            ['Hint count', String(preparedSelection.unlockIds.length)],
                            ['Trigger IDs', summarizeIds(preparedSelection.unlockIds)],
                        ]);
                        pushChainEvent('buy', 'Signature request', 'Review the wallet prompt before signing this vault buy.', 'warning', [
                            ['Chunk', chunkLabel],
                            ['Function', 'Vault.buyPBDirect'],
                            ['Contract', TVault],
                            ['Spend', '$' + formatNumber(parseFloat(chunkAmount), 2)],
                            ['Recipient', recipientAddress],
                            ['Trigger IDs', summarizeIds(preparedSelection.unlockIds)],
                        ]);
                        const { receipt, txHash, unlockIds, minPBOut, rawPB } = await executeSingleBuy(
                            vaultContract,
                            chunkUsdlWei,
                            formatNumber(parseFloat(chunkAmount), 2),
                            giftRecipient,
                            quoteContext,
                            chunkLabel,
                            preparedSelection
                        );
                        pushChainEvent('buy', 'Buy submitted', 'Vault buy transaction sent to chain.', 'warning', [
                            ['Chunk', chunkLabel],
                            ['Tx hash', txHash],
                            ['Hint IDs', summarizeIds(unlockIds)],
                            ['Raw PB Out', formatNumber(ethers.formatEther(rawPB), 4)],
                            ['Min PB Out', formatNumber(ethers.formatEther(minPBOut), 4)],
                        ]);
                        pushChainEvent('buy', 'Buy confirmed', 'Vault buy receipt confirmed on chain.', 'success', [
                            ['Chunk', chunkLabel],
                            ['Receipt hash', receipt?.hash || txHash],
                            ['Block', String(receipt?.blockNumber || '-')],
                            ['Gas Used', String(receipt?.gasUsed || '-')],
                        ]);
                        const balanceAfter = await captureRecipientBalances(recipientAddress);
                        const finalPool = await app.contractLayer.getPoolSnapshot();
                        const decoded = decodeBuyReceiptLogs(receipt);
                        pushChainEvent('buy', 'Recipient balance delta', 'Observed post-transaction asset changes for the recipient.', 'success', [
                            ['Recipient', recipientAddress],
                            ['PB delta', formatSignedTokenAmount(diffBalance(balanceAfter.pb, balanceBefore.pb), 18, 4)],
                            ['PBc delta', formatSignedTokenAmount(diffBalance(balanceAfter.pbc, balanceBefore.pbc), 18, 4)],
                            ['USDL delta', formatSignedTokenAmount(diffBalance(balanceAfter.usdl, balanceBefore.usdl), 18, 2)],
                            ['PBt delta', formatSignedCount(diffBalance(balanceAfter.pbt, balanceBefore.pbt))],
                        ]);

                        const pbDelta = diffBalance(balanceAfter.pb, balanceBefore.pb);
                        const pbcDelta = diffBalance(balanceAfter.pbc, balanceBefore.pbc);
                        const valueMetrics = computeBuyValueMetrics(pbDelta, pbcDelta, startPool.price, finalPool.price, chunkUsdlWei);
                        if (valueMetrics.pbTotal > 0n) {
                            pushChainEvent('buy', 'Buy value view', 'Mark-to-market of PB plus PBc received in this executed buy chunk.', 'info', [
                                ['Received PB + PBc', formatNumber(ethers.formatUnits(valueMetrics.pbTotal, 18), 4)],
                                ['Start price', formatPrice(startPool.price)],
                                ['Final price', formatPrice(finalPool.price)],
                                ['Start $', formatUsd(valueMetrics.startValue)],
                                ['Final $', formatUsd(valueMetrics.finalValue)],
                                ['Avg / PB', formatPrice(valueMetrics.avgPrice)],
                            ]);
                        }

                        decoded.buyWithNetting.forEach((args, eventIndex) => {
                            pushChainEvent('buy', `BuyWithNetting event ${eventIndex + 1}`, 'Decoded vault summary event from the receipt.', 'info', [
                                ['PBt', String(args.pbtId)],
                                ['USDL In', formatNumber(ethers.formatUnits(args.usdlIn, 18), 2)],
                                ['Total PB Out', formatNumber(ethers.formatUnits(args.totalPBOut, 18), 4)],
                                ['Netted PB', formatNumber(ethers.formatUnits(args.nettedPB, 18), 4)],
                                ['AMM PB', formatNumber(ethers.formatUnits(args.ammPB, 18), 4)],
                                ['Unlocks Netted', String(args.unlocksNetted)],
                            ]);
                        });

                        decoded.unlockNetted.forEach((args, eventIndex) => {
                            pushChainEvent('buy', `UnlockNetted ${eventIndex + 1}`, 'A PBt unlock was settled as part of the buy flow.', 'info', [
                                ['PBt', String(args.pbtId)],
                                ['Unlock', 'T' + (Number(args.unlockIndex) + 1)],
                                ['Logged PBc', formatNumber(ethers.formatUnits(args.pbcSettled, 18), 4)],
                                ['Logged USDL', formatNumber(ethers.formatUnits(args.usdlPaid, 18), 2)],
                                ['Payout', String(args.payoutAddress)],
                            ]);
                        });

                        decoded.pbtMints.forEach((mint, eventIndex) => {
                            pushChainEvent('buy', `PBt mint ${eventIndex + 1}`, 'Observed PBt mint in the receipt.', 'success', [
                                ['Recipient', mint.to],
                                ['Token ID', String(mint.tokenId)],
                            ]);
                        });
                        lastReceipt = receipt;

                        if (index < buyChunks.length - 1) {
                            await waitForIndexerCheckpoint(Number(receipt?.blockNumber || 0), chunkLabel);
                        }
                    }

                    showTransactionStatus(
                        'buy-status',
                        buyChunks.length > 1
                            ? '✅ Auto-chunk buy success!'
                            : '✅ Buy success!',
                        'success',
                        lastReceipt?.hash,
                        'https://scan.v4.testnet.pulsechain.com'
                    );
                } catch (buyErr) {
                    const decodedError = decodeVaultCustomError(buyErr);
                    const friendlyMessage = (decodedError === 'InvalidAmount' || decodedError === 'NotExist')
                        ? 'Vault rejected the netting hints. This usually means the quote or unlockIds went stale before execution.'
                        : (buyErr.reason || buyErr.message);
                    pushChainEvent('buy', 'Buy failed', friendlyMessage, 'error');
                    showStatus('buy-status', `❌ Transaction failed: ${friendlyMessage}`, 'error');
                    throw buyErr;
                }

                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true, includeQuote: true });
                }, 2000);
            } catch (err) {
                console.error('Buy failed:', err);
                showStatus('buy-status', '❌ Buy failed: ' + (err.reason || err.message), 'error');
            } finally {
                buyExecutionInFlight = false;
                updateBuyQuoteMeta();
                scheduleBuyQuoteRefresh();
            }
        }

        async function getSellQuote() {
            if (!app.getAccount()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const pbAmountStr = document.getElementById('sell-amount').value;
                if (!pbAmountStr || parseFloat(pbAmountStr) <= 0) {
                    alert('Enter valid PB amount');
                    return;
                }

                const { price } = await app.contractLayer.getPoolSnapshot();
                const pbAmount = parseFloat(pbAmountStr);
                const usdlOut = pbAmount * price * 0.98;
                document.getElementById('quote-usdl').innerText = formatNumber(usdlOut, 2);
                lastSellPreview = {
                    pbAmount,
                    usdlOut,
                    minOut: usdlOut * 0.95,
                };
                lastSellPreviewTerminalState = {
                    mode: 'Sell preview',
                    summaryRows: [
                        ['Action', 'Sell PB'],
                        ['Input', formatNumber(pbAmount, 2) + ' PB'],
                        ['Expected USDL', '$' + formatNumber(usdlOut, 2)],
                        ['Expected avg price', formatPrice(usdlOut / Math.max(pbAmount, 1e-12))],
                        ['Recipient', app.getAccount() || '-'],
                        ['Router path', 'PB -> USDL'],
                    ],
                    steps: [
                        {
                            title: 'What you will sign',
                            badge: 'Signer',
                            body: 'The wallet should sign one router swap if you execute now.',
                            details: [
                                ['Function', 'swapExactTokensForTokens'],
                                ['Contract', PULSEX_ROUTER],
                                ['Spend PB', formatNumber(pbAmount, 2)],
                                ['Receive wallet', app.getAccount() || '-'],
                                ['Path', `${TPB} -> ${TUSDL}`],
                                ['Min USDL Out', '$' + formatNumber(usdlOut * 0.95, 2)],
                            ]
                        },
                        {
                            title: 'Why this route looks like this',
                            badge: 'Explain',
                            body: 'Sell execution is a direct router swap with no vault netting layer.',
                            details: [
                                ['Execution path', 'Router only'],
                                ['Netting layer', 'None'],
                            ]
                        },
                        {
                            title: 'Approval and swap flow',
                            badge: 'Route',
                            body: 'If router allowance is short, PB approval is requested before the swap.',
                            details: [
                                ['PB spender', PULSEX_ROUTER],
                                ['PB amount', formatNumber(pbAmount, 2)],
                                ['Expected USDL', '$' + formatNumber(usdlOut, 2)],
                            ]
                        },
                        {
                            title: 'Trust note',
                            badge: 'Sync',
                            body: 'Sells do not use the vault netting indexer. The flow is direct router approval plus swap, so there is no checkpoint wait between steps.',
                            details: [
                                ['Indexer dependency', 'None'],
                                ['Execution model', 'Direct router path'],
                            ]
                        },
                    ],
                    addresses: [
                        ['Wallet', app.getAccount() || '-'],
                        ['PB', TPB],
                        ['USDL', TUSDL],
                        ['PulseX Router', PULSEX_ROUTER],
                        ['PB/USDL Pair', PULSEX_PAIR],
                    ],
                };
                setTerminalMode('sell');
                renderSellSigningPreview(lastSellPreview);
            } catch (err) {
                console.error('Sell quote failed:', err);
                showStatus('sell-status', 'Quote failed: ' + err.message, 'error');
            }
        }

        async function executeSell() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const pbAmountStr = document.getElementById('sell-amount').value;
                const pbAmount = ethers.parseEther(pbAmountStr);
                setTerminalMode('sell');
                resetChainEvents('sell');
                pushChainEvent('sell', 'Sell execution started', 'Preparing router approval and swap flow.', 'info', [
                    ['Account', app.getAccount()],
                    ['Spend', formatNumber(pbAmountStr, 2) + ' PB'],
                    ['Route', 'Direct router swap'],
                ]);

                showStatus('sell-status', '⏳ Approving PB...', 'info');
                const pbContract = app.contractLayer.getWriteContract('pb');
                const approveTx = await pbContract.approve(PULSEX_ROUTER, pbAmount);
                pushChainEvent('sell', 'Approval submitted', 'PB allowance transaction sent to chain.', 'warning', [
                    ['Tx hash', approveTx.hash],
                    ['Token', TPB],
                    ['Spender', PULSEX_ROUTER],
                ]);
                await approveTx.wait();
                pushChainEvent('sell', 'Approval confirmed', 'Router can now spend PB for the swap.', 'success', [
                    ['Spender', PULSEX_ROUTER],
                ]);

                showStatus('sell-status', '⏳ Executing sell...', 'info');
                const { price } = await app.contractLayer.getPoolSnapshot();
                const minOut = ethers.parseEther(String(parseFloat(pbAmountStr) * price * 0.95 / 1));
                pushChainEvent('sell', 'Signature request', 'Review the wallet prompt before signing the router swap.', 'warning', [
                    ['Function', 'swapExactTokensForTokens'],
                    ['Contract', PULSEX_ROUTER],
                    ['Path', `${TPB} -> ${TUSDL}`],
                    ['Min USDL Out', ethers.formatEther(minOut)],
                ]);

                const routerContract = app.contractLayer.getWriteContract('router');
                const path = [TPB, TUSDL];
                const sellTx = await routerContract.swapExactTokensForTokens(
                    pbAmount,
                    minOut,
                    path,
                    app.getAccount(),
                    Math.floor(Date.now() / 1000) + 3600
                );
                pushChainEvent('sell', 'Sell submitted', 'Router swap transaction sent to chain.', 'warning', [
                    ['Tx hash', sellTx.hash],
                    ['Deadline', String(Math.floor(Date.now() / 1000) + 3600)],
                ]);
                const receipt = await sellTx.wait();
                pushChainEvent('sell', 'Sell confirmed', 'Router swap receipt confirmed on chain.', 'success', [
                    ['Receipt hash', receipt.hash],
                ]);

                showTransactionStatus(
                    'sell-status',
                    '✅ Sell successful!',
                    'success',
                    receipt.hash,
                    'https://scan.v4.testnet.pulsechain.com'
                );
                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true });
                }, 3000);
            } catch (err) {
                console.error('Sell failed:', err);
                pushChainEvent('sell', 'Sell failed', err.reason || err.message, 'error');
                showStatus('sell-status', '❌ Sell failed: ' + (err.reason || err.message), 'error');
            }
        }

        setTerminalMode('buy');
        renderActiveTerminals();

        return {
            handleBuyAmountInputChange,
            getQuote,
            executeBuy,
            getSellQuote,
            executeSell,
            refreshBuySigningPreview,
        };
    }

    window.PBTestDappTrades = { create };
})();