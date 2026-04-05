(function () {
    const { showStatus } = window.PBTestDapp;

    function create(app) {
        async function faucetMintTUSDL() {
            if (!app.getAccount() || !app.getSigner()) {
                alert('Connect wallet first');
                return;
            }
            try {
                showStatus('faucet-status', 'Requesting 555.5 USDL...', 'info');
                const tusdlAbi = ['function mint(address to, uint256 amount) returns (bool)'];
                const tusdlContract = app.contractLayer.getWriteContract('tusdl', tusdlAbi);
                const amount = ethers.parseEther('555.5');
                const tx = await tusdlContract.mint(app.getAccount(), amount);
                console.log('Faucet tx:', tx.hash);
                showStatus('faucet-status', 'Waiting for confirmation...', 'info');
                await tx.wait();
                showStatus('faucet-status', 'Successfully minted 555.5 USDL!', 'success');
                setTimeout(() => {
                    app.refreshDashboard({ includePrice: false, includePositions: false, includeDropdowns: false });
                }, 2000);
            } catch (err) {
                console.error('Faucet error:', err);
                showStatus('faucet-status', 'Error: ' + (err.reason || err.message), 'error');
            }
        }

        return {
            faucetMintTUSDL,
        };
    }

    window.PBTestDappFaucet = { create };
})();