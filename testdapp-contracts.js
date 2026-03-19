(function () {
    const {
        TPB,
        TPBc,
        TPBt,
        TPBr,
        TPBi,
        TUSDL,
        TVault,
        PULSEX_PAIR,
        PULSEX_ROUTER,
        VAULT_ABI,
        TOKEN_ABI,
        PAIR_ABI,
        ROUTER_ABI,
        NFT_ABI,
        BADGE_ABI,
    } = window.PBTestDapp;

    function create(app) {
        const addresses = {
            vault: TVault,
            pb: TPB,
            pbc: TPBc,
            pbt: TPBt,
            pbr: TPBr,
            pbi: TPBi,
            tusdl: TUSDL,
            pair: PULSEX_PAIR,
            router: PULSEX_ROUTER,
        };

        const abis = {
            vault: VAULT_ABI,
            pb: TOKEN_ABI,
            pbc: TOKEN_ABI,
            tusdl: TOKEN_ABI,
            pair: PAIR_ABI,
            router: ROUTER_ABI,
            pbr: BADGE_ABI,
            pbi: BADGE_ABI,
        };

        function getReadContract(key, abiOverride) {
            const web3 = app.getWeb3();
            if (!web3) throw new Error('Web3 not initialized');
            const address = addresses[key];
            const abi = abiOverride || abis[key];
            if (!address || !abi) throw new Error(`Unknown read contract: ${key}`);
            return new ethers.Contract(address, abi, web3);
        }

        function getWriteContract(key, abiOverride) {
            const signer = app.getSigner();
            if (!signer) throw new Error('Signer not initialized');
            const address = addresses[key];
            const abi = abiOverride || abis[key];
            if (!address || !abi) throw new Error(`Unknown write contract: ${key}`);
            return new ethers.Contract(address, abi, signer);
        }

        async function getPoolSnapshot() {
            const pairContract = getReadContract('pair');
            const [reserve0, reserve1] = await pairContract.getReserves();
            const token0 = await pairContract.token0();

            let pbReserve;
            let usdlReserve;
            if (token0.toLowerCase() === TPB.toLowerCase()) {
                pbReserve = Number(ethers.formatEther(reserve0));
                usdlReserve = Number(ethers.formatEther(reserve1));
            } else {
                pbReserve = Number(ethers.formatEther(reserve1));
                usdlReserve = Number(ethers.formatEther(reserve0));
            }

            return {
                pairContract,
                reserve0,
                reserve1,
                token0,
                pbReserve,
                usdlReserve,
                price: usdlReserve / pbReserve,
                poolValue: usdlReserve * 2,
            };
        }

        return {
            getReadContract,
            getWriteContract,
            getPoolSnapshot,
        };
    }

    window.PBTestDappContracts = { create };
})();