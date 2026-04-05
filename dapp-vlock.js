(function () {
    const {
        TVault,
        formatNumber,
        showStatus,
        createOperationTerminal,
    } = window.PBTestDapp;

    function create(app) {
        const vlockTerminal = createOperationTerminal({
            containerId: 'vlock-terminal',
            modeId: 'vlock-terminal-mode',
            defaultMode: 'VLock',
            defaultStatus: 'Enter a PB amount to preview voluntary lock execution',
            addresses: [
                ['Vault', TVault],
            ],
        });

        function readVLockRewards(receipt, vaultContract) {
            let usdlBonusPaid = 0;
            let pbBonusPaid = 0;

            try {
                const parsedLogs = receipt.logs
                    .map((log) => {
                        try {
                            return vaultContract.interface.parseLog(log);
                        } catch (_) {
                            return null;
                        }
                    })
                    .filter(Boolean);

                const executedLog = parsedLogs.find((entry) => entry.name === 'VLockExecuted');
                const bonusLog = parsedLogs.find((entry) => entry.name === 'VLockBonusPaid');

                if (!executedLog && !bonusLog) {
                    return { usdlBonusPaid, pbBonusPaid };
                }

                if (executedLog) {
                    usdlBonusPaid = Number(ethers.formatEther(executedLog.args.usdlBonusPaid || 0n));
                    pbBonusPaid = Number(ethers.formatEther(executedLog.args.pbBonusPaid || 0n));
                }

                if ((!usdlBonusPaid && !pbBonusPaid) && bonusLog) {
                    usdlBonusPaid = Number(ethers.formatEther(bonusLog.args.usdlAmount || 0n));
                    pbBonusPaid = Number(ethers.formatEther(bonusLog.args.pbAmount || 0n));
                }
            } catch (err) {
                console.warn('Could not decode VLock reward amounts from receipt:', err);
            }

            return { usdlBonusPaid, pbBonusPaid };
        }

        async function getCurrentPBPrice() {
            let currentPrice = 0.05555;
            try {
                const snapshot = await app.contractLayer.getPoolSnapshot();
                if (snapshot && Number.isFinite(snapshot.price) && snapshot.price > 0) {
                    currentPrice = snapshot.price;
                }
            } catch (err) {
                console.warn('Could not fetch price from pair for VLock preview, using default:', err);
            }
            return currentPrice;
        }

        function formatSuggestedPBAmount(pbAmount) {
            const roundedUp = Math.ceil(pbAmount * 100) / 100;
            return roundedUp.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0$/, '$1');
        }

        function readVisibleWalletPBBalance() {
            const balanceText = document.getElementById('balance-pb')?.innerText || '0';
            return parseFloat(String(balanceText).replace(/[^\d.]/g, '')) || 0;
        }

        async function fillVLockAmount(fraction) {
            const input = document.getElementById('vlock-amount');
            if (!input) return;

            const currentPrice = await getCurrentPBPrice();
            const minPbAmount = 100 / currentPrice;
            const latestExact = typeof app.getLatestPBBalanceExact === 'function'
                ? parseFloat(app.getLatestPBBalanceExact() || '0') || 0
                : 0;
            const visibleBalance = readVisibleWalletPBBalance();
            const currentInput = parseFloat(String(input.value || '').trim() || '0') || 0;

            let baseAmount = latestExact > 0 ? latestExact : visibleBalance;
            if (!(baseAmount > 0)) {
                baseAmount = currentInput > 0 ? currentInput : minPbAmount;
            }

            const targetAmount = baseAmount * fraction;
            input.value = formatSuggestedPBAmount(targetAmount);
            await updateVLockPreview();
        }

        async function updateLPFeeStatus() {
            try {
                const usdlText = document.getElementById('lp-usdl')?.innerText || '0';
                const pbText = document.getElementById('lp-pb')?.innerText || '0';
                const totalUsdl = parseFloat(String(usdlText).replace(/[^\d.]/g, '')) || 0;
                const totalPb = parseFloat(String(pbText).replace(/[^\d.]/g, '')) || 0;
                const userShare = 0.05555;
                const lpUsdlYour = document.getElementById('lp-usdl-your');
                const lpPbYour = document.getElementById('lp-pb-your');
                if (lpUsdlYour) lpUsdlYour.innerText = `Your 5.555%: ${formatNumber(totalUsdl * userShare, 6)} USDL`;
                if (lpPbYour) lpPbYour.innerText = `Your 5.555%: ${formatNumber(totalPb * userShare, 6)} PB`;
            } catch (err) {
                console.error('LP fee status update failed:', err);
            }
        }

        async function updateVLockPreview() {
            const input = document.getElementById('vlock-amount');
            const preview = document.getElementById('vlock-preview');
            if (!input || !preview) return;

            vlockTerminal.setMode('VLock');

            const MIN_USDL_EQUIV = 100;
            const currentPrice = await getCurrentPBPrice();
            const minPbAmount = MIN_USDL_EQUIV / currentPrice;

            const rawInput = String(input.value || '').trim();
            let pbAmount = parseFloat(rawInput || '0');
            if (!rawInput) {
                input.value = formatSuggestedPBAmount(minPbAmount);
                pbAmount = parseFloat(input.value || '0');
            }

            const BONUS_PCT = 5555;
            const PCT_DENOM = 100000;

            if (!Number.isFinite(pbAmount) || pbAmount <= 0) {
                preview.innerHTML = `
                    <div style="color: #FF6B6B; font-weight: 600;">Enter PB Amount</div>
                    <div style="font-size: 0.85rem; color: #aaa; margin-top: 6px;">
                        Use the quick buttons or type a positive PB amount. Current minimum for LP reward eligibility is about ${formatNumber(minPbAmount, 2)} PB.
                    </div>
                `;
                vlockTerminal.setPreview({
                    modeLabel: 'VLock',
                    mode: 'VLock preview',
                    summaryRows: [
                        ['PB to lock', rawInput || '0'],
                        ['Eligibility floor', `${formatNumber(minPbAmount, 2)} PB`],
                        ['Status', 'Enter a positive amount'],
                    ],
                    steps: [
                        { title: 'approve', badge: 'ERC20', body: 'PB approval to Vault is required before locking.', details: [['Spender', TVault]] },
                        { title: 'voluntaryLock', badge: 'Vault', body: 'Vault converts PB into PBc, mints one PBt, and checks LP reward eligibility.', details: [['Function', 'voluntaryLock']] },
                    ],
                    addresses: [['Vault', TVault]],
                });
                return;
            }

            const usdlEquiv = pbAmount * currentPrice;
            const usdlFees = parseFloat((document.getElementById('lp-usdl')?.innerText || '').replace(/[^\d.]/g, '')) || 0;
            const pbFees = parseFloat((document.getElementById('lp-pb')?.innerText || '').replace(/[^\d.]/g, '')) || 0;

            if (usdlEquiv < MIN_USDL_EQUIV) {
                const neededMore = MIN_USDL_EQUIV - usdlEquiv;
                preview.innerHTML = `
                    <div style="color: #FF6B6B; font-weight: 600;">⚠️ Below Minimum</div>
                    <div style="font-size: 0.85rem; color: #aaa; margin-top: 6px;">
                        Need ${formatNumber(neededMore / currentPrice, 2)} more PB, worth $${formatNumber(neededMore, 4)}, to reach the $100 PB value minimum for LP rewards
                    </div>
                `;
                vlockTerminal.setPreview({
                    modeLabel: 'VLock',
                    mode: 'VLock preview',
                    summaryRows: [
                        ['PB to lock', `${formatNumber(pbAmount, 4)} PB`],
                        ['USDL equivalent', `$${formatNumber(usdlEquiv, 4)}`],
                        ['Eligibility', 'Below minimum'],
                    ],
                    steps: [
                        { title: 'approve', badge: 'ERC20', body: 'PB approval to Vault is required before locking.', details: [['Contract', 'approve'], ['Spender', TVault]] },
                        { title: 'voluntaryLock', badge: 'Vault', body: 'Vault converts PB into 1:1 PBc and mints one PBt tracker NFT.', details: [['Function', 'voluntaryLock']] },
                        { title: 'bonus gate', badge: 'Check', body: 'No LP reward payout until the lock meets the $100 PB value threshold.', details: [['Needed more', `${formatNumber(neededMore / currentPrice, 2)} PB`]] },
                    ],
                    addresses: [['Vault', TVault]],
                });
                return;
            }

            const yourUSDLReward = (usdlFees * BONUS_PCT) / PCT_DENOM;
            const yourPBReward = (pbFees * BONUS_PCT) / PCT_DENOM;
            preview.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <div style="color: #4CAF50; font-weight: 600; margin-bottom: 8px;">✅ YOU WILL RECEIVE:</div>
                    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch;">
                    <div style="padding: 8px; background: #1a2a2a; border-radius: 4px; min-width:0;">
                        <div style="color: #888; font-size: 0.8rem;">PBc (Locked Backing)</div>
                        <div style="color: #4CAF50; font-size: 1rem; font-weight: 600;">${formatNumber(pbAmount, 0)} PBc</div>
                        <div style="color: #777; font-size: 0.75rem;">1:1 backing for your locked PB</div>
                    </div>
                    <div style="padding: 8px; background: #1a2a2a; border-radius: 4px; min-width:0;">
                        <div style="color: #888; font-size: 0.8rem;">PBt (Position Tracker)</div>
                        <div style="color: #64B5F6; font-size: 1rem; font-weight: 600;">1 NFT</div>
                        <div style="color: #777; font-size: 0.75rem;">Tracks your position & unlocks</div>
                    </div>
                    <div style="padding: 8px; background: #1a2a2a; border-radius: 4px; min-width:0;">
                        <div style="color: #888; font-size: 0.8rem;">LP Rewards (5.555% of fees)</div>
                        <div style="color: #FFD700; font-size: 0.95rem; font-weight: 600;">+${formatNumber(yourUSDLReward, 6)} USDL<br/>+${formatNumber(yourPBReward, 6)} PB</div>
                    </div>
                    </div>
                </div>
            `;
            vlockTerminal.setPreview({
                modeLabel: 'VLock',
                mode: 'VLock preview',
                summaryRows: [
                    ['PB to lock', `${formatNumber(pbAmount, 4)} PB`],
                    ['USDL equivalent', `$${formatNumber(usdlEquiv, 4)}`],
                    ['Projected reward', `${formatNumber(yourUSDLReward, 6)} USDL + ${formatNumber(yourPBReward, 6)} PB`],
                ],
                steps: [
                    { title: 'harvestLPRewards', badge: 'Vault', body: 'The dapp first harvests current fee accrual so the lock can claim against fresh balances.', details: [['Function', 'harvestLPRewards']] },
                    { title: 'approve', badge: 'ERC20', body: 'PB approval lets Vault pull the chosen amount from the connected wallet.', details: [['Function', 'approve'], ['Spender', TVault]] },
                    { title: 'voluntaryLock', badge: 'Vault', body: 'Vault locks PB, issues PBc, mints one PBt, and pays the fixed LP reward share if eligible.', details: [['Function', 'voluntaryLock'], ['PBc minted', `${formatNumber(pbAmount, 4)} PBc`], ['PBt minted', '1 NFT']] },
                ],
                addresses: [['Vault', TVault]],
            });
        }

        async function harvestFees() {
            if (!app.getSigner()) {
                alert('Connect wallet to harvest');
                return;
            }
            try {
                showStatus('harvest-status', 'Harvesting fees...', 'info');
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tx = await vaultContract.harvestLPRewards();
                await tx.wait();
                showStatus('harvest-status', 'Fees harvested! Refreshing...', 'success');
                setTimeout(() => {
                    updateLPFeeStatus();
                }, 2000);
            } catch (err) {
                console.error('Harvest failed:', err);
                showStatus('harvest-status', 'Harvest failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function harvestAndRefreshLPRewards() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            try {
                vlockTerminal.setMode('Harvest');
                vlockTerminal.resetChain();
                vlockTerminal.setPreview({
                    modeLabel: 'Harvest',
                    mode: 'Harvest preview',
                    summaryRows: [['Action', 'Refresh LP fee snapshot']],
                    steps: [
                        { title: 'harvestLPRewards', badge: 'Vault', body: 'Harvests fee-only LP proceeds into the vault accounting before refreshing the VLock panel.', details: [['Function', 'harvestLPRewards']] },
                    ],
                    addresses: [['Vault', TVault]],
                });
                vlockTerminal.pushChainEvent('Harvest start', 'Submitting LP reward harvest transaction.', 'info', [['Function', 'harvestLPRewards']]);
                const btn = document.getElementById('btn-harvest-refresh');
                const originalText = btn ? btn.innerText : '';
                if (btn) {
                    btn.innerText = '⏳ Pulling fees...';
                    btn.disabled = true;
                }
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const harvestTx = await vaultContract.harvestLPRewards();
                vlockTerminal.pushChainEvent('Harvest submitted', 'Waiting for harvest receipt.', 'info', [['Tx', harvestTx.hash]]);
                await harvestTx.wait();
                vlockTerminal.pushChainEvent('Harvest confirmed', 'LP reward snapshot refreshed from chain state.', 'success', [['Tx', harvestTx.hash]]);
                if (btn) {
                    btn.innerText = '✅ Done!';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.disabled = false;
                    }, 2000);
                }
                await updateLPFeeStatus();
            } catch (err) {
                console.error('Check failed:', err);
                vlockTerminal.pushChainEvent('Harvest failed', err.reason || err.message, 'error');
                const btn = document.getElementById('btn-harvest-refresh');
                if (btn) {
                    btn.innerText = 'See Total Available';
                    btn.disabled = false;
                }
                showStatus('vlock-status', 'Check failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function executeVLock() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const amountInput = document.getElementById('vlock-amount');
                const pbAmountStr = amountInput ? amountInput.value : '';
                if (!pbAmountStr || parseFloat(pbAmountStr) <= 0) {
                    alert('Enter valid PB amount');
                    return;
                }

                const pbAmount = ethers.parseEther(pbAmountStr);
                vlockTerminal.setMode('VLock');
                vlockTerminal.resetChain();
                vlockTerminal.pushChainEvent('Harvesting rewards', 'Refreshing vault fee balances before lock execution.', 'info', [['Function', 'harvestLPRewards']]);
                showStatus('vlock-status', '⏳ Capturing fresh LP fees...', 'info');
                try {
                    const vaultContract = app.contractLayer.getWriteContract('vault');
                    const harvestTx = await vaultContract.harvestLPRewards();
                    await harvestTx.wait();
                    vlockTerminal.pushChainEvent('Harvest confirmed', 'Fee harvest mined successfully.', 'success', [['Tx', harvestTx.hash]]);
                } catch (harvestErr) {
                    console.log('No new fees since last harvest', harvestErr.message);
                    vlockTerminal.pushChainEvent('Harvest skipped', harvestErr.message, 'warning');
                }

                showStatus('vlock-status', '⏳ Approving PB...', 'info');
                const pbContract = app.contractLayer.getWriteContract('pb');
                const approveTx = await pbContract.approve(TVault, pbAmount);
                vlockTerminal.pushChainEvent('Approval submitted', 'PB approval sent to wallet.', 'info', [['Function', 'approve'], ['Tx', approveTx.hash]]);
                await approveTx.wait();
                vlockTerminal.pushChainEvent('Approval confirmed', 'Vault can now pull PB for voluntary lock.', 'success', [['Tx', approveTx.hash]]);

                showStatus('vlock-status', '⏳ Locking PB & claiming rewards...', 'info');
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const vlockTx = await vaultContract.voluntaryLock(pbAmount);
                vlockTerminal.pushChainEvent('VLock submitted', 'Waiting for voluntary lock receipt.', 'info', [['Function', 'voluntaryLock'], ['Tx', vlockTx.hash]]);
                const receipt = await vlockTx.wait();
                const { usdlBonusPaid, pbBonusPaid } = readVLockRewards(receipt, vaultContract);
                vlockTerminal.pushChainEvent('VLock confirmed', 'PB locked, PBc minted, PBt tracker created, and rewards paid if eligible.', 'success', [['Tx', receipt.hash], ['PB reward', `${formatNumber(pbBonusPaid, 6)} PB`], ['USDL reward', `${formatNumber(usdlBonusPaid, 6)} USDL`]]);

                showStatus(
                    'vlock-status',
                    '✅ Success! PB locked + rewards claimed. Tx: ' +
                    receipt.hash.substring(0, 10) +
                    '... | PB: ' + formatNumber(pbBonusPaid, 6) +
                    ' | $: ' + formatNumber(usdlBonusPaid, 6),
                    'success'
                );
                if (amountInput) amountInput.value = '';
                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true, includeLPStatus: true });
                }, 3000);
            } catch (err) {
                console.error('VLock failed:', err);
                vlockTerminal.pushChainEvent('VLock failed', err.reason || err.message, 'error');
                showStatus('vlock-status', '❌ Failed: ' + (err.reason || err.message), 'error');
            }
        }

        return {
            updateLPFeeStatus,
            updateVLockPreview,
            fillVLockAmount,
            harvestFees,
            harvestAndRefreshLPRewards,
            executeVLock,
        };
    }

    window.PBTestDappVLock = { create };
})();