(function () {
    const {
        INDEXER_URL,
        TVault,
        TPB,
        TUSDL,
        PULSEX_ROUTER,
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
        let buyQuoteRefreshTimer = null;
        let lastBuyQuoteTimestamp = null;
        let lastBuyQuoteAmount = null;
        let buyQuoteInFlight = false;
        let buyExecutionInFlight = false;
        let nettingPreviewEndpointMissing = false;

        function showNettingPreviewUnavailable(message) {
            showStatus('buy-status', message || '⚠️ Netting preview endpoint is not deployed yet - quote without netting', 'warning');
        }

        async function submitVaultBuy(vaultContract, usdlWei, recipient, unlockIds) {
            const pairContract = app.contractLayer.getReadContract('pair');
            const [r0, r1] = await pairContract.getReserves();
            const t0 = await pairContract.token0();
            const rUSDL = t0.toLowerCase() === TPB.toLowerCase() ? r1 : r0;
            const rPB = t0.toLowerCase() === TPB.toLowerCase() ? r0 : r1;
            const rawPB = getAmountOut(usdlWei, rUSDL, rPB);
            const minPBOut = rawPB * 50n / 100n;

            return vaultContract.buyPBDirect(usdlWei, minPBOut, recipient, unlockIds);
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
            updateBuyQuoteMeta();
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
                const avgPrice = totalPBFloat > 0 ? parseFloat(usdlAmountStr) / totalPBFloat : 0;
                document.getElementById('quote-pb').innerText = '~' + totalFormatted;
                document.getElementById('quote-liquid').innerText = liquidFormatted + ' PB';
                document.getElementById('quote-locked').innerText = lockedFormatted + ' PBc';
                document.getElementById('quote-avg-price').innerText = totalPBFloat > 0 ? formatPrice(avgPrice) : '-';
                lastBuyQuoteTimestamp = Date.now();
                lastBuyQuoteAmount = normalizeBuyAmount(usdlAmountStr);
                updateBuyQuoteMeta();
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

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tusdlContract = app.contractLayer.getWriteContract('tusdl');
                const usdlWei = ethers.parseEther(usdlAmountNum.toFixed(6));

                let unlockIds = [];
                try {
                    showStatus('buy-status', `⏳ Fetching eligible unlock positions from indexer... ${quoteContext}`, 'info');
                    const resp = await fetch(`${INDEXER_URL}/unlock-ids?usdl=${usdlWei.toString()}&limit=150`);
                    if (resp.ok) {
                        const data = await resp.json();
                        unlockIds = data.unlockIds || [];
                        if (unlockIds.length > 150) {
                            console.warn(`Trimming ${unlockIds.length} unlockIds to 150 (gas safety)`);
                            unlockIds = unlockIds.slice(0, 150);
                        }
                        if (unlockIds.length > 0) {
                            showStatus('buy-status', `📊 ${unlockIds.length} positions eligible for netting`, 'info');
                        } else {
                            showStatus('buy-status', '📊 No netting positions - plain AMM buy', 'info');
                        }
                    } else {
                        console.warn('Indexer returned non-OK:', resp.status);
                        showStatus('buy-status', '⚠️ Indexer unavailable - proceeding without netting', 'info');
                    }
                } catch (indexerErr) {
                    console.warn('Indexer fetch failed, proceeding without netting:', indexerErr.message);
                    showStatus('buy-status', '⚠️ Indexer unavailable - proceeding without netting', 'info');
                }

                const currentAllowance = await tusdlContract.allowance(app.getAccount(), TVault);
                if (currentAllowance < usdlWei) {
                    showStatus('buy-status', `⏳ Approving $${usdlAmountNum.toFixed(2)} USDL...`, 'info');
                    try {
                        const approveTx = await tusdlContract.approve(TVault, usdlWei);
                        await approveTx.wait();
                        showStatus('buy-status', '✅ Approval confirmed!', 'success');
                    } catch (approveErr) {
                        showStatus('buy-status', `⚠️ Approval failed: ${approveErr.reason || approveErr.message}`, 'error');
                        throw approveErr;
                    }
                } else {
                    showStatus('buy-status', '✅ Allowance sufficient - skipping approve', 'success');
                }

                showStatus('buy-status', `⏳ Executing buy: $${usdlAmountNum.toFixed(2)} USDL with ${unlockIds.length} netting hints. ${quoteContext}`, 'info');

                try {
                    let buyTx;
                    let usedFallback = false;

                    try {
                        buyTx = await submitVaultBuy(vaultContract, usdlWei, giftRecipient, unlockIds);
                    } catch (buyErr) {
                        const decodedError = decodeVaultCustomError(buyErr);
                        const canRetryWithoutHints = (decodedError === 'InvalidAmount' || decodedError === 'NotExist') && unlockIds.length > 0;
                        if (!canRetryWithoutHints) {
                            throw buyErr;
                        }

                        console.warn('Retrying buy without netting hints after InvalidAmount:', buyErr);
                        showStatus('buy-status', '⚠️ Netting hints were stale, dust-cleared, or out of order. Retrying without netting hints...', 'info');
                        buyTx = await submitVaultBuy(vaultContract, usdlWei, giftRecipient, []);
                        usedFallback = true;
                    }

                    const receipt = await buyTx.wait();
                    showTransactionStatus(
                        'buy-status',
                        usedFallback ? '✅ Buy success (plain AMM fallback)!' : '✅ Buy success!',
                        'success',
                        receipt.hash,
                        'https://scan.v4.testnet.pulsechain.com'
                    );
                } catch (buyErr) {
                    const decodedError = decodeVaultCustomError(buyErr);
                    const friendlyMessage = (decodedError === 'InvalidAmount' || decodedError === 'NotExist')
                        ? 'Vault rejected the netting hints. This usually means the quote or unlockIds went stale before execution.'
                        : (buyErr.reason || buyErr.message);
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

                showStatus('sell-status', '⏳ Approving PB...', 'info');
                const pbContract = app.contractLayer.getWriteContract('pb');
                const approveTx = await pbContract.approve(PULSEX_ROUTER, pbAmount);
                await approveTx.wait();

                showStatus('sell-status', '⏳ Executing sell...', 'info');
                const { price } = await app.contractLayer.getPoolSnapshot();
                const minOut = ethers.parseEther(String(parseFloat(pbAmountStr) * price * 0.95 / 1));

                const routerContract = app.contractLayer.getWriteContract('router');
                const path = [TPB, TUSDL];
                const sellTx = await routerContract.swapExactTokensForTokens(
                    pbAmount,
                    minOut,
                    path,
                    app.getAccount(),
                    Math.floor(Date.now() / 1000) + 3600
                );
                const receipt = await sellTx.wait();

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
                showStatus('sell-status', '❌ Sell failed: ' + (err.reason || err.message), 'error');
            }
        }

        return {
            handleBuyAmountInputChange,
            getQuote,
            executeBuy,
            getSellQuote,
            executeSell,
        };
    }

    window.PBTestDappTrades = { create };
})();