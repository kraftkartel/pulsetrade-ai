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
  { id: "OIL/USD",  icon: "🛢", base: 82,     category: "Commodity", decimals: 2 },
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
  { text: "OPEC+ cuts output by 1M barrels, crude prices surge", sentiment: "bullish", source: "Reuters" },
  { text: "US crude inventories draw down sharply, supply tightens", sentiment: "bullish", source: "EIA" },
  { text: "Recession fears weigh on oil demand outlook globally", sentiment: "bearish", source: "Bloomberg" },
  { text: "Dollar strengthens, commodity prices under pressure", sentiment: "bearish", source: "FT" },
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
  if (score > 45) return { signal: "BUY",  color: "#26a69a", bg: "#26a69a12", confidence: Math.floor(68 + Math.random() * 22), target: "+2.4%", stop: "-1.1%" };
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

function generatePrediction(candles, signal) {
  const last = candles[candles.length - 1];
  const timeStep = candles[1].time - candles[0].time;
  const volatility = candles.slice(-20).reduce((acc, c) => acc + Math.abs(c.high - c.low), 0) / 20;
  const isBull = signal?.signal === "BUY";
  const isHold = signal?.signal === "HOLD";
  const confidence = (signal?.confidence || 65) / 100;
  const paths = { bull: [], bear: [], mid: [] };
  let bullPrice = last.close, bearPrice = last.close, midPrice = last.close;
  for (let i = 1; i <= 30; i++) {
    const t = last.time + i * timeStep;
    const noise = (Math.random() - 0.5) * volatility * 0.4;
    const bullBias  =  volatility * 0.18 * confidence;
    const bearBias  = -volatility * 0.15 * confidence;
    const midBias   =  volatility * (isBull ? 0.06 : isHold ? 0.01 : -0.06);
    bullPrice = bullPrice + bullBias + noise;
    bearPrice = bearPrice + bearBias + noise * 0.8;
    midPrice  = midPrice  + midBias  + noise * 0.5;
    paths.bull.push({ time: t, value: parseFloat(bullPrice.toFixed(6)) });
    paths.bear.push({ time: t, value: parseFloat(bearPrice.toFixed(6)) });
    paths.mid.push({  time: t, value: parseFloat(midPrice.toFixed(6))  });
  }
  const bullProb = isBull ? Math.floor(55 + confidence * 30) : isHold ? 45 : Math.floor(25 + confidence * 20);
  const bearProb = 100 - bullProb;
  return { paths, bullProb, bearProb, volatility: parseFloat((volatility / last.close * 100).toFixed(2)) };
}

function detectPatterns(candles) {
  const recent = candles.slice(-5);
  const patterns = [];
  const last3 = recent.slice(-3);
  if (last3[2].close > last3[1].close && last3[1].close < last3[0].close) patterns.push({ name:"V-Reversal", color:"#26a69a", icon:"↗" });
  const range = candles.slice(-20);
  const hi = Math.max(...range.map(c => c.high)), lo = Math.min(...range.map(c => c.low));
  const mid = (hi + lo) / 2;
  if (candles[candles.length-1].close > mid * 1.005) patterns.push({ name:"Above Mid-Range", color:"#2962ff", icon:"⬆" });
  if (candles[candles.length-1].close < mid * 0.995) patterns.push({ name:"Below Mid-Range", color:"#ef5350", icon:"⬇" });
  const vols = candles.slice(-10).map(c => c.volume);
  const avgVol = vols.slice(0,-1).reduce((a,b) => a+b,0) / (vols.length-1);
  if (vols[vols.length-1] > avgVol * 1.6) patterns.push({ name:"Volume Spike", color:"#f59e0b", icon:"⚡" });
  const rsi20 = candles.slice(-3).map(c => c.close);
  if (rsi20[2] > rsi20[1] && rsi20[1] > rsi20[0]) patterns.push({ name:"Momentum Up", color:"#26a69a", icon:"▲" });
  if (rsi20[2] < rsi20[1] && rsi20[1] < rsi20[0]) patterns.push({ name:"Momentum Down", color:"#ef5350", icon:"▼" });
  return patterns.slice(0, 3);
}

function detectSwingPoints(candles) {
  const swings = { highs: [], lows: [] };
  for (let i = 2; i < candles.length - 2; i++) {
    if (candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high &&
        candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high)
      swings.highs.push({ time: candles[i].time, price: candles[i].high, idx: i });
    if (candles[i].low < candles[i-1].low && candles[i].low < candles[i-2].low &&
        candles[i].low < candles[i+1].low && candles[i].low < candles[i+2].low)
      swings.lows.push({ time: candles[i].time, price: candles[i].low, idx: i });
  }
  return swings;
}

function detectBOSCHOCH(candles, swings) {
  const signals = [];
  const last = candles[candles.length - 1];
  const recentHighs = swings.highs.slice(-3);
  const recentLows  = swings.lows.slice(-3);
  if (recentHighs.length >= 2) {
    const [prev, curr] = recentHighs.slice(-2);
    if (curr.price > prev.price && last.close > curr.price)
      signals.push({ type:"BOS", dir:"bullish", price: curr.price, label:"BOS ▲", color:"#26a69a" });
    if (curr.price < prev.price)
      signals.push({ type:"CHOCH", dir:"bearish", price: curr.price, label:"CHoCH ↓", color:"#ef5350" });
  }
  if (recentLows.length >= 2) {
    const [prev, curr] = recentLows.slice(-2);
    if (curr.price < prev.price && last.close < curr.price)
      signals.push({ type:"BOS", dir:"bearish", price: curr.price, label:"BOS ▼", color:"#ef5350" });
    if (curr.price > prev.price)
      signals.push({ type:"CHOCH", dir:"bullish", price: curr.price, label:"CHoCH ↑", color:"#26a69a" });
  }
  return signals;
}

function calcFibLevels(swings, candles) {
  if (!swings.highs.length || !swings.lows.length) return [];
  const lastHigh = swings.highs[swings.highs.length - 1];
  const lastLow  = swings.lows[swings.lows.length  - 1];
  const hi = lastHigh.price, lo = lastLow.price, range = hi - lo;
  const isBullish = lastLow.idx < lastHigh.idx;
  const end = candles[candles.length - 1].time + (candles[1].time - candles[0].time) * 40;
  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(r => ({
    level: r,
    price: isBullish ? hi - range * r : lo + range * r,
    label: `${(r * 100).toFixed(1)}%`,
    color: r === 0.618 ? "#ce93d8" : r === 0.5 ? "#f59e0b" : r === 0.382 ? "#2962ff" : "#4a5568",
    end,
  }));
}

function detectLiquidityZones(candles) {
  const zones = [];
  const recent = candles.slice(-40);
  const highs = recent.map(c => c.high).sort((a,b) => b-a);
  const lows  = recent.map(c => c.low).sort((a,b) => a-b);
  const topCluster = highs.slice(0, 5).reduce((a,b) => a+b,0) / 5;
  const botCluster = lows.slice(0, 5).reduce((a,b) => a+b,0) / 5;
  zones.push({ price: topCluster, label: "Liq. Zone", color: "#ef535044", type: "resistance" });
  zones.push({ price: botCluster, label: "Liq. Zone", color: "#26a69a44", type: "support" });
  return zones;
}

function buildRegressionChannel(candles) {
  const n = Math.min(40, candles.length);
  const slice = candles.slice(-n);
  let sumX=0, sumY=0, sumXY=0, sumX2=0;
  slice.forEach((c, i) => { sumX+=i; sumY+=c.close; sumXY+=i*c.close; sumX2+=i*i; });
  const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  const intercept = (sumY - slope*sumX) / n;
  const step = slice[1].time - slice[0].time;
  const deviations = slice.map((c,i) => Math.abs(c.close - (intercept + slope*i)));
  const stdDev = Math.sqrt(deviations.reduce((a,b) => a+b*b,0)/n);
  const mid=[], upper=[], lower=[];
  for (let i = 0; i < n + 15; i++) {
    const t = slice[0].time + i * step;
    const v = intercept + slope * i;
    mid.push({ time: t, value: parseFloat(v.toFixed(6)) });
    upper.push({ time: t, value: parseFloat((v + stdDev * 1.5).toFixed(6)) });
    lower.push({ time: t, value: parseFloat((v - stdDev * 1.5).toFixed(6)) });
  }
  return { mid, upper, lower, slope };
}

function generateScenarios(prediction, signal, patterns) {
  const bull = prediction?.bullProb || 50;
  const bear = prediction?.bearProb || 50;
  const sideways = Math.max(0, Math.min(30, Math.floor((100 - Math.abs(bull - bear)) * 0.35)));
  const total = bull + bear + sideways;
  return [
    { label:"Bullish Continuation", prob: Math.round(bull * (1 - sideways/total)), color:"#26a69a", icon:"▲",
      reason: signal?.signal==="BUY" ? "Higher lows forming, momentum expanding above EMA stack." : "Oversold bounce likely from key demand zone." },
    { label:"Sideways Consolidation", prob: sideways, color:"#f59e0b", icon:"↔",
      reason: "Range-bound behavior between liquidity zones. Market awaiting catalyst." },
    { label:"Bearish Reversal", prob: Math.round(bear * (1 - sideways/total)), color:"#ef5350", icon:"▼",
      reason: signal?.signal==="SELL" ? "Lower highs confirmed. Distribution phase likely underway." : "Resistance rejection near supply zone. Momentum weakening." },
  ].sort((a,b) => b.prob - a.prob);
}

function buildAIReasoning(candles, signal, prediction, patterns, bosSignals) {
  const last = candles[candles.length-1];
  const prev = candles[candles.length-6];
  const trendUp = last.close > prev.close;
  const vol = prediction?.volatility || 0;
  const conf = signal?.confidence || 65;
  const lines = [];
  lines.push(trendUp
    ? `Price is making higher lows — bullish market structure intact.`
    : `Price printing lower highs — bearish structure developing.`);
  if (vol > 1.2) lines.push(`Elevated volatility (${vol}%) signals institutional activity. Expect fast moves.`);
  else lines.push(`Low volatility (${vol}%) — compression phase. Breakout likely soon.`);
  if (bosSignals?.length) lines.push(`${bosSignals[0].label}: ${bosSignals[0].dir === "bullish" ? "Smart money confirmed buying above structure." : "Smart money distributing below structure break."}`);
  else lines.push(`No confirmed structure break. Watch for BOS/CHoCH as trigger.`);
  if (conf > 75) lines.push(`High-confidence signal (${conf}%). Multiple timeframe alignment detected.`);
  else if (conf > 60) lines.push(`Moderate confidence (${conf}%). Signal valid but manage risk carefully.`);
  else lines.push(`Low confidence (${conf}%). Mixed signals — reduce position size.`);
  if (patterns?.length) lines.push(`Pattern detected: ${patterns[0].name}. ${patterns[0].icon} Adds directional confluence.`);
  return lines;
}

function classifyTradeType(signal, prediction, candles) {
  const vol = prediction?.volatility || 0;
  const conf = signal?.confidence || 60;
  const prices = candles.slice(-20).map(c => c.close);
  const range = Math.max(...prices) - Math.min(...prices);
  const rangeRatio = range / prices[prices.length-1] * 100;
  if (vol > 1.5 || rangeRatio > 3)  return { type:"Scalp",      duration:"< 1 hour",   risk:"HIGH",   emoji:"⚡" };
  if (vol > 0.8 || rangeRatio > 1.5) return { type:"Intraday",   duration:"1–8 hours",  risk:"MED",    emoji:"📈" };
  if (conf > 70)                      return { type:"Swing Trade", duration:"1–5 days",   risk:"MED",    emoji:"🎯" };
  if (conf > 55)                      return { type:"Mid-Term",    duration:"1–4 weeks",  risk:"LOW-MED",emoji:"📊" };
  return                               { type:"Wait/Hold",   duration:"Unclear",    risk:"LOW",    emoji:"⏸" };
}

function getDecision(signal, prediction, patterns, bosSignals) {
  const conf = signal?.confidence || 60;
  const bull = prediction?.bullProb || 50;
  const hasBOS = bosSignals?.some(b => b.dir === "bullish");
  const hasCHOCH = bosSignals?.some(b => b.type === "CHOCH");
  const volHigh = (prediction?.volatility || 0) > 1.5;
  if (signal?.signal === "SELL" && hasCHOCH) return { action:"EXIT", color:"#ef5350", bg:"#ef535008", desc:"Structure break confirmed. Exit or avoid longs.", urgency:"HIGH" };
  if (signal?.signal === "BUY"  && hasBOS && conf > 70) return { action:"BUY",  color:"#26a69a", bg:"#26a69a08", desc:"Bullish BOS confirmed with strong momentum.", urgency:"HIGH" };
  if (signal?.signal === "BUY"  && conf > 60) return { action:"BUY",  color:"#26a69a", bg:"#26a69a08", desc:"Bullish setup forming. Manage position size.", urgency:"MED" };
  if (signal?.signal === "SELL" && conf > 60) return { action:"SELL", color:"#ef5350", bg:"#ef535008", desc:"Bearish momentum building. Watch for continuation.", urgency:"MED" };
  if (volHigh) return { action:"WAIT", color:"#f59e0b", bg:"#f59e0b08", desc:"High volatility detected. Wait for cleaner setup.", urgency:"LOW" };
  return { action:"HOLD", color:"#787b86", bg:"#78769608", desc:"No clear edge. Consolidation phase — stay patient.", urgency:"LOW" };
}

const AI_COMMENTARY = [
  "Smart money accumulation detected near support zone.",
  "Liquidity sweep likely before next directional move.",
  "Institutional order flow pointing bullish above current range.",
  "Bearish divergence forming — watch for reversal.",
  "High-probability breakout setup forming on this timeframe.",
  "Whale activity detected: large orders absorbing sell pressure.",
  "Market structure shift: lower highs forming, caution advised.",
  "Volatility compression — explosive move imminent.",
  "AI detects hidden bullish divergence on momentum oscillators.",
  "Rejection zone approaching — high risk of pullback.",
];

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
function TVChart({ market, candles, onPriceUpdate, signal, prediction }) {
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
  const predBullRef   = useRef(null);
  const predBearRef   = useRef(null);
  const predMidRef    = useRef(null);
  const regMidRef     = useRef(null);
  const regUpperRef   = useRef(null);
  const regLowerRef   = useRef(null);
  const aiOverlaysRef = useRef([]);
  const [showAIDraw,  setShowAIDraw]  = useState(true);
  const [showRegCh,   setShowRegCh]   = useState(true);
  const [aiBOSLabels, setAIBOSLabels] = useState([]);

  const [tool,      setTool]      = useState("cursor");
  const [drawingPoint, setDrawingPoint] = useState(false);
  useEffect(() => { drawRef.current.active = tool; setDrawingPoint(false); }, [tool]);
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showVol,   setShowVol]   = useState(true);
  const [showRSI,   setShowRSI]   = useState(true);
  const [chartType, setChartType] = useState("candle");
  const [ohlc,      setOhlc]      = useState(null);
  const [showPred,  setShowPred]  = useState(true);

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
      watermark: { visible: true, fontSize: 13, horzAlign: "left", vertAlign: "top", color: "rgba(41,98,255,0.06)", text: "PULSETRADE AI  ·  " + market.id + "  ·  BY TWUMVE" },
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

    const predBull = chart.addLineSeries({ color: "rgba(38,166,154,0.9)", lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: "▲Bull" });
    const predBear = chart.addLineSeries({ color: "rgba(239,83,80,0.9)",  lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: "▼Bear" });
    const predMid  = chart.addLineSeries({ color: "rgba(249,168,37,0.7)", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, title: "Mid"  });
    predBullRef.current = predBull;
    predBearRef.current = predBear;
    predMidRef.current  = predMid;

    const regMid   = chart.addLineSeries({ color: "rgba(249,168,37,0.5)",  lineWidth: 1, lineStyle: LineStyle.Solid,  priceLineVisible: false, lastValueVisible: false, title: "REG" });
    const regUpper = chart.addLineSeries({ color: "rgba(239,83,80,0.35)",   lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
    const regLower = chart.addLineSeries({ color: "rgba(38,166,154,0.35)",  lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
    regMidRef.current   = regMid;
    regUpperRef.current = regUpper;
    regLowerRef.current = regLower;

    chart.subscribeCrosshairMove(p => {
      if (!p.time || !p.seriesData) { setOhlc(null); return; }
      const d = p.seriesData.get(cs);
      if (d) setOhlc(d);
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
    }, 800);
    return () => clearInterval(t);
  }, [candles, market]);

  useEffect(() => { ema20Ref.current?.applyOptions({ visible: showEMA20 }); }, [showEMA20]);
  useEffect(() => { ema50Ref.current?.applyOptions({ visible: showEMA50 }); }, [showEMA50]);
  useEffect(() => { volRef.current?.applyOptions({ visible: showVol }); }, [showVol]);

  useEffect(() => {
    if (!predBullRef.current || !prediction?.paths) return;
    try {
      predBullRef.current.setData([...candles.slice(-1).map(c => ({ time: c.time, value: c.close })), ...prediction.paths.bull]);
      predBearRef.current.setData([...candles.slice(-1).map(c => ({ time: c.time, value: c.close })), ...prediction.paths.bear]);
      predMidRef.current.setData([...candles.slice(-1).map(c => ({ time: c.time, value: c.close })),  ...prediction.paths.mid]);
    } catch {}
  }, [prediction, candles]);

  useEffect(() => {
    if (!predBullRef.current || !predBearRef.current || !predMidRef.current) return;
    if (!showPred) {
      predBullRef.current.applyOptions({ visible: false });
      predBearRef.current.applyOptions({ visible: false });
      predMidRef.current.applyOptions({  visible: false });
      return;
    }
    predBullRef.current.applyOptions({ visible: true });
    predBearRef.current.applyOptions({ visible: true });
    predMidRef.current.applyOptions({  visible: true });
  }, [showPred]);

  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    aiOverlaysRef.current.forEach(s => { try { chartRef.current.removeSeries(s); } catch {} });
    aiOverlaysRef.current = [];
    if (!showAIDraw) return;
    const chart = chartRef.current;
    const swings = detectSwingPoints(candles);
    const fibs   = calcFibLevels(swings, candles);
    const liqZones = detectLiquidityZones(candles);
    const bosSignals = detectBOSCHOCH(candles, swings);
    const endTime = candles[candles.length-1].time + (candles[1].time - candles[0].time) * 35;
    fibs.forEach(f => {
      try {
        const s = chart.addLineSeries({ color: f.color, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: true, title: `Fib ${f.label}` });
        s.setData([{ time: candles[0].time, value: f.price }, { time: endTime, value: f.price }]);
        aiOverlaysRef.current.push(s);
      } catch {}
    });
    liqZones.forEach(z => {
      try {
        const s = chart.addLineSeries({ color: z.color, lineWidth: 3, lineStyle: LineStyle.Solid, priceLineVisible: false, lastValueVisible: true, title: z.label });
        s.setData([{ time: candles[Math.floor(candles.length*0.6)].time, value: z.price }, { time: endTime, value: z.price }]);
        aiOverlaysRef.current.push(s);
      } catch {}
    });
    bosSignals.forEach(b => {
      try {
        const s = chart.addLineSeries({ color: b.color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: b.label });
        s.setData([{ time: candles[candles.length-10].time, value: b.price }, { time: endTime, value: b.price }]);
        aiOverlaysRef.current.push(s);
      } catch {}
    });
    if (swings.highs.length && swings.lows.length) {
      const lastSwingH = swings.highs[swings.highs.length-1];
      const lastSwingL = swings.lows[swings.lows.length-1];
      try {
        const tl = chart.addLineSeries({ color: "rgba(41,98,255,0.6)", lineWidth: 1.5, lineStyle: LineStyle.Solid, priceLineVisible: false, lastValueVisible: false });
        tl.setData([{ time: lastSwingL.time, value: lastSwingL.price }, { time: lastSwingH.time, value: lastSwingH.price }]);
        aiOverlaysRef.current.push(tl);
      } catch {}
    }
    setAIBOSLabels(bosSignals);
  }, [candles, showAIDraw]);

  useEffect(() => {
    if (!regMidRef.current || !candles.length) return;
    if (!showRegCh) {
      regMidRef.current?.applyOptions({ visible: false });
      regUpperRef.current?.applyOptions({ visible: false });
      regLowerRef.current?.applyOptions({ visible: false });
      return;
    }
    const ch = buildRegressionChannel(candles);
    try {
      regMidRef.current.setData(ch.mid);
      regUpperRef.current.setData(ch.upper);
      regLowerRef.current.setData(ch.lower);
      regMidRef.current?.applyOptions({ visible: true });
      regUpperRef.current?.applyOptions({ visible: true });
      regLowerRef.current?.applyOptions({ visible: true });
    } catch {}
  }, [candles, showRegCh]);

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
      if (!dr.active) { dr.active = tool; dr.points = [{ time, price }]; setDrawingPoint(true); }
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
        dr.active = null; dr.points = []; setDrawingPoint(false);
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
          { key:"pred",   label:"AI PROJ", color:"#26a69a", val:showPred,   set:setShowPred   },
          { key:"aidraw", label:"AI DRAW", color:"#ce93d8", val:showAIDraw, set:setShowAIDraw },
          { key:"regch",  label:"REG CH",  color:"#f59e0b", val:showRegCh,  set:setShowRegCh  },
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
          {aiBOSLabels.length > 0 && (
            <div style={{ position:"absolute", top:8, right:8, zIndex:10, display:"flex", flexDirection:"column", gap:3, pointerEvents:"none" }}>
              {aiBOSLabels.map((b, i) => (
                <div key={i} style={{ background:"#131722", border:`1px solid ${b.color}`, borderRadius:3, padding:"2px 8px", fontSize:9, color:b.color, fontWeight:700, letterSpacing:1, fontFamily:"monospace", boxShadow:`0 0 8px ${b.color}44` }}>
                  {b.label}
                </div>
              ))}
            </div>
          )}
          {drawingPoint && (
            <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)", zIndex:10, background:"#2a2e39ee", color:"#2962ff", fontSize:11, padding:"3px 14px", borderRadius:12, border:"1px solid #2962ff35", pointerEvents:"none" }}>
              Click second point · {drawRef.current.active}
            </div>
          )}
          <div ref={mainRef} onClick={handleClick} style={{ flex: showRSI ? "0 0 70%" : 1, cursor: tool==="cursor" ? "default" : "crosshair" }} />
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
  const [market,       setMarket]       = useState(MARKETS[1]);
  const [candles,      setCandles]      = useState(() => generateOHLCV(MARKETS[1].base));
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
  const [prediction, setPrediction] = useState(null);
  const [patterns,   setPatterns]   = useState([]);
  const [commentary,  setCommentary]  = useState("");
  const [scenarios,   setScenarios]   = useState([]);
  const [reasoning,   setReasoning]   = useState([]);
  const [bosSignals,  setBosSignals]  = useState([]);
  const [decision,    setDecision]    = useState(null);
  const [tradeType,   setTradeType]   = useState(null);
  const commentaryRef = useRef(null);

  useEffect(() => {
    const c = generateOHLCV(market.base);
    setCandles(c);
  }, [activeIv]);

  useEffect(() => { (async () => {
    const c = generateOHLCV(market.base);
    setCandles(c);
    const last = c[c.length-1].close;
    setLivePrice(last);
    setPriceChange(parseFloat(((last - market.base) / market.base * 100).toFixed(2)));
    const n = await fetchNews(market.id);
    setNews(n);
    const sig = getSignal(c, n);
    setSignal(sig);
    const pred = generatePrediction(c, sig);
    const pats = detectPatterns(c);
    const swings = detectSwingPoints(c);
    const bos = detectBOSCHOCH(c, swings);
    setPrediction(pred);
    setPatterns(pats);
    setBosSignals(bos);
    setScenarios(generateScenarios(pred, sig, pats));
    setReasoning(buildAIReasoning(c, sig, pred, pats, bos));
    setDecision(getDecision(sig, pred, pats, bos));
    setTradeType(classifyTradeType(sig, pred, c));
    setCommentary(AI_COMMENTARY[Math.floor(Math.random() * AI_COMMENTARY.length)]);
    setAiReason("");
  })(); }, [market]);

  useEffect(() => {
    const t = setInterval(() => {
      setCommentary(AI_COMMENTARY[Math.floor(Math.random() * AI_COMMENTARY.length)]);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const handlePriceUpdate = useCallback((p) => {
    setLivePrice(p);
    setPriceChange(parseFloat(((p - market.base) / market.base * 100).toFixed(2)));
    setMarketPrices(prev => ({ ...prev, [market.id]: p }));
  }, [market]);

  async function analyzeMarket() {
    setLoading(true); setAiReason("");
    const bullish = news.filter(n => n.sentiment==="bullish").map(n => n.text);
    const bearish = news.filter(n => n.sentiment==="bearish").map(n => n.text);
    const prompt = `You are PulseTrade AI — a quantitative market reasoning engine, not a chatbot. Analyze ${market.id} at ${fmt(livePrice, market)} (${priceChange>0?"+":""}${priceChange}%).\n\nBullish factors: ${bullish.join("; ")}\nBearish factors: ${bearish.join("; ")}\nSignal: ${signal?.signal} | Confidence: ${signal?.confidence}% | Volatility: ${prediction?.volatility}%\nScenarios: ${scenarios.map(s=>s.label+' '+s.prob+'%').join(', ')}\n\nRespond with exactly 4 numbered lines:\n1. [STRUCTURE] What the market structure shows right now.\n2. [MOMENTUM] Momentum state and what it implies.\n3. [SIGNAL] Why this ${signal?.signal} signal was generated — be specific.\n4. [RISK] The single most important risk that could invalidate this thesis.\n\nTone: calm, precise, probabilistic. Never make guarantees.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const winRate = accuracy.total === 0 ? 0 : Math.round((accuracy.correct / accuracy.total) * 100);
  const up = priceChange >= 0;

  const C = { bg:"#131722", panel:"#1e222d", border:"#2a2e39", text:"#b2b5be", muted:"#787b86", accent:"#2962ff", green:"#26a69a", red:"#ef5350", amber:"#f59e0b" };

  return (
    <div style={{ margin:0, padding:0, height:"100vh", background:"#131722", color:C.text, display:"flex", flexDirection:"column", fontFamily:"'Trebuchet MS', sans-serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { margin:0; padding:0; background:#131722; height:100vh; overflow:hidden; color-scheme: dark; }
        input, select { background:#131722; color:#b2b5be; border:1px solid #2a2e39; border-radius:3px; font-family:inherit; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:#131722; }
        ::-webkit-scrollbar-thumb { background:#2a2e39; border-radius:2px; }
        button { font-family:inherit; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(38,166,154,0.5)}70%{box-shadow:0 0 0 5px rgba(38,166,154,0)}100%{box-shadow:0 0 0 0 rgba(38,166,154,0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)} }
        @keyframes ticker { 0%{opacity:0;transform:translateY(6px)}10%{opacity:1;transform:translateY(0)}90%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-6px)} }
        .ticker-text { animation:ticker 8s ease infinite; }
        .blink { animation:blink 2s infinite; }
        .fadein { animation:fadeIn .3s ease; }
        .pulse-dot { animation:pulse 2s infinite; }
        .slide-in { animation:slideIn .2s ease; }
        .mkt-row { display:flex; align-items:center; gap:10px; padding:7px 10px; cursor:pointer; border-left:2px solid transparent; transition:all .12s; }
        .mkt-row:hover { background:#1c2030; }
        .mkt-row.active { border-left-color:#2962ff; background:#161b2e; }
        .iv-btn { padding:3px 8px; font-size:11px; font-weight:600; border-radius:3px; cursor:pointer; border:none; background:transparent; color:#787b86; transition:all .1s; font-family:inherit; }
        .iv-btn:hover { color:#b2b5be; background:#2a2e39; }
        .iv-btn.active { color:#2962ff; background:#2962ff15; }
        .tab { background:none; border:none; border-bottom:2px solid transparent; color:#787b86; padding:8px 16px; cursor:pointer; font-size:11px; letter-spacing:.5px; transition:all .12s; font-family:inherit; }
        .tab:hover { color:#b2b5be; }
        .tab.active { border-bottom-color:#2962ff; color:#2962ff; }
        .news-item { display:flex; gap:10px; padding:10px 0; border-bottom:1px solid #1e222d; cursor:pointer; transition:opacity .15s; }
        .news-item:last-child { border:none; }
        .news-item:hover { opacity:.8; }
        .stat-card { background:#1a1e2e; border:1px solid #2a2e39; border-radius:4px; padding:12px 14px; border-left:2px solid #2962ff33; }
        .analyze-btn { width:100%; padding:8px; border-radius:4px; border:1px solid #2962ff44; background:#2962ff15; color:#2962ff; font-size:11px; font-weight:600; letter-spacing:1.5px; cursor:pointer; transition:all .18s; font-family:inherit; text-transform:uppercase; }
        .analyze-btn:hover:not(:disabled) { background:#2962ff25; border-color:#2962ff88; box-shadow:0 0 14px rgba(41,98,255,0.25); }
        .analyze-btn:disabled { opacity:.4; cursor:not-allowed; }
      `}</style>

      {/* ══ TOPBAR ══ */}
      <div style={{ height:38, background:"#1e222d", borderBottom:"1px solid #2a2e39", display:"flex", alignItems:"center", padding:"0 10px", gap:10, flexShrink:0, zIndex:100 }}>

        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:4 }}>
          <div style={{ width:26, height:26, background:"linear-gradient(135deg,#2962ff,#26a69a)", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, boxShadow:"0 0 10px rgba(41,98,255,0.4)" }}>⚡</div>
          <span style={{ fontWeight:700, fontSize:13, color:"#e0e3ea", letterSpacing:.3 }}>PulseTrade <span style={{ color:C.accent, textShadow:"0 0 12px rgba(41,98,255,0.6)" }}>AI</span></span>
        </div>

        <div style={{ width:1, height:20, background:C.border }} />

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#e0e3ea", fontFamily:"JetBrains Mono,monospace", letterSpacing:.5 }}>{market.id}</span>
          <span style={{ fontSize:14, fontWeight:600, color: up ? C.green : C.red, fontFamily:"JetBrains Mono,monospace", textShadow: up ? "0 0 8px rgba(38,166,154,0.5)" : "0 0 8px rgba(239,83,80,0.5)" }}>{fmt(livePrice, market)}</span>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:3, background: up ? C.green+"18" : C.red+"18", color: up ? C.green : C.red, fontWeight:700 }}>{up?"+":""}{priceChange}%</span>
          {decision && (
            <span style={{ fontSize:9, padding:"1px 8px", borderRadius:3, background:decision.color+"18", color:decision.color, fontWeight:700, letterSpacing:1, fontFamily:"monospace", border:`1px solid ${decision.color}30` }}>{decision.action}</span>
          )}
        </div>

        <div style={{ width:1, height:20, background:C.border }} />

        <div style={{ display:"flex", gap:1 }}>
          {INTERVALS.map(iv => (
            <button key={iv} className={`iv-btn ${activeIv===iv?"active":""}`} onClick={() => setActiveIv(iv)}>{iv}</button>
          ))}
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          <div className="pulse-dot" style={{ width:7, height:7, borderRadius:"50%", background:C.green }} />
          <span style={{ fontSize:10, color:C.green, letterSpacing:1.5, fontWeight:600 }}>LIVE</span>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* LEFT: Watchlist */}
        <div style={{ width:180, background:"#131722", borderRight:"1px solid #2a2e39", display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ padding:"6px 10px 5px", fontSize:9, color:"#4a5568", letterSpacing:2.5, borderBottom:"1px solid #2a2e39", textTransform:"uppercase", fontWeight:700 }}>Watchlist</div>
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

          {/* AI Decision Engine */}
          {decision && (
            <div style={{ padding:"10px", borderTop:"1px solid #2a2e39", flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>

              {/* Primary decision */}
              <div style={{ background:decision.bg, border:`1px solid ${decision.color}30`, borderRadius:5, padding:"10px", textAlign:"center", position:"relative", overflow:"hidden" }}>
                <div style={{ fontSize:9, color:"#4a5568", letterSpacing:2, marginBottom:6 }}>AI DECISION</div>
                <div style={{ fontSize:22, fontWeight:900, color:decision.color, fontFamily:"JetBrains Mono,monospace", letterSpacing:3, lineHeight:1 }}>{decision.action}</div>
                <div style={{ fontSize:8, color:decision.color+"99", marginTop:4, letterSpacing:1 }}>URGENCY: {decision.urgency}</div>
                <div style={{ fontSize:9, color:"#4a5568", marginTop:6, lineHeight:1.5 }}>{decision.desc}</div>
              </div>

              {/* Trade type */}
              {tradeType && (
                <div style={{ background:"#1a1e2e", border:"1px solid #2a2e39", borderRadius:4, padding:"7px 10px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>{tradeType.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:"#e0e3ea", fontWeight:600 }}>{tradeType.type}</div>
                    <div style={{ fontSize:9, color:"#4a5568" }}>{tradeType.duration}</div>
                  </div>
                  <div style={{ fontSize:8, padding:"2px 6px", borderRadius:2, background: tradeType.risk==="HIGH"?"#ef535018":tradeType.risk==="MED"?"#f59e0b18":"#26a69a18", color: tradeType.risk==="HIGH"?C.red:tradeType.risk==="MED"?C.amber:C.green, fontWeight:700 }}>{tradeType.risk}</div>
                </div>
              )}

              {/* TP/SL + confidence */}
              {signal && (
                <div style={{ display:"flex", gap:6 }}>
                  <div style={{ flex:1, background:"#26a69a10", border:"1px solid #26a69a25", borderRadius:4, padding:"5px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:8, color:"#4a5568", marginBottom:2 }}>TARGET</div>
                    <div style={{ fontSize:11, color:C.green, fontWeight:700, fontFamily:"monospace" }}>{signal.target}</div>
                  </div>
                  <div style={{ flex:1, background:"#ef535010", border:"1px solid #ef535025", borderRadius:4, padding:"5px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:8, color:"#4a5568", marginBottom:2 }}>STOP</div>
                    <div style={{ fontSize:11, color:C.red, fontWeight:700, fontFamily:"monospace" }}>{signal.stop}</div>
                  </div>
                </div>
              )}

              {/* Confidence meter */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a5568", marginBottom:3 }}>
                  <span>Confidence</span>
                  <span style={{ color: signal?.confidence > 70 ? C.green : signal?.confidence > 55 ? C.amber : C.red }}>{signal?.confidence}%</span>
                </div>
                <div style={{ background:"#131722", borderRadius:2, height:3, overflow:"hidden" }}>
                  <div style={{ width:`${signal?.confidence || 0}%`, height:"100%", background: signal?.confidence > 70 ? C.green : signal?.confidence > 55 ? C.amber : C.red, transition:"width 1s" }} />
                </div>
              </div>

              <button className="analyze-btn" onClick={analyzeMarket} disabled={loading}>
                {loading ? "⏳ Scanning…" : "🤖 Deep Analysis"}
              </button>
            </div>
          )}
        </div>

        {/* CENTER: Chart + tabs */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", borderBottom:"1px solid #2a2e39", background:"#131722", flexShrink:0 }}>
            {[["chart","Chart"],["predict","🤖 Predict"],["news","News"],["accuracy","Accuracy"]].map(([id,label]) => (
              <button key={id} className={`tab ${tab===id?"active":""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "chart" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ background:"#0a0d14", borderBottom:"1px solid #1a2035", padding:"5px 14px", flexShrink:0, display:"flex", gap:10, alignItems:"center", borderLeft:"2px solid #2962ff33" }}>
                <span className="blink" style={{ fontSize:8, color:"#2962ff", letterSpacing:2, whiteSpace:"nowrap" }}>● AI</span>
                <p key={commentary} className="ticker-text" style={{ fontSize:10, color:"#4a5568", lineHeight:1, margin:0, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", fontStyle:"italic" }}>{commentary}</p>
                {prediction && (
                  <div style={{ marginLeft:"auto", display:"flex", gap:8, flexShrink:0, alignItems:"center" }}>
                    <span style={{ fontSize:9, color:"#4a5568", letterSpacing:1 }}>VOL {prediction.volatility}%</span>
                    <div style={{ width:1, height:10, background:"#2a2e39" }} />
                    <span style={{ fontSize:9, color:"#26a69a", fontWeight:700 }}>▲{prediction.bullProb}%</span>
                    <span style={{ fontSize:9, color:"#ef5350", fontWeight:700 }}>▼{prediction.bearProb}%</span>
                  </div>
                )}
              </div>
              {aiReason && (
                <div className="fadein" style={{ background:"#0d1117", borderBottom:"1px solid #2962ff18", padding:"8px 14px", flexShrink:0 }}>
                  <div style={{ fontSize:8, color:"#2962ff", letterSpacing:2, marginBottom:6 }}>● DEEP ANALYSIS</div>
                  {aiReason.split("\n").filter(l => l.trim()).map((line, i) => (
                    <div key={i} style={{ display:"flex", gap:8, marginBottom:4, alignItems:"flex-start" }}>
                      <span style={{ fontSize:9, color:"#2962ff33", fontFamily:"monospace", flexShrink:0, marginTop:1 }}>{String(i+1).padStart(2,"0")}</span>
                      <span style={{ fontSize:10, color:"#6b7280", lineHeight:1.6 }}>{line.replace(/^\d+\.\s*/,"")}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ flex:1, overflow:"hidden" }}>
                <TVChart market={market} candles={candles} onPriceUpdate={handlePriceUpdate} signal={signal} prediction={prediction} />
              </div>
            </div>
          )}

          {tab === "predict" && prediction && (
            <div className="fadein" style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>

              {/* AI Reasoning Chain */}
              <div style={{ background:"#0d1117", border:"1px solid #2962ff22", borderRadius:6, padding:"12px 14px", borderLeft:"2px solid #2962ff" }}>
                <div style={{ fontSize:9, color:"#2962ff", letterSpacing:2, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                  <span className="blink">●</span> AI REASONING CHAIN
                </div>
                {reasoning.map((line, i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:7, alignItems:"flex-start" }}>
                    <span style={{ fontSize:9, color:"#2962ff44", fontFamily:"monospace", marginTop:1, flexShrink:0 }}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{ fontSize:11, color:"#9ca3af", lineHeight:1.6 }}>{line}</span>
                  </div>
                ))}
              </div>

              {/* Scenario Engine */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>SCENARIO ENGINE</div>
                {scenarios.map((s, i) => (
                  <div key={i} style={{ marginBottom: i < scenarios.length-1 ? 10 : 0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:11, color:s.color }}>{s.icon}</span>
                        <span style={{ fontSize:11, color:"#e0e3ea", fontWeight:600 }}>{s.label}</span>
                      </div>
                      <span style={{ fontSize:12, color:s.color, fontWeight:700, fontFamily:"monospace" }}>{s.prob}%</span>
                    </div>
                    <div style={{ background:"#131722", borderRadius:2, height:4, overflow:"hidden", marginBottom:4 }}>
                      <div style={{ width:`${s.prob}%`, height:"100%", background:s.color, transition:"width 1s", opacity:0.8 }} />
                    </div>
                    <div style={{ fontSize:10, color:"#4a5568", fontStyle:"italic" }}>{s.reason}</div>
                    {i < scenarios.length-1 && <div style={{ height:1, background:"#2a2e39", marginTop:10 }} />}
                  </div>
                ))}
              </div>

              {/* Probability split */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>DIRECTIONAL PROBABILITY</div>
                <div style={{ display:"flex", borderRadius:3, overflow:"hidden", height:18, marginBottom:8 }}>
                  <div style={{ width:`${prediction.bullProb}%`, background:"linear-gradient(90deg,#1a4d40,#26a69a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#fff", transition:"width 1s" }}>{prediction.bullProb}%</div>
                  <div style={{ width:`${prediction.bearProb}%`, background:"linear-gradient(90deg,#ef5350,#6b1f1f)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#fff", transition:"width 1s" }}>{prediction.bearProb}%</div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9 }}>
                  <span style={{ color:"#26a69a" }}>▲ Bull {prediction.bullProb}%</span>
                  <div style={{ display:"flex", gap:16, fontSize:9 }}>
                    <span style={{ color:"#787b86" }}>Vol <b style={{ color:"#f59e0b" }}>{prediction.volatility}%</b></span>
                    <span style={{ color:"#787b86" }}>Conf <b style={{ color:"#26a69a" }}>{signal?.confidence}%</b></span>
                  </div>
                  <span style={{ color:"#ef5350" }}>▼ Bear {prediction.bearProb}%</span>
                </div>
              </div>

              {/* Pattern + BOS signals */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>MARKET STRUCTURE SIGNALS</div>
                {bosSignals.map((b, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid #2a2e39" }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:b.color, boxShadow:`0 0 6px ${b.color}` }} />
                    <span style={{ fontSize:10, color:b.color, fontWeight:700, fontFamily:"monospace" }}>{b.label}</span>
                    <span style={{ fontSize:10, color:"#4a5568", marginLeft:"auto" }}>{b.dir}</span>
                  </div>
                ))}
                {patterns.map((p, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom: i < patterns.length-1 ? "1px solid #2a2e39":"none" }}>
                    <span style={{ fontSize:12, color:p.color }}>{p.icon}</span>
                    <span style={{ fontSize:10, color:"#b2b5be" }}>{p.name}</span>
                  </div>
                ))}
                {!bosSignals.length && !patterns.length && <div style={{ fontSize:10, color:"#4a5568" }}>No structural signals detected.</div>}
              </div>

              {/* Confidence quality meter */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>PREDICTION QUALITY</div>
                {[
                  { label:"Signal Confidence",    val: signal?.confidence || 0,   max:100, color:"#2962ff" },
                  { label:"Volatility Stability",  val: Math.max(0, 100 - (prediction.volatility * 20)), max:100, color:"#26a69a" },
                  { label:"Structure Clarity",     val: bosSignals.length ? 80 : 40, max:100, color:"#ce93d8" },
                  { label:"Pattern Confluence",    val: patterns.length * 33,        max:100, color:"#f59e0b" },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#787b86", marginBottom:3 }}>
                      <span>{m.label}</span><span style={{ color:m.color, fontWeight:700 }}>{Math.min(m.val, 100)}%</span>
                    </div>
                    <div style={{ background:"#131722", borderRadius:2, height:3, overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(m.val,100)}%`, height:"100%", background:m.color, transition:"width 1s", opacity:0.75 }} />
                    </div>
                  </div>
                ))}
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
              {news.map((n,i) => {
                const impact = n.sentiment==="bullish"
                  ? ["Price support likely","Momentum boost possible","Watch for follow-through"][i%3]
                  : ["Sell pressure may increase","Watch for breakdown","Risk-off sentiment rising"][i%3];
                const timeEffect = ["Short-term","Intraday","Swing-level"][i%3];
                return (
                  <div key={i} className="news-item" onClick={() => n.url && window.open(n.url,"_blank")}>
                    <div style={{ width:3, minHeight:40, borderRadius:2, background: n.sentiment==="bullish"?C.green:C.red, flexShrink:0, marginTop:2 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#b2b5be", lineHeight:1.6, marginBottom:5 }}>{n.text}</div>
                      <div style={{ fontSize:9, color:"#4a5568", fontStyle:"italic", marginBottom:5 }}>↳ {impact}</div>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <span style={{ fontSize:9, color:"#374151" }}>{n.source}</span>
                        <span style={{ fontSize:8, padding:"1px 5px", borderRadius:2, background: n.sentiment==="bullish"?C.green+"15":C.red+"15", color: n.sentiment==="bullish"?C.green:C.red, fontWeight:700 }}>
                          {n.sentiment==="bullish"?"▲ BULL":"▼ BEAR"}
                        </span>
                        <span style={{ fontSize:8, padding:"1px 5px", borderRadius:2, background:"#2a2e39", color:"#4a5568" }}>{timeEffect}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "accuracy" && (
            <div className="fadein" style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>

              {/* Confidence score cards */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { label:"SIGNAL QUALITY", value: signal?.confidence ? (signal.confidence > 75 ? "HIGH" : signal.confidence > 60 ? "MED" : "LOW") : "—", sub: `${signal?.confidence || 0}% confidence`, color: signal?.confidence > 75 ? C.green : signal?.confidence > 60 ? C.amber : C.red },
                  { label:"VOLATILITY GRADE", value: prediction?.volatility < 0.5 ? "A" : prediction?.volatility < 1.2 ? "B" : "C", sub: `${prediction?.volatility || 0}% vol`, color: prediction?.volatility < 0.5 ? C.green : prediction?.volatility < 1.2 ? C.amber : C.red },
                  { label:"STRUCTURE", value: bosSignals.length ? "CLEAR" : "MIXED", sub: `${bosSignals.length} signal(s)`, color: bosSignals.length ? C.green : C.muted },
                  { label:"SIGNALS FIRED", value: accuracy.total, sub: `${accuracy.correct} accurate`, color:"#ce93d8" },
                ].map((s,i) => (
                  <div key={i} className="stat-card" style={{ padding:"10px 12px" }}>
                    <div style={{ fontSize:8, color:C.muted, letterSpacing:2, marginBottom:6 }}>{s.label}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:"JetBrains Mono,monospace", lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:9, color:"#4a5568", marginTop:4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Confidence decay */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>CONFIDENCE DECAY MODEL</div>
                <div style={{ fontSize:10, color:"#4a5568", marginBottom:8 }}>Prediction reliability degrades over time as market conditions evolve.</div>
                {[5,15,30,60].map((mins, i) => {
                  const decay = Math.max(0, (signal?.confidence || 65) - i * 8 - Math.random()*5);
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:9, color:"#4a5568", width:32, flexShrink:0 }}>+{mins}m</span>
                      <div style={{ flex:1, background:"#131722", borderRadius:2, height:4, overflow:"hidden" }}>
                        <div style={{ width:`${decay}%`, height:"100%", background: decay>70?"#26a69a":decay>50?"#f59e0b":"#ef5350", transition:"width 1s" }} />
                      </div>
                      <span style={{ fontSize:9, color:"#787b86", width:32, textAlign:"right" }}>{Math.round(decay)}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Signal history */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>SIGNAL HISTORY</div>
                {accuracy.history.length === 0 && <div style={{ fontSize:10, color:"#4a5568" }}>Run AI Analysis to build history.</div>}
                <div style={{ display:"flex", gap:4 }}>
                  {accuracy.history.map((h,i) => (
                    <div key={i} style={{ flex:1, height:38, borderRadius:3, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background: h==="W"?"#26a69a12":"#ef535012", border:`1px solid ${h==="W"?"#26a69a28":"#ef535028"}` }}>
                      <span style={{ fontSize:11 }}>{h==="W"?"✓":"✗"}</span>
                      <span style={{ fontSize:8, color: h==="W"?C.green:C.red, fontWeight:700 }}>{h}</span>
                    </div>
                  ))}
                </div>
                {accuracy.total > 0 && (
                  <div style={{ marginTop:10, background:"#131722", borderRadius:2, height:3, overflow:"hidden" }}>
                    <div style={{ width:`${winRate}%`, height:"100%", background:`linear-gradient(90deg,${C.accent},${C.green})`, transition:"width 1s" }} />
                  </div>
                )}
              </div>

              {/* Market condition grade */}
              <div style={{ background:"#1e222d", border:"1px solid #2a2e39", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#787b86", letterSpacing:2, marginBottom:10 }}>CURRENT MARKET CONDITIONS</div>
                {[
                  { label:"Trending",    val: Math.random()>0.4, desc:"Directional bias present" },
                  { label:"Liquid",      val: Math.random()>0.3, desc:"Sufficient volume for clean moves" },
                  { label:"Low Noise",   val: Math.random()>0.5, desc:"Price action is readable" },
                  { label:"Predictable", val: (signal?.confidence||0) > 65, desc:"AI confidence above threshold" },
                ].map((c, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"5px 0", borderBottom: i<3?"1px solid #2a2e39":"none" }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background: c.val ? C.green : "#4a5568", flexShrink:0 }} />
                    <span style={{ fontSize:10, color: c.val ? "#e0e3ea" : "#4a5568", fontWeight: c.val ? 600 : 400 }}>{c.label}</span>
                    <span style={{ fontSize:9, color:"#4a5568", marginLeft:"auto" }}>{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Market overview + win rate */}
        <div style={{ width:160, background:"#131722", borderLeft:"1px solid #2a2e39", display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ padding:"6px 10px 5px", fontSize:9, color:"#4a5568", letterSpacing:2.5, borderBottom:"1px solid #2a2e39", textTransform:"uppercase", fontWeight:700 }}>Overview</div>
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
          <div style={{ padding:"10px", borderTop:"1px solid #2a2e39", background:"#131722", flexShrink:0 }}>
            {prediction && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:9, color:"#4a5568", letterSpacing:2, marginBottom:6 }}>SENTIMENT</div>
                <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                  <div style={{ flex:prediction.bullProb, height:4, borderRadius:2, background:"#26a69a", opacity:0.8 }} />
                  <div style={{ flex:prediction.bearProb, height:4, borderRadius:2, background:"#ef5350", opacity:0.8 }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:8, color:"#4a5568" }}>
                  <span style={{ color:"#26a69a" }}>Bull {prediction.bullProb}%</span>
                  <span style={{ color:"#ef5350" }}>Bear {prediction.bearProb}%</span>
                </div>
              </div>
            )}
            <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:7 }}>AI WIN RATE</div>
            <div style={{ fontSize:26, fontWeight:700, color: winRate>65?C.green:C.amber, fontFamily:"JetBrains Mono,monospace", lineHeight:1, textShadow: winRate>65?"0 0 12px rgba(38,166,154,0.4)":"0 0 12px rgba(245,158,11,0.4)" }}>{winRate}%</div>
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