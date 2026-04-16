(function () {
    const {
        INDEXER_URL,
        TPB,
        formatNumber,
        formatPrice,
    } = window.PBTestDapp;

    function create(app) {
        const MATRIX_GREEN = '#00ff41';

        function localTriggerPrice(buyPriceNum, unlockIndex) {
            let price = buyPriceNum;
            for (let i = 0; i <= unlockIndex; i++) {
                price = price * 1.5555;
            }
            return price;
        }

        async function fetchIndexedPositions(account) {
            const response = await fetch(`${INDEXER_URL}/positions?holder=${encodeURIComponent(String(account || '').toLowerCase())}`);
            if (!response.ok) {
                throw new Error(`Indexed positions request failed (${response.status})`);
            }
            const payload = await response.json();
            return Array.isArray(payload?.positions) ? payload.positions : [];
        }

        async function loadPositionEventMap(account) {
            const allEventMap = {};
            try {
                const response = await fetch(`${INDEXER_URL}/position-events?holder=${encodeURIComponent(String(account || '').toLowerCase())}`);
                if (!response.ok) return allEventMap;
                const payload = await response.json();
                if (!Array.isArray(payload?.events)) return allEventMap;

                for (const row of payload.events) {
                    const pbtId = Number(row.pbt_id);
                    const unlockIndex = Number(row.unlock_index);
                    const pbcAmount = Number(ethers.formatEther(row.pbc_settled || '0'));
                    const proceeds = Number(ethers.formatEther(row.usdl_amount || '0'));
                    const executionPrice = Number(ethers.formatEther(row.settlement_price || '0'));
                    const kind = String(row.event_type || '').includes('netted') ? 'netted' : 'triggered';

                    if (!allEventMap[pbtId]) allEventMap[pbtId] = {};
                    allEventMap[pbtId][unlockIndex] = {
                        pbcAmount,
                        proceeds,
                        loggedProceeds: proceeds,
                        extraProceeds: 0,
                        executionPrice: kind === 'netted'
                            ? executionPrice
                            : (pbcAmount > 0 ? proceeds / pbcAmount : 0),
                        txHash: String(row.tx_hash || ''),
                        logIndex: Number(row.log_index ?? 0),
                        payoutAddress: String(row.payout_address || ''),
                        kind,
                        txAdjusted: false,
                    };
                }
            } catch (err) {
                console.warn('position-events fetch failed:', err.message);
            }
            return allEventMap;
        }

        async function updatePositions() {
            const account = app.getAccount();
            if (!account) return;

            document.getElementById('positions-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">⏳ Loading positions...</div>';
            document.getElementById('unlocks-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">⏳ Loading unlocks...</div>';

            try {
                const vaultContract = app.contractLayer.getReadContract('vault');
                const indexedPositions = await fetchIndexedPositions(account);

                if (indexedPositions.length === 0) {
                    document.getElementById('positions-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">No positions found.</div>';
                    document.getElementById('unlocks-list').innerHTML = '<div style="color: #aaa; text-align: center; padding: 30px;">No positions to display.</div>';
                    return;
                }

                const pairContract = app.contractLayer.getReadContract('pair');
                const [reservesResult, token0] = await Promise.all([
                    pairContract.getReserves(),
                    pairContract.token0(),
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
                    allEventMap = await loadPositionEventMap(account);
                } catch (eventErr) {
                    console.warn('Event query failed (continuing without events):', eventErr.message);
                }

                let positionsHtml = '';
                let unlocksHtml = '';
                let totalLocked = 0;

                for (const row of indexedPositions) {
                    const pbtId = Number(row.pbt_id);
                    const buyPrice = BigInt(row.buy_price || '0');
                    const pbAmount = BigInt(row.pb_amount || '0');
                    const pbcLocked = BigInt(row.pbc_locked || '0');
                    const nextUnlockIndex = Number(row.next_unlock_index || 0);
                    const nextTriggerPrice = BigInt(row.next_trigger_price || '0');

                    const liquidPBWei = (pbAmount * 369n) / 10000n;
                    const initialLockedPBcWei = pbAmount - liquidPBWei;
                    const pbcRemainingFormatted = ethers.formatEther(pbcLocked);
                    const buyPriceNum = Number(ethers.formatEther(buyPrice));
                    const nextTriggerPriceNum = Number(ethers.formatEther(nextTriggerPrice));
                    const nextUnlockIndexNum = nextUnlockIndex;
                    const pbAmountFormatted = ethers.formatEther(pbAmount);
                    const initialLockedPBcFormatted = ethers.formatEther(initialLockedPBcWei);

                    totalLocked += parseFloat(pbcRemainingFormatted);

                    const buyValueUSDL = buyPriceNum * parseFloat(pbAmountFormatted);
                    const eligible = nextTriggerPriceNum > 0 && currentPrice >= nextTriggerPriceNum;
                    const progressPct = nextTriggerPriceNum > 0 ? Math.min((currentPrice / nextTriggerPriceNum) * 100, 100) : 0;
                    const headerBarColor = progressPct >= 50 ? '#4CAF50' : '#F39004';
                    const badgeClass = eligible ? 'ready' : 'pending';
                    const badgeText = eligible
                        ? '✅ READY'
                        : `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:100px;height:2px;background:rgba(255,255,255,0.12);border-radius:1px;overflow:hidden;"><span style="display:block;width:${Math.round(progressPct)}%;height:100%;background:${headerBarColor};border-radius:1px;"></span></span><span style="font-size:0.75rem;color:#aaa;">${Math.round(progressPct)}%</span></span>`;

                    const eventMap = allEventMap[Number(pbtId)] || {};
                    let tableHtml = '';
                    let cumulativePBcRemaining = parseFloat(initialLockedPBcFormatted);
                    const hasPastUnlocks = nextUnlockIndexNum > 0;

                    tableHtml = `
                        <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden;">
                            <thead>
                                <tr style="border-bottom: 2px solid #F39004;">
                                    <th style="padding: 8px; text-align: left; color: #F39004; font-weight: bold;">Unlock ID#</th>
                                    <th style="padding: 8px; text-align: center; color: #F39004; font-weight: bold;"></th>
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

                        const pastTierPct = 100;
                        const pastTierBar = `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:100px;height:2px;background:rgba(255,255,255,0.12);border-radius:1px;overflow:hidden;"><span style="display:block;width:100%;height:100%;background:#4CAF50;border-radius:1px;"></span></span><span style="font-size:0.75rem;color:#aaa;">100%</span></span>`;
                        tableHtml += `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: ${bgColor};">
                                <td style="padding: 8px; color: ${textColor}; font-weight: bold;">T${tNumber}${isConfirmed ? ' ✓' : ''}</td>
                                <td style="padding: 8px; text-align: center;">${pastTierBar}</td>
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

                        const nextTierPct = execPrice > 0 ? Math.min((currentPrice / execPrice) * 100, 100) : 0;
                        const nextTierPctRound = Math.round(nextTierPct);
                        const nextTierBarColor = isConfirmed ? '#4CAF50' : nextTierPct >= 50 ? '#4CAF50' : '#F39004';
                        const nextTierBar = `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:100px;height:2px;background:rgba(255,255,255,0.12);border-radius:1px;overflow:hidden;"><span style="display:block;width:${isConfirmed ? 100 : nextTierPctRound}%;height:100%;background:${nextTierBarColor};border-radius:1px;"></span></span><span style="font-size:0.75rem;color:#aaa;">${isConfirmed ? 100 : nextTierPctRound}%</span></span>`;
                        const statusColor = isConfirmed ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 152, 4, 0.1)';
                        const textColor = isConfirmed ? MATRIX_GREEN : '#F39004';
                        const badge = isConfirmed ? ' ✓ PAID' : ' (next)';

                        tableHtml += `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: ${statusColor};">
                                <td style="padding: 8px; color: ${textColor}; font-weight: bold;">T${tNumber}${badge}</td>
                                <td style="padding: 8px; text-align: center;">${nextTierBar}</td>
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
                                ${eligible ? `<span class="unlock-badge ready">${badgeText}</span>` : ''}
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

                        const tierPct = triggerPrice > 0 ? Math.min((currentPrice / triggerPrice) * 100, 100) : 0;
                        const tierPctRound = Math.round(tierPct);
                        const tierBarColor = tierPct >= 100 ? '#4CAF50' : tierPct >= 50 ? '#4CAF50' : '#F39004';
                        const tierBar = `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:100px;height:2px;background:rgba(255,255,255,0.12);border-radius:1px;overflow:hidden;"><span style="display:block;width:${tierPctRound}%;height:100%;background:${tierBarColor};border-radius:1px;"></span></span><span style="font-size:0.75rem;color:#aaa;">${tierPctRound}%</span></span>`;

                        if (t - 1 < nextUnlockIndexNum) {
                            status = paidEvent && paidEvent.proceeds > 0 ? `✅ Unlocked & PAID $${formatNumber(paidEvent.proceeds, 2)}${paidEvent.txAdjusted ? ' (tx-adjusted)' : ''}` : '✅ Unlocked & PAID';
                            rowColor = 'rgba(76, 175, 80, 0.1)';
                        } else if (t - 1 === nextUnlockIndexNum) {
                            status = eligible ? '🎯 READY NOW' : `⏳ ${tierBar}`;
                            rowColor = eligible ? 'rgba(244, 67, 54, 0.15)' : 'rgba(255, 193, 7, 0.1)';
                        } else {
                            status = tierBar;
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