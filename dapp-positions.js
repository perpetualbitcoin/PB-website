(function () {
    const {
        TPB,
        TUSDL,
        TVault,
        VAULT_EVENT_FROM_BLOCK,
        formatNumber,
        formatPrice,
    } = window.PBTestDapp;

    const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
    const erc20TransferInterface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);

    function getParsedEventName(parsed) {
        return parsed?.name || parsed?.fragment?.name || '';
    }

    function getLogIndexValue(log) {
        const raw = log?.logIndex ?? log?.index;
        if (raw === undefined || raw === null) return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    function getTxHashValue(log) {
        return log?.transactionHash || log?.hash || '';
    }

    function create(app) {
        const payoutReceiptCache = new Map();
        const MATRIX_GREEN = '#00ff41';

        function localTriggerPrice(buyPriceNum, unlockIndex) {
            let price = buyPriceNum;
            for (let i = 0; i <= unlockIndex; i++) {
                price = price * 1.5555;
            }
            return price;
        }

        async function getReceiptPayoutAdjustments(txHash, vaultContract) {
            if (!txHash) return new Map();
            if (payoutReceiptCache.has(txHash)) return payoutReceiptCache.get(txHash);

            const adjustments = new Map();
            try {
                const provider = vaultContract.runner?.provider;
                const receipt = provider ? await provider.getTransactionReceipt(txHash) : null;
                if (!receipt) {
                    payoutReceiptCache.set(txHash, adjustments);
                    return adjustments;
                }

                const unlockRows = [];
                for (const log of receipt.logs) {
                    if (String(log.address).toLowerCase() !== String(TVault).toLowerCase()) continue;
                    try {
                        const parsed = vaultContract.interface.parseLog(log);
                        if (getParsedEventName(parsed) !== 'UnlockNetted') continue;
                        const logIndex = getLogIndexValue(log);
                        if (!Number.isFinite(logIndex)) continue;
                        unlockRows.push({
                            logIndex,
                            payoutAddress: String(parsed.args[4]).toLowerCase(),
                        });
                    } catch {
                        continue;
                    }
                }

                const outgoingTransfers = receipt.logs
                    .filter(log => String(log.address).toLowerCase() === String(TUSDL).toLowerCase() && log.topics[0] === ERC20_TRANSFER_TOPIC)
                    .map(log => {
                        try {
                            const parsed = erc20TransferInterface.parseLog(log);
                            const logIndex = getLogIndexValue(log);
                            if (!Number.isFinite(logIndex)) return null;
                            return {
                                logIndex,
                                from: String(parsed.args.from).toLowerCase(),
                                to: String(parsed.args.to).toLowerCase(),
                                value: Number(ethers.formatEther(parsed.args.value)),
                                matched: false,
                            };
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean)
                    .filter(transfer => transfer.from === String(TVault).toLowerCase());

                const sortedUnlockRows = unlockRows.sort((a, b) => a.logIndex - b.logIndex);
                for (const row of sortedUnlockRows) {
                    for (let idx = outgoingTransfers.length - 1; idx >= 0; idx--) {
                        const transfer = outgoingTransfers[idx];
                        if (transfer.matched) continue;
                        if (transfer.to !== row.payoutAddress) continue;
                        if (transfer.logIndex >= row.logIndex) continue;
                        transfer.matched = true;
                        break;
                    }
                }

                for (const row of sortedUnlockRows) {
                    const nextSameAddressRow = sortedUnlockRows.find(next => next.logIndex > row.logIndex && next.payoutAddress === row.payoutAddress);
                    const upperBound = nextSameAddressRow ? nextSameAddressRow.logIndex : Number.POSITIVE_INFINITY;
                    const extraValue = outgoingTransfers
                        .filter(transfer => !transfer.matched && transfer.to === row.payoutAddress && transfer.logIndex > row.logIndex && transfer.logIndex < upperBound)
                        .reduce((sum, transfer) => sum + transfer.value, 0);
                    adjustments.set(row.logIndex, extraValue);
                }
            } catch (err) {
                console.warn('Receipt payout adjustment failed for tx', txHash, err.message);
            }

            payoutReceiptCache.set(txHash, adjustments);
            return adjustments;
        }

        async function applySplitPayoutAdjustments(eventMap, vaultContract) {
            const rows = [];
            Object.values(eventMap || {}).forEach(positionRows => {
                Object.values(positionRows || {}).forEach(row => {
                    if (!row || row.kind !== 'netted' || !row.txHash || !Number.isFinite(row.logIndex) || !row.payoutAddress) return;
                    rows.push(row);
                });
            });

            const txHashes = [...new Set(rows.map(row => row.txHash))];
            await Promise.all(txHashes.map(txHash => getReceiptPayoutAdjustments(txHash, vaultContract)));

            for (const row of rows) {
                const adjustments = payoutReceiptCache.get(row.txHash);
                const extraProceeds = adjustments?.get(Number(row.logIndex)) || 0;
                row.extraProceeds = extraProceeds;
                row.loggedProceeds = row.loggedProceeds ?? row.proceeds ?? 0;
                row.proceeds = row.loggedProceeds + extraProceeds;
                row.txAdjusted = extraProceeds > 0;
            }
        }

        async function updatePositions() {
            const account = app.getAccount();
            if (!account) return;

            document.getElementById('positions-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">⏳ Loading positions...</div>';
            document.getElementById('unlocks-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">⏳ Loading unlocks...</div>';

            try {
                const vaultContract = app.contractLayer.getReadContract('vault');
                const vaultViewsContract = app.contractLayer.getReadContract('vaultviews');
                const pbtIds = await vaultViewsContract.getUserPBtIds(account);

                if (pbtIds.length === 0) {
                    document.getElementById('positions-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">No positions found.</div>';
                    document.getElementById('unlocks-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">No positions to display.</div>';
                    return;
                }

                const pairContract = app.contractLayer.getReadContract('pair');
                const [reservesResult, token0, ...positionResults] = await Promise.all([
                    pairContract.getReserves(),
                    pairContract.token0(),
                    ...pbtIds.flatMap((id) => [
                        vaultContract.pbtRegistry(id),
                        vaultViewsContract.getPositionUnlockStatus(id),
                    ]),
                ]);

                const [reserve0, reserve1] = reservesResult;
                let pbReserve;
                let usdlReserve;
                if (token0.toLowerCase() === TPB.toLowerCase()) {
                    pbReserve = Number(ethers.formatEther(reserve0));
                    usdlReserve = Number(ethers.formatEther(reserve1));
                } else {
                    pbReserve = Number(ethers.formatEther(reserve1));
                    usdlReserve = Number(ethers.formatEther(reserve0));
                }
                const currentPrice = usdlReserve / pbReserve;

                let allEventMap = {};
                try {
                    const fromBlock = Number.isFinite(Number(VAULT_EVENT_FROM_BLOCK)) ? Number(VAULT_EVENT_FROM_BLOCK) : 0;
                    const [unlockTriggeredEvents, unlockNettedEvents] = await Promise.all([
                        vaultContract.queryFilter(vaultContract.filters.UnlockTriggered(), fromBlock, 'latest'),
                        vaultContract.queryFilter(vaultContract.filters.UnlockNetted(), fromBlock, 'latest'),
                    ]);
                    const events = unlockTriggeredEvents.concat(unlockNettedEvents);

                    for (const event of events) {
                        try {
                            const eventName = event.fragment?.name || event.eventName || '';
                            const evPbtId = Number(event.args[0]);
                            const unlockIndex = Number(event.args[1]);
                            const pbcAmount = Number(ethers.formatEther(event.args[2]));
                            const proceeds = Number(ethers.formatEther(event.args[3]));
                            if (!allEventMap[evPbtId]) allEventMap[evPbtId] = {};
                            allEventMap[evPbtId][unlockIndex] = {
                                pbcAmount,
                                proceeds,
                                loggedProceeds: proceeds,
                                extraProceeds: 0,
                                executionPrice: eventName === 'UnlockNetted'
                                    ? Number(ethers.formatEther(event.args[5]))
                                    : (pbcAmount > 0 ? proceeds / pbcAmount : 0),
                                txHash: getTxHashValue(event),
                                logIndex: getLogIndexValue(event),
                                payoutAddress: String(event.args[4] || ''),
                                kind: eventName === 'UnlockNetted' ? 'netted' : 'triggered',
                                txAdjusted: false,
                            };
                        } catch {}
                    }
                    await applySplitPayoutAdjustments(allEventMap, vaultContract);
                } catch (eventErr) {
                    console.warn('Event query failed (continuing without events):', eventErr.message);
                }

                let positionsHtml = '';
                let unlocksHtml = '';
                let totalLocked = 0;

                for (let i = 0; i < pbtIds.length; i++) {
                    const pbtId = pbtIds[i];
                    const [buyPrice, pbAmount, pbcLocked, nextUnlockIndex, nextTriggerPrice] = positionResults[i * 2];
                    const [, , eligible, pbcRemaining] = positionResults[i * 2 + 1];

                    const liquidPBWei = (pbAmount * 369n) / 10000n;
                    const initialLockedPBcWei = pbAmount - liquidPBWei;
                    const pbcRemainingFormatted = ethers.formatEther(pbcRemaining);
                    const buyPriceNum = Number(ethers.formatEther(buyPrice));
                    const nextTriggerPriceNum = Number(ethers.formatEther(nextTriggerPrice));
                    const nextUnlockIndexNum = Number(nextUnlockIndex);
                    const pbAmountFormatted = ethers.formatEther(pbAmount);
                    const initialLockedPBcFormatted = ethers.formatEther(initialLockedPBcWei);

                    totalLocked += parseFloat(pbcRemainingFormatted);

                    const buyValueUSDL = buyPriceNum * parseFloat(pbAmountFormatted);
                    const progressPct = nextTriggerPriceNum > 0 ? Math.min((currentPrice / nextTriggerPriceNum) * 100, 100) : 0;
                    const badgeClass = eligible ? 'ready' : 'pending';
                    const badgeText = eligible ? '✅ READY' : `🔒 ${Math.round(progressPct)}% Maturity`;

                    const eventMap = allEventMap[Number(pbtId)] || {};
                    let tableHtml = '';
                    let cumulativePBcRemaining = parseFloat(initialLockedPBcFormatted);
                    const hasPastUnlocks = nextUnlockIndexNum > 0;

                    tableHtml = `
                        <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden;">
                            <thead>
                                <tr style="border-bottom: 2px solid #F39004;">
                                    <th style="padding: 8px; text-align: left; color: #F39004; font-weight: bold;">Unlock ID#</th>
                                    <th style="padding: 8px; text-align: right; color: #F39004; font-weight: bold;">@ $ Price</th>
                                    <th style="padding: 8px; text-align: right; color: #F39004; font-weight: bold;">PBc #</th>
                                    <th style="padding: 8px; text-align: right; color: #F39004; font-weight: bold;">$ $ $</th>
                                    <th style="padding: 8px; text-align: right; color: #F39004; font-weight: bold;">Current $</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    for (let unlockIdx = 0; unlockIdx < nextUnlockIndexNum; unlockIdx++) {
                        const tNumber = unlockIdx + 1;
                        let pbcSoldAmount = cumulativePBcRemaining / 3;
                        let executionPrice = 0;
                        let valuePaid = 0;
                        let isConfirmed = false;

                        if (eventMap[unlockIdx]) {
                            executionPrice = eventMap[unlockIdx].executionPrice;
                            valuePaid = eventMap[unlockIdx].proceeds;
                            isConfirmed = true;
                        } else {
                            executionPrice = localTriggerPrice(buyPriceNum, unlockIdx);
                            valuePaid = pbcSoldAmount * executionPrice;
                        }
                        cumulativePBcRemaining -= pbcSoldAmount;

                        const bgColor = isConfirmed ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.05)';
                        const textColor = isConfirmed ? MATRIX_GREEN : '#1bf408';

                        tableHtml += `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: ${bgColor};">
                                <td style="padding: 8px; color: ${textColor}; font-weight: bold;">T${tNumber}${isConfirmed ? ' ✓' : ''}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor};">${formatPrice(executionPrice)}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor};">${formatNumber(pbcSoldAmount, 2)}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor}; font-weight: bold;">$${formatNumber(valuePaid, 2)}${eventMap[unlockIdx]?.txAdjusted ? '<div style="font-size:0.72rem;color:#888;">tx-adjusted</div>' : ''}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor};">${formatPrice(currentPrice)}</td>
                            </tr>
                        `;
                    }

                    let nextUnlocksShown = 0;
                    for (let unlockIdx = nextUnlockIndexNum; nextUnlocksShown < 2 && unlockIdx <= 8; unlockIdx++) {
                        const tNumber = unlockIdx + 1;
                        let isConfirmed = false;
                        let pbcAmountForRow = 0;
                        let proceeds = 0;
                        let execPrice = 0;
                        let estimatedValue = 0;

                        if (eventMap[unlockIdx]) {
                            isConfirmed = true;
                            pbcAmountForRow = eventMap[unlockIdx].pbcAmount;
                            proceeds = eventMap[unlockIdx].proceeds;
                            execPrice = eventMap[unlockIdx].executionPrice;
                        } else {
                            execPrice = localTriggerPrice(buyPriceNum, unlockIdx);
                            pbcAmountForRow = cumulativePBcRemaining / 3;
                            estimatedValue = pbcAmountForRow * execPrice;
                        }

                        const statusColor = isConfirmed ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 152, 4, 0.1)';
                        const textColor = isConfirmed ? MATRIX_GREEN : '#F39004';
                        const badge = isConfirmed ? ' ✓ PAID' : ' (next)';

                        tableHtml += `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: ${statusColor};">
                                <td style="padding: 8px; color: ${textColor}; font-weight: bold;">T${tNumber}${badge}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor};">${formatPrice(execPrice)}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor};">${formatNumber(pbcAmountForRow, 2)}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor}; font-weight: bold;">${isConfirmed ? '$' + formatNumber(proceeds, 2) : '$' + formatNumber(estimatedValue, 2)}</td>
                                <td style="padding: 8px; text-align: right; color: ${textColor};">${formatPrice(currentPrice)}</td>
                            </tr>
                        `;

                        cumulativePBcRemaining -= pbcAmountForRow;
                        nextUnlocksShown++;
                    }

                    tableHtml += '</tbody></table>';

                    if (!hasPastUnlocks) {
                        tableHtml += `
                            <div style="padding: 8px; margin-top: 8px; background: rgba(255, 193, 7, 0.1); border-left: 3px solid #FFC107; border-radius: 4px; font-size: 0.8rem; color: #FFC107;">
                                ⏳ Waiting for T1
                            </div>
                        `;
                    }

                    positionsHtml += `
                        <div class="position-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div>
                                    <strong style="color: #F39004;">PB Tracker #${pbtId}:</strong>
                                    <span style="color: #aaa; margin-left: 8px;">$${formatNumber(buyValueUSDL, 2)} USDL @ ${formatPrice(buyPriceNum)} = ${formatNumber(pbAmountFormatted, 0)} (PB+PBc)</span>
                                </div>
                                <span class="unlock-badge ${badgeClass}">${badgeText}</span>
                            </div>
                            ${tableHtml}
                        </div>
                    `;

                    let triggerTableHtml = `
                        <div class="position-card">
                            <div style="margin-bottom: 12px;">
                                <strong style="color: #F39004;">PB Tracker #${pbtId} - Unlock Timeline</strong>
                                <div style="font-size: 0.85rem; color: #aaa; margin-top: 4px;">Perpetual unlocks: sell 1/3 of remaining at each price trigger</div>
                            </div>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
                                    <thead>
                                        <tr style="border-bottom: 2px solid #F39004;">
                                            <th style="padding: 8px; text-align: left; color: #F39004;">Unlock</th>
                                            <th style="padding: 8px; text-align: right; color: #F39004;">Trigger Price</th>
                                            <th style="padding: 8px; text-align: center; color: #F39004;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;

                    for (let t = 1; t <= 8; t++) {
                        const triggerPrice = localTriggerPrice(buyPriceNum, t - 1);
                        let status;
                        let rowColor;
                        const paidEvent = eventMap[t - 1];

                        if (t - 1 < nextUnlockIndexNum) {
                            status = paidEvent && paidEvent.proceeds > 0 ? `✅ Unlocked & PAID $${formatNumber(paidEvent.proceeds, 2)}${paidEvent.txAdjusted ? ' (tx-adjusted)' : ''}` : '✅ Unlocked & PAID';
                            rowColor = 'rgba(76, 175, 80, 0.1)';
                        } else if (t - 1 === nextUnlockIndexNum) {
                            status = eligible ? '🎯 READY NOW' : '⏳ PENDING';
                            rowColor = eligible ? 'rgba(244, 67, 54, 0.15)' : 'rgba(255, 193, 7, 0.1)';
                        } else {
                            status = '⏳ FUTURE';
                            rowColor = 'rgba(255, 255, 255, 0.02)';
                        }

                        triggerTableHtml += `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); background-color: ${rowColor};">
                                <td style="padding: 8px; color: #F39004; font-weight: bold;">T${t}</td>
                                <td style="padding: 8px; text-align: right; color: #aaa;">${formatPrice(triggerPrice)}</td>
                                <td style="padding: 8px; text-align: center; color: ${t - 1 < nextUnlockIndexNum ? MATRIX_GREEN : (t - 1 === nextUnlockIndexNum && eligible ? '#F44336' : '#aaa')}; font-weight: ${t - 1 === nextUnlockIndexNum || t - 1 < nextUnlockIndexNum ? 'bold' : 'normal'};">${status}</td>
                            </tr>
                        `;
                    }

                    triggerTableHtml += `
                                    </tbody>
                                </table>
                            </div>
                            <div style="font-size: 0.8rem; color: #aaa; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                                <strong style="color: #F39004;">Buy Price:</strong> ${formatPrice(buyPriceNum)} |
                                <strong style="color: #F39004;">Current:</strong> ${formatPrice(currentPrice)} |
                                <strong style="color: #F39004;">Progress:</strong> ${Math.round(progressPct)}%
                            </div>
                        </div>
                    `;
                    unlocksHtml += triggerTableHtml;
                }

                const totalValue = totalLocked * currentPrice;
                document.getElementById('positions-list').innerHTML = positionsHtml;
                sortPositions(document.getElementById('sort-by-select').value);
                document.getElementById('unlocks-list').innerHTML = unlocksHtml;
                document.getElementById('portfolio-locked').innerText = formatNumber(totalLocked, 2);
                document.getElementById('portfolio-value').innerText = formatNumber(totalValue, 2) + ' USDL';

                const pbContract = app.contractLayer.getReadContract('pb');
                const liquidBalance = await pbContract.balanceOf(account);
                const totalLiquid = parseFloat(ethers.formatEther(liquidBalance));
                document.getElementById('portfolio-liquid').innerText = formatNumber(totalLiquid, 2);
            } catch (err) {
                console.error('Position update failed:', err);
                document.getElementById('positions-list').innerHTML = '<div style="color: #ff5555; text-align: center; padding: 30px;">Failed to load positions</div>';
            }
        }

        function sortPositions(sortType) {
            const positionsList = document.getElementById('positions-list');
            const positionCards = Array.from(positionsList.querySelectorAll('.position-card'));
            if (positionCards.length === 0) return;

            positionCards.sort((cardA, cardB) => {
                let priceA = 999999;
                let priceB = 999999;
                const textA = cardA.innerText;
                const textB = cardB.innerText;
                const statusA = /🎯 READY NOW/.test(textA) ? 'ready' : 'pending';
                const statusB = /🎯 READY NOW/.test(textB) ? 'ready' : 'pending';
                const nextRowA = textA.match(/\(next\)\s*\$?([0-9.]+)/);
                if (nextRowA) priceA = parseFloat(nextRowA[1]);
                const nextRowB = textB.match(/\(next\)\s*\$?([0-9.]+)/);
                if (nextRowB) priceB = parseFloat(nextRowB[1]);

                if (sortType === 'price-low-high') return priceA - priceB;
                if (sortType === 'price-high-low') return priceB - priceA;
                if (statusA === 'ready' && statusB !== 'ready') return -1;
                if (statusA !== 'ready' && statusB === 'ready') return 1;
                return priceA - priceB;
            });

            positionsList.innerHTML = '';
            positionCards.forEach((card) => positionsList.appendChild(card));
        }

        function switchTab(tabName) {
            const tabs = document.querySelectorAll('.tab-content');
            tabs.forEach((tab) => tab.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');

            const tabButtons = document.querySelectorAll('.tab');
            tabButtons.forEach((btn) => btn.classList.remove('active'));
            if (typeof event !== 'undefined' && event && event.target) {
                event.target.classList.add('active');
            }
        }

        return {
            updatePositions,
            sortPositions,
            switchTab,
        };
    }

    window.PBTestDappPositions = { create };
})();