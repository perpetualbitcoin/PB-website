(function () {
    const {
        ACTIVE_NETWORK_KEY,
        CHAIN_ID,
        CHAIN_NAME,
        RPC_URL,
        TVault,
        TPB,
        TPBc,
        TUSDL,
        PULSEX_PAIR,
        hexChainId,
        ensureWalletOnChain,
    } = window.PBTestDapp;

    function create(app) {
        let networkChangeListenerAttached = false;
        let listenersBound = false;
        let suppressNextCorrectChainRefresh = false;
        let activeWalletProvider = null;
        let networkChangeListenerProvider = null;
        let networkChangeHandler = null;

        function getChainRequestProvider() {
            return getActiveWalletProvider() || window.ethereum || null;
        }

        function getPreferredNetworkKey(targetChain) {
            return Number(targetChain) === 369 ? 'mainnet' : 'testnet';
        }

        function setPreferredNetwork(targetChain) {
            try {
                window.localStorage.setItem('pbPreferredNetwork', getPreferredNetworkKey(targetChain));
            } catch (err) {
                console.warn('Unable to persist preferred network:', err);
            }
        }

        function syncNetworkChrome() {
            const isMainnetMode = ACTIVE_NETWORK_KEY === 'mainnet';
            const badge = document.getElementById('hero-network-badge');
            const caption = document.getElementById('hero-network-caption');
            const message = document.getElementById('hero-network-message');
            const faucetWrap = document.getElementById('testnet-faucet-wrap');
            const utilityTitle = document.getElementById('network-utilities-title');
            const utilityNote = document.getElementById('network-utilities-note');

            if (badge) badge.innerText = isMainnetMode ? 'Mainnet 369 Active' : 'Testnet 943 Active';
            if (caption) caption.innerText = isMainnetMode
                ? 'Live contract routing and PulseChain mainnet explorer links'
                : 'Public rehearsal mode with faucets and testnet contracts';
            if (message) message.innerText = isMainnetMode
                ? 'Mainnet mode is selected. Connect on PulseChain 369 to use the production deployment once addresses are published.'
                : 'Testnet mode is selected. Use PulseChain testnet 943 for final walkthroughs, faucet funding, and dry runs.';
            if (utilityTitle) utilityTitle.innerText = isMainnetMode ? '🌐 Network Utilities' : '🌐 Network Utilities + Testnet Tools';
            if (utilityNote) utilityNote.innerHTML = isMainnetMode
                ? '<em>Add PulseChain networks to your wallet. Switch back to testnet mode any time you need faucet funding or a rehearsal environment.</em>'
                : '<em>tPLS comes from the external faucet and the USDL mint is only available in testnet mode.</em>';
            if (faucetWrap) faucetWrap.style.display = isMainnetMode ? 'none' : 'grid';
        }

        function applyHeroChainState(chainId) {
            const hero = document.getElementById('network-toggle-hero');
            if (!hero) return;
            const isMainnet = Number(chainId) === 369;
            hero.checked = isMainnet;
            const knob = document.getElementById('toggle-knob-hero');
            const testnetLabel = document.getElementById('label-testnet-hero');
            const mainnetLabel = document.getElementById('label-mainnet-hero');
            if (knob) knob.style.left = isMainnet ? '24px' : '2px';
            if (testnetLabel) {
                testnetLabel.style.color = isMainnet ? '#9a927f' : '#F39004';
                testnetLabel.style.opacity = isMainnet ? '0.82' : '1';
            }
            if (mainnetLabel) {
                mainnetLabel.style.color = isMainnet ? '#F39004' : '#9a927f';
                mainnetLabel.style.opacity = isMainnet ? '1' : '0.82';
            }
            syncNetworkChrome();
        }

        async function switchWalletChain(targetChain) {
            const provider = getChainRequestProvider();
            const success = provider && typeof provider.request === 'function'
                ? await ensureProviderOnChain(provider, targetChain)
                : await ensureWalletOnChain(targetChain);
            if (success) {
                applyHeroChainState(targetChain);
            }
            return success;
        }

        async function switchToCorrectNetwork() {
            try {
                const success = await switchWalletChain(CHAIN_ID);
                if (success) {
                    console.log(`✅ Switched to correct network (${CHAIN_ID})`);
                    document.getElementById('network-display').innerText = `✅ ${CHAIN_NAME}`;
                } else {
                    console.error('Failed to switch network');
                    document.getElementById('network-display').innerText = '❌ Switch failed';
                }
            } catch (err) {
                console.error('Network switch error:', err);
                document.getElementById('network-display').innerText = '❌ Error';
            }
        }

        function setupNetworkChangeListener(provider = getChainRequestProvider()) {
            if (!provider || typeof provider.on !== 'function') return;
            if (networkChangeListenerAttached && networkChangeListenerProvider === provider) return;

            if (networkChangeListenerProvider && networkChangeHandler && typeof networkChangeListenerProvider.removeListener === 'function') {
                networkChangeListenerProvider.removeListener('chainChanged', networkChangeHandler);
            }

            networkChangeHandler = async (chainId) => {
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
                    document.getElementById('network-display').innerText = `✅ ${CHAIN_NAME}`;

                    app.setWeb3(new ethers.BrowserProvider(provider));
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
            };

            provider.on('chainChanged', networkChangeHandler);
            networkChangeListenerProvider = provider;
            networkChangeListenerAttached = true;
        }

        function setupHeroNetworkSync() {
            const hero = document.getElementById('network-toggle-hero');
            const navToggle = document.getElementById('network-toggle');
            if (!hero) return;

            function initHero() {
                if (navToggle && navToggle.tagName === 'SELECT') {
                    hero.checked = Number(navToggle.value) === 369;
                } else if (navToggle && navToggle.type === 'checkbox') {
                    hero.checked = navToggle.checked;
                } else {
                    hero.checked = CHAIN_ID === 369;
                }
                applyHeroChainState(hero.checked ? 369 : 943);
            }

            initHero();
            hero.addEventListener('change', async () => {
                if (navToggle && navToggle.tagName === 'SELECT') {
                    navToggle.value = hero.checked ? '369' : '943';
                    navToggle.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (navToggle && navToggle.type === 'checkbox') {
                    navToggle.checked = hero.checked;
                    navToggle.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (getChainRequestProvider()) {
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
            const chainProvider = getChainRequestProvider();
            if (!networkToggle) {
                if (chainProvider && typeof chainProvider.request === 'function') {
                    chainProvider.request({ method: 'eth_chainId' }).then((chainId) => {
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

            if (chainProvider && typeof chainProvider.request === 'function') {
                chainProvider.request({ method: 'eth_chainId' }).then((chainId) => {
                    const parsedChainId = parseInt(chainId, 16);
                    networkToggle.value = parsedChainId.toString();
                    applyHeroChainState(parsedChainId);
                }).catch(() => {
                    networkToggle.value = CHAIN_ID.toString();
                    applyHeroChainState(CHAIN_ID);
                });
            } else {
                networkToggle.value = CHAIN_ID.toString();
                applyHeroChainState(CHAIN_ID);
            }

            networkToggle.addEventListener('change', async (e) => {
                const targetChain = parseInt(e.target.value, 10);
                console.log(`🔄 User requested switch to chain ${targetChain}`);
                setPreferredNetwork(targetChain);
                applyHeroChainState(targetChain);

                if (!app.getAccount()) {
                    window.location.reload();
                    return;
                }

                try {
                    const success = await switchWalletChain(targetChain);
                    if (!success) {
                        console.error(`Failed to switch to chain ${targetChain}`);
                        e.target.value = CHAIN_ID.toString();
                        applyHeroChainState(CHAIN_ID);
                        return;
                    }
                    window.location.reload();
                } catch (err) {
                    console.error('Network toggle error:', err);
                    alert('Network switch failed');
                    e.target.value = CHAIN_ID.toString();
                    applyHeroChainState(CHAIN_ID);
                }
            });

            setupHeroNetworkSync();
        }

        const TOKEN_IMAGE_URLS = {
            PB: 'https://perpetualbitcoin.io/Pic/PB.png',
            PBc: 'https://perpetualbitcoin.io/Pic/PBc.png',
            USDL: 'https://perpetualbitcoin.io/Pic/PB_logo.jpg',
            'PBUSDL-LP': 'https://perpetualbitcoin.io/Pic/PB_logo.jpg',
        };

        async function addTokenToWallet(tokenAddress, tokenSymbol, decimals, imageUrl) {
            if (!app.getAccount()) {
                alert('Connect wallet first');
                return;
            }
            try {
                const provider = getActiveWalletProvider();
                if (!provider || typeof provider.request !== 'function') {
                    alert('No compatible wallet provider found for automatic token import. You can still add the token manually.');
                    return;
                }

                if (isOKXProvider(provider) && CHAIN_ID === 369) {
                    showManualImportFallback(
                        tokenAddress,
                        tokenSymbol,
                        'OKX Wallet does not reliably persist wallet_watchAsset imports on PulseChain mainnet.'
                    );
                    return;
                }

                const onCorrectChain = await ensureProviderOnChain(provider, CHAIN_ID);
                if (!onCorrectChain) {
                    showManualImportFallback(tokenAddress, tokenSymbol, 'Wallet is on the wrong chain for automatic import.');
                    return;
                }

                const opts = {
                    address: tokenAddress,
                    symbol: tokenSymbol,
                    decimals,
                };
                if (imageUrl) {
                    opts.image = imageUrl;
                }
                const added = await provider.request({
                    method: 'wallet_watchAsset',
                    params: {
                        type: 'ERC20',
                        options: opts,
                    }
                });

                if (added !== true) {
                    showManualImportFallback(tokenAddress, tokenSymbol, 'Wallet did not complete the automatic import.');
                }
            } catch (err) {
                console.error('Error adding token:', err);
                showManualImportFallback(tokenAddress, tokenSymbol, 'Automatic import failed.');
            }
        }

        function getInjectedProviders() {
            if (!window.ethereum) return [];

            const providers = Array.isArray(window.ethereum.providers) && window.ethereum.providers.length
                ? window.ethereum.providers
                : [window.ethereum];

            const extraProviders = [];
            if (window.okxwallet && window.okxwallet.ethereum) extraProviders.push(window.okxwallet.ethereum);
            if (window.ethereum && !providers.includes(window.ethereum)) extraProviders.push(window.ethereum);

            return [...new Set([...providers, ...extraProviders])].filter(Boolean);
        }

        function getPreferredAssetProvider() {
            const providers = getInjectedProviders();
            if (!providers.length) return null;

            const metaMaskProvider = providers.find((provider) => provider && provider.isMetaMask);
            if (metaMaskProvider) return metaMaskProvider;

            const okxProvider = providers.find((provider) => provider && (provider.isOKXWallet || provider.isOkxWallet));
            if (okxProvider) return okxProvider;

            return providers[0];
        }

        async function getProviderChainId(provider) {
            if (!provider || typeof provider.request !== 'function') return null;
            try {
                const chainHex = await provider.request({ method: 'eth_chainId' });
                return parseInt(chainHex, 16);
            } catch (err) {
                console.warn('Unable to inspect injected wallet provider chain:', err);
                return null;
            }
        }

        async function selectConnectProvider(targetChain) {
            const providers = getInjectedProviders();
            if (!providers.length) return null;

            const inspected = await Promise.all(providers.map(async (provider) => ({
                provider,
                chainId: await getProviderChainId(provider),
                isOKX: Boolean(provider && (provider.isOKXWallet || provider.isOkxWallet)),
                isMetaMask: Boolean(provider && provider.isMetaMask),
            })));

            const matchingProviders = inspected.filter((entry) => entry.chainId === Number(targetChain));
            if (matchingProviders.length) {
                const preferredMatch = matchingProviders.find((entry) => entry.isOKX)
                    || matchingProviders.find((entry) => !entry.isMetaMask)
                    || matchingProviders[0];
                return preferredMatch.provider;
            }

            const preferredProvider = getPreferredAssetProvider();
            return preferredProvider || inspected[0].provider;
        }

        function getActiveWalletProvider() {
            return activeWalletProvider || getPreferredAssetProvider();
        }

        async function detectProviderForAccount(account, preferredProvider) {
            const normalizedAccount = String(account || '').toLowerCase();
            const providers = getInjectedProviders();

            if (preferredProvider && typeof preferredProvider.request === 'function') {
                providers.unshift(preferredProvider);
            }

            const uniqueProviders = [...new Set(providers)].filter(Boolean);
            for (const provider of uniqueProviders) {
                if (typeof provider.request !== 'function') continue;
                try {
                    const accounts = await provider.request({ method: 'eth_accounts' });
                    if (Array.isArray(accounts) && accounts.some((value) => String(value).toLowerCase() === normalizedAccount)) {
                        return provider;
                    }
                } catch (err) {
                    console.warn('Unable to inspect injected wallet provider accounts:', err);
                }
            }

            return preferredProvider || uniqueProviders[0] || null;
        }

        function isOKXProvider(provider) {
            return Boolean(provider && (provider.isOKXWallet || provider.isOkxWallet));
        }

        async function ensureProviderOnChain(provider, targetChain) {
            try {
                const currentChainHex = await provider.request({ method: 'eth_chainId' });
                const currentChainId = parseInt(currentChainHex, 16);
                if (currentChainId === targetChain) return true;

                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: hexChainId(targetChain) }]
                });

                const postSwitchChainHex = await provider.request({ method: 'eth_chainId' });
                return parseInt(postSwitchChainHex, 16) === targetChain;
            } catch (err) {
                if (err && (err.code === 4902 || String(err.message || '').includes('Unrecognized'))) {
                    try {
                        const params = targetChain === 943 ? [{
                            chainId: hexChainId(943),
                            chainName: 'PulseChain Testnet v4',
                            nativeCurrency: { name: 'tPLS', symbol: 'tPLS', decimals: 18 },
                            rpcUrls: ['https://rpc.v4.testnet.pulsechain.com'],
                            blockExplorerUrls: ['https://scan.v4.testnet.pulsechain.com']
                        }] : [{
                            chainId: hexChainId(369),
                            chainName: 'PulseChain',
                            nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
                            rpcUrls: ['https://rpc.pulsechain.com'],
                            blockExplorerUrls: ['https://scan.pulsechain.com']
                        }];

                        await provider.request({
                            method: 'wallet_addEthereumChain',
                            params
                        });
                        await provider.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: hexChainId(targetChain) }]
                        });

                        const postAddChainHex = await provider.request({ method: 'eth_chainId' });
                        return parseInt(postAddChainHex, 16) === targetChain;
                    } catch (addErr) {
                        console.error('Unable to add/switch wallet chain for asset import:', addErr);
                        return false;
                    }
                }

                console.error('Unable to switch wallet chain for asset import:', err);
                return false;
            }
        }

        function showManualImportFallback(tokenAddress, tokenSymbol, prefixMessage) {
            const message = [
                prefixMessage,
                `${tokenSymbol} address: ${tokenAddress}`,
                `Chain: ${CHAIN_NAME} (${CHAIN_ID})`,
                'The address has been copied to your clipboard.',
                'You can still paste this address into the wallet import dialog manually.'
            ].join('\n');

            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(tokenAddress).catch(() => {});
            }

            alert(message);
        }

        function addPBToWallet() {
            return addTokenToWallet(TPB, 'PB', 18, TOKEN_IMAGE_URLS.PB);
        }

        function addPBcToWallet() {
            return addTokenToWallet(TPBc, 'PBc', 18, TOKEN_IMAGE_URLS.PBc);
        }

        function addTUSDLToWallet() {
            return addTokenToWallet(TUSDL, 'USDL', 18, TOKEN_IMAGE_URLS.USDL);
        }

        function addLPToWallet() {
            return addTokenToWallet(PULSEX_PAIR, 'PBUSDL-LP', 18, TOKEN_IMAGE_URLS['PBUSDL-LP']);
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

        function copyVaultAddress(targetId) {
            navigator.clipboard.writeText(TVault).then(() => {
                const el = document.getElementById(targetId);
                if (!el) return;
                const original = el.innerText;
                el.innerText = '✓ Copied!';
                setTimeout(() => {
                    el.innerText = original;
                }, 1500);
            }).catch(() => {
                alert('Failed to copy address');
            });
        }

        function copyDiagVaultAddress() {
            copyVaultAddress('diag-vault');
        }

        function copyNavVaultAddress(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            copyVaultAddress('nav-vault-addr');
        }

        function openNavVaultLink(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const navVaultLink = document.getElementById('nav-vault-link');
            const href = navVaultLink && navVaultLink.href;
            if (href) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        }

        function bindEventListeners() {
            if (listenersBound) return;

            function formatPercentAmount(value) {
                const floored = Math.floor(value * 1000000) / 1000000;
                return floored.toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
            }

            function formatStableInputAmount(value) {
                const floored = Math.floor(value * 10000) / 10000;
                const stepped = Math.floor((floored + 1e-12) / 0.05) * 0.05;
                return stepped.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
            }

            function getPBInputBalance() {
                const balanceText = document.getElementById('balance-pb')?.innerText || '0';
                return parseFloat(balanceText.replace(/[^\d\.]/g, '')) || 0;
            }

            function getExactPBInputBalance() {
                if (typeof app.getLatestPBBalanceExact === 'function') {
                    const exact = app.getLatestPBBalanceExact();
                    if (exact && Number(exact) > 0) return exact;
                }
                return String(getPBInputBalance());
            }

            function getExactLPInputBalance() {
                return document.getElementById('remove-lp-balance')?.dataset.exact || '0';
            }

            function getUSDLInputBalance() {
                return app.getLatestTusdlBalance() > 0 ? app.getLatestTusdlBalance() : 0;
            }

            async function getFreshUSDLInputBalance() {
                try {
                    if (typeof app.updateBalances === 'function') {
                        await app.updateBalances();
                    }
                } catch (err) {
                    console.warn('Unable to refresh USDL balance before applying quick amount:', err);
                }

                const refreshedBalance = Number(app.getLatestTusdlBalance());
                if (Number.isFinite(refreshedBalance) && refreshedBalance >= 0) {
                    return refreshedBalance;
                }

                return getUSDLInputBalance();
            }

            async function fillBuyAmountFromBalancePercent(multiplier) {
                const liveBalance = await getFreshUSDLInputBalance();
                document.getElementById('buy-amount').value = formatStableInputAmount(liveBalance * multiplier);
                app.handleBuyAmountInputChange();
                app.getQuote();
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
            document.getElementById('buy-autochunk-checkbox')?.addEventListener('change', function () {
                this.dataset.touched = 'true';
                app.handleBuyAmountInputChange();
            });
            document.getElementById('gift-buy-checkbox').addEventListener('change', function () {
                document.getElementById('gift-buy-field').style.display = this.checked ? 'block' : 'none';
                if (typeof app.refreshBuySigningPreview === 'function') app.refreshBuySigningPreview();
            });
            document.getElementById('gift-recipient').addEventListener('input', () => {
                if (typeof app.refreshBuySigningPreview === 'function') app.refreshBuySigningPreview();
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
            document.getElementById('btn-add-lp')?.addEventListener('click', app.PBaddUserLP);
            document.getElementById('add-lp-pb-amount')?.addEventListener('input', () => app.updateLPAddPreview('pb'));
            document.getElementById('add-lp-usdl-amount')?.addEventListener('input', () => app.updateLPAddPreview('usdl'));
            document.getElementById('add-lp-slippage')?.addEventListener('input', () => app.updateLPAddPreview());
            document.getElementById('btn-remove-lp')?.addEventListener('click', app.PBremoveUserLP);
            document.getElementById('remove-lp-amount')?.addEventListener('input', app.updateLPRemovalPreview);
            document.getElementById('remove-lp-slippage')?.addEventListener('input', app.updateLPRemovalPreview);

            document.getElementById('buy-33').addEventListener('click', async () => {
                await fillBuyAmountFromBalancePercent(0.33);
            });
            document.getElementById('buy-66').addEventListener('click', async () => {
                await fillBuyAmountFromBalancePercent(0.66);
            });
            document.getElementById('buy-100').addEventListener('click', async () => {
                await fillBuyAmountFromBalancePercent(1);
            });
            document.getElementById('sell-33').addEventListener('click', () => {
                document.getElementById('sell-amount').value = formatPercentAmount(Number(getExactPBInputBalance()) * 0.33);
                app.getSellQuote();
            });
            document.getElementById('sell-66').addEventListener('click', () => {
                document.getElementById('sell-amount').value = formatPercentAmount(Number(getExactPBInputBalance()) * 0.66);
                app.getSellQuote();
            });
            document.getElementById('sell-100').addEventListener('click', () => {
                document.getElementById('sell-amount').value = formatPercentAmount(Number(getExactPBInputBalance()));
                app.getSellQuote();
            });
            document.getElementById('vlock-25').addEventListener('click', () => app.fillVLockAmount(0.25));
            document.getElementById('vlock-50').addEventListener('click', () => app.fillVLockAmount(0.5));
            document.getElementById('vlock-75').addEventListener('click', () => app.fillVLockAmount(0.75));
            document.getElementById('vlock-100').addEventListener('click', () => app.fillVLockAmount(1));
            document.getElementById('add-lp-25')?.addEventListener('click', () => app.fillAddLPAmounts(0.25));
            document.getElementById('add-lp-50')?.addEventListener('click', () => app.fillAddLPAmounts(0.5));
            document.getElementById('add-lp-75')?.addEventListener('click', () => app.fillAddLPAmounts(0.75));
            document.getElementById('add-lp-100')?.addEventListener('click', () => app.fillAddLPAmounts(1));
            document.getElementById('remove-lp-25')?.addEventListener('click', () => {
                document.getElementById('remove-lp-amount').value = formatPercentAmount(Number(getExactLPInputBalance()) * 0.25);
                app.updateLPRemovalPreview();
            });
            document.getElementById('remove-lp-50')?.addEventListener('click', () => {
                document.getElementById('remove-lp-amount').value = formatPercentAmount(Number(getExactLPInputBalance()) * 0.5);
                app.updateLPRemovalPreview();
            });
            document.getElementById('remove-lp-75')?.addEventListener('click', () => {
                document.getElementById('remove-lp-amount').value = formatPercentAmount(Number(getExactLPInputBalance()) * 0.75);
                app.updateLPRemovalPreview();
            });
            document.getElementById('remove-lp-100')?.addEventListener('click', () => {
                document.getElementById('remove-lp-amount').value = getExactLPInputBalance();
                app.updateLPRemovalPreview();
            });
            document.getElementById('btn-harvest-refresh').addEventListener('click', app.harvestAndRefreshLPRewards);
            document.getElementById('btn-setup-recovery')?.addEventListener('click', app.setupRecovery);
            document.getElementById('btn-setup-inheritance')?.addEventListener('click', app.setupInheritance);
            document.getElementById('btn-find-activation-badges')?.addEventListener('click', app.findActivatableBadges);
            document.getElementById('btn-activate-selected-badge')?.addEventListener('click', app.activateSelectedBadge);
            document.getElementById('recovery-pbtid')?.addEventListener('change', () => app.updateRecoveryTerminalPreview('recovery'));
            document.getElementById('recovery-addr')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('recovery'));
            document.getElementById('recovery-password')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('recovery'));
            document.getElementById('recovery-memo')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('recovery'));
            document.getElementById('inheritance-pbtid')?.addEventListener('change', () => app.updateRecoveryTerminalPreview('inheritance'));
            document.getElementById('beneficiary-addr')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('inheritance'));
            document.getElementById('inheritance-password')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('inheritance'));
            document.getElementById('inheritance-memo')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('inheritance'));
            document.getElementById('combined-activate-password')?.addEventListener('input', () => app.updateRecoveryTerminalPreview('activation'));
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
            document.getElementById('nav-vault-link')?.addEventListener('click', copyNavVaultAddress);
            document.getElementById('nav-vault-link')?.addEventListener('dblclick', openNavVaultLink);

            document.getElementById('combined-activate-password')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !document.getElementById('btn-activate-selected-badge').disabled) {
                    document.getElementById('btn-activate-selected-badge').click();
                }
            });

            const faucetBtn = document.getElementById('btn-faucet-tusdl');
            if (faucetBtn) faucetBtn.addEventListener('click', app.faucetMintTUSDL);

            document.getElementById('fox-link-1')?.addEventListener('click', addPBToWallet);
            document.getElementById('fox-link-2')?.addEventListener('click', addPBcToWallet);
            document.getElementById('fox-link-3')?.addEventListener('click', addTUSDLToWallet);
            document.getElementById('fox-link-lp')?.addEventListener('click', addLPToWallet);
            document.querySelectorAll('.fox-link-lp-inline').forEach((element) => {
                element.addEventListener('click', addLPToWallet);
            });

            listenersBound = true;
        }

        async function connectWallet() {
            try {
                if (!window.ethereum) {
                    document.getElementById('wallet-addr').innerText = 'Install wallet to connect';
                    document.getElementById('connect-btn').innerText = 'Install Wallet';
                    document.getElementById('nav-connect-btn').innerText = 'Install MM';
                    return;
                }

                if (window.PBDisclaimer && typeof window.PBDisclaimer.ensureAccepted === 'function') {
                    const accepted = await window.PBDisclaimer.ensureAccepted();
                    if (!accepted) {
                        document.getElementById('wallet-addr').innerText = 'Disclaimer required';
                        document.getElementById('connect-btn').innerText = 'Connect Wallet';
                        document.getElementById('nav-connect-btn').innerText = 'Connect';
                        return;
                    }
                }

                const baseProvider = await selectConnectProvider(CHAIN_ID) || getActiveWalletProvider() || window.ethereum;
                const accounts = await baseProvider.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                activeWalletProvider = await detectProviderForAccount(account, baseProvider);
                app.setAccount(account);
                const currentChainHex = await activeWalletProvider.request({ method: 'eth_chainId' });
                const currentChainId = parseInt(currentChainHex, 16);

                if (currentChainId !== CHAIN_ID) {
                    console.log(`Wrong network detected: ${currentChainId}, switching to ${CHAIN_ID}...`);
                    document.getElementById('network-display').innerText = '⏳ Switching...';
                    suppressNextCorrectChainRefresh = true;
                    await switchToCorrectNetwork();
                    const postSwitchChainHex = await activeWalletProvider.request({ method: 'eth_chainId' });
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
                        alert(`Wallet is still on the wrong chain. Please switch to ${CHAIN_NAME} (${CHAIN_ID}) to connect this dapp.`);
                        return;
                    }

                    app.setWeb3(new ethers.BrowserProvider(activeWalletProvider));
                } else {
                    document.getElementById('network-display').innerText = `✅ ${CHAIN_NAME}`;
                    app.setWeb3(new ethers.BrowserProvider(activeWalletProvider));
                }

                app.setSigner(await app.getWeb3().getSigner(account));

                document.getElementById('wallet-addr').innerText = account.substring(0, 6) + '...' + account.substring(38);
                document.getElementById('connect-btn').innerText = '✅ Connected';
                document.getElementById('nav-connect-btn').innerText = '✅ ' + account.substring(0, 6) + '...';

                setupNetworkChangeListener(activeWalletProvider);
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
            if (typeof ethers === 'undefined') {
                console.error('ethers library not loaded');
                document.getElementById('wallet-addr').innerText = 'ethers library not loaded';
                document.getElementById('nav-connect-btn').innerText = 'Error: Ethers';
                return;
            }

            app.setReadProvider(new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID));

            const vaultAddrShort = TVault ? TVault.substring(0, 6) + '...' + TVault.substring(TVault.length - 4) : 'Pending';
            document.getElementById('nav-vault-addr').innerText = vaultAddrShort;
            const navVaultLink = document.getElementById('nav-vault-link');
            if (navVaultLink && TVault) {
                navVaultLink.href = 'https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/' + TVault;
                navVaultLink.title = `${TVault} — click to copy, double-click to open in scanner`;
            }
            const lpPairLink = document.getElementById('lp-pair-link');
            if (lpPairLink && typeof ACTIVE_NETWORK !== 'undefined' && ACTIVE_NETWORK && ACTIVE_NETWORK.explorer) {
                lpPairLink.href = ACTIVE_NETWORK.explorer.replace(/\/$/, '') + '/address/' + PULSEX_PAIR;
                lpPairLink.title = PULSEX_PAIR;
            }

            bindEventListeners();
            app.updateLPFeeStatus();
            app.updateVLockPreview();
            app.updateLPManagementPreview();
            app.updateRecoveryTerminalPreview();
            setInterval(app.updateLPFeeStatus, 30000);
            app.updatePrice();
            setInterval(app.updatePrice, 15000);
            setInterval(() => {
                if (app.getAccount()) app.updateBalances();
            }, 30000);

            setupNetworkToggle();
            syncNetworkChrome();

            if (typeof window.ethereum !== 'undefined') {
                const provider = getChainRequestProvider();
                if (provider) {
                    app.setWeb3(new ethers.BrowserProvider(provider));
                }
            } else {
                document.getElementById('wallet-addr').innerText = 'Read-only mode';
                document.getElementById('connect-btn').innerText = 'Install Wallet';
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
            addLPToWallet,
            copyWalletAddress,
            copyDiagVaultAddress,
        };
    }

    window.PBTestDappWallet = { create };
})();