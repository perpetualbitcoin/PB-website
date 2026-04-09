(function () {
    const { INDEXER_URL } = window.PBTestDapp;

    function create() {
        let priceChart;
        let candleSeries;
        let volumeSeries;
        let lineSeries;
        let chartType = 'candle';
        let currentTimeframeMin = 60;
        let tickHistory = [];

        async function loadPriceHistory() {
            try {
                const now = Math.floor(Date.now() / 1000);
                const resp = await fetch(`${INDEXER_URL}/price?to=${now}&resolution=1m`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.prices && data.prices.length > 0) {
                        tickHistory = data.prices.map((c) => ({
                            time: c.t,
                            price: parseFloat(c.c) / 1e18,
                        })).filter((t) => t.price > 0);
                        tickHistory.sort((a, b) => a.time - b.time);
                        console.log(`[chart] Loaded ${tickHistory.length} full-history price points from DB`);
                    }
                }
            } catch (e) {
                console.warn('[chart] DB price fetch failed, falling back to localStorage:', e.message);
            }

            const stored = localStorage.getItem('pb_tick_history');
            if (stored) {
                try {
                    const localTicks = JSON.parse(stored);
                    const dbMaxTime = tickHistory.length > 0 ? tickHistory[tickHistory.length - 1].time : 0;
                    const newerTicks = localTicks.filter((t) => t.time > dbMaxTime && t.price > 0);
                    if (newerTicks.length > 0) {
                        tickHistory = tickHistory.concat(newerTicks);
                        tickHistory.sort((a, b) => a.time - b.time);
                        console.log(`[chart] Merged ${newerTicks.length} newer localStorage ticks`);
                    }
                } catch {}
            }
        }

        function savePriceHistory() {
            if (tickHistory.length > 10000) tickHistory = tickHistory.slice(-10000);
            localStorage.setItem('pb_tick_history', JSON.stringify(tickHistory));
        }

        function aggregateCandles(ticks, tfMinutes) {
            if (!ticks.length) return [];
            const tfSeconds = tfMinutes * 60;
            const buckets = {};
            ticks.forEach((t) => {
                const bucket = Math.floor(t.time / tfSeconds) * tfSeconds;
                if (!buckets[bucket]) {
                    buckets[bucket] = { time: bucket, open: t.price, high: t.price, low: t.price, close: t.price };
                } else {
                    buckets[bucket].high = Math.max(buckets[bucket].high, t.price);
                    buckets[bucket].low = Math.min(buckets[bucket].low, t.price);
                    buckets[bucket].close = t.price;
                }
            });
            const sorted = Object.values(buckets).sort((a, b) => a.time - b.time);
            if (sorted.length < 2) return sorted;

            const filled = [sorted[0]];
            for (let i = 1; i < sorted.length; i++) {
                const prev = filled[filled.length - 1];
                let t = prev.time + tfSeconds;
                while (t < sorted[i].time) {
                    filled.push({ time: t, open: prev.close, high: prev.close, low: prev.close, close: prev.close });
                    t += tfSeconds;
                }
                filled.push(sorted[i]);
            }
            return filled;
        }

        function updateChartDisplay(resetView = false) {
            if (!candleSeries || !tickHistory.length) return;

            const tf = currentTimeframeMin === 0 ? 15 : currentTimeframeMin;
            const candles = aggregateCandles(tickHistory, tf);
            candleSeries.setData(candles);
            volumeSeries.setData(candles.map((c) => ({
                time: c.time,
                value: 1,
                color: c.close >= c.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
            })));
            lineSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));

            if (resetView) {
                if (currentTimeframeMin === 0) {
                    const visibleBars = Math.min(240, candles.length);
                    priceChart.timeScale().setVisibleLogicalRange({
                        from: Math.max(0, candles.length - visibleBars),
                        to: candles.length - 1 + 1,
                    });
                } else {
                    priceChart.timeScale().fitContent();
                }
            }
        }

        function switchTimeframe(tfMinutes, clickedBtn) {
            currentTimeframeMin = tfMinutes;
            document.querySelectorAll('#timeframe-buttons .timeframe-btn').forEach((btn) => {
                btn.style.background = 'transparent';
                btn.style.color = '#aaa';
                btn.style.borderColor = 'rgba(255, 165, 0, 0.2)';
            });
            if (clickedBtn) {
                clickedBtn.style.background = 'rgba(255, 165, 0, 0.1)';
                clickedBtn.style.color = '#F39004';
                clickedBtn.style.borderColor = 'rgba(255, 165, 0, 0.3)';
            }
            updateChartDisplay(true);
        }

        function switchChartType(type) {
            chartType = type;
            const isCandle = type === 'candle';
            candleSeries.applyOptions({ visible: isCandle });
            volumeSeries.applyOptions({ visible: isCandle });
            lineSeries.applyOptions({ visible: !isCandle });
            document.getElementById('chart-candle-btn').style.background = isCandle ? 'rgba(255,165,0,0.1)' : 'transparent';
            document.getElementById('chart-candle-btn').style.color = isCandle ? '#F39004' : '#aaa';
            document.getElementById('chart-candle-btn').style.borderColor = isCandle ? 'rgba(255,165,0,0.3)' : 'rgba(255,165,0,0.2)';
            document.getElementById('chart-line-btn').style.background = !isCandle ? 'rgba(255,165,0,0.1)' : 'transparent';
            document.getElementById('chart-line-btn').style.color = !isCandle ? '#F39004' : '#aaa';
            document.getElementById('chart-line-btn').style.borderColor = !isCandle ? 'rgba(255,165,0,0.3)' : 'rgba(255,165,0,0.2)';
            updateChartDisplay(false);
        }

        function initChart() {
            if (typeof LightweightCharts === 'undefined') {
                console.warn('LightweightCharts not loaded yet');
                return;
            }
            const container = document.getElementById('priceChart');
            if (!container) return;

            if (priceChart) {
                updateChartDisplay(true);
                return;
            }

            priceChart = LightweightCharts.createChart(container, {
                width: container.clientWidth,
                height: container.clientHeight || 300,
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#aaa',
                    fontSize: 12,
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: { color: 'rgba(243, 144, 4, 0.4)', labelBackgroundColor: '#F39004' },
                    horzLine: { color: 'rgba(243, 144, 4, 0.4)', labelBackgroundColor: '#F39004' },
                },
                rightPriceScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    scaleMargins: { top: 0.1, bottom: 0.2 },
                },
                timeScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    timeVisible: true,
                    secondsVisible: false,
                },
                handleScroll: true,
                handleScale: true,
            });

            candleSeries = priceChart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderDownColor: '#ef5350',
                borderUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                wickUpColor: '#26a69a',
                priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            });

            volumeSeries = priceChart.addHistogramSeries({
                priceFormat: { type: 'volume' },
                priceScaleId: '',
            });
            priceChart.priceScale('').applyOptions({
                scaleMargins: { top: 0.85, bottom: 0 },
            });

            lineSeries = priceChart.addLineSeries({
                color: '#F39004',
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                priceLineVisible: false,
                priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            });
            lineSeries.applyOptions({ visible: false });

            const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    priceChart.applyOptions({ width, height: height || 300 });
                }
            });
            resizeObserver.observe(container);

            document.querySelectorAll('#timeframe-buttons .timeframe-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const tf = parseInt(btn.dataset.tf, 10);
                    switchTimeframe(tf, btn);
                });
            });

            document.getElementById('chart-candle-btn')?.addEventListener('click', () => {
                switchChartType('candle');
            });
            document.getElementById('chart-line-btn')?.addEventListener('click', () => {
                switchChartType('line');
            });

            updateChartDisplay(true);
        }

        function updateChartData(price) {
            if (!candleSeries) return;
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0) return;

            const now = Math.floor(Date.now() / 1000);
            tickHistory.push({ time: now, price: priceNum });
            savePriceHistory();

            const tf = currentTimeframeMin === 0 ? 15 : currentTimeframeMin;
            const tfSeconds = tf * 60;
            const bucket = Math.floor(now / tfSeconds) * tfSeconds;
            const bucketTicks = tickHistory.filter((t) => Math.floor(t.time / tfSeconds) * tfSeconds === bucket);
            if (bucketTicks.length > 0) {
                const candle = {
                    time: bucket,
                    open: bucketTicks[0].price,
                    high: Math.max(...bucketTicks.map((t) => t.price)),
                    low: Math.min(...bucketTicks.map((t) => t.price)),
                    close: priceNum,
                };
                candleSeries.update(candle);
                lineSeries.update({ time: bucket, value: priceNum });
                volumeSeries.update({
                    time: bucket,
                    value: bucketTicks.length,
                    color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
                });
            }
        }

        return {
            loadPriceHistory,
            initChart,
            updateChartData,
            switchChartType,
        };
    }

    window.PBTestDappChart = { create };
})();