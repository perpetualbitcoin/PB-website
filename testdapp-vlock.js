(function () {
    const {
        TVault,
        formatNumber,
        showStatus,
    } = window.PBTestDapp;

    function create(app) {
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

            const MIN_USDL_EQUIV = 100;
            const currentPrice = await getCurrentPBPrice();
            const minPbAmount = MIN_USDL_EQUIV / currentPrice;

            let pbAmount = parseFloat(input.value || '0');
            if (!pbAmount || pbAmount <= 0) {
                input.value = formatSuggestedPBAmount(minPbAmount);
                pbAmount = parseFloat(input.value || '0');
            }

            const BONUS_PCT = 5555;
            const PCT_DENOM = 100000;

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
                return;
            }

            const yourUSDLReward = (usdlFees * BONUS_PCT) / PCT_DENOM;
            const yourPBReward = (pbFees * BONUS_PCT) / PCT_DENOM;
            preview.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <div style="color: #4CAF50; font-weight: 600; margin-bottom: 8px;">✅ YOU WILL RECEIVE:</div>
                    <div style="padding: 8px; background: #1a2a2a; border-radius: 4px; margin-bottom: 8px;">
                        <div style="color: #888; font-size: 0.8rem;">PBc (Locked Backing)</div>
                        <div style="color: #4CAF50; font-size: 1rem; font-weight: 600;">${formatNumber(pbAmount, 0)} PBc</div>
                        <div style="color: #777; font-size: 0.75rem;">1:1 backing for your locked PB</div>
                    </div>
                    <div style="padding: 8px; background: #1a2a2a; border-radius: 4px; margin-bottom: 8px;">
                        <div style="color: #888; font-size: 0.8rem;">PBt (Position Tracker)</div>
                        <div style="color: #64B5F6; font-size: 1rem; font-weight: 600;">1 NFT</div>
                        <div style="color: #777; font-size: 0.75rem;">Tracks your position & unlocks</div>
                    </div>
                    <div style="padding: 8px; background: #1a2a2a; border-radius: 4px; margin-bottom: 8px;">
                        <div style="color: #888; font-size: 0.8rem;">LP Rewards (5.555% of fees)</div>
                        <div style="color: #FFD700; font-size: 0.95rem; font-weight: 600;">+${formatNumber(yourUSDLReward, 6)} USDL<br/>+${formatNumber(yourPBReward, 6)} PB</div>
                    </div>
                </div>
            `;
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
                const btn = document.getElementById('btn-harvest-refresh');
                const originalText = btn ? btn.innerText : '';
                if (btn) {
                    btn.innerText = '⏳ Pulling fees...';
                    btn.disabled = true;
                }
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const harvestTx = await vaultContract.harvestLPRewards();
                await harvestTx.wait();
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
                showStatus('vlock-status', '⏳ Capturing fresh LP fees...', 'info');
                try {
                    const vaultContract = app.contractLayer.getWriteContract('vault');
                    const harvestTx = await vaultContract.harvestLPRewards();
                    await harvestTx.wait();
                } catch (harvestErr) {
                    console.log('No new fees since last harvest', harvestErr.message);
                }

                showStatus('vlock-status', '⏳ Approving PB...', 'info');
                const pbContract = app.contractLayer.getWriteContract('pb');
                const approveTx = await pbContract.approve(TVault, pbAmount);
                await approveTx.wait();

                showStatus('vlock-status', '⏳ Locking PB & claiming rewards...', 'info');
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const vlockTx = await vaultContract.voluntaryLock(pbAmount);
                const receipt = await vlockTx.wait();

                showStatus('vlock-status', '✅ Success! PB locked + rewards claimed. Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
                if (amountInput) amountInput.value = '';
                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true, includeLPStatus: true });
                }, 3000);
            } catch (err) {
                console.error('VLock failed:', err);
                showStatus('vlock-status', '❌ Failed: ' + (err.reason || err.message), 'error');
            }
        }

        return {
            updateLPFeeStatus,
            updateVLockPreview,
            harvestFees,
            harvestAndRefreshLPRewards,
            executeVLock,
        };
    }

    window.PBTestDappVLock = { create };
})();