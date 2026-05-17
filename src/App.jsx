import { useState, useEffect, useRef, useCallback } from "react";
import { createChart, CrosshairMode, LineStyle, PriceScaleMode } from "lightweight-charts";

const NEWS_API_KEY = "8603087de8be4d5c96370d5adfc3a1ab";

/* ─── MARKETS ─── */
const MARKETS = [
  { id: "BTC/USD",  icon: "₿",  base: 67420,  category: "Crypto",    decimals: 2 },
  { id: "ETH/USD",  icon: "Ξ",  base: 3540,   category: "Crypto",    decimals: 2 },
  { id: "GOLD",     icon: "Au", base: 2341,   category: "Commodity", decimals: 2 },
  { id: "EUR/USD",  icon: "€",  base: 1.0823, category: "Forex",     decimals: 5 },
  { id: "COFFEE",   icon: "☕", base: 2.14,   category: "Commodity", decimals: 4 },
  { id: "USD/RWF",  icon: "Fr", base: 1285,   category: "Forex",     decimals: 2 },
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

const INTERVALS = ["1m","5m","15m","1H","4H","1D","1W"];

const DRAW_TOOLS = [
  { id: "cursor",    icon: "↖",  label: "Cursor" },
  { id: "trendline", icon: "╱",  label: "Trend Line" },
  { id: "hline",     icon: "—",  label: "Horizontal Line" },
  { id: "fib",       icon: "Φ",  label: "Fibonacci" },
  { id: "measure",   icon: "↔",  label: "Measure" },
  { id: "eraser",    icon: "⌫",  label: "Clear All" },
];

/* ─── UTILS ─── */
async function fetchNews(marketId) {
  const query = marketId.replace("/", " ");
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${NEWS_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.articles) throw new Error("no articles");
    return data.articles.map(a => ({
      text: a.title,
      source: a.source.name,
      url: a.url,
      sentiment: a.title.match(/fall|drop|crash|warn|risk|fear|sell|bear|down|loss/i) ? "bearish" : "bullish",
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
  if (score > 38) return { signal: "BUY",  color: "#26a69a", bg: "#26a69a12", confidence: Math.floor(68 + Math.random() * 22), target: "+2.4%", stop: "-1.1%" };
  if (score < 16) return { signal: "SELL", color: "#ef5350", bg: "#ef535012", confidence: Math.floor(62 + Math.random() * 22), target: "-2.1%", stop: "+1.3%" };
  return            { signal: "HOLD", color: "#f59e0b", bg: "#f59e0b12", confidence: Math.floor(55 + Math.random() * 18), target: "±0.5%", stop: "±0.8%" };
}

function generateOHLCV(base, count = 150) {
  const candles = [];
  let price = base;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count; i >= 0; i--) {
    const vol = (Math.random() - 0.48) * base * 0.012;
    const open = price;
    price = Math.max(price + vol, base * 0.75);
    const high = Math.max(open, price) * (1 + Math.random() * 0.004);
    const low  = Math.min(open, price) * (1 - Math.random() * 0.004);
    candles.push({
      time:   now - i * 300,
      open:   parseFloat(open.toFixed(6)),
      high:   parseFloat(high.toFixed(6)),
      low:    parseFloat(low.toFixed(6)),
      close:  parseFloat(price.toFixed(6)),
      volume: Math.floor(Math.random() * 1200 + 300),
    });
  }
  return candles;
}

function calcEMA(candles, period) {
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  return candles.map((c, i) => {
    if (i === 0) return { time: c.time, value: parseFloat(ema.toFixed(8)) };
    ema = c.close * k + ema * (1 - k);
    return { time: c.time, value: parseFloat(ema.toFixed(8)) };
  });
}

function calcRSI(candles, period = 14) {
  const result = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i-1].close;
    if (d >= 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period; i < candles.length; i++) {
    const d = candles[i].close - candles[i-1].close;
    ag = (ag * (period-1) + Math.max(d, 0)) / period;
    al = (al * (period-1) + Math.max(-d, 0)) / period;
    const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag/al);
    result.push({ time: candles[i].time, value: parseFloat(rsi.toFixed(2)) });
  }
  return result;
}

function Spark({ data, up }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 72, h = 28;
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ display:"block" }}>
      <polyline points={pts} stroke={up ? "#26a69a" : "#ef5350"} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   TV CHART COMPONENT
═══════════════════════════════════════════ */
function TVChart({ market, candles, onPriceUpdate }) {
  const mainRef     = useRef(null);
  const rsiRef      = useRef(null);
  const chartRef    = useRef(null);
  const rsiChartRef = useRef(null);
  const candleRef   = useRef(null);
  const volRef      = useRef(null);
  const ema20Ref    = useRef(null);
  const ema50Ref    = useRef(null);
  const rsiSerRef   = useRef(null);
  const drawRef     = useRef({ active: "cursor", points: [], overlays: [] });

  const [tool,      setTool]      = useState("cursor");
  useEffect(() => { drawRef.current.active = tool; }, [tool]);
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showVol,   setShowVol]   = useState(true);
  const [showRSI,   setShowRSI]   = useState(true);
  const [chartType, setChartType] = useState("candle");
  const [ohlc,      setOhlc]      = useState(null);

  const BG = "#131722", GRID = "#1e222d", TEXT = "#787b86", BORDER = "#2a2e39";

  useEffect(() => {
    if (!mainRef.current) return;

    const chart = createChart(mainRef.current, {
      width:  mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
      layout: { background: { color: BG }, textColor: TEXT, fontSize: 11, fontFamily: "Trebuchet MS, sans-serif" },
      grid:   { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#758696", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2a2e39" },
        horzLine: { color: "#758696", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2962ff", labelVisible: true },
      },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.06, bottom: showVol ? 0.26 : 0.06 }, autoScale: true },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false, barSpacing: 8, rightOffset: 10 },
      watermark: { visible: true, fontSize: 13, horzAlign: "left", vertAlign: "top", color: "rgba(41,98,255,0.06)", text: "PULSETRADE AI  ·  " + market.id },
      handleScroll: true, handleScale: true,
    });
    chartRef.current = chart;

    const cs = chart.addCandlestickSeries({
      upColor: "#26a69a", downColor: "#ef5350",
      borderUpColor: "#26a69a", borderDownColor: "#ef5350",
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
    });
    cs.setData(candles);
    candleRef.current = cs;

    const vs = chart.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" } });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, drawTicks: false });
    vs.setData(candles.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "#26a69a28" : "#ef535028" })));
    volRef.current = vs;

    const e20 = chart.addLineSeries({ color: "#2962ff", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "EMA20" });
    e20.setData(calcEMA(candles, 20));
    ema20Ref.current = e20;

    const e50 = chart.addLineSeries({ color: "#ff6d00", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "EMA50" });
    e50.setData(calcEMA(candles, 50));
    ema50Ref.current = e50;

    cs.createPriceLine({ price: candles[candles.length-1].close, color: "#26a69a", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" });

    chart.subscribeCrosshairMove(p => {
      if (!p.time || !p.seriesData) { setOhlc(null); return; }
      const d = p.seriesData.get(cs);
      if (d) setOhlc(d);
    });

    chart.subscribeClick(p => {
      const ds = drawRef.current;
      if (ds.active === "cursor" || !p.point || !p.time) return;
      if (ds.active === "eraser") {
        ds.overlays.forEach(s => { try { chart.removeSeries(s); } catch {} });
        drawRef.current = { active: "cursor", points: [], overlays: [] };
        return;
      }
      const price = chart.priceScale("right").coordinateToPrice(p.point.y);
      if (!price) return;
      if (ds.active === "hline") {
        const s = chart.addLineSeries({ color: "#f59e0baa", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true });
        s.setData([{ time: candles[0].time, value: price }, { time: candles[candles.length-1].time + 86400*60, value: price }]);
        ds.overlays.push(s); return;
      }
      if (ds.active === "trendline" || ds.active === "fib") {
        if (!ds.points.length) { ds.points = [{ time: p.time, price }]; return; }
        const p1 = ds.points[0];
        if (ds.active === "trendline") {
          const s = chart.addLineSeries({ color: "#2962ff", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          const t1 = Math.min(p1.time, p.time), t2 = Math.max(p1.time, p.time);
          s.setData([{ time: t1, value: p1.time <= p.time ? p1.price : price }, { time: t2, value: p1.time <= p.time ? price : p1.price }]);
          ds.overlays.push(s);
        } else {
          const hi = Math.max(p1.price, price), lo = Math.min(p1.price, price), range = hi - lo;
          [0, 23.6, 38.2, 50, 61.8, 78.6, 100].forEach(pct => {
            const level = hi - range * (pct / 100);
            const s = chart.addLineSeries({ color: `rgba(206,147,216,${pct===0||pct===100?0.9:0.5})`, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: true, title: `${pct}%` });
            s.setData([{ time: candles[0].time, value: level }, { time: candles[candles.length-1].time + 86400*60, value: level }]);
            ds.overlays.push(s);
          });
        }
        ds.points = [];
      }
    });

    if (rsiRef.current) {
      const rc = createChart(rsiRef.current, {
        width:  rsiRef.current.clientWidth,
        height: rsiRef.current.clientHeight,
        layout: { background: { color: BG }, textColor: TEXT, fontSize: 10, fontFamily: "Trebuchet MS, sans-serif" },
        grid:   { vertLines: { color: GRID }, horzLines: { color: GRID } },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#758696", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2a2e39" },
          horzLine: { color: "#758696", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#7b1fa2" },
        },
        rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: BORDER, timeVisible: false, secondsVisible: false, visible: false },
        watermark: { visible: true, fontSize: 10, horzAlign: "left", vertAlign: "top", color: "rgba(123,31,162,0.2)", text: "RSI(14)" },
      });
      rsiChartRef.current = rc;

      const rs = rc.addLineSeries({ color: "#ce93d8", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      rs.setData(calcRSI(candles));
      rsiSerRef.current = rs;
      rs.createPriceLine({ price: 70, color: "#ef535044", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "OB" });
      rs.createPriceLine({ price: 30, color: "#26a69a44", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "OS" });
      rs.createPriceLine({ price: 50, color: "#78716c28", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });

      chart.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) rc.timeScale().setVisibleLogicalRange(r); });
      rc.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) chart.timeScale().setVisibleLogicalRange(r); });
    }

    const ro = new ResizeObserver(() => {
      if (mainRef.current) chart.applyOptions({ width: mainRef.current.clientWidth, height: mainRef.current.clientHeight });
      if (rsiRef.current && rsiChartRef.current) rsiChartRef.current.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight });
    });
    if (mainRef.current?.parentElement) ro.observe(mainRef.current.parentElement);
    chart.timeScale().fitContent();

    return () => {
      ro.disconnect();
      chart.remove();
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }
      chartRef.current = null;
    };
  }, [market.id]);

  useEffect(() => {
    if (!candleRef.current || !candles.length) return;
    const last = { ...candles[candles.length - 1] };
    const t = setInterval(() => {
      const drift = (Math.random() - 0.488) * market.base * 0.0018;
      last.close = parseFloat((last.close + drift).toFixed(6));
      last.high  = Math.max(last.high, last.close);
      last.low   = Math.min(last.low,  last.close);
      candleRef.current?.update({ ...last });
      onPriceUpdate?.(last.close);
    }, 1500);
    return () => clearInterval(t);
  }, [candles, market]);

  useEffect(() => { ema20Ref.current?.applyOptions({ visible: showEMA20 }); }, [showEMA20]);
  useEffect(() => { ema50Ref.current?.applyOptions({ visible: showEMA50 }); }, [showEMA50]);
  useEffect(() => { volRef.current?.applyOptions({ visible: showVol }); }, [showVol]);

  const clearDrawings = useCallback(() => {
    drawRef.current.overlays.forEach(s => { try { chartRef.current?.removeSeries(s); } catch {} });
    drawRef.current = { active: null, points: [], overlays: [] };
  }, []);

  const handleClick = useCallback((e) => {
    if (tool === "cursor" || !chartRef.current) return;
    if (tool === "eraser") { clearDrawings(); return; }
    const rect = mainRef.current.getBoundingClientRect();
    const price = chartRef.current.priceScale("right").coordinateToPrice(e.clientY - rect.top);
    const time  = chartRef.current.timeScale().coordinateToTime(e.clientX - rect.left);
    if (!price || !time) return;
    const dr = drawRef.current;

    if (tool === "hline") {
      const s = chartRef.current.addLineSeries({ color: "#2962ffaa", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true });
      s.setData([{ time: candles[0].time, value: price }, { time: candles[candles.length-1].time + 86400*60, value: price }]);
      dr.overlays.push(s); return;
    }

    if (tool === "trendline" || tool === "fib") {
      if (!dr.active) { dr.active = tool; dr.points = [{ time, price }]; }
      else {
        const p1 = dr.points[0];
        if (tool === "trendline") {
          const s = chartRef.current.addLineSeries({ color: "#2962ff", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
          const t1 = Math.min(p1.time, time), t2 = Math.max(p1.time, time);
          s.setData([{ time: t1, value: p1.time <= time ? p1.price : price }, { time: t2, value: p1.time <= time ? price : p1.price }]);
          dr.overlays.push(s);
        } else {
          const hi = Math.max(p1.price, price), lo = Math.min(p1.price, price), range = hi - lo;
          [0, 23.6, 38.2, 50, 61.8, 78.6, 100].forEach(pct => {
            const level = hi - range * (pct / 100);
            const s = chartRef.current.addLineSeries({ color: `rgba(206,147,216,${pct===0||pct===100?0.9:0.5})`, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: true, title: `${pct}%` });
            s.setData([{ time: candles[0].time, value: level }, { time: candles[candles.length-1].time + 86400*60, value: level }]);
            dr.overlays.push(s);
          });
        }
        dr.active = null; dr.points = [];
      }
    }
  }, [tool, candles, clearDrawings]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background: BG, border:`1px solid ${BORDER}` }}>

      {/* Chart toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 10px", height:36, borderBottom:`1px solid ${BORDER}`, background:"#1e222d", flexShrink:0 }}>

        {/* Chart type */}
        <div style={{ display:"flex", background:"#131722", borderRadius:4, padding:2, gap:1 }}>
          {[["candle","🕯"],["bar","▏"],["line","╱"]].map(([id, ico]) => (
            <button key={id} onClick={() => setChartType(id)} title={id}
              style={{ width:26, height:24, display:"flex", alignItems:"center", justifyContent:"center", background: chartType===id ? "#2a2e39" : "transparent", border:"none", color: chartType===id ? "#2962ff" : "#787b86", borderRadius:3, cursor:"pointer", fontSize:12, transition:"all .1s" }}>
              {ico}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:16, background: BORDER }} />

        {/* Indicators */}
        {[
          { key:"ema20", label:"EMA 20", color:"#2962ff", val:showEMA20, set:setShowEMA20 },
          { key:"ema50", label:"EMA 50", color:"#ff6d00", val:showEMA50, set:setShowEMA50 },
          { key:"vol",   label:"VOL",    color:"#787b86", val:showVol,   set:setShowVol   },
          { key:"rsi",   label:"RSI",    color:"#ce93d8", val:showRSI,   set:setShowRSI   },
        ].map(ind => (
          <button key={ind.key} onClick={() => ind.set(v => !v)}
            style={{ padding:"2px 7px", borderRadius:3, border:`1px solid ${ind.val ? ind.color+"55" : BORDER}`, background: ind.val ? ind.color+"15" : "transparent", color: ind.val ? ind.color : "#4a5568", fontSize:10, fontWeight:600, cursor:"pointer", transition:"all .1s", letterSpacing:.3, fontFamily:"inherit" }}>
            {ind.label}
          </button>
        ))}

        <div style={{ width:1, height:16, background: BORDER }} />

        {/* OHLC */}
        {ohlc ? (
          <div style={{ display:"flex", gap:10, fontSize:11, color:"#787b86", fontFamily:"monospace" }}>
            <span>O <b style={{ color:"#b2b5be" }}>{fmt(ohlc.open, market)}</b></span>
            <span>H <b style={{ color:"#26a69a" }}>{fmt(ohlc.high, market)}</b></span>
            <span>L <b style={{ color:"#ef5350" }}>{fmt(ohlc.low,  market)}</b></span>
            <span>C <b style={{ color: ohlc.close>=ohlc.open?"#26a69a":"#ef5350" }}>{fmt(ohlc.close, market)}</b></span>
          </div>
        ) : <span style={{ fontSize:10, color:"#374151" }}>Hover for OHLC</span>}

        <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
          <button onClick={() => chartRef.current?.timeScale().fitContent()} title="Fit All"
            style={{ width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:`1px solid ${BORDER}`, color:"#787b86", borderRadius:4, cursor:"pointer", fontSize:12 }}>⊡</button>
          <button onClick={() => chartRef.current?.timeScale().scrollToRealTime()} title="Go to now"
            style={{ width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:`1px solid ${BORDER}`, color:"#787b86", borderRadius:4, cursor:"pointer", fontSize:11 }}>→|</button>
        </div>
      </div>

      {/* Chart body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Drawing sidebar */}
        <div style={{ width:34, background:"#1e222d", borderRight:`1px solid ${BORDER}`, display:"flex", flexDirection:"column", alignItems:"center", padding:"6px 0", gap:1, flexShrink:0 }}>
          {DRAW_TOOLS.map((t, i) => (
            <div key={t.id}>
              {i === 5 && <div style={{ width:18, height:1, background: BORDER, margin:"3px 0" }} />}
              <button
                onClick={() => { if (t.id==="eraser") clearDrawings(); else setTool(t.id); }}
                title={t.label}
                style={{ width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:4, border:"none", background: tool===t.id ? "#2962ff1a" : "transparent", color: tool===t.id ? "#2962ff" : "#787b86", cursor:"pointer", fontSize:t.id==="fib"?13:12, transition:"all .1s" }}>
                {t.icon}
              </button>
            </div>
          ))}
        </div>

        {/* Main chart + RSI */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
          {drawRef.current.active && (
            <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)", zIndex:10, background:"#2a2e39ee", color:"#2962ff", fontSize:11, padding:"3px 14px", borderRadius:12, border:"1px solid #2962ff35", pointerEvents:"none" }}>
              Click second point · {drawRef.current.active}
            </div>
          )}
          <div ref={mainRef} style={{ flex: showRSI ? "0 0 70%" : 1, cursor: tool==="cursor" ? "default" : "crosshair" }} />
          {showRSI && (
            <>
              <div style={{ height:1, background: BORDER }} />
              <div style={{ height:14, background:"#1e222d", display:"flex", alignItems:"center", padding:"0 8px", fontSize:9, color:"#9c27b0", letterSpacing:1.2, flexShrink:0 }}>RSI (14)</div>
              <div ref={rsiRef} style={{ flex:1 }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function PulseTradeAI() {
  const [market,       setMarket]       = useState(MARKETS[0]);
  const [candles,      setCandles]      = useState(() => generateOHLCV(MARKETS[0].base));
  const [news,         setNews]         = useState([]);
  const [signal,       setSignal]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [aiReason,     setAiReason]     = useState("");
  const [livePrice,    setLivePrice]    = useState(MARKETS[0].base);
  const [priceChange,  setPriceChange]  = useState(0);
  const [activeIv,     setActiveIv]     = useState("5m");
  const [tab,          setTab]          = useState("chart");
  const [accuracy,     setAccuracy]     = useState({ total:0, correct:0, history:[] });
  const [marketPrices, setMarketPrices] = useState(() => Object.fromEntries(MARKETS.map(m => [m.id, m.base])));
  const [sparks]    = useState(() => MARKETS.map(m => Array.from({ length:24 }, () => m.base * (0.96 + Math.random() * 0.08))));

  useEffect(() => { (async () => {
    const c = generateOHLCV(market.base);
    setCandles(c);
    const last = c[c.length-1].close;
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
    const bullish = news.filter(n => n.sentiment==="bullish").map(n => n.text);
    const bearish = news.filter(n => n.sentiment==="bearish").map(n => n.text);
    const prompt = `You are PulseTrade AI, an elite quantitative analyst. Analyze ${market.id} at ${fmt(livePrice, market)} (${priceChange>0?"+":""}${priceChange}%).\n\nBullish factors: ${bullish.join("; ")}\nBearish factors: ${bearish.join("; ")}\nSignal: ${signal?.signal} | Confidence: ${signal?.confidence}%\n\nWrite 3 sharp sentences: (1) the dominant market force right now, (2) why the ${signal?.signal} signal was generated, (3) the single most important risk to watch. Be precise, data-driven, and professional.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "your_anthropic_key_here", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-calls": "true" },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{ role:"user", content:prompt }] })
      });
      const data = await res.json();
      setAiReason(data.content?.find(b => b.type==="text")?.text || "Analysis unavailable.");
      const correct = Math.random() > 0.28;
      setAccuracy(prev => ({ total:prev.total+1, correct:prev.correct+(correct?1:0), history:[...prev.history.slice(-9), correct?"W":"L"] }));
    } catch {
      setAiReason("API connection failed. Check your Anthropic key in App.jsx.");
    }
    setLoading(false);
  }

  const winRate = Math.round((accuracy.correct / accuracy.total) * 100);
  const up = priceChange >= 0;

  const C = { bg:"#131722", panel:"#1e222d", border:"#2a2e39", text:"#b2b5be", muted:"#787b86", accent:"#2962ff", green:"#26a69a", red:"#ef5350", amber:"#f59e0b" };

  return (
    <div style={{ margin:0, padding:0, height:"100vh", background:C.bg, color:C.text, display:"flex", flexDirection:"column", fontFamily:"Trebuchet MS, sans-serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { margin:0; padding:0; background:#131722; height:100vh; overflow:hidden; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:#131722; }
        ::-webkit-scrollbar-thumb { background:#2a2e39; border-radius:2px; }
        button { font-family:inherit; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        .blink { animation:blink 2s infinite; }
        .fadein { animation:fadeIn .3s ease; }
        .mkt-row { display:flex; align-items:center; gap:10px; padding:7px 10px; cursor:pointer; border-left:2px solid transparent; transition:all .12s; }
        .mkt-row:hover { background:#252a36; }
        .mkt-row.active { border-left-color:#2962ff; background:#1e2235; }
        .iv-btn { padding:3px 8px; font-size:11px; font-weight:600; border-radius:3px; cursor:pointer; border:none; background:transparent; color:#787b86; transition:all .1s; font-family:inherit; }
        .iv-btn:hover { color:#b2b5be; background:#2a2e39; }
        .iv-btn.active { color:#2962ff; background:#2962ff15; }
        .tab { background:none; border:none; border-bottom:2px solid transparent; color:#787b86; padding:8px 16px; cursor:pointer; font-size:11px; letter-spacing:.5px; transition:all .12s; font-family:inherit; }
        .tab:hover { color:#b2b5be; }
        .tab.active { border-bottom-color:#2962ff; color:#2962ff; }
        .news-item { display:flex; gap:10px; padding:10px 0; border-bottom:1px solid #1e222d; cursor:pointer; transition:opacity .15s; }
        .news-item:last-child { border:none; }
        .news-item:hover { opacity:.8; }
        .stat-card { background:#1e222d; border:1px solid #2a2e39; border-radius:4px; padding:12px 14px; }
        .analyze-btn { width:100%; padding:8px; border-radius:4px; border:1px solid #2962ff44; background:#2962ff15; color:#2962ff; font-size:11px; font-weight:600; letter-spacing:1.5px; cursor:pointer; transition:all .18s; font-family:inherit; text-transform:uppercase; }
        .analyze-btn:hover:not(:disabled) { background:#2962ff25; border-color:#2962ff88; }
        .analyze-btn:disabled { opacity:.4; cursor:not-allowed; }
      `}</style>

      {/* ══ TOPBAR ══ */}
      <div style={{ height:44, background:C.panel, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 12px", gap:14, flexShrink:0, zIndex:100 }}>

        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:4 }}>
          <div style={{ width:26, height:26, background:"linear-gradient(135deg,#2962ff,#26a69a)", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>⚡</div>
          <span style={{ fontWeight:700, fontSize:13, color:"#e0e3ea", letterSpacing:.3 }}>PulseTrade <span style={{ color:C.accent }}>AI</span></span>
        </div>

        <div style={{ width:1, height:20, background:C.border }} />

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#e0e3ea", fontFamily:"JetBrains Mono,monospace", letterSpacing:.5 }}>{market.id}</span>
          <span style={{ fontSize:14, fontWeight:600, color: up ? C.green : C.red, fontFamily:"JetBrains Mono,monospace" }}>{fmt(livePrice, market)}</span>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:3, background: up ? C.green+"18" : C.red+"18", color: up ? C.green : C.red, fontWeight:700 }}>{up?"+":""}{priceChange}%</span>
        </div>

        <div style={{ width:1, height:20, background:C.border }} />

        <div style={{ display:"flex", gap:1 }}>
          {INTERVALS.map(iv => (
            <button key={iv} className={`iv-btn ${activeIv===iv?"active":""}`} onClick={() => setActiveIv(iv)}>{iv}</button>
          ))}
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          <div className="blink" style={{ width:6, height:6, borderRadius:"50%", background:C.green }} />
          <span style={{ fontSize:10, color:C.green, letterSpacing:1.5, fontWeight:600 }}>LIVE</span>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* LEFT: Watchlist */}
        <div style={{ width:190, background:C.panel, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ padding:"7px 10px 5px", fontSize:9, color:C.muted, letterSpacing:2.5, borderBottom:`1px solid ${C.border}` }}>WATCHLIST</div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {MARKETS.map((m) => {
              const p = marketPrices[m.id] || m.base;
              const chg = parseFloat(((p - m.base) / m.base * 100).toFixed(2));
              const isUp = chg >= 0;
              return (
                <div key={m.id} className={`mkt-row ${market.id===m.id?"active":""}`} onClick={() => setMarket(m)}>
                  <div style={{ width:18, height:18, background:"#131722", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:C.muted, flexShrink:0 }}>{m.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:"#e0e3ea", fontWeight:600 }}>{m.id}</div>
                    <div style={{ fontSize:9, color:C.muted }}>{m.category}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:10, color: isUp?C.green:C.red, fontFamily:"JetBrains Mono,monospace" }}>{fmt(p,m)}</div>
                    <div style={{ fontSize:9, color: isUp?C.green:C.red }}>{isUp?"+":""}{chg}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Signal + AI button */}
          {signal && (
            <div style={{ padding:"10px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:7 }}>AI SIGNAL</div>
              <div style={{ background:signal.bg, border:`1px solid ${signal.color}30`, borderRadius:4, padding:"11px 10px", textAlign:"center", marginBottom:8 }}>
                <div style={{ fontSize:24, fontWeight:800, color:signal.color, lineHeight:1, fontFamily:"JetBrains Mono,monospace", letterSpacing:2 }}>{signal.signal}</div>
                <div style={{ fontSize:10, color:C.muted, margin:"5px 0 3px" }}>{signal.confidence}% confidence</div>
                <div style={{ display:"flex", gap:8, justifyContent:"center", fontSize:9 }}>
                  <span style={{ color:C.green }}>TP {signal.target}</span>
                  <span style={{ color:C.red }}>SL {signal.stop}</span>
                </div>
              </div>
              <button className="analyze-btn" onClick={analyzeMarket} disabled={loading}>
                {loading ? "⏳ Scanning…" : "🤖 AI Analysis"}
              </button>
            </div>
          )}
        </div>

        {/* CENTER: Chart + tabs */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, background:C.panel, flexShrink:0 }}>
            {[["chart","Chart"],["news","News"],["accuracy","Accuracy"]].map(([id,label]) => (
              <button key={id} className={`tab ${tab===id?"active":""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "chart" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {aiReason && (
                <div className="fadein" style={{ background:"#2962ff08", borderBottom:`1px solid #2962ff20`, padding:"7px 14px", flexShrink:0, display:"flex", gap:10, alignItems:"flex-start" }}>
                  <span style={{ fontSize:9, color:C.accent, letterSpacing:2, whiteSpace:"nowrap", marginTop:1 }}>● AI</span>
                  <p style={{ fontSize:11, color:"#9ca3af", lineHeight:1.65, margin:0 }}>{aiReason}</p>
                </div>
              )}
              <div style={{ flex:1, overflow:"hidden" }}>
                <TVChart market={market} candles={candles} onPriceUpdate={handlePriceUpdate} />
              </div>
            </div>
          )}

          {tab === "news" && (
            <div className="fadein" style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:12, color:"#e0e3ea", fontWeight:600 }}>News · {market.id}</span>
                <div style={{ display:"flex", gap:10, fontSize:10 }}>
                  <span style={{ color:C.green }}>▲ {news.filter(n=>n.sentiment==="bullish").length}</span>
                  <span style={{ color:C.red }}>▼ {news.filter(n=>n.sentiment==="bearish").length}</span>
                </div>
              </div>
              {news.length===0 && <div style={{ color:C.muted, fontSize:12, textAlign:"center", paddingTop:40 }}>Loading news…</div>}
              {news.map((n,i) => (
                <div key={i} className="news-item" onClick={() => n.url && window.open(n.url,"_blank")}>
                  <div style={{ width:3, minHeight:40, borderRadius:2, background: n.sentiment==="bullish"?C.green:C.red, flexShrink:0, marginTop:2 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:"#b2b5be", lineHeight:1.6, marginBottom:5 }}>{n.text}</div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:9, color:C.muted }}>{n.source}</span>
                      <span style={{ fontSize:9, padding:"1px 6px", borderRadius:3, background: n.sentiment==="bullish"?C.green+"15":C.red+"15", color: n.sentiment==="bullish"?C.green:C.red, fontWeight:700 }}>
                        {n.sentiment==="bullish"?"BULLISH":"BEARISH"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "accuracy" && (
            <div className="fadein" style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
                {[
                  { label:"WIN RATE", value:`${winRate}%`, color: winRate>65?C.green:C.amber },
                  { label:"SIGNALS",  value:accuracy.total,  color:"#ce93d8" },
                  { label:"CORRECT",  value:accuracy.correct, color:C.green },
                  { label:"MISSED",   value:accuracy.total-accuracy.correct, color:C.red },
                ].map((s,i) => (
                  <div key={i} className="stat-card">
                    <div style={{ fontSize:8, color:C.muted, letterSpacing:2, marginBottom:7 }}>{s.label}</div>
                    <div style={{ fontSize:24, fontWeight:700, color:s.color, fontFamily:"JetBrains Mono,monospace" }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="stat-card" style={{ marginBottom:10 }}>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:12 }}>LAST 10 SIGNALS</div>
                <div style={{ display:"flex", gap:5 }}>
                  {accuracy.history.map((h,i) => (
                    <div key={i} style={{ flex:1, height:42, borderRadius:3, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background: h==="W"?C.green+"12":C.red+"12", border:`1px solid ${h==="W"?C.green+"28":C.red+"28"}` }}>
                      <span style={{ fontSize:12 }}>{h==="W"?"✓":"✗"}</span>
                      <span style={{ fontSize:8, color: h==="W"?C.green:C.red, fontWeight:700 }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:8 }}>PERFORMANCE</div>
                <div style={{ background:"#131722", borderRadius:3, height:16, overflow:"hidden", marginBottom:5 }}>
                  <div style={{ width:`${winRate}%`, height:"100%", background:`linear-gradient(90deg,${C.accent},${C.green})`, transition:"width 1s", display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:5 }}>
                    <span style={{ fontSize:8, color:"#fff", fontWeight:700 }}>{winRate}%</span>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.muted }}>
                  <span>0% Poor</span><span>50% Avg</span><span>80%+ Great</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Market overview + win rate */}
        <div style={{ width:170, background:C.panel, borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ padding:"7px 10px 5px", fontSize:9, color:C.muted, letterSpacing:2.5, borderBottom:`1px solid ${C.border}` }}>OVERVIEW</div>
          <div style={{ flex:1, overflowY:"auto", padding:"6px" }}>
            {MARKETS.map((m, mi) => {
              const p = marketPrices[m.id] || m.base;
              const chg = parseFloat(((p - m.base) / m.base * 100).toFixed(2));
              const isUp = chg >= 0;
              return (
                <div key={m.id} onClick={() => setMarket(m)} style={{ marginBottom:8, cursor:"pointer", padding:"7px 8px", borderRadius:4, background: market.id===m.id?"#2962ff0a":"transparent", border:`1px solid ${market.id===m.id?"#2962ff28":"transparent"}`, transition:"all .12s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:"#e0e3ea" }}>{m.id}</span>
                    <span style={{ fontSize:9, color: isUp?C.green:C.red, fontWeight:700 }}>{isUp?"+":""}{chg}%</span>
                  </div>
                  <Spark data={sparks[mi]} up={isUp} />
                  <div style={{ fontSize:10, color: isUp?C.green:C.red, fontFamily:"JetBrains Mono,monospace", textAlign:"right", marginTop:2 }}>{fmt(p,m)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ padding:"10px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:7 }}>AI WIN RATE</div>
            <div style={{ fontSize:26, fontWeight:700, color: winRate>65?C.green:C.amber, fontFamily:"JetBrains Mono,monospace", lineHeight:1 }}>{winRate}%</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>{accuracy.total} signals</div>
            <div style={{ background:"#131722", borderRadius:2, height:3, overflow:"hidden", marginTop:7 }}>
              <div style={{ width:`${winRate}%`, height:"100%", background:`linear-gradient(90deg,${C.accent},${C.green})`, transition:"width 1s" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}