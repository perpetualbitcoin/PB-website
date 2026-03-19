(function () {
    const {
        TPBr,
        TPBi,
        NFT_ABI,
        TVault,
        showStatus,
    } = window.PBTestDapp;

    function create(app) {
        let foundPBrId = null;
        let foundPBiId = null;

        async function populatePBtDropdowns() {
            const account = app.getAccount();
            if (!account) return;
            try {
                const vaultContract = app.contractLayer.getReadContract('vault');
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

                if (!pbtId || !recoveryAddr || !password) {
                    alert('Fill in all fields');
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
                showStatus('recovery-status', '⏳ Setting recovery...', 'info');

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const recoveryMemo = document.getElementById('recovery-memo').value || '';
                const tx = await vaultContract.setRecoveryAddress(pbtId, recoveryAddr, passwordHash, recoveryMemo);
                const receipt = await tx.wait();
                showStatus('recovery-status', '✅ Recovery address set! Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
            } catch (err) {
                console.error('Recovery setup failed:', err);
                showStatus('recovery-status', '❌ Setup failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function activateRecovery() {
            if (!foundPBrId) {
                alert('Click "Find My PBr Badge" first');
                return;
            }

            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }

            try {
                const password = document.getElementById('recovery-activate-password').value;
                if (!password) {
                    alert('Enter your recovery password');
                    return;
                }

                showStatus('recovery-activate-status', '⏳ Activating recovery for PBr ID #' + foundPBrId + '...', 'info');
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tx = await vaultContract.activateRecovery(foundPBrId, password);
                const receipt = await tx.wait();

                showStatus('recovery-activate-status', '✅ Recovery activated! PBr ID #' + foundPBrId + ' | Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
                foundPBrId = null;
                document.getElementById('recovery-badge-info').style.display = 'none';
                document.getElementById('recovery-activate-password').disabled = true;
                document.getElementById('btn-activate-recovery').disabled = true;
                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true, includePrice: false });
                }, 3000);
            } catch (err) {
                console.error('Recovery activation failed:', err);
                showStatus('recovery-activate-status', '❌ Activation failed: ' + (err.reason || err.message), 'error');
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

                if (!pbtId || !beneficiary || !password) {
                    alert('Fill in all fields');
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
                showStatus('inheritance-status', '⏳ Setting inheritance...', 'info');

                const vaultContract = app.contractLayer.getWriteContract('vault');
                const inheritanceMemo = document.getElementById('inheritance-memo').value || '';
                const tx = await vaultContract.setInheritanceAddress(pbtId, beneficiary, passwordHash, inheritanceMemo);
                const receipt = await tx.wait();
                showStatus('inheritance-status', '✅ Beneficiary set! Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
            } catch (err) {
                console.error('Inheritance setup failed:', err);
                showStatus('inheritance-status', '❌ Setup failed: ' + (err.reason || err.message), 'error');
            }
        }

        async function activateInheritance() {
            if (!foundPBiId) {
                alert('Click "Find My PBi Badge" first');
                return;
            }

            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }

            try {
                const password = document.getElementById('inheritance-activate-password').value;
                if (!password) {
                    alert('Enter your inheritance password');
                    return;
                }

                showStatus('inheritance-activate-status', '⏳ Activating inheritance for PBi ID #' + foundPBiId + '...', 'info');
                const vaultContract = app.contractLayer.getWriteContract('vault');
                const tx = await vaultContract.activateInheritance(foundPBiId, password);
                const receipt = await tx.wait();

                showStatus('inheritance-activate-status', '✅ Inheritance activated! PBi ID #' + foundPBiId + ' | Tx: ' + receipt.hash.substring(0, 10) + '...', 'success');
                foundPBiId = null;
                document.getElementById('inheritance-badge-info').style.display = 'none';
                document.getElementById('inheritance-activate-password').disabled = true;
                document.getElementById('btn-activate-inheritance').disabled = true;
                setTimeout(() => {
                    app.refreshDashboard({ includePositions: true, includeDropdowns: true, includePrice: false });
                }, 3000);
            } catch (err) {
                console.error('Inheritance activation failed:', err);
                showStatus('inheritance-activate-status', '❌ Activation failed: ' + (err.reason || err.message), 'error');
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

        async function findPBr() {
            const account = app.getAccount();
            if (!account || !app.getWeb3()) {
                alert('Connect wallet first');
                return;
            }
            try {
                showStatus('recovery-activate-status', 'Fetching your PBr badges...', 'info');
                const pbrContract = new ethers.Contract(TPBr, ['function getBadgeIds(address holder) view returns (uint256[])'], app.getWeb3());
                const badgeIds = await pbrContract.getBadgeIds(account);

                if (badgeIds.length > 0) {
                    const foundIds = badgeIds.map((id) => id.toNumber ? id.toNumber() : Number(id));
                    document.getElementById('recovery-badge-info').style.display = 'block';

                    if (foundIds.length === 1) {
                        foundPBrId = foundIds[0];
                        document.getElementById('recovery-badge-text').innerText = 'Found: PBr ID #' + foundIds[0];
                        document.getElementById('recovery-badge-select').style.display = 'none';
                        document.getElementById('recovery-activate-password').disabled = false;
                        document.getElementById('btn-activate-recovery').disabled = false;
                        showStatus('recovery-activate-status', 'Found PBr ID #' + foundIds[0] + ' ✓ Ready to activate', 'success');
                    } else {
                        document.getElementById('recovery-badge-text').innerText = 'Found ' + foundIds.length + ' PBr badges - select one:';
                        const select = document.getElementById('recovery-badge-select');
                        select.innerHTML = '';
                        foundIds.forEach((id) => {
                            const option = document.createElement('option');
                            option.value = id;
                            option.innerText = 'PBr ID #' + id;
                            select.appendChild(option);
                        });
                        select.style.display = 'block';
                        foundPBrId = foundIds[0];
                        select.onchange = function () { foundPBrId = parseInt(this.value, 10); };
                        document.getElementById('recovery-activate-password').disabled = false;
                        document.getElementById('btn-activate-recovery').disabled = false;
                        showStatus('recovery-activate-status', 'Select a PBr badge and enter password to activate', 'success');
                    }
                } else {
                    showStatus('recovery-activate-status', 'No PBr badge found in your wallet', 'error');
                }
            } catch (err) {
                showStatus('recovery-activate-status', 'Error fetching: ' + err.message, 'error');
            }
        }

        async function findPBi() {
            const account = app.getAccount();
            if (!account || !app.getWeb3()) {
                alert('Connect wallet first');
                return;
            }
            try {
                showStatus('inheritance-activate-status', 'Fetching your PBi badges...', 'info');
                const pbiContract = new ethers.Contract(TPBi, ['function getBadgeIds(address holder) view returns (uint256[])'], app.getWeb3());
                const badgeIds = await pbiContract.getBadgeIds(account);

                if (badgeIds.length > 0) {
                    const foundIds = badgeIds.map((id) => id.toNumber ? id.toNumber() : Number(id));
                    document.getElementById('inheritance-badge-info').style.display = 'block';

                    if (foundIds.length === 1) {
                        foundPBiId = foundIds[0];
                        document.getElementById('inheritance-badge-text').innerText = 'Found: PBi ID #' + foundIds[0];
                        document.getElementById('inheritance-badge-select').style.display = 'none';
                        document.getElementById('inheritance-activate-password').disabled = false;
                        document.getElementById('btn-activate-inheritance').disabled = false;
                        showStatus('inheritance-activate-status', 'Found PBi ID #' + foundIds[0] + ' ✓ Ready to activate', 'success');
                    } else {
                        document.getElementById('inheritance-badge-text').innerText = 'Found ' + foundIds.length + ' PBi badges - select one:';
                        const select = document.getElementById('inheritance-badge-select');
                        select.innerHTML = '';
                        foundIds.forEach((id) => {
                            const option = document.createElement('option');
                            option.value = id;
                            option.innerText = 'PBi ID #' + id;
                            select.appendChild(option);
                        });
                        select.style.display = 'block';
                        foundPBiId = foundIds[0];
                        select.onchange = function () { foundPBiId = parseInt(this.value, 10); };
                        document.getElementById('inheritance-activate-password').disabled = false;
                        document.getElementById('btn-activate-inheritance').disabled = false;
                        showStatus('inheritance-activate-status', 'Select a PBi badge and enter password to activate', 'success');
                    }
                } else {
                    showStatus('inheritance-activate-status', 'No PBi badge found in your wallet', 'error');
                }
            } catch (err) {
                showStatus('inheritance-activate-status', 'Error fetching: ' + err.message, 'error');
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

                result += '<br><strong>PBr Balance:</strong> ' + pbrBalance.toString();
                document.getElementById('recovery-check-result').innerHTML = result;
            } catch (err) {
                console.error('Recovery check failed:', err);
                document.getElementById('recovery-check-result').innerHTML = '❌ Error: ' + err.message;
            }
        }

        return {
            populatePBtDropdowns,
            setupRecovery,
            activateRecovery,
            setupInheritance,
            activateInheritance,
            updateRecoveryInheritanceDiagnostics,
            findPBr,
            findPBi,
            checkRecoveryInheritanceStatus,
        };
    }

    window.PBTestDappRecovery = { create };
})();