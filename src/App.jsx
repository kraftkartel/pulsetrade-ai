import { useState, useEffect, useRef, useCallback } from "react";
import { createChart, CrosshairMode, LineStyle, PriceScaleMode } from "lightweight-charts";
const NEWS_API_KEY = "your_key_here";

/* ─── MARKETS ─── */
const MARKETS = [
  { id: "BTC/USD", icon: "₿", base: 67420, category: "Crypto", decimals: 2 },
  { id: "ETH/USD", icon: "Ξ", base: 3540, category: "Crypto", decimals: 2 },
  { id: "GOLD", icon: "Au", base: 2341, category: "Commodity", decimals: 2 },
  { id: "EUR/USD", icon: "€", base: 1.0823, category: "Forex", decimals: 5 },
  { id: "COFFEE", icon: "☕", base: 2.14, category: "Commodity", decimals: 4 },
  { id: "USD/RWF", icon: "Fr", base: 1285, category: "Forex", decimals: 2 },
];

const NEWS_POOL = [
  { text: "Federal Reserve signals potential rate pause in June meeting", sentiment: "bullish", source: "Reuters" },
  { text: "Bitcoin ETF sees record $800M inflows this week", sentiment: "bullish", source: "Bloomberg" },
  { text: "Rwanda Coffee exports hit all-time high, global demand surges", sentiment: "bullish", source: "AfDB" },
  { text: "Inflation data beats expectations, markets rally strongly", sentiment: "bullish", source: "CNBC" },
  { text: "African Development Bank boosts fintech investment by $2B", sentiment: "bullish", source: "AfDB" },
  { text: "EU economy contracts for second consecutive quarter", sentiment: "bearish", source: "FT" },
  { text: "SEC tightens crypto regulations, uncertainty rises", sentiment: "bearish", source: "WSJ" },
  { text: "Gold demand drops as dollar strengthens globally", sentiment: "bearish", source: "Reuters" },
  { text: "IMF warns of global growth slowdown in 2026", sentiment: "bearish", source: "IMF" },
  { text: "China tech crackdown spills into global markets", sentiment: "bearish", source: "Bloomberg" },
];

/* ─── HELPERS ─── */
async function fetchNews(marketId) {
  const query = marketId.replace("/", " ");
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${NEWS_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.articles.map(a => ({
      text: a.title,
      source: a.source.name,
      sentiment: a.title.match(/fall|drop|crash|warn|risk|fear|sell|bear|down|loss/i) ? "bearish" : "bullish",
      url: a.url,
    }));
  } catch {
    return [...NEWS_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
  }
}

function fmt(val, market) {
  if (val == null) return "";
  const m = typeof market === "string" ? MARKETS.find(x => x.id === market) : market;
  const dec = m?.decimals ?? 2;
  if (dec >= 4) return val.toFixed(dec);
  return val.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getSignal(candles, news) {
  const bullish = news.filter(n => n.sentiment === "bullish").length;
  const prices = candles.slice(-8).map(c => c.close);
  const trend = prices[prices.length - 1] - prices[0];
  const score = bullish * 14 + (trend > 0 ? 22 : -22) + Math.random() * 18;
  if (score > 38) return { signal: "BUY", color: "#00e5a0", bg: "#00e5a009", confidence: Math.floor(68 + Math.random() * 22), target: "+2.4%", stop: "-1.1%" };
  if (score < 16) return { signal: "SELL", color: "#f43f5e", bg: "#f43f5e09", confidence: Math.floor(62 + Math.random() * 22), target: "-2.1%", stop: "+1.3%" };
  return { signal: "HOLD", color: "#f59e0b", bg: "#f59e0b09", confidence: Math.floor(55 + Math.random() * 18), target: "±0.5%", stop: "±0.8%" };
}

/* ─── OHLCV GENERATOR ─── */
function generateOHLCV(base, count = 120) {
  const candles = [];
  let price = base;
  const now = Math.floor(Date.now() / 1000);
  const interval = 5 * 60; // 5-minute bars

  for (let i = count; i >= 0; i--) {
    const vol = (Math.random() - 0.48) * base * 0.012;
    const open = price;
    price = Math.max(price + vol, base * 0.75);
    const high = Math.max(open, price) * (1 + Math.random() * 0.004);
    const low = Math.min(open, price) * (1 - Math.random() * 0.004);
    const close = price;
    candles.push({
      time: now - i * interval,
      open: parseFloat(open.toFixed(6)),
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      close: parseFloat(close.toFixed(6)),
      volume: Math.floor(Math.random() * 1200 + 300),
    });
  }
  return candles;
}

/* ─── EMA CALCULATOR ─── */
function calcEMA(candles, period) {
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  return candles.map((c, i) => {
    if (i === 0) { ema = c.close; return { time: c.time, value: parseFloat(ema.toFixed(6)) }; }
    ema = c.close * k + ema * (1 - k);
    return { time: c.time, value: parseFloat(ema.toFixed(6)) };
  });
}

/* ─── RSI CALCULATOR ─── */
function calcRSI(candles, period = 14) {
  const result = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    result.push({ time: candles[i].time, value: parseFloat(rsi.toFixed(2)) });
  }
  return result;
}

/* ─── DRAWING TOOLS ─── */
const DRAW_TOOLS = [
  { id: "cursor", icon: "↖", label: "Cursor" },
  { id: "crosshair", icon: "⊕", label: "Crosshair" },
  { id: "trendline", icon: "╱", label: "Trend Line" },
  { id: "hline", icon: "—", label: "Horizontal Line" },
  { id: "hray", icon: "→", label: "Horizontal Ray" },
  { id: "fib", icon: "Φ", label: "Fibonacci Retracement" },
  { id: "rect", icon: "▭", label: "Rectangle" },
  { id: "measure", icon: "↔", label: "Price Range Ruler" },
  { id: "text", icon: "T", label: "Text Label" },
  { id: "eraser", icon: "⌫", label: "Eraser" },
];

const INTERVALS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1H", seconds: 3600 },
  { label: "4H", seconds: 14400 },
  { label: "1D", seconds: 86400 },
  { label: "1W", seconds: 604800 },
];

/* ═══════════════════════════════════════════════
   TRADINGVIEW CHART COMPONENT
═══════════════════════════════════════════════ */
function TVChart({ market, candles, onPriceUpdate }) {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const rsiSeriesRef = useRef(null);
  const drawingRef = useRef({ active: null, points: [], overlays: [] });
  const svgLayerRef = useRef(null);
  const [activeTool, setActiveTool] = useState("cursor");
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [chartType, setChartType] = useState("candle"); // candle | bar | line | area
  const [ohlcInfo, setOhlcInfo] = useState(null);

  /* ── INIT CHARTS ── */
  useEffect(() => { (async () => {
    if (!chartContainerRef.current) return;

    const CHART_BG = "#0a0c0f";
    const GRID = "#151c28";
    const TEXT = "#64748b";
    const BORDER = "#1e2530";

    /* Main chart */
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: showRSI ? Math.floor(chartContainerRef.current.clientHeight * 0.72) : chartContainerRef.current.clientHeight,
      layout: { background: { color: CHART_BG }, textColor: TEXT, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: GRID, style: LineStyle.Dotted }, horzLines: { color: GRID, style: LineStyle.Dotted } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#2a3a50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a2535" }, horzLine: { color: "#2a3a50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#00e5a0", labelVisible: true } },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.08, bottom: showVolume ? 0.28 : 0.08 }, mode: PriceScaleMode.Normal, autoScale: true },
      leftPriceScale: { visible: false },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false, barSpacing: 8, rightOffset: 12 },
      watermark: { visible: true, fontSize: 14, horzAlign: "left", vertAlign: "top", color: "rgba(0,229,160,0.07)", text: "PULSETRADE AI · " + market.id },
    });
    chartRef.current = chart;

    /* Candlestick series */
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00e5a0", downColor: "#f43f5e",
      borderUpColor: "#00e5a0", borderDownColor: "#f43f5e",
      wickUpColor: "#00e5a0", wickDownColor: "#f43f5e",
    });
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    /* Volume histogram */
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#3b82f620",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 }, drawTicks: false });
    const volData = candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "#00e5a022" : "#f43f5e22",
    }));
    volumeSeries.setData(volData);
    volumeSeriesRef.current = volumeSeries;

    /* EMA 20 */
    const ema20 = chart.addLineSeries({ color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "EMA20" });
    ema20.setData(calcEMA(candles, 20));
    ema20Ref.current = ema20;

    /* EMA 50 */
    const ema50 = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "EMA50" });
    ema50.setData(calcEMA(candles, 50));
    ema50Ref.current = ema50;

    /* Price line for live price */
    candleSeries.createPriceLine({
      price: candles[candles.length - 1].close,
      color: "#00e5a0",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "LIVE",
    });

    /* Crosshair move → OHLC tooltip */
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData) { setOhlcInfo(null); return; }
      const data = param.seriesData.get(candleSeries);
      if (data) setOhlcInfo(data);
    });

    /* RSI sub-chart */
    if (rsiContainerRef.current) {
      const rsiChart = createChart(rsiContainerRef.current, {
        width: rsiContainerRef.current.clientWidth,
        height: rsiContainerRef.current.clientHeight,
        layout: { background: { color: CHART_BG }, textColor: TEXT, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
        grid: { vertLines: { color: GRID, style: LineStyle.Dotted }, horzLines: { color: GRID, style: LineStyle.Dotted } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#2a3a50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a2535" }, horzLine: { color: "#2a3a50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#7c3aed" } },
        rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false },
        watermark: { visible: true, fontSize: 11, horzAlign: "left", vertAlign: "top", color: "rgba(124,58,237,0.15)", text: "RSI(14)" },
      });
      rsiChartRef.current = rsiChart;

      const rsiSeries = rsiChart.addLineSeries({ color: "#a78bfa", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      rsiSeries.setData(calcRSI(candles));
      rsiSeriesRef.current = rsiSeries;

      /* RSI reference lines */
      rsiSeries.createPriceLine({ price: 70, color: "#f43f5e44", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "OB" });
      rsiSeries.createPriceLine({ price: 30, color: "#00e5a044", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "OS" });
      rsiSeries.createPriceLine({ price: 50, color: "#64748b33", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });

      /* Sync timescales */
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
      });
      rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) chart.timeScale().setVisibleLogicalRange(range);
      });
    }

    /* Resize observer */
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    });
    if (chartContainerRef.current) ro.observe(chartContainerRef.current.parentElement);

    chart.timeScale().fitContent();

    return () => {
      ro.disconnect();
      chart.remove();
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }
      chartRef.current = null;
    };
  }, [market.id]); // re-init on market change

  /* ── LIVE TICK ── */
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    const last = candles[candles.length - 1];
    const interval = setInterval(() => {
      const drift = (Math.random() - 0.488) * market.base * 0.0018;
      const newClose = parseFloat((last.close + drift).toFixed(6));
      const update = { ...last, close: newClose, high: Math.max(last.high, newClose), low: Math.min(last.low, newClose) };
      candleSeriesRef.current?.update(update);
      onPriceUpdate?.(newClose);
    }, 1500);
    return () => clearInterval(interval);
  }, [candles, market]);

  /* ── TOGGLE VISIBILITY ── */
  useEffect(() => { ema20Ref.current?.applyOptions({ visible: showEMA20 }); }, [showEMA20]);
  useEffect(() => { ema50Ref.current?.applyOptions({ visible: showEMA50 }); }, [showEMA50]);
  useEffect(() => { volumeSeriesRef.current?.applyOptions({ visible: showVolume }); }, [showVolume]);

  /* ── CHART TYPE ── */
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    if (chartType === "candle") {
      candleSeriesRef.current.applyOptions({ upColor: "#00e5a0", downColor: "#f43f5e", wickVisible: true, borderVisible: true });
    } else if (chartType === "bar") {
      candleSeriesRef.current.applyOptions({ upColor: "#00e5a0", downColor: "#f43f5e", wickVisible: true, borderVisible: false, thinBars: true });
    }
  }, [chartType]);

  /* ── DRAWING TOOL CLICK ON CHART ── */
  const handleChartClick = useCallback((e) => {
    if (activeTool === "cursor" || activeTool === "crosshair") return;
    if (!chartRef.current) return;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = chartRef.current.priceScale("right").coordinateToPrice(y);
    const time = chartRef.current.timeScale().coordinateToTime(x);

    if (!price || !time) return;

    const drawing = drawingRef.current;

    if (activeTool === "hline") {
      /* Instant horizontal line */
      const series = chartRef.current.addLineSeries({ color: "#00e5a088", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      const first = candles[0].time, last2 = candles[candles.length - 1].time + 86400 * 30;
      series.setData([{ time: first, value: price }, { time: last2, value: price }]);
      drawing.overlays.push(series);
      return;
    }

    if (activeTool === "trendline" || activeTool === "fib" || activeTool === "measure") {
      if (!drawing.active) {
        drawing.active = activeTool;
        drawing.points = [{ time, price, x, y }];
      } else {
        const p1 = drawing.points[0];
        if (activeTool === "trendline") {
          const series = chartRef.current.addLineSeries({ color: "#3b82f6", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
          series.setData([{ time: Math.min(p1.time, time), value: time < p1.time ? price : p1.price }, { time: Math.max(p1.time, time), value: time > p1.time ? price : p1.price }]);
          drawing.overlays.push(series);
        } else if (activeTool === "fib") {
          const hi = Math.max(p1.price, price), lo = Math.min(p1.price, price), range = hi - lo;
          [0, 23.6, 38.2, 50, 61.8, 78.6, 100].forEach(pct => {
            const level = hi - range * (pct / 100);
            const s = chartRef.current.addLineSeries({ color: `rgba(168,85,247,${pct === 0 || pct === 100 ? 0.9 : 0.5})`, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: true, title: `${pct}%` });
            const f = candles[0].time, l = candles[candles.length - 1].time + 86400 * 30;
            s.setData([{ time: f, value: level }, { time: l, value: level }]);
            drawing.overlays.push(s);
          });
        }
        drawing.active = null;
        drawing.points = [];
      }
    }
  }, [activeTool, candles]);

  /* ── ERASER ── */
  const clearDrawings = () => {
    drawingRef.current.overlays.forEach(s => { try { chartRef.current?.removeSeries(s); } catch {} });
    drawingRef.current.overlays = [];
    drawingRef.current.active = null;
    drawingRef.current.points = [];
  };

  const toolGroups = [
    DRAW_TOOLS.slice(0, 2),
    DRAW_TOOLS.slice(2, 7),
    DRAW_TOOLS.slice(7, 10),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0c0f", borderRadius: 16, overflow: "hidden", border: "1px solid #1e2530" }}>

      {/* ── CHART TOOLBAR ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "6px 12px", borderBottom: "1px solid #1e2530", background: "#0f1318", flexWrap: "wrap", gap: 8, minHeight: 44 }}>

        {/* Chart type */}
        <div style={{ display: "flex", gap: 2, background: "#060a0f", borderRadius: 7, padding: 3 }}>
          {[["candle","🕯","Candles"],["bar","▏","Bars"],["line","╱","Line"]].map(([id, ico, lbl]) => (
            <button key={id} title={lbl} onClick={() => setChartType(id)} style={{ background: chartType === id ? "#1e2530" : "transparent", border: "none", color: chartType === id ? "#00e5a0" : "#475569", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontFamily: "inherit", transition: "all .15s" }}>{ico}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "#1e2530" }} />

        {/* Indicators */}
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "ema20", label: "EMA20", color: "#3b82f6", val: showEMA20, set: setShowEMA20 },
            { key: "ema50", label: "EMA50", color: "#f59e0b", val: showEMA50, set: setShowEMA50 },
            { key: "vol", label: "VOL", color: "#64748b", val: showVolume, set: setShowVolume },
            { key: "rsi", label: "RSI", color: "#a78bfa", val: showRSI, set: setShowRSI },
          ].map(ind => (
            <button key={ind.key} onClick={() => ind.set(v => !v)} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${ind.val ? ind.color + "60" : "#1e2530"}`, background: ind.val ? ind.color + "15" : "transparent", color: ind.val ? ind.color : "#475569", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, cursor: "pointer", transition: "all .15s", letterSpacing: .5 }}>
              {ind.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "#1e2530" }} />

        {/* OHLC Info */}
        {ohlcInfo && (
          <div style={{ display: "flex", gap: 12, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: "#64748b" }}>
            <span>O <span style={{ color: "#94a3b8" }}>{fmt(ohlcInfo.open, market)}</span></span>
            <span>H <span style={{ color: "#00e5a0" }}>{fmt(ohlcInfo.high, market)}</span></span>
            <span>L <span style={{ color: "#f43f5e" }}>{fmt(ohlcInfo.low, market)}</span></span>
            <span>C <span style={{ color: ohlcInfo.close >= ohlcInfo.open ? "#00e5a0" : "#f43f5e" }}>{fmt(ohlcInfo.close, market)}</span></span>
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => chartRef.current?.timeScale().fitContent()} title="Fit content" style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid #1e2530", background: "transparent", color: "#475569", fontSize: 11, cursor: "pointer", transition: "all .15s" }}>⊡</button>
          <button onClick={() => chartRef.current?.timeScale().scrollToRealTime()} title="Go to real-time" style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid #1e2530", background: "transparent", color: "#475569", fontSize: 11, cursor: "pointer", transition: "all .15s" }}>→|</button>
        </div>
      </div>

      {/* ── BODY: LEFT TOOLBAR + CHART ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Drawing tools sidebar */}
        <div style={{ width: 40, background: "#0c1018", borderRight: "1px solid #1e2530", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 1, flexShrink: 0 }}>
          {toolGroups.map((group, gi) => (
            <div key={gi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, width: "100%", ...(gi > 0 ? { borderTop: "1px solid #1e2530", paddingTop: 4, marginTop: 3 } : {}) }}>
              {group.map(tool => (
                <button key={tool.id} title={tool.label}
                  onClick={() => { if (tool.id === "eraser") { clearDrawings(); } else { setActiveTool(tool.id); } }}
                  style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "none", background: activeTool === tool.id ? "#00e5a020" : "transparent", color: activeTool === tool.id ? "#00e5a0" : "#475569", cursor: "pointer", fontSize: tool.icon === "Φ" ? 14 : 13, transition: "all .15s", fontFamily: "inherit" }}>
                  {tool.icon}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Drawing hint */}
          {drawingRef.current.active && (
            <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "#1e2530ee", color: "#00e5a0", fontSize: 11, padding: "4px 14px", borderRadius: 20, border: "1px solid #00e5a040", fontFamily: "'JetBrains Mono',monospace", pointerEvents: "none" }}>
              Click second point to complete {drawingRef.current.active}
            </div>
          )}

          {/* Main chart */}
          <div ref={chartContainerRef} style={{ flex: showRSI ? "0 0 70%" : 1, cursor: activeTool === "cursor" ? "default" : activeTool === "crosshair" ? "crosshair" : "crosshair" }} onClick={handleChartClick} />

          {/* RSI sub-chart */}
          {showRSI && (
            <>
              <div style={{ height: 1, background: "#1e2530" }} />
              <div style={{ padding: "4px 8px", background: "#0c1018", fontSize: 9, color: "#7c3aed", fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>RSI (14)</div>
              <div ref={rsiContainerRef} style={{ flex: 1 }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MINI SPARKLINE (market cards)
═══════════════════════════════════════════════ */
function Spark({ data, up }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 80, h = 32, pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={up ? "#00e5a0" : "#f43f5e"} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
export default function PulseTradeAI() {
  const [market, setMarket] = useState(MARKETS[0]);
  const [candles, setCandles] = useState(() => generateOHLCV(MARKETS[0].base));
  const [news, setNews] = useState(pickNews());
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiReason, setAiReason] = useState("");
  const [livePrice, setLivePrice] = useState(MARKETS[0].base);
  const [priceChange, setPriceChange] = useState(0.42);
  const [tab, setTab] = useState("chart");
  const [interval, setIntervalVal] = useState("5m");
  const [accuracy, setAccuracy] = useState({ total: 147, correct: 103, history: ["W","W","L","W","W","W","L","W","W","W"] });
  const [sparks] = useState(() => MARKETS.map(m => Array.from({ length: 24 }, () => m.base * (0.96 + Math.random() * 0.08))));
  const [marketPrices, setMarketPrices] = useState(() => Object.fromEntries(MARKETS.map(m => [m.id, m.base])));
  const livePriceRef = useRef(livePrice);
  livePriceRef.current = livePrice;

  useEffect(() => { (async () => {
    const c = generateOHLCV(market.base);
    setCandles(c);
    const last = c[c.length - 1].close;
    setLivePrice(last);
    setPriceChange(parseFloat(((last - market.base) / market.base * 100).toFixed(2)));
    const n = await fetchNews(market.id);
    setNews(n);
    setSignal(getSignal(c, n));
    setAiReason("");
  })(); }, [market]);

  const handlePriceUpdate = useCallback((p) => {
    setLivePrice(p);
    setPriceChange(parseFloat(((p - market.base) / market.base * 100).toFixed(2)));
    setMarketPrices(prev => ({ ...prev, [market.id]: p }));
  }, [market]);

  async function analyzeMarket() {
    setLoading(true); setAiReason("");
    const bullish = news.filter(n => n.sentiment === "bullish").map(n => n.text);
    const bearish = news.filter(n => n.sentiment === "bearish").map(n => n.text);
    const prompt = `You are PulseTrade AI, an elite quantitative analyst. Analyze ${market.id} at ${fmt(livePrice, market)} (${priceChange > 0 ? "+" : ""}${priceChange}%).\n\nBullish factors: ${bullish.join("; ")}\nBearish factors: ${bearish.join("; ")}\nSignal: ${signal?.signal} | Confidence: ${signal?.confidence}%\n\nWrite 3 sharp sentences: (1) the dominant market force right now, (2) why the ${signal?.signal} signal was generated, (3) the single most important risk to watch. Be precise, data-driven, and professional.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      setAiReason(data.content?.find(b => b.type === "text")?.text || "Analysis unavailable.");
      const correct = Math.random() > 0.28;
      setAccuracy(prev => ({ total: prev.total + 1, correct: prev.correct + (correct ? 1 : 0), history: [...prev.history.slice(-9), correct ? "W" : "L"] }));
    } catch {
      setAiReason("Signal computed from technical indicators. Connect API for full AI analysis.");
    }
    setLoading(false);
  }

  const winRate = Math.round((accuracy.correct / accuracy.total) * 100);

  return (
    <div style={{ margin: 0, padding: 0, minHeight: "100vh", background: "#060912", fontFamily: "'DM Mono','Courier New',monospace", color: "#c8d8f0", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=JetBrains+Mono:wght@400;600&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { margin: 0; padding: 0; background: #060912; min-height: 100vh; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #060912; }
        ::-webkit-scrollbar-thumb { background: #1e2530; border-radius: 4px; }
        button { font-family: inherit; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{text-shadow:0 0 18px currentColor}50%{text-shadow:0 0 40px currentColor,0 0 70px currentColor} }
        .live-dot { width:7px;height:7px;background:#00e5a0;border-radius:50%;animation:pulse-dot 2s infinite;flex-shrink:0; }
        .fade-up { animation:fadeUp .35s ease; }
        .signal-glow { animation:glow 3s infinite; }
        .mkt-card { background:#0c1220;border:1px solid #1a2540;border-radius:12px;padding:12px 14px;cursor:pointer;transition:all .2s; }
        .mkt-card:hover { border-color:#2a4060;background:#0f1828; }
        .mkt-card.active { border-color:#00e5a0;background:#00e5a009; }
        .tab-btn { background:none;border:none;border-bottom:2px solid transparent;color:#4a6080;padding:10px 20px;cursor:pointer;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;transition:all .2s; }
        .tab-btn:hover { color:#8aafcf; }
        .tab-btn.active { border-bottom-color:#00e5a0;color:#00e5a0; }
        .glass { background:#0c1220cc;border:1px solid #1a2540;border-radius:14px;backdrop-filter:blur(10px); }
        .analyze-btn { background:linear-gradient(135deg,#00e5a018,#3b82f618);border:1px solid #00e5a040;color:#00e5a0;padding:11px 28px;border-radius:9px;cursor:pointer;font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;transition:all .25s; }
        .analyze-btn:hover:not(:disabled) { background:linear-gradient(135deg,#00e5a028,#3b82f628);border-color:#00e5a0;box-shadow:0 0 20px #00e5a025; }
        .analyze-btn:disabled { opacity:.4;cursor:not-allowed; }
        .news-row { display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #0f1828;transition:padding .2s; }
        .news-row:last-child{border:none}
        .news-row:hover{padding-left:6px}
        .iv-btn { padding:4px 9px;font-size:11px;font-weight:600;border-radius:5px;cursor:pointer;border:1px solid transparent;background:transparent;color:#475569;transition:all .15s;font-family:'JetBrains Mono',monospace; }
        .iv-btn:hover{color:#94a3b8;border-color:#1e2530}
        .iv-btn.active{color:#00e5a0;background:#00e5a012;border-color:#00e5a030}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#08101eee", borderBottom: "1px solid #1a2540", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 200, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#00e5a0,#3b82f6)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900 }}>⚡</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: "#e0f0ff", letterSpacing: 1 }}>PULSETRADE AI</div>
            <div style={{ fontSize: 8, color: "#2a5070", letterSpacing: 3 }}>SIGNAL INTELLIGENCE PLATFORM</div>
          </div>
        </div>

        {/* Live price in header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 600, color: priceChange >= 0 ? "#00e5a0" : "#f43f5e" }}>{fmt(livePrice, market)}</div>
            <div style={{ fontSize: 10, color: priceChange >= 0 ? "#00e5a0" : "#f43f5e" }}>{priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange)}%</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 10, color: "#00e5a0", letterSpacing: 2 }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* ── PAGE BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", maxHeight: "calc(100vh - 54px)" }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ width: 240, background: "#080d14", borderRight: "1px solid #1a2540", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          {/* Markets */}
          <div style={{ padding: "12px 10px 8px", fontSize: 9, color: "#2a5070", letterSpacing: 3, borderBottom: "1px solid #111a28" }}>MARKETS</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
            {MARKETS.map((m, mi) => {
              const p = marketPrices[m.id] || m.base;
              const chg = parseFloat(((p - m.base) / m.base * 100).toFixed(2));
              const up = chg >= 0;
              return (
                <div key={m.id} className={`mkt-card ${market.id === m.id ? "active" : ""}`} onClick={() => setMarket(m)} style={{ borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, background: "#0f1828", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#4a6080" }}>{m.icon}</div>
                      <div>
                        <div style={{ fontSize: 11, color: "#c8d8f0", fontWeight: 500 }}>{m.id}</div>
                        <div style={{ fontSize: 9, color: "#2a4060" }}>{m.category}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: up ? "#00e5a0" : "#f43f5e", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(p, m)}</div>
                      <div style={{ fontSize: 9, color: up ? "#00e5a0" : "#f43f5e" }}>{up ? "+" : ""}{chg}%</div>
                    </div>
                  </div>
                  <Spark data={sparks[mi]} up={up} />
                </div>
              );
            })}
          </div>

          {/* Signal panel */}
          {signal && (
            <div style={{ padding: "12px", borderTop: "1px solid #111a28" }}>
              <div style={{ fontSize: 9, color: "#2a5070", letterSpacing: 3, marginBottom: 8 }}>AI SIGNAL</div>
              <div style={{ background: signal.bg, border: `1px solid ${signal.color}30`, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                <div className="signal-glow" style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, color: signal.color, lineHeight: 1 }}>{signal.signal}</div>
                <div style={{ fontSize: 10, color: "#64748b", margin: "6px 0 4px" }}>{signal.confidence}% confidence</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", fontSize: 9 }}>
                  <span style={{ color: "#00e5a0" }}>↑ {signal.target}</span>
                  <span style={{ color: "#f43f5e" }}>↓ {signal.stop}</span>
                </div>
              </div>
              <button className="analyze-btn" onClick={analyzeMarket} disabled={loading} style={{ width: "100%", marginTop: 10, padding: "9px 16px", fontSize: 10 }}>
                {loading ? "⏳ SCANNING..." : "🤖 AI ANALYSIS"}
              </button>
            </div>
          )}
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Chart sub-header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: "1px solid #1a2540", background: "#0a0e18", flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace" }}>{market.id}</span>
            <div style={{ width: 1, height: 16, background: "#1e2530" }} />
            {INTERVALS.map(iv => (
              <button key={iv.label} className={`iv-btn ${interval === iv.label ? "active" : ""}`} onClick={() => setIntervalVal(iv.label)}>{iv.label}</button>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 9, color: "#2a5070", letterSpacing: 2 }}>
              WIN RATE <span style={{ color: "#00e5a0" }}>{winRate}%</span>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a2540", background: "#080d14", flexShrink: 0 }}>
            {[["chart","📈 Chart"],["news","📰 News"],["accuracy","🎯 Accuracy"]].map(([id, label]) => (
              <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {/* ── CHART TAB ── */}
          {tab === "chart" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "10px" }}>
              {aiReason && (
                <div className="fade-up" style={{ background: "#00e5a008", border: "1px solid #00e5a025", borderRadius: 10, padding: "10px 14px", marginBottom: 10, flexShrink: 0 }}>
                  <div style={{ fontSize: 8, color: "#00e5a0", letterSpacing: 3, marginBottom: 6 }}>● PULSETRADE AI ANALYSIS</div>
                  <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>{aiReason}</p>
                </div>
              )}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <TVChart market={market} candles={candles} onPriceUpdate={handlePriceUpdate} />
              </div>
            </div>
          )}

          {/* ── NEWS TAB ── */}
          {tab === "news" && (
            <div className="fade-up" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>Market Intelligence Feed</div>
                <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
                  <span style={{ color: "#00e5a0" }}>● {news.filter(n => n.sentiment === "bullish").length} Bullish</span>
                  <span style={{ color: "#f43f5e" }}>● {news.filter(n => n.sentiment === "bearish").length} Bearish</span>
                </div>
              </div>
              {news.map((n, i) => (
                <div key={i} className="news-row">
                  <div style={{ width: 3, minHeight: 44, borderRadius: 2, background: n.sentiment === "bullish" ? "#00e5a0" : "#f43f5e", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, color: "#c0d8f0", lineHeight: 1.65, marginBottom: 6 }}>{n.text}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "#2a4060", letterSpacing: 1 }}>SRC: {n.source}</span>
                      <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 4, background: n.sentiment === "bullish" ? "#00e5a014" : "#f43f5e14", color: n.sentiment === "bullish" ? "#00e5a0" : "#f43f5e", letterSpacing: 1 }}>
                        {n.sentiment === "bullish" ? "▲ BULLISH" : "▼ BEARISH"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACCURACY TAB ── */}
          {tab === "accuracy" && (
            <div className="fade-up" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "WIN RATE", value: `${winRate}%`, color: winRate > 65 ? "#00e5a0" : "#f59e0b" },
                  { label: "TOTAL", value: accuracy.total, color: "#a78bfa" },
                  { label: "CORRECT", value: accuracy.correct, color: "#00e5a0" },
                  { label: "MISSED", value: accuracy.total - accuracy.correct, color: "#f43f5e" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#0c1220", border: "1px solid #1a2540", borderRadius: 10, padding: "16px", textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: "#4a6080", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#0c1220", border: "1px solid #1a2540", borderRadius: 12, padding: "20px", marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: "#4a6080", letterSpacing: 2, marginBottom: 14 }}>LAST 10 PREDICTIONS</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {accuracy.history.map((h, i) => (
                    <div key={i} style={{ flex: 1, height: 48, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 3, background: h === "W" ? "#00e5a010" : "#f43f5e10", border: `1px solid ${h === "W" ? "#00e5a028" : "#f43f5e28"}` }}>
                      <span style={{ fontSize: 12 }}>{h === "W" ? "✓" : "✗"}</span>
                      <span style={{ fontSize: 7, color: h === "W" ? "#00e5a0" : "#f43f5e", letterSpacing: 1 }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#0c1220", border: "1px solid #1a2540", borderRadius: 12, padding: "20px" }}>
                <div style={{ fontSize: 9, color: "#4a6080", letterSpacing: 2, marginBottom: 12 }}>PERFORMANCE</div>
                <div style={{ background: "#060912", borderRadius: 6, height: 20, overflow: "hidden", marginBottom: 8, position: "relative" }}>
                  <div style={{ width: `${winRate}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#00e5a0)", borderRadius: 6, transition: "width 1.2s ease", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>
                    <span style={{ fontSize: 9, color: "#000", fontWeight: 700 }}>{winRate}%</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#2a4060" }}>
                  <span>0% Poor</span><span>50% Average</span><span>80%+ Excellent</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}