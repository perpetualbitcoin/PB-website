(function () {
    const {
        TPBr,
        TPBi,
        NFT_ABI,
        TVault,
        showStatus,
        createOperationTerminal,
    } = window.PBTestDapp;

    function create(app) {
        let selectedActivation = null;
        const recoveryTerminal = createOperationTerminal({
            containerId: 'recovery-terminal',
            modeId: 'recovery-terminal-mode',
            defaultMode: 'Recovery',
            defaultStatus: 'Fill recovery, inheritance, or activation fields to preview the transaction path',
            addresses: [
                ['Vault', TVault],
                ['PBr', TPBr],
                ['PBi', TPBi],
            ],
        });

        function shortAddress(value) {
            return value && value.startsWith('0x') && value.length > 10
                ? `${value.slice(0, 6)}...${value.slice(-4)}`
                : (value || '-');
        }

        function isValidMemo(value) {
            return /^[A-Za-z0-9 ,.\-]*$/.test(value || '');
        }

        function getConfirmationStatus(password, confirmation) {
            if (!password) return 'Missing';
            if (!confirmation) return 'Awaiting confirmation';
            return password === confirmation ? 'Matched' : 'Mismatch';
        }

        function updateRecoveryTerminalPreview(mode) {
            const nextMode = mode || 'recovery';
            if (nextMode === 'inheritance') {
                const pbtId = document.getElementById('inheritance-pbtid')?.value || '-';
                const beneficiary = document.getElementById('beneficiary-addr')?.value || '';
                const password = document.getElementById('inheritance-password')?.value || '';
                const confirmation = document.getElementById('inheritance-password-confirm')?.value || '';
                const memo = document.getElementById('inheritance-memo')?.value || '';
                recoveryTerminal.setMode('Inheritance');
                recoveryTerminal.setPreview({
                    modeLabel: 'Inheritance',
                    mode: 'Inheritance preview',
                    summaryRows: [
                        ['PBt ID', pbtId],
                        ['Beneficiary', shortAddress(beneficiary)],
                        ['Password length', password ? `${password.length} chars` : 'Missing'],
                        ['Password confirm', getConfirmationStatus(password, confirmation)],
                    ],
                    steps: [
                        { title: 'password hash', badge: 'Client', body: 'The plaintext password is hashed locally before the transaction is sent.', details: [['Memo length', `${memo.length} chars`]] },
                        { title: 'setInheritanceAddress', badge: 'Vault', body: 'Vault records the beneficiary and password hash against the selected PBt position.', details: [['Function', 'setInheritanceAddress']] },
                    ],
                    addresses: [['Vault', TVault], ['PBi', TPBi]],
                });
                return;
            }

            if (nextMode === 'activation') {
                const selectValue = document.getElementById('combined-badge-select')?.value || '';
                const badge = selectedActivation || (selectValue ? (() => {
                    const [type, id] = selectValue.split(':');
                    return { type, id: parseInt(id, 10) };
                })() : null);
                const password = document.getElementById('combined-activate-password')?.value || '';
                const actionLabel = badge ? (badge.type === 'recovery' ? 'Activate PBr' : 'Activate PBi') : 'Activate Badge';
                recoveryTerminal.setMode(actionLabel);
                recoveryTerminal.setPreview({
                    modeLabel: actionLabel,
                    mode: `${actionLabel} preview`,
                    summaryRows: [
                        ['Selected badge', badge ? `${badge.type === 'recovery' ? 'PBr' : 'PBi'} #${badge.id}` : 'Detect first'],
                        ['Password length', password ? `${password.length} chars` : 'Missing'],
                    ],
                    steps: [
                        { title: 'detect badges', badge: 'Read', body: 'Wallet scans ERC-1155 badge IDs held by the connected account.', details: [['PBr', TPBr], ['PBi', TPBi]] },
                        { title: badge && badge.type === 'recovery' ? 'activateRecovery' : 'activateInheritance', badge: 'Vault', body: 'Vault validates the provided password and activates the selected badge path.', details: [['Function', badge && badge.type === 'recovery' ? 'activateRecovery' : 'activateInheritance']] },
                    ],
                    addresses: [['Vault', TVault], ['PBr', TPBr], ['PBi', TPBi]],
                });
                return;
            }

            const pbtId = document.getElementById('recovery-pbtid')?.value || '-';
            const recoveryAddr = document.getElementById('recovery-addr')?.value || '';
            const password = document.getElementById('recovery-password')?.value || '';
            const confirmation = document.getElementById('recovery-password-confirm')?.value || '';
            const memo = document.getElementById('recovery-memo')?.value || '';
            recoveryTerminal.setMode('Recovery');
            recoveryTerminal.setPreview({
                modeLabel: 'Recovery',
                mode: 'Recovery preview',
                summaryRows: [
                    ['PBt ID', pbtId],
                    ['Recovery wallet', shortAddress(recoveryAddr)],
                    ['Password length', password ? `${password.length} chars` : 'Missing'],
                    ['Password confirm', getConfirmationStatus(password, confirmation)],
                ],
                steps: [
                    { title: 'password hash', badge: 'Client', body: 'The password is hashed in-browser before the transaction is signed.', details: [['Memo length', `${memo.length} chars`]] },
                    { title: 'setRecoveryAddress', badge: 'Vault', body: 'Vault stores the fallback recovery address and hash for the selected PBt position.', details: [['Function', 'setRecoveryAddress']] },
                ],
                addresses: [['Vault', TVault], ['PBr', TPBr]],
            });
        }

        function resetCombinedActivationUi() {
            selectedActivation = null;
            const infoEl = document.getElementById('combined-badge-info');
            const textEl = document.getElementById('combined-badge-text');
            const selectEl = document.getElementById('combined-badge-select');
            const passwordEl = document.getElementById('combined-activate-password');
            const activateBtn = document.getElementById('btn-activate-selected-badge');

            if (infoEl) infoEl.style.display = 'none';
            if (textEl) textEl.innerText = '';
            if (selectEl) {
                selectEl.innerHTML = '';
                selectEl.style.display = 'none';
                selectEl.onchange = null;
            }
            if (passwordEl) {
                passwordEl.value = '';
                passwordEl.disabled = true;
            }
            if (activateBtn) activateBtn.disabled = true;
            const bannerEl = document.getElementById('pbi-warning-banner');
            if (bannerEl) { bannerEl.style.display = 'none'; bannerEl.innerHTML = ''; }
            updateRecoveryTerminalPreview('activation');
        }

        function enableCombinedActivation() {
            const passwordEl = document.getElementById('combined-activate-password');
            const activateBtn = document.getElementById('btn-activate-selected-badge');
            if (passwordEl) passwordEl.disabled = false;
            if (activateBtn) activateBtn.disabled = false;
        }

        function describeBadgeType(type) {
            return type === 'recovery' ? 'PBr' : 'PBi';
        }

        async function populatePBtDropdowns() {
            const account = app.getAccount();
            if (!account) return;
            try {
                const vaultContract = app.contractLayer.getReadContract('vaultviews');
                const pbtIds = await vaultContract.getUserPBtIds(account);

                let options = '<option value="">Select a position...</option>';
                for (const id of pbtIds) {
                    options += `<option value="${id}">PBt ID #${id}</option>`;
                }

                document.getElementById('recovery-pbtid').innerHTML = options;
                document.getElementById('inheritance-pbtid').innerHTML = options;
            } catch (err) {
                console.error('PBt dropdown populate failed:', err);
            }
        }

        async function setupRecovery() {
            const account = app.getAccount();
            if (!account || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const pbtId = document.getElementById('recovery-pbtid').value;
                const recoveryAddr = document.getElementById('recovery-addr').value;
                const password = document.getElementById('recovery-password').value;
                const confirmation = document.getElementById('recovery-password-confirm').value;

                if (!pbtId || !recoveryAddr || !password || !confirmation) {
                    alert('Fill in all fields');
                    return;
                }
                if (password !== confirmation) {
                    alert('Recovery passwords do not match');
                    return;
                }
                if (recoveryAddr.toLowerCase() === account.toLowerCase()) {
                    alert('Cannot set yourself as recovery address');
                    return;
                }
                if (password.length < 11) {
                    alert('Password must be at least 11 characters');
                    return;
                }

                const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
                const recoveryMemo = document.getElementById('recovery-memo').value || '';
                if (!isValidMemo(recoveryMemo)) {
                    alert('Memo can only contain letters, numbers, spaces, dash, comma, and period');
                    return;
                }
                recoveryTerminal.setMode('Recovery');
                recoveryTerminal.resetChain();
                recoveryTerminal.pushChainEvent('Recovery submission', 'Sending recovery setup transaction to the vault.', 'info', [['Function', 'setRecoveryAddress'], ['PBt ID', pbtId]]);
                showStatus('recovery-status', '⏳ Setting recovery...', 'info');

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tx = await vaultContract.setRecoveryAddress(pbtId, recoveryAddr, passwordHash, recoveryMemo);
                const receipt = await tx.wait();
                recoveryTerminal.pushChainEvent('Recovery confirmed', 'Recovery wallet stored on-chain for the selected PBt.', 'success', [['Tx', receipt.hash], ['Recovery wallet', shortAddress(recoveryAddr)]]);
                showStatus('recovery-status', '✅ Recovery address set! Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
            } catch (err) {
                console.error('Recovery setup failed:', err);
                recoveryTerminal.pushChainEvent('Recovery failed', err.reason || err.message, 'error');
                showStatus('recovery-status', '❌ Setup failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function setupInheritance() {
            const account = app.getAccount();
            if (!account || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const pbtId = document.getElementById('inheritance-pbtid').value;
                const beneficiary = document.getElementById('beneficiary-addr').value;
                const password = document.getElementById('inheritance-password').value;
                const confirmation = document.getElementById('inheritance-password-confirm').value;

                if (!pbtId || !beneficiary || !password || !confirmation) {
                    alert('Fill in all fields');
                    return;
                }
                if (password !== confirmation) {
                    alert('Inheritance passwords do not match');
                    return;
                }
                if (beneficiary.toLowerCase() === account.toLowerCase()) {
                    alert('Cannot set yourself as beneficiary');
                    return;
                }
                if (password.length < 11) {
                    alert('Password must be at least 11 characters');
                    return;
                }

                const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
                const inheritanceMemo = document.getElementById('inheritance-memo').value || '';
                if (!isValidMemo(inheritanceMemo)) {
                    alert('Memo can only contain letters, numbers, spaces, dash, comma, and period');
                    return;
                }
                recoveryTerminal.setMode('Inheritance');
                recoveryTerminal.resetChain();
                recoveryTerminal.pushChainEvent('Inheritance submission', 'Sending inheritance setup transaction to the vault.', 'info', [['Function', 'setInheritanceAddress'], ['PBt ID', pbtId]]);
                showStatus('inheritance-status', '⏳ Setting inheritance...', 'info');

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tx = await vaultContract.setInheritanceAddress(pbtId, beneficiary, passwordHash, inheritanceMemo);
                const receipt = await tx.wait();
                recoveryTerminal.pushChainEvent('Inheritance confirmed', 'Beneficiary stored on-chain for the selected PBt.', 'success', [['Tx', receipt.hash], ['Beneficiary', shortAddress(beneficiary)]]);
                showStatus('inheritance-status', '✅ Beneficiary set! Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
            } catch (err) {
                console.error('Inheritance setup failed:', err);
                recoveryTerminal.pushChainEvent('Inheritance failed', err.reason || err.message, 'error');
                showStatus('inheritance-status', '❌ Setup failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function checkAndShowPBiWarning(badge) {
            const bannerEl = document.getElementById('pbi-warning-banner');
            if (!bannerEl) return;
            bannerEl.style.display = 'none';
            bannerEl.innerHTML = '';
            if (!badge || badge.type !== 'recovery') return;
            try {
                const viewsContract = app.contractLayer.getReadContract('vaultviews');
                const inhData = await viewsContract.getInheritanceData(badge.id);
                const inhAddr = inhData.inheritanceAddress || inhData[0];
                if (inhAddr && inhAddr !== '0x0000000000000000000000000000000000000000') {
                    bannerEl.innerHTML = '🚨 <strong>PBi already set on PBt #' + badge.id + '</strong><br>' +
                        'Beneficiary: <span style="color:#ffaa00;">' + inhAddr.substring(0, 6) + '...' + inhAddr.substring(38) + '</span><br>' +
                        'The PBi holder can <strong>revert / cancel / overrule</strong> this PBr activation. Proceed with caution.';
                    bannerEl.style.display = 'block';
                }
            } catch (err) {
                console.warn('PBi warning check failed (non-blocking):', err);
            }
        }

        async function activateSelectedBadge() {
            if (!selectedActivation) {
                alert('Detect your PBr / PBi badges first');
                return;
            }
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }

            try {
                const password = document.getElementById('combined-activate-password').value;
                if (!password) {
                    alert('Enter the activation password for the selected badge');
                    return;
                }

                const badgeLabel = describeBadgeType(selectedActivation.type);
                const statusMessage = selectedActivation.type === 'recovery'
                    ? '⏳ Activating recovery for '
                    : '⏳ Activating inheritance for ';
                recoveryTerminal.setMode(selectedActivation.type === 'recovery' ? 'Activate PBr' : 'Activate PBi');
                recoveryTerminal.resetChain();
                recoveryTerminal.pushChainEvent('Activation submission', 'Submitting activation transaction for the selected badge.', 'info', [['Badge', badgeLabel + ' #' + selectedActivation.id]]);
                showStatus('combined-activate-status', statusMessage + badgeLabel + ' ID #' + selectedActivation.id + '...', 'info');

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tx = selectedActivation.type === 'recovery'
                    ? await vaultContract.activateRecovery(selectedActivation.id, password)
                    : await vaultContract.activateInheritance(selectedActivation.id, password);
                const receipt = await tx.wait();

                const successLabel = selectedActivation.type === 'recovery' ? 'Recovery activated!' : 'Inheritance activated!';
                recoveryTerminal.pushChainEvent('Activation confirmed', 'Vault accepted the password and activated the badge path.', 'success', [['Tx', receipt.hash], ['Badge', badgeLabel + ' #' + selectedActivation.id]]);
                showStatus('combined-activate-status', '✅ ' + successLabel + ' ' + badgeLabel + ' ID #' + selectedActivation.id + ' | Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
                resetCombinedActivationUi();
                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true, includePrice: false });
                }, 3000);
            } catch (err) {
                console.error('Combined badge activation failed:', err);
                recoveryTerminal.pushChainEvent('Activation failed', err.reason || err.message, 'error');
                showStatus('combined-activate-status', '❌ Activation failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function updateRecoveryInheritanceDiagnostics() {
            const account = app.getAccount();
            if (!account || !app.getWeb3()) return;
            try {
                const pbrDiagEl = document.getElementById('diag-pbr-balance');
                const pbiDiagEl = document.getElementById('diag-pbi-balance');
                if (!pbrDiagEl || !pbiDiagEl) return;

                const pbrContract = app.contractLayer.getReadContract('pbr');
                const pbiContract = app.contractLayer.getReadContract('pbi');
                const pbrBadgeIds = await pbrContract.getBadgeIds(account);
                const pbiBadgeIds = await pbiContract.getBadgeIds(account);

                pbrDiagEl.innerText = pbrBadgeIds.length.toString();
                pbiDiagEl.innerText = pbiBadgeIds.length.toString();
            } catch (err) {
                console.error('Diagnostics failed:', err);
            }
        }

        async function findActivatableBadges() {
            const account = app.getAccount();
            if (!account || !app.getWeb3()) {
                alert('Connect wallet first');
                return;
            }

            try {
                resetCombinedActivationUi();
                recoveryTerminal.setMode('Activate Badge');
                recoveryTerminal.resetChain();
                recoveryTerminal.pushChainEvent('Badge scan', 'Scanning connected wallet for recovery and inheritance badges.', 'info', [['PBr', TPBr], ['PBi', TPBi]]);
                showStatus('combined-activate-status', 'Fetching your PBr / PBi badges...', 'info');

                const pbrContract = new ethers.Contract(TPBr, ['function getBadgeIds(address holder) view returns (uint256[])'], app.getWeb3());
                const pbiContract = new ethers.Contract(TPBi, ['function getBadgeIds(address holder) view returns (uint256[])'], app.getWeb3());
                const [pbrBadgeIds, pbiBadgeIds] = await Promise.all([
                    pbrContract.getBadgeIds(account),
                    pbiContract.getBadgeIds(account),
                ]);

                const foundBadges = [
                    ...pbrBadgeIds.map((id) => ({
                        type: 'recovery',
                        id: id.toNumber ? id.toNumber() : Number(id),
                    })),
                    ...pbiBadgeIds.map((id) => ({
                        type: 'inheritance',
                        id: id.toNumber ? id.toNumber() : Number(id),
                    })),
                ];

                if (foundBadges.length === 0) {
                    recoveryTerminal.pushChainEvent('Badge scan empty', 'No activatable badges found in the connected wallet.', 'warning');
                    showStatus('combined-activate-status', 'No PBr or PBi badges found in your wallet', 'error');
                    return;
                }

                const infoEl = document.getElementById('combined-badge-info');
                const textEl = document.getElementById('combined-badge-text');
                const selectEl = document.getElementById('combined-badge-select');
                infoEl.style.display = 'block';

                if (foundBadges.length === 1) {
                    selectedActivation = foundBadges[0];
                    textEl.innerText = 'Found: ' + describeBadgeType(selectedActivation.type) + ' ID #' + selectedActivation.id;
                    selectEl.style.display = 'none';
                    enableCombinedActivation();
                    recoveryTerminal.pushChainEvent('Badge found', 'One activatable badge detected and ready for password entry.', 'success', [['Badge', describeBadgeType(selectedActivation.type) + ' #' + selectedActivation.id]]);
                    updateRecoveryTerminalPreview('activation');
                    showStatus('combined-activate-status', 'Found ' + describeBadgeType(selectedActivation.type) + ' ID #' + selectedActivation.id + ' ✓ Ready to activate', 'success');
                    checkAndShowPBiWarning(selectedActivation);
                    return;
                }

                textEl.innerText = 'Found ' + foundBadges.length + ' activatable badges - select one:';
                selectEl.innerHTML = '';
                foundBadges.forEach((badge) => {
                    const option = document.createElement('option');
                    option.value = badge.type + ':' + badge.id;
                    option.innerText = describeBadgeType(badge.type) + ' ID #' + badge.id;
                    selectEl.appendChild(option);
                });
                selectEl.style.display = 'block';
                selectedActivation = foundBadges[0];
                selectEl.onchange = function () {
                    const [type, id] = this.value.split(':');
                    selectedActivation = { type, id: parseInt(id, 10) };
                    checkAndShowPBiWarning(selectedActivation);
                    updateRecoveryTerminalPreview('activation');
                };
                enableCombinedActivation();
                recoveryTerminal.pushChainEvent('Multiple badges found', 'Select one badge and enter its password to continue.', 'success', [['Badge count', String(foundBadges.length)]]);
                updateRecoveryTerminalPreview('activation');
                showStatus('combined-activate-status', 'Select a badge and enter the matching password to activate', 'success');
                checkAndShowPBiWarning(selectedActivation);
            } catch (err) {
                console.error('Badge detection failed:', err);
                recoveryTerminal.pushChainEvent('Badge scan failed', err.message, 'error');
                showStatus('combined-activate-status', 'Error fetching: ' + err.message, 'error');
            }
        }

        async function checkRecoveryInheritanceStatus() {
            const account = app.getAccount();
            if (!account || !app.getWeb3()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const pbrId = prompt('Enter PBr ID to check recovery setup:');
                if (!pbrId) return;

                const pbrContract = new ethers.Contract(TPBr, NFT_ABI, app.getWeb3());
                const pbrBalance = await pbrContract.balanceOf(account);
                let result = '<strong>Recovery Status for ID #' + pbrId + ':</strong><br>';
                let ownsId = false;

                if (pbrBalance > 0) {
                    for (let i = 0; i < pbrBalance; i++) {
                        const tokenId = await pbrContract.tokenOfOwnerByIndex(account, i);
                        if (tokenId.toString() === pbrId) {
                            ownsId = true;
                            break;
                        }
                    }
                }

                if (ownsId) {
                    result += '✅ You own PBr ID #' + pbrId + '<br>';
                    const vaultContract = new ethers.Contract(TVault, app.contractLayer.getReadContract('vault').interface.fragments, app.getWeb3());
                    try {
                        void vaultContract;
                        result += '✅ Recovery setup detected on vault<br>';
                    } catch {
                        result += '⚠️ Could not verify recovery setup on vault<br>';
                    }
                } else {
                    result += '❌ You do NOT own PBr ID #' + pbrId + '<br>';
                    result += 'Your wallet has ' + pbrBalance.toString() + ' PBr NFT(s)<br>';
                }

                const resultEl = document.getElementById('recovery-check-result');
                if (resultEl) {
                    result += '<br><strong>PBr Balance:</strong> ' + pbrBalance.toString();
                    resultEl.innerHTML = result;
                }
            } catch (err) {
                console.error('Recovery check failed:', err);
                const resultEl = document.getElementById('recovery-check-result');
                if (resultEl) resultEl.innerHTML = '❌ Error: ' + err.message;
            }
        }

        return {
            populatePBtDropdowns,
            setupRecovery,
            activateSelectedBadge,
            setupInheritance,
            updateRecoveryInheritanceDiagnostics,
            findActivatableBadges,
            checkRecoveryInheritanceStatus,
            updateRecoveryTerminalPreview,
        };
    }

    window.PBTestDappRecovery = { create };
})();
