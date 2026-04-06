(function () {
    const { INDEXER_URL, CHART_HISTORY_START_TS } = window.PBTestDapp;
    const HISTORY_STORAGE_KEY = `pb_tick_history_${typeof ACTIVE_NETWORK_KEY === 'string' ? ACTIVE_NETWORK_KEY : 'default'}`;

    function create() {
        let priceChart;
        let candleSeries;
        let volumeSeries;
        let lineSeries;
        let chartType = 'line';
        let currentTimeframeMin = 60;
        let tickHistory = [];
        let chartResizeObserver = null;

        function normalizeTicks(ticks) {
            if (!Array.isArray(ticks) || !ticks.length) return [];

            const byTime = new Map();
            for (const tick of ticks) {
                const time = Number(tick?.time);
                const price = Number(tick?.price);
                if (!Number.isFinite(time) || time <= 0) continue;
                if (!Number.isFinite(price) || price <= 0) continue;
                if (CHART_HISTORY_START_TS > 0 && time < CHART_HISTORY_START_TS) continue;
                byTime.set(Math.floor(time), { time: Math.floor(time), price });
            }

            return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
        }

        function applyNormalizedHistory(ticks) {
            tickHistory = normalizeTicks(ticks);
            return tickHistory;
        }

        function safeChartCall(label, fn) {
            try {
                return fn();
            } catch (err) {
                console.error(`[chart] ${label} failed:`, err);
                return null;
            }
        }

        async function loadPriceHistory() {
            try {
                const now = Math.floor(Date.now() / 1000);
                const resp = await fetch(`${INDEXER_URL}/price?to=${now}&resolution=1m`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.prices && data.prices.length > 0) {
                        applyNormalizedHistory(data.prices.map((c) => ({
                            time: c.t,
                            price: parseFloat(c.c) / 1e18,
                        })));
                        console.log(`[chart] Loaded ${tickHistory.length} full-history price points from DB`);
                    }
                }
            } catch (e) {
                console.warn('[chart] DB price fetch failed, falling back to localStorage:', e.message);
            }

            const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (stored) {
                try {
                    const localTicks = normalizeTicks(JSON.parse(stored));
                    const dbMaxTime = tickHistory.length > 0 ? tickHistory[tickHistory.length - 1].time : 0;
                    const newerTicks = localTicks.filter((t) => t.time > dbMaxTime && t.price > 0);
                    if (newerTicks.length > 0) {
                        applyNormalizedHistory(tickHistory.concat(newerTicks));
                        console.log(`[chart] Merged ${newerTicks.length} newer localStorage ticks`);
                    }
                } catch {}
            }

            savePriceHistory();
        }

        function savePriceHistory() {
            if (tickHistory.length > 10000) tickHistory = tickHistory.slice(-10000);
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(tickHistory));
            } catch (err) {
                console.warn('[chart] Unable to persist local tick history:', err.message || err);
            }
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
            const stableCandles = Array.isArray(candles) ? candles.filter((c) => Number.isFinite(c?.time) && Number.isFinite(c?.open) && Number.isFinite(c?.high) && Number.isFinite(c?.low) && Number.isFinite(c?.close)) : [];
            if (!stableCandles.length) return;

            safeChartCall('set candle data', () => candleSeries.setData(stableCandles));
            safeChartCall('set volume data', () => volumeSeries.setData(stableCandles.map((c) => ({
                time: c.time,
                value: 1,
                color: c.close >= c.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
            }))));
            safeChartCall('set line data', () => lineSeries.setData(stableCandles.map((c) => ({ time: c.time, value: c.close }))));

            if (resetView) {
                if (currentTimeframeMin === 0) {
                    const visibleBars = Math.min(240, stableCandles.length);
                    safeChartCall('set logical range', () => priceChart.timeScale().setVisibleLogicalRange({
                        from: Math.max(0, candles.length - visibleBars),
                        to: stableCandles.length,
                    }));
                } else {
                    safeChartCall('fit content', () => priceChart.timeScale().fitContent());
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
            safeChartCall('toggle candle series', () => candleSeries.applyOptions({ visible: isCandle }));
            safeChartCall('toggle volume series', () => volumeSeries.applyOptions({ visible: isCandle }));
            safeChartCall('toggle line series', () => lineSeries.applyOptions({ visible: !isCandle }));
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
            lineSeries.applyOptions({ visible: true });

            chartResizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    safeChartCall('resize chart', () => priceChart.applyOptions({ width, height: height || 300 }));
                }
            });
            chartResizeObserver.observe(container);

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

            switchChartType(chartType);
            updateChartDisplay(true);
        }

        function updateChartData(price) {
            if (!candleSeries) return;
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0) return;

            const now = Math.floor(Date.now() / 1000);
            const lastTick = tickHistory.length ? tickHistory[tickHistory.length - 1] : null;
            if (lastTick && lastTick.time === now) {
                lastTick.price = priceNum;
            } else {
                tickHistory.push({ time: now, price: priceNum });
            }
            tickHistory = normalizeTicks(tickHistory);
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
                safeChartCall('update candle', () => candleSeries.update(candle));
                safeChartCall('update line', () => lineSeries.update({ time: bucket, value: priceNum }));
                safeChartCall('update volume', () => volumeSeries.update({
                    time: bucket,
                    value: bucketTicks.length,
                    color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
                }));
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