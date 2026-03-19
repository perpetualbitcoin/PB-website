(function () {
    const {
        CHAIN_ID,
        RPC_URL,
        TVault,
        TPB,
        TPBc,
        TUSDL,
        ensureWalletOnChain,
    } = window.PBTestDapp;

    function create(app) {
        let networkChangeListenerAttached = false;
        let listenersBound = false;
        let suppressNextCorrectChainRefresh = false;

        function applyHeroChainState(chainId) {
            const hero = document.getElementById('network-toggle-hero');
            if (!hero) return;
            const isMainnet = Number(chainId) === 369;
            hero.checked = isMainnet;
            document.getElementById('toggle-knob-hero').style.left = isMainnet ? '25px' : '3px';
            document.getElementById('label-testnet-hero').style.color = isMainnet ? '#666' : '#F39004';
            document.getElementById('label-mainnet-hero').style.color = isMainnet ? '#F39004' : '#666';
        }

        async function switchWalletChain(targetChain) {
            const success = await ensureWalletOnChain(targetChain);
            if (success) {
                applyHeroChainState(targetChain);
            }
            return success;
        }

        async function switchToCorrectNetwork() {
            try {
                const success = await switchWalletChain(CHAIN_ID);
                if (success) {
                    console.log('✅ Switched to correct network (943)');
                    document.getElementById('network-display').innerText = `✅ ${CHAIN_ID}`;
                } else {
                    console.error('Failed to switch network');
                    document.getElementById('network-display').innerText = '❌ Switch failed';
                }
            } catch (err) {
                console.error('Network switch error:', err);
                document.getElementById('network-display').innerText = '❌ Error';
            }
        }

        function setupNetworkChangeListener() {
            if (!window.ethereum || networkChangeListenerAttached) return;
            window.ethereum.on('chainChanged', async (chainId) => {
                const newChainId = parseInt(chainId, 16);
                console.log(`🔄 Network changed to: ${newChainId}`);
                applyHeroChainState(newChainId);

                if (newChainId !== CHAIN_ID) {
                    console.log(`⚠️ Wrong network! Expected ${CHAIN_ID}, got ${newChainId}`);
                    document.getElementById('network-display').innerText = `⚠️ Wrong Chain: ${newChainId}`;

                    setTimeout(async () => {
                        console.log('Attempting to switch back to correct network...');
                        await switchToCorrectNetwork();
                    }, 1000);
                } else {
                    console.log('✅ Correct network');
                    document.getElementById('network-display').innerText = `✅ ${CHAIN_ID}`;

                    app.setWeb3(new ethers.BrowserProvider(window.ethereum));
                    const currentAccount = app.getAccount();
                    if (currentAccount) {
                        app.setSigner(await app.getWeb3().getSigner(currentAccount));
                    }

                    if (suppressNextCorrectChainRefresh) {
                        suppressNextCorrectChainRefresh = false;
                        return;
                    }

                    if (app.refreshDashboard) {
                        await app.refreshDashboard({ includePositions: true, includeDropdowns: true });
                    } else {
                        app.updateBalances();
                        app.updatePositions();
                        app.populatePBtDropdowns();
                    }
                }
            });
            networkChangeListenerAttached = true;
        }

        function setupHeroNetworkSync() {
            const hero = document.getElementById('network-toggle-hero');
            const navToggle = document.getElementById('network-toggle');
            if (!hero) return;

            function initHero() {
                if (navToggle && navToggle.tagName === 'SELECT') {
                    const value = navToggle.value || '';
                    hero.checked = value.toString().includes('171');
                } else if (navToggle && navToggle.type === 'checkbox') {
                    hero.checked = navToggle.checked;
                }
                applyHeroChainState(hero.checked ? 369 : CHAIN_ID);
            }

            initHero();
            hero.addEventListener('change', async () => {
                if (navToggle && navToggle.tagName === 'SELECT') {
                    const mainOpt = Array.from(navToggle.options).find((option) => option.text && option.text.includes('Mainnet'));
                    const testOpt = Array.from(navToggle.options).find((option) => option.text && option.text.includes('Testnet'));
                    if (hero.checked && mainOpt) navToggle.value = mainOpt.value;
                    if (!hero.checked && testOpt) navToggle.value = testOpt.value;
                    navToggle.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (navToggle && navToggle.type === 'checkbox') {
                    navToggle.checked = hero.checked;
                    navToggle.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (window.ethereum) {
                    const targetChain = hero.checked ? 369 : CHAIN_ID;
                    const success = await switchWalletChain(targetChain);
                    if (!success) {
                        initHero();
                    }
                }
            });

            if (navToggle) {
                navToggle.addEventListener('change', initHero);
            }
        }

        function setupNetworkToggle() {
            const networkToggle = document.getElementById('network-toggle');
            if (!networkToggle) {
                if (typeof window.ethereum !== 'undefined') {
                    window.ethereum.request({ method: 'eth_chainId' }).then((chainId) => {
                        const parsedChainId = parseInt(chainId, 16);
                        applyHeroChainState(parsedChainId);
                    }).catch(() => {
                        applyHeroChainState(CHAIN_ID);
                    });
                } else {
                    applyHeroChainState(CHAIN_ID);
                }
                setupHeroNetworkSync();
                return;
            }

            if (typeof window.ethereum !== 'undefined') {
                window.ethereum.request({ method: 'eth_chainId' }).then((chainId) => {
                    const parsedChainId = parseInt(chainId, 16);
                    networkToggle.value = parsedChainId.toString();
                    applyHeroChainState(parsedChainId);
                }).catch(() => {
                    networkToggle.value = CHAIN_ID.toString();
                    applyHeroChainState(CHAIN_ID);
                });
            }

            networkToggle.addEventListener('change', async (e) => {
                const targetChain = parseInt(e.target.value, 10);
                console.log(`🔄 User requested switch to chain ${targetChain}`);

                if (!app.getAccount()) {
                    alert('Please connect wallet first');
                    e.target.value = CHAIN_ID.toString();
                    return;
                }

                try {
                    const chainIdHex = '0x' + targetChain.toString(16);
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: chainIdHex }]
                        });
                        console.log(`✅ Switched to chain ${targetChain}`);
                    } catch (switchError) {
                        if (switchError.code === 4902) {
                            const chainConfigs = {
                                943: {
                                    chainId: '0x3AF',
                                    chainName: 'PulseChain Testnet V4',
                                    rpcUrls: [RPC_URL],
                                    nativeCurrency: { name: 'tPLS', symbol: 'tPLS', decimals: 18 },
                                    blockExplorerUrls: ['https://scan.v4.testnet.pulsechain.com']
                                },
                                369: {
                                    chainId: '0x171',
                                    chainName: 'PulseChain Mainnet',
                                    rpcUrls: ['https://rpc.pulsechain.com'],
                                    nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
                                    blockExplorerUrls: ['https://scan.pulsechain.com']
                                }
                            };

                            const config = chainConfigs[targetChain];
                            if (config) {
                                try {
                                    await window.ethereum.request({
                                        method: 'wallet_addEthereumChain',
                                        params: [config]
                                    });
                                    console.log(`✅ Added and switched to chain ${targetChain}`);
                                } catch (addError) {
                                    console.error('Failed to add chain:', addError);
                                    alert(`Failed to add chain ${targetChain}`);
                                    e.target.value = CHAIN_ID.toString();
                                }
                            }
                        } else {
                            console.error('Failed to switch chain:', switchError);
                            alert(`Failed to switch to chain ${targetChain}`);
                            e.target.value = CHAIN_ID.toString();
                        }
                    }
                } catch (err) {
                    console.error('Network toggle error:', err);
                    alert('Network switch failed');
                    e.target.value = CHAIN_ID.toString();
                }
            });

            setupHeroNetworkSync();
        }

        async function addTokenToWallet(tokenAddress, tokenSymbol, decimals) {
            if (!app.getAccount()) {
                alert('Connect wallet first');
                return;
            }
            try {
                await window.ethereum.request({
                    method: 'wallet_watchAsset',
                    params: {
                        type: 'ERC20',
                        options: {
                            address: tokenAddress,
                            symbol: tokenSymbol,
                            decimals,
                            image: ''
                        }
                    }
                });
            } catch (err) {
                console.error('Error adding token:', err);
            }
        }

        function addPBToWallet() {
            return addTokenToWallet(TPB, 'PB', 18);
        }

        function addPBcToWallet() {
            return addTokenToWallet(TPBc, 'PBc', 18);
        }

        function addTUSDLToWallet() {
            return addTokenToWallet(TUSDL, 'USDL', 18);
        }

        function copyWalletAddress() {
            const account = app.getAccount();
            if (account) {
                navigator.clipboard.writeText(account).then(() => {
                    alert('Wallet address copied to clipboard!');
                }).catch(() => {
                    alert('Failed to copy address');
                });
            } else {
                alert('Connect wallet first');
            }
        }

        function copyDiagVaultAddress() {
            navigator.clipboard.writeText(TVault).then(() => {
                const el = document.getElementById('diag-vault');
                const original = el.innerText;
                el.innerText = '✓ Copied!';
                setTimeout(() => {
                    el.innerText = original;
                }, 1500);
            }).catch(() => {
                alert('Failed to copy address');
            });
        }

        function bindEventListeners() {
            if (listenersBound) return;

            function getPBInputBalance() {
                const balanceText = document.getElementById('balance-pb')?.innerText || '0';
                return parseFloat(balanceText.replace(/[^\d\.]/g, '')) || 0;
            }

            function getUSDLInputBalance() {
                return app.getLatestTusdlBalance() > 0 ? app.getLatestTusdlBalance() : 0;
            }

            document.getElementById('connect-btn').addEventListener('click', connectWallet);
            document.getElementById('nav-connect-btn').addEventListener('click', connectWallet);
            document.getElementById('btn-quote').addEventListener('click', app.getQuote);
            document.getElementById('buy-amount').addEventListener('input', app.handleBuyAmountInputChange);
            document.getElementById('buy-amount').addEventListener('change', app.handleBuyAmountInputChange);
            document.getElementById('buy-amount').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    app.getQuote();
                }
            });
            document.getElementById('btn-buy').addEventListener('click', app.executeBuy);
            document.getElementById('gift-buy-checkbox').addEventListener('change', function () {
                document.getElementById('gift-buy-field').style.display = this.checked ? 'block' : 'none';
            });
            document.getElementById('sell-amount').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    app.getSellQuote();
                }
            });
            document.getElementById('btn-sell-quote').addEventListener('click', app.getSellQuote);
            document.getElementById('btn-sell').addEventListener('click', app.executeSell);
            document.getElementById('btn-vlock').addEventListener('click', app.executeVLock);
            document.getElementById('vlock-amount').addEventListener('input', app.updateVLockPreview);

            document.getElementById('buy-33').addEventListener('click', () => {
                document.getElementById('buy-amount').value = (getUSDLInputBalance() * 0.33).toFixed(2);
                app.getQuote();
            });
            document.getElementById('buy-66').addEventListener('click', () => {
                document.getElementById('buy-amount').value = (getUSDLInputBalance() * 0.66).toFixed(2);
                app.getQuote();
            });
            document.getElementById('buy-100').addEventListener('click', () => {
                document.getElementById('buy-amount').value = getUSDLInputBalance().toFixed(2);
                app.getQuote();
            });
            document.getElementById('sell-33').addEventListener('click', () => {
                document.getElementById('sell-amount').value = (getPBInputBalance() * 0.33).toFixed(2);
                app.getSellQuote();
            });
            document.getElementById('sell-66').addEventListener('click', () => {
                document.getElementById('sell-amount').value = (getPBInputBalance() * 0.66).toFixed(2);
                app.getSellQuote();
            });
            document.getElementById('sell-100').addEventListener('click', () => {
                document.getElementById('sell-amount').value = getPBInputBalance().toFixed(2);
                app.getSellQuote();
            });
            document.getElementById('vlock-25').addEventListener('click', () => {
                document.getElementById('vlock-amount').value = (getPBInputBalance() * 0.25).toFixed(0);
                app.updateVLockPreview();
            });
            document.getElementById('vlock-50').addEventListener('click', () => {
                document.getElementById('vlock-amount').value = (getPBInputBalance() * 0.5).toFixed(0);
                app.updateVLockPreview();
            });
            document.getElementById('vlock-75').addEventListener('click', () => {
                document.getElementById('vlock-amount').value = (getPBInputBalance() * 0.75).toFixed(0);
                app.updateVLockPreview();
            });
            document.getElementById('vlock-100').addEventListener('click', () => {
                document.getElementById('vlock-amount').value = getPBInputBalance().toFixed(0);
                app.updateVLockPreview();
            });
            document.getElementById('btn-harvest-refresh').addEventListener('click', app.harvestAndRefreshLPRewards);
            document.getElementById('btn-setup-recovery').addEventListener('click', app.setupRecovery);
            document.getElementById('btn-activate-recovery').addEventListener('click', app.activateRecovery);
            document.getElementById('btn-setup-inheritance').addEventListener('click', app.setupInheritance);
            document.getElementById('btn-activate-inheritance').addEventListener('click', app.activateInheritance);
            document.getElementById('btn-find-pbr').addEventListener('click', app.findPBr);
            document.getElementById('btn-find-pbi').addEventListener('click', app.findPBi);
            document.getElementById('refresh-positions-btn')?.addEventListener('click', app.updatePositions);
            document.getElementById('refresh-positions-btn')?.addEventListener('mouseenter', (event) => {
                event.currentTarget.style.transform = 'rotate(20deg)';
            });
            document.getElementById('refresh-positions-btn')?.addEventListener('mouseleave', (event) => {
                event.currentTarget.style.transform = 'rotate(0deg)';
            });
            document.getElementById('sort-by-select')?.addEventListener('change', (event) => {
                app.sortPositions(event.target.value);
            });
            document.querySelectorAll('.tabs .tab[data-tab]').forEach((tabButton) => {
                tabButton.addEventListener('click', () => {
                    app.switchTab(tabButton.dataset.tab);
                });
            });
            document.getElementById('diag-vault')?.addEventListener('click', copyDiagVaultAddress);

            document.getElementById('recovery-activate-password')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !document.getElementById('btn-activate-recovery').disabled) {
                    document.getElementById('btn-activate-recovery').click();
                }
            });
            document.getElementById('inheritance-activate-password')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !document.getElementById('btn-activate-inheritance').disabled) {
                    document.getElementById('btn-activate-inheritance').click();
                }
            });

            const faucetBtn = document.getElementById('btn-faucet-tusdl');
            if (faucetBtn) faucetBtn.addEventListener('click', app.faucetMintTUSDL);

            document.getElementById('fox-link-1')?.addEventListener('click', addPBToWallet);
            document.getElementById('fox-link-2')?.addEventListener('click', addPBcToWallet);
            document.getElementById('fox-link-3')?.addEventListener('click', addTUSDLToWallet);

            listenersBound = true;
        }

        async function connectWallet() {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                app.setAccount(account);
                const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' });
                const currentChainId = parseInt(currentChainHex, 16);

                if (currentChainId !== CHAIN_ID) {
                    console.log(`Wrong network detected: ${currentChainId}, switching to ${CHAIN_ID}...`);
                    document.getElementById('network-display').innerText = '⏳ Switching...';
                    suppressNextCorrectChainRefresh = true;
                    await switchToCorrectNetwork();
                    const postSwitchChainHex = await window.ethereum.request({ method: 'eth_chainId' });
                    const postSwitchChainId = parseInt(postSwitchChainHex, 16);
                    applyHeroChainState(postSwitchChainId);

                    if (postSwitchChainId !== CHAIN_ID) {
                        suppressNextCorrectChainRefresh = false;
                        document.getElementById('network-display').innerText = `⚠️ Wrong Chain: ${postSwitchChainId}`;
                        document.getElementById('wallet-addr').innerText = 'Wrong network';
                        document.getElementById('connect-btn').innerText = 'Connect Wallet';
                        document.getElementById('nav-connect-btn').innerText = 'Connect';
                        app.setAccount(null);
                        app.setSigner(null);
                        alert('Wallet is still on the wrong chain. Please switch to PulseChain Testnet 943 to connect this dapp.');
                        return;
                    }

                    app.setWeb3(new ethers.BrowserProvider(window.ethereum));
                } else {
                    document.getElementById('network-display').innerText = `✅ ${CHAIN_ID}`;
                }

                app.setSigner(await app.getWeb3().getSigner(account));

                document.getElementById('wallet-addr').innerText = account.substring(0, 6) + '...' + account.substring(38);
                document.getElementById('connect-btn').innerText = '✅ Connected';
                document.getElementById('nav-connect-btn').innerText = '✅ ' + account.substring(0, 6) + '...';

                setupNetworkChangeListener();
                if (app.refreshDashboard) {
                    await app.refreshDashboard({ includePositions: true, includeDropdowns: true });
                } else {
                    app.updateBalances();
                    app.updatePositions();
                    app.populatePBtDropdowns();
                }
            } catch (err) {
                console.error('Wallet connection failed:', err);
                document.getElementById('wallet-addr').innerText = 'Connection failed';
                document.getElementById('connect-btn').innerText = 'Connect Wallet';
                document.getElementById('nav-connect-btn').innerText = 'Connect';
            }
        }

        async function init() {
            await app.loadPriceHistory();

            const vaultAddrShort = TVault.substring(0, 6) + '...' + TVault.substring(TVault.length - 4);
            document.getElementById('nav-vault-addr').innerText = vaultAddrShort;

            if (typeof window.ethereum !== 'undefined') {
                if (typeof ethers === 'undefined') {
                    console.error('ethers library not loaded');
                    document.getElementById('wallet-addr').innerText = 'ethers library not loaded';
                    document.getElementById('nav-connect-btn').innerText = 'Error: Ethers';
                    return;
                }

                app.setWeb3(new ethers.BrowserProvider(window.ethereum));
                console.log('Fallback RPC initialized:', RPC_URL);

                bindEventListeners();
                app.updateLPFeeStatus();
                app.updateVLockPreview();
                setInterval(app.updateLPFeeStatus, 30000);
                app.updatePrice();
                setInterval(app.updatePrice, 15000);
                setInterval(() => {
                    if (app.getAccount()) app.updateBalances();
                }, 30000);

                try {
                    app.initChart();
                } catch (e) {
                    console.warn('Chart init failed:', e);
                }
                setupNetworkToggle();
            } else {
                document.getElementById('wallet-addr').innerText = 'MetaMask not detected';
                document.getElementById('nav-connect-btn').innerText = 'Install MM';
            }
        }

        window.copyDiagVaultAddress = copyDiagVaultAddress;

        return {
            init,
            connectWallet,
            switchToCorrectNetwork,
            setupNetworkChangeListener,
            setupNetworkToggle,
            addPBToWallet,
            addPBcToWallet,
            addTUSDLToWallet,
            copyWalletAddress,
            copyDiagVaultAddress,
        };
    }

    window.PBTestDappWallet = { create };
})();