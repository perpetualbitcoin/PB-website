(function () {
    const {
        TPB,
        TUSDL,
        TPBRemoveUserLP,
        PULSEX_PAIR,
        PULSEX_ROUTER,
        formatNumber,
        showStatus,
        showTransactionStatus,
        createOperationTerminal,
    } = window.PBTestDapp;

    function create(app) {
        const DEFAULT_SLIPPAGE = 1;
        const DEFAULT_DEADLINE_MINUTES = 20;
        const lpTerminal = createOperationTerminal({
            containerId: 'lp-terminal',
            modeId: 'lp-terminal-mode',
            defaultMode: 'Add LP',
            defaultStatus: 'Fill add or remove LP inputs to preview the transaction path',
            addresses: [
                ['Pair', PULSEX_PAIR],
                ['Router', PULSEX_ROUTER],
                ['LP remover', TPBRemoveUserLP],
            ],
        });

        function getExplorerBaseUrl() {
            if (typeof ACTIVE_NETWORK !== 'undefined' && ACTIVE_NETWORK && ACTIVE_NETWORK.explorer) {
                return ACTIVE_NETWORK.explorer;
            }
            return '';
        }

        function setDefaults() {
            const addSlippageInput = document.getElementById('add-lp-slippage');
            const addDeadlineInput = document.getElementById('add-lp-deadline');
            const slippageInput = document.getElementById('remove-lp-slippage');
            const deadlineInput = document.getElementById('remove-lp-deadline');
            if (addSlippageInput && !addSlippageInput.value) addSlippageInput.value = String(DEFAULT_SLIPPAGE);
            if (addDeadlineInput && !addDeadlineInput.value) addDeadlineInput.value = String(DEFAULT_DEADLINE_MINUTES);
            if (slippageInput && !slippageInput.value) slippageInput.value = String(DEFAULT_SLIPPAGE);
            if (deadlineInput && !deadlineInput.value) deadlineInput.value = String(DEFAULT_DEADLINE_MINUTES);
        }

        async function getPoolSnapshot() {
            const pairContract = app.contractLayer.getReadContract('pair');
            const account = app.getAccount();
            const pbContract = app.contractLayer.getReadContract('pb');
            const usdlContract = app.contractLayer.getReadContract('tusdl');
            const [reserves, token0, totalSupply, lpBalance, pbBalance, usdlBalance] = await Promise.all([
                pairContract.getReserves(),
                pairContract.token0(),
                pairContract.totalSupply(),
                account ? pairContract.balanceOf(account) : Promise.resolve(0n),
                account ? pbContract.balanceOf(account) : Promise.resolve(0n),
                account ? usdlContract.balanceOf(account) : Promise.resolve(0n),
            ]);

            const reserve0 = reserves[0];
            const reserve1 = reserves[1];
            const isPBToken0 = token0.toLowerCase() === TPB.toLowerCase();

            return {
                totalSupply,
                lpBalance,
                pbReserve: isPBToken0 ? reserve0 : reserve1,
                usdlReserve: isPBToken0 ? reserve1 : reserve0,
                lpBalanceExact: ethers.formatEther(lpBalance),
                totalSupplyExact: ethers.formatEther(totalSupply),
                pbBalance,
                usdlBalance,
                pbBalanceExact: ethers.formatEther(pbBalance),
                usdlBalanceExact: ethers.formatEther(usdlBalance),
            };
        }

        function getPoolRatio(snapshot) {
            if (!snapshot.pbReserve || snapshot.pbReserve === 0n) return 0;
            return Number(ethers.formatEther(snapshot.usdlReserve)) / Number(ethers.formatEther(snapshot.pbReserve));
        }

        function estimateLiquidityMinted(pbAmountWei, usdlAmountWei, snapshot) {
            if (!snapshot.totalSupply || snapshot.totalSupply === 0n) {
                return 0n;
            }

            const byPB = (pbAmountWei * snapshot.totalSupply) / snapshot.pbReserve;
            const byUSDL = (usdlAmountWei * snapshot.totalSupply) / snapshot.usdlReserve;
            return byPB < byUSDL ? byPB : byUSDL;
        }

        function syncAddInputs(source, snapshot) {
            const pbInput = document.getElementById('add-lp-pb-amount');
            const usdlInput = document.getElementById('add-lp-usdl-amount');
            if (!pbInput || !usdlInput) return;

            const ratio = getPoolRatio(snapshot);
            if (!ratio || ratio <= 0) return;

            if (source === 'pb') {
                const pbValue = parseFloat(pbInput.value || '0');
                if (!pbValue || pbValue <= 0) {
                    usdlInput.value = '';
                    return;
                }
                usdlInput.value = (pbValue * ratio).toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
            }

            if (source === 'usdl') {
                const usdlValue = parseFloat(usdlInput.value || '0');
                if (!usdlValue || usdlValue <= 0) {
                    pbInput.value = '';
                    return;
                }
                pbInput.value = (usdlValue / ratio).toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
            }
        }

        function updateWalletDisplay(snapshot) {
            const balanceEl = document.getElementById('remove-lp-balance');
            const shareEl = document.getElementById('remove-lp-share');
            const addPbBalanceEl = document.getElementById('add-lp-balance-pb');
            const addUsdlBalanceEl = document.getElementById('add-lp-balance-usdl');

            if (balanceEl) {
                const lpBalanceFloat = Number(snapshot.lpBalanceExact);
                const totalSupplyFloat = Number(snapshot.totalSupplyExact);
                const poolShare = totalSupplyFloat > 0 ? (lpBalanceFloat / totalSupplyFloat) * 100 : 0;
                balanceEl.dataset.exact = snapshot.lpBalanceExact;
                balanceEl.innerText = formatNumber(lpBalanceFloat, 6);
                if (shareEl) shareEl.innerText = `${formatNumber(poolShare, 6)}%`;
            }

            if (addPbBalanceEl) {
                addPbBalanceEl.dataset.exact = snapshot.pbBalanceExact;
                addPbBalanceEl.innerText = formatNumber(snapshot.pbBalanceExact, 6);
            }
            if (addUsdlBalanceEl) {
                addUsdlBalanceEl.dataset.exact = snapshot.usdlBalanceExact;
                addUsdlBalanceEl.innerText = formatNumber(snapshot.usdlBalanceExact, 6);
            }
        }

        function estimateOutputs(lpAmountWei, snapshot) {
            if (!snapshot.totalSupply || snapshot.totalSupply === 0n) {
                return { pbOut: 0n, usdlOut: 0n };
            }

            return {
                pbOut: (lpAmountWei * snapshot.pbReserve) / snapshot.totalSupply,
                usdlOut: (lpAmountWei * snapshot.usdlReserve) / snapshot.totalSupply,
            };
        }

        function readRemovalEvent(receipt, removerContract) {
            let pbAmount = 0;
            let usdlAmount = 0;

            try {
                const parsedLog = receipt.logs
                    .map((log) => {
                        try {
                            return removerContract.interface.parseLog(log);
                        } catch (_) {
                            return null;
                        }
                    })
                    .find((entry) => entry && entry.name === 'UserLPRemoved');

                if (!parsedLog) {
                    return { pbAmount, usdlAmount };
                }

                pbAmount = Number(ethers.formatEther(parsedLog.args.pbAmount || 0n));
                usdlAmount = Number(ethers.formatEther(parsedLog.args.usdlAmount || 0n));
            } catch (err) {
                console.warn('Could not decode UserLPRemoved event:', err);
            }

            return { pbAmount, usdlAmount };
        }

        async function updateLPAddPreview(source) {
            setDefaults();
            lpTerminal.setMode('Add LP');

            const previewEl = document.getElementById('add-lp-preview');
            const pbInput = document.getElementById('add-lp-pb-amount');
            const usdlInput = document.getElementById('add-lp-usdl-amount');
            const slippageInput = document.getElementById('add-lp-slippage');

            if (!previewEl || !pbInput || !usdlInput || !slippageInput) return;

            if (!app.getAccount()) {
                previewEl.innerHTML = 'Connect wallet or enter a PB amount to preview the matching USDL side and LP minted.';
                return;
            }

            try {
                const snapshot = await getPoolSnapshot();
                updateWalletDisplay(snapshot);
                syncAddInputs(source, snapshot);

                const pbText = (pbInput.value || '').trim();
                const usdlText = (usdlInput.value || '').trim();
                const ratio = getPoolRatio(snapshot);
                const maxPBByUSDL = ratio > 0 ? Number(snapshot.usdlBalanceExact) / ratio : 0;
                const maxPB = Math.min(Number(snapshot.pbBalanceExact), maxPBByUSDL);
                const maxUSDL = maxPB * ratio;

                if (!pbText || !usdlText) {
                    previewEl.innerHTML = `Enter a PB amount or use the percentage buttons. At current reserves your max balanced add is about ${formatNumber(maxPB, 6)} PB + ${formatNumber(maxUSDL, 6)} USDL.`;
                    lpTerminal.setPreview({
                        modeLabel: 'Add LP',
                        mode: 'Add LP preview',
                        summaryRows: [
                            ['Wallet max balanced add', `${formatNumber(maxPB, 6)} PB + ${formatNumber(maxUSDL, 6)} USDL`],
                            ['Pool ratio', `${formatNumber(ratio, 6)} USDL / PB`],
                        ],
                        steps: [
                            { title: 'approve', badge: 'ERC20', body: 'PB and USDL may need separate router approvals before add-liquidity can execute.', details: [['Spender', PULSEX_ROUTER]] },
                            { title: 'addLiquidity', badge: 'Router', body: 'Router pulls both tokens, matches them against current reserves, and mints LP to your wallet.', details: [['Function', 'addLiquidity']] },
                        ],
                        addresses: [
                            ['Router', PULSEX_ROUTER],
                            ['LP remover', TPBRemoveUserLP],
                        ],
                    });
                    return;
                }

                const pbAmountWei = ethers.parseEther(pbText);
                const usdlAmountWei = ethers.parseEther(usdlText);
                if (pbAmountWei <= 0n || usdlAmountWei <= 0n) {
                    previewEl.innerHTML = 'Enter PB and USDL amounts greater than zero.';
                    return;
                }

                if (pbAmountWei > snapshot.pbBalance || usdlAmountWei > snapshot.usdlBalance) {
                    previewEl.innerHTML = 'Requested add amount exceeds your wallet PB or USDL balance.';
                    return;
                }

                const liquidity = estimateLiquidityMinted(pbAmountWei, usdlAmountWei, snapshot);
                const slippagePct = Math.max(0, parseFloat(slippageInput.value || String(DEFAULT_SLIPPAGE)) || DEFAULT_SLIPPAGE);
                const slippageBps = BigInt(Math.min(9900, Math.round(slippagePct * 100)));
                const minPB = (pbAmountWei * (10000n - slippageBps)) / 10000n;
                const minUSDL = (usdlAmountWei * (10000n - slippageBps)) / 10000n;
                const requestShare = snapshot.totalSupply > 0n ? Number(ethers.formatEther(liquidity)) / Number(snapshot.totalSupplyExact) * 100 : 0;

                previewEl.innerHTML = `
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
                        <div style="padding:10px;background:#161926;border-radius:8px;">
                            <div style="font-size:0.78rem;color:#888;">Matched deposit</div>
                            <div style="font-size:1rem;color:#4CAF50;font-weight:700;">${formatNumber(pbText, 6)} PB</div>
                            <div style="font-size:0.75rem;color:#777;">${formatNumber(usdlText, 6)} USDL</div>
                        </div>
                        <div style="padding:10px;background:#161926;border-radius:8px;">
                            <div style="font-size:0.78rem;color:#888;">Estimated LP minted</div>
                            <div style="font-size:1rem;color:#64B5F6;font-weight:700;">${formatNumber(ethers.formatEther(liquidity), 6)} LP</div>
                            <div style="font-size:0.75rem;color:#777;">Min amounts: ${formatNumber(ethers.formatEther(minPB), 6)} PB / ${formatNumber(ethers.formatEther(minUSDL), 6)} USDL</div>
                        </div>
                    </div>
                    <div style="margin-top:10px;font-size:0.8rem;color:#8f98b2;">This add is about ${formatNumber(requestShare, 6)}% of the current LP supply before minting.</div>
                `;
                lpTerminal.setPreview({
                    modeLabel: 'Add LP',
                    mode: 'Add LP preview',
                    summaryRows: [
                        ['PB in', `${formatNumber(pbText, 6)} PB`],
                        ['USDL in', `${formatNumber(usdlText, 6)} USDL`],
                        ['Estimated LP', `${formatNumber(ethers.formatEther(liquidity), 6)} LP`],
                    ],
                    steps: [
                        { title: 'approve', badge: 'ERC20', body: 'Approve PB and USDL to the router if current allowance is insufficient.', details: [['PB spender', PULSEX_ROUTER], ['USDL spender', PULSEX_ROUTER]] },
                        { title: 'addLiquidity', badge: 'Router', body: 'Router matches the supplied amounts to the pool ratio and sends LP directly to the connected wallet.', details: [['Function', 'addLiquidity'], ['Min PB', `${formatNumber(ethers.formatEther(minPB), 6)} PB`], ['Min USDL', `${formatNumber(ethers.formatEther(minUSDL), 6)} USDL`]] },
                    ],
                    addresses: [
                        ['Router', PULSEX_ROUTER],
                        ['LP remover', TPBRemoveUserLP],
                    ],
                });
            } catch (err) {
                console.error('LP add preview failed:', err);
                previewEl.innerHTML = 'Could not load LP add preview right now.';
            }
        }

        async function updateLPRemovalPreview() {
            setDefaults();
            lpTerminal.setMode('Remove LP');

            const balanceEl = document.getElementById('remove-lp-balance');
            const shareEl = document.getElementById('remove-lp-share');
            const previewEl = document.getElementById('remove-lp-preview');
            const amountInput = document.getElementById('remove-lp-amount');
            const slippageInput = document.getElementById('remove-lp-slippage');

            if (!balanceEl || !shareEl || !previewEl || !amountInput || !slippageInput) return;

            if (!app.getAccount()) {
                balanceEl.dataset.exact = '0';
                balanceEl.innerText = '-';
                shareEl.innerText = '-';
                previewEl.innerHTML = 'Connect wallet to inspect your LP position and estimate removal proceeds.';
                return;
            }

            try {
                const snapshot = await getPoolSnapshot();
                updateWalletDisplay(snapshot);

                const amountText = (amountInput.value || '').trim();
                if (!amountText) {
                    previewEl.innerHTML = 'Enter how much LP you want to remove. The dapp will estimate the PB and USDL returned from the current pool reserves.';
                    lpTerminal.setPreview({
                        modeLabel: 'Remove LP',
                        mode: 'Remove LP preview',
                        summaryRows: [
                            ['Wallet LP', `${formatNumber(snapshot.lpBalanceExact, 6)} LP`],
                            ['Pool share', shareEl ? shareEl.innerText : '-'],
                        ],
                        steps: [
                            { title: 'approve', badge: 'LP token', body: 'Approve the middleware to move the LP token from your wallet to the pair.', details: [['Spender', TPBRemoveUserLP]] },
                            { title: 'removeUserPBLP', badge: 'Middleware', body: 'Middleware burns LP via the pair and routes PB through the Vault so the token restriction is respected.', details: [['Function', 'removeUserPBLP']] },
                        ],
                        addresses: [
                            ['LP remover', TPBRemoveUserLP],
                            ['Router', PULSEX_ROUTER],
                        ],
                    });
                    return;
                }

                const lpAmountWei = ethers.parseEther(amountText);
                if (lpAmountWei <= 0n) {
                    previewEl.innerHTML = 'Enter an LP amount greater than zero.';
                    return;
                }

                if (lpAmountWei > snapshot.lpBalance) {
                    previewEl.innerHTML = 'Requested LP amount is higher than your wallet balance.';
                    return;
                }

                const { pbOut, usdlOut } = estimateOutputs(lpAmountWei, snapshot);
                const slippagePct = Math.max(0, parseFloat(slippageInput.value || String(DEFAULT_SLIPPAGE)) || DEFAULT_SLIPPAGE);
                const slippageBps = BigInt(Math.min(9900, Math.round(slippagePct * 100)));
                const minPB = (pbOut * (10000n - slippageBps)) / 10000n;
                const minUSDL = (usdlOut * (10000n - slippageBps)) / 10000n;
                const requestShare = Number(snapshot.totalSupplyExact) > 0 ? (Number(amountText) / Number(snapshot.totalSupplyExact)) * 100 : 0;

                previewEl.innerHTML = `
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
                        <div style="padding:10px;background:#161926;border-radius:8px;">
                            <div style="font-size:0.78rem;color:#888;">Estimated PB back</div>
                            <div style="font-size:1rem;color:#4CAF50;font-weight:700;">${formatNumber(ethers.formatEther(pbOut), 6)} PB</div>
                            <div style="font-size:0.75rem;color:#777;">Min after slippage: ${formatNumber(ethers.formatEther(minPB), 6)} PB</div>
                        </div>
                        <div style="padding:10px;background:#161926;border-radius:8px;">
                            <div style="font-size:0.78rem;color:#888;">Estimated USDL back</div>
                            <div style="font-size:1rem;color:#FFD700;font-weight:700;">${formatNumber(ethers.formatEther(usdlOut), 6)} USDL</div>
                            <div style="font-size:0.75rem;color:#777;">Min after slippage: ${formatNumber(ethers.formatEther(minUSDL), 6)} USDL</div>
                        </div>
                    </div>
                    <div style="margin-top:10px;font-size:0.8rem;color:#8f98b2;">This request removes about ${formatNumber(requestShare, 6)}% of the full PB/USDL pool LP supply.</div>
                `;
                lpTerminal.setPreview({
                    modeLabel: 'Remove LP',
                    mode: 'Remove LP preview',
                    summaryRows: [
                        ['LP to burn', `${formatNumber(amountText, 6)} LP`],
                        ['Estimated PB out', `${formatNumber(ethers.formatEther(pbOut), 6)} PB`],
                        ['Estimated USDL out', `${formatNumber(ethers.formatEther(usdlOut), 6)} USDL`],
                    ],
                    steps: [
                        { title: 'approve', badge: 'LP token', body: 'Approve middleware if current LP allowance is short.', details: [['Spender', TPBRemoveUserLP]] },
                        { title: 'removeUserPBLP', badge: 'Middleware', body: 'Burns LP to Vault, then Vault forwards the recovered PB and USDL back to your wallet.', details: [['Function', 'removeUserPBLP'], ['Min PB', `${formatNumber(ethers.formatEther(minPB), 6)} PB`], ['Min USDL', `${formatNumber(ethers.formatEther(minUSDL), 6)} USDL`]] },
                    ],
                    addresses: [
                        ['LP remover', TPBRemoveUserLP],
                        ['Router', PULSEX_ROUTER],
                    ],
                });
            } catch (err) {
                console.error('LP removal preview failed:', err);
                previewEl.innerHTML = 'Could not load LP removal preview right now.';
            }
        }

        async function fillAddLPAmounts(fraction) {
            if (!app.getAccount()) {
                alert('Connect wallet first');
                return;
            }

            try {
                const snapshot = await getPoolSnapshot();
                const ratio = getPoolRatio(snapshot);
                if (!ratio || ratio <= 0) return;

                const maxPBByUSDL = Number(snapshot.usdlBalanceExact) / ratio;
                const maxPB = Math.max(0, Math.min(Number(snapshot.pbBalanceExact), maxPBByUSDL));
                const targetPB = maxPB * fraction;
                const targetUSDL = targetPB * ratio;

                const pbInput = document.getElementById('add-lp-pb-amount');
                const usdlInput = document.getElementById('add-lp-usdl-amount');
                if (pbInput) pbInput.value = targetPB.toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
                if (usdlInput) usdlInput.value = targetUSDL.toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
                await updateLPAddPreview();
            } catch (err) {
                console.error('Could not fill add LP amounts:', err);
            }
        }

        async function PBaddUserLP() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }

            const pbInput = document.getElementById('add-lp-pb-amount');
            const usdlInput = document.getElementById('add-lp-usdl-amount');
            const slippageInput = document.getElementById('add-lp-slippage');
            const deadlineInput = document.getElementById('add-lp-deadline');
            if (!pbInput || !usdlInput || !slippageInput || !deadlineInput) return;

            try {
                const pbText = (pbInput.value || '').trim();
                const usdlText = (usdlInput.value || '').trim();
                if (!pbText || !usdlText || Number(pbText) <= 0 || Number(usdlText) <= 0) {
                    alert('Enter valid PB and USDL amounts');
                    return;
                }

                const slippagePct = parseFloat(slippageInput.value || String(DEFAULT_SLIPPAGE));
                if (!Number.isFinite(slippagePct) || slippagePct < 0 || slippagePct >= 99) {
                    alert('Enter a slippage value between 0 and 99');
                    return;
                }

                const deadlineMinutes = parseInt(deadlineInput.value || String(DEFAULT_DEADLINE_MINUTES), 10);
                if (!Number.isFinite(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > 1440) {
                    alert('Enter a deadline between 1 and 1440 minutes');
                    return;
                }

                const snapshot = await getPoolSnapshot();
                const pbAmountWei = ethers.parseEther(pbText);
                const usdlAmountWei = ethers.parseEther(usdlText);
                if (pbAmountWei > snapshot.pbBalance || usdlAmountWei > snapshot.usdlBalance) {
                    alert('Requested add amount exceeds wallet PB or USDL balance');
                    return;
                }

                const slippageBps = BigInt(Math.round(slippagePct * 100));
                const minPB = (pbAmountWei * (10000n - slippageBps)) / 10000n;
                const minUSDL = (usdlAmountWei * (10000n - slippageBps)) / 10000n;
                const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

                const [pairRead, pbContract, usdlContract, routerContract] = [
                    app.contractLayer.getReadContract('pair'),
                    app.contractLayer.getWriteContract('pb'),
                    app.contractLayer.getWriteContract('tusdl'),
                    app.contractLayer.getWriteContract('router'),
                ];

                const [beforePB, beforeUSDL, beforeLP, pbAllowance, usdlAllowance] = await Promise.all([
                    app.contractLayer.getReadContract('pb').balanceOf(app.getAccount()),
                    app.contractLayer.getReadContract('tusdl').balanceOf(app.getAccount()),
                    pairRead.balanceOf(app.getAccount()),
                    pbContract.allowance(app.getAccount(), PULSEX_ROUTER),
                    usdlContract.allowance(app.getAccount(), PULSEX_ROUTER),
                ]);

                lpTerminal.setMode('Add LP');
                lpTerminal.resetChain();

                if (pbAllowance < pbAmountWei) {
                    showStatus('add-lp-status', '⏳ Approving PB for router...', 'info');
                    const approvePbTx = await pbContract.approve(PULSEX_ROUTER, pbAmountWei);
                    lpTerminal.pushChainEvent('PB approval submitted', 'Waiting for PB approval receipt.', 'info', [['Function', 'approve'], ['Tx', approvePbTx.hash]]);
                    await approvePbTx.wait();
                    lpTerminal.pushChainEvent('PB approval confirmed', 'Router can spend the requested PB amount.', 'success', [['Tx', approvePbTx.hash]]);
                }

                if (usdlAllowance < usdlAmountWei) {
                    showStatus('add-lp-status', '⏳ Approving USDL for router...', 'info');
                    const approveUsdlTx = await usdlContract.approve(PULSEX_ROUTER, usdlAmountWei);
                    lpTerminal.pushChainEvent('USDL approval submitted', 'Waiting for USDL approval receipt.', 'info', [['Function', 'approve'], ['Tx', approveUsdlTx.hash]]);
                    await approveUsdlTx.wait();
                    lpTerminal.pushChainEvent('USDL approval confirmed', 'Router can spend the requested USDL amount.', 'success', [['Tx', approveUsdlTx.hash]]);
                }

                showStatus('add-lp-status', '⏳ Adding liquidity on PulseX...', 'info');
                const tx = await routerContract.addLiquidity(
                    TPB,
                    TUSDL,
                    pbAmountWei,
                    usdlAmountWei,
                    minPB,
                    minUSDL,
                    app.getAccount(),
                    deadline
                );
                lpTerminal.pushChainEvent('Add LP submitted', 'Router add-liquidity transaction sent to wallet.', 'info', [['Function', 'addLiquidity'], ['Tx', tx.hash]]);
                showTransactionStatus('add-lp-status', '⏳ Waiting for add-liquidity confirmation...', 'info', tx.hash, getExplorerBaseUrl());

                const receipt = await tx.wait();
                const [afterPB, afterUSDL, afterLP] = await Promise.all([
                    app.contractLayer.getReadContract('pb').balanceOf(app.getAccount()),
                    app.contractLayer.getReadContract('tusdl').balanceOf(app.getAccount()),
                    pairRead.balanceOf(app.getAccount()),
                ]);

                const pbSpent = beforePB > afterPB ? beforePB - afterPB : 0n;
                const usdlSpent = beforeUSDL > afterUSDL ? beforeUSDL - afterUSDL : 0n;
                const lpMinted = afterLP > beforeLP ? afterLP - beforeLP : 0n;
                lpTerminal.pushChainEvent('Add LP confirmed', 'Liquidity added and LP minted to the connected wallet.', 'success', [['Tx', receipt.hash], ['PB spent', `${formatNumber(ethers.formatEther(pbSpent), 6)} PB`], ['USDL spent', `${formatNumber(ethers.formatEther(usdlSpent), 6)} USDL`], ['LP minted', `${formatNumber(ethers.formatEther(lpMinted), 6)} LP`]]);

                showTransactionStatus(
                    'add-lp-status',
                    `✅ LP added. Spent ${formatNumber(ethers.formatEther(pbSpent), 6)} PB and ${formatNumber(ethers.formatEther(usdlSpent), 6)} USDL for ${formatNumber(ethers.formatEther(lpMinted), 6)} LP.`,
                    'success',
                    receipt.hash,
                    getExplorerBaseUrl()
                );

                pbInput.value = '';
                usdlInput.value = '';
                await updateLPManagementPreview();
                setTimeout(() => {
                    app.refreshDashboard({ includeBalances: true, includePositions: true, includeDropdowns: true, includeLPStatus: true });
                }, 1500);
            } catch (err) {
                console.error('LP add failed:', err);
                lpTerminal.pushChainEvent('Add LP failed', err.reason || err.shortMessage || err.message, 'error');
                showStatus('add-lp-status', '❌ LP add failed: ' + (err.reason || err.shortMessage || err.message), 'error');
            }
        }

        async function PBremoveUserLP() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }

            const amountInput = document.getElementById('remove-lp-amount');
            const slippageInput = document.getElementById('remove-lp-slippage');
            const deadlineInput = document.getElementById('remove-lp-deadline');
            if (!amountInput || !slippageInput || !deadlineInput) return;

            try {
                const amountText = (amountInput.value || '').trim();
                if (!amountText || Number(amountText) <= 0) {
                    alert('Enter a valid LP amount');
                    return;
                }

                const slippagePct = parseFloat(slippageInput.value || String(DEFAULT_SLIPPAGE));
                if (!Number.isFinite(slippagePct) || slippagePct < 0 || slippagePct >= 99) {
                    alert('Enter a slippage value between 0 and 99');
                    return;
                }

                const deadlineMinutes = parseInt(deadlineInput.value || String(DEFAULT_DEADLINE_MINUTES), 10);
                if (!Number.isFinite(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > 1440) {
                    alert('Enter a deadline between 1 and 1440 minutes');
                    return;
                }

                const snapshot = await getPoolSnapshot();
                const lpAmountWei = ethers.parseEther(amountText);
                if (lpAmountWei > snapshot.lpBalance) {
                    alert('LP amount exceeds wallet balance');
                    return;
                }

                const { pbOut, usdlOut } = estimateOutputs(lpAmountWei, snapshot);
                const slippageBps = BigInt(Math.round(slippagePct * 100));
                const minPB = (pbOut * (10000n - slippageBps)) / 10000n;
                const minUSDL = (usdlOut * (10000n - slippageBps)) / 10000n;
                const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
                lpTerminal.setMode('Remove LP');
                lpTerminal.resetChain();

                const pairContract = app.contractLayer.getWriteContract('pair');
                const allowance = await pairContract.allowance(app.getAccount(), TPBRemoveUserLP);
                if (allowance < lpAmountWei) {
                    showStatus('remove-lp-status', '⏳ Approving LP tokens...', 'info');
                    const approveTx = await pairContract.approve(TPBRemoveUserLP, lpAmountWei);
                    lpTerminal.pushChainEvent('LP approval submitted', 'Waiting for LP allowance receipt.', 'info', [['Function', 'approve'], ['Tx', approveTx.hash]]);
                    await approveTx.wait();
                    lpTerminal.pushChainEvent('LP approval confirmed', 'Middleware can now move the requested LP amount.', 'success', [['Tx', approveTx.hash]]);
                }

                showStatus('remove-lp-status', '⏳ Removing LP from PulseX...', 'info');
                const removerContract = app.contractLayer.getWriteContract('removeUserLP');
                const tx = await removerContract.removeUserPBLP(lpAmountWei, minPB, minUSDL, deadline);
                lpTerminal.pushChainEvent('Remove LP submitted', 'Middleware removal transaction sent to wallet.', 'info', [['Function', 'removeUserPBLP'], ['Tx', tx.hash]]);
                showTransactionStatus('remove-lp-status', '⏳ Waiting for LP removal confirmation...', 'info', tx.hash, getExplorerBaseUrl());

                const receipt = await tx.wait();
                const { pbAmount, usdlAmount } = readRemovalEvent(receipt, removerContract);
                lpTerminal.pushChainEvent('Remove LP confirmed', 'LP burned and underlying tokens forwarded back to the wallet.', 'success', [['Tx', receipt.hash], ['PB out', `${formatNumber(pbAmount, 6)} PB`], ['USDL out', `${formatNumber(usdlAmount, 6)} USDL`]]);
                showTransactionStatus(
                    'remove-lp-status',
                    `✅ LP removed. Received ${formatNumber(pbAmount, 6)} PB and ${formatNumber(usdlAmount, 6)} USDL.`,
                    'success',
                    receipt.hash,
                    getExplorerBaseUrl()
                );

                amountInput.value = '';
                await updateLPManagementPreview();
                setTimeout(() => {
                    app.refreshDashboard({ includeBalances: true, includePositions: true, includeDropdowns: true, includeLPStatus: true });
                }, 1500);
            } catch (err) {
                console.error('LP removal failed:', err);
                lpTerminal.pushChainEvent('Remove LP failed', err.reason || err.shortMessage || err.message, 'error');
                showStatus('remove-lp-status', '❌ LP removal failed: ' + (err.reason || err.shortMessage || err.message), 'error');
            }
        }

        async function updateLPManagementPreview() {
            setDefaults();

            if (!app.getAccount()) {
                const addPreviewEl = document.getElementById('add-lp-preview');
                const removePreviewEl = document.getElementById('remove-lp-preview');
                const balanceEl = document.getElementById('remove-lp-balance');
                const shareEl = document.getElementById('remove-lp-share');
                const addPbBalanceEl = document.getElementById('add-lp-balance-pb');
                const addUsdlBalanceEl = document.getElementById('add-lp-balance-usdl');

                if (balanceEl) { balanceEl.dataset.exact = '0'; balanceEl.innerText = '-'; }
                if (shareEl) shareEl.innerText = '-';
                if (addPbBalanceEl) { addPbBalanceEl.dataset.exact = '0'; addPbBalanceEl.innerText = '-'; }
                if (addUsdlBalanceEl) { addUsdlBalanceEl.dataset.exact = '0'; addUsdlBalanceEl.innerText = '-'; }
                if (addPreviewEl) addPreviewEl.innerHTML = 'Connect wallet or enter a PB amount to preview the matching USDL side and LP minted.';
                if (removePreviewEl) removePreviewEl.innerHTML = 'Connect wallet to inspect your LP position.';
                return;
            }

            try {
                const snapshot = await getPoolSnapshot();
                updateWalletDisplay(snapshot);
            } catch (err) {
                console.error('LP management snapshot failed:', err);
            }

            await updateLPAddPreview();
            await updateLPRemovalPreview();
        }

        return {
            updateLPManagementPreview,
            updateLPAddPreview,
            updateLPRemovalPreview,
            fillAddLPAmounts,
            PBaddUserLP,
            PBremoveUserLP,
        };
    }

    window.PBTestDappRemoveLP = { create };
})();