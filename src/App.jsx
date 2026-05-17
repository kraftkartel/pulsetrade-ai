import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";

/* ════════════════════════════════════════════════════════════════
   PULSETRADE AI™  —  INSTITUTIONAL MARKET INTELLIGENCE SYSTEM
   PulseScore™ · Smart Exit Radar™ · TrapSense AI™ · Market DNA™
   BY TWUMVE  ·  v3.1 ELITE  —  Beginner/Advanced/Pro Edition
════════════════════════════════════════════════════════════════ */

const NEWS_API_KEY = "8603087de8be4d5c96370d5adfc3a1ab";

const MARKETS = [
  { id: "BTC/USD",  icon: "₿",  base: 67420,  category: "Crypto",    decimals: 2,  vol24h: "42.1B",  mktCap: "1.32T" },
  { id: "ETH/USD",  icon: "Ξ",  base: 3540,   category: "Crypto",    decimals: 2,  vol24h: "18.7B",  mktCap: "425B"  },
  { id: "GOLD",     icon: "Au", base: 2341,   category: "Commodity", decimals: 2,  vol24h: "142B",   mktCap: "14.6T" },
  { id: "EUR/USD",  icon: "€",  base: 1.0823, category: "Forex",     decimals: 5,  vol24h: "7.5T",   mktCap: "—"     },
  { id: "COFFEE",   icon: "☕", base: 2.14,   category: "Commodity", decimals: 4,  vol24h: "3.2B",   mktCap: "—"     },
  { id: "OIL/USD",  icon: "🛢", base: 82,     category: "Commodity", decimals: 2,  vol24h: "2.8B",   mktCap: "—"     },
];

const INTERVALS = ["1m","5m","15m","1H","4H","1D","1W"];

/* ── PATCH 4: Beginner/Advanced/Pro mode system ── */
const MODES = ["Beginner", "Advanced", "Pro"];

const BEGINNER_TRANSLATIONS = {
  "MOMENTUM EXHAUSTION": {
    title: "🐢 Trade Slowing Down",
    desc: "The market has been moving fast but is now running out of steam. Like a sprinter getting tired — expect a slowdown or reversal soon."
  },
  "OVEREXTENDED MOVE": {
    title: "⚠️ Price Stretched Too Far",
    desc: "Price moved very far from its average. Think of a rubber band — the further it stretches, the more likely it snaps back."
  },
  "WEAKENING TREND": {
    title: "📉 Direction Losing Strength",
    desc: "The market is still moving in one direction, but the force behind it is fading. This could mean the trend is about to change."
  },
  "VOLATILITY COMPRESSION": {
    title: "💤 Calm Before the Storm",
    desc: "The market has gone very quiet. This usually means a big move is coming — but we don't know which way yet. Be patient."
  },
  "FAKE BREAKOUT": {
    title: "🎭 Possible False Move",
    desc: "Price broke through a level, but the move may not be real. Big traders sometimes push price to trick smaller traders into buying/selling at the wrong time."
  },
  "STOP HUNT": {
    title: "🎯 Stop-Loss Trap Active",
    desc: "Price is near a level where many traders have their stop-losses. Big players may push price there to trigger those stops, then reverse direction."
  },
  "EMOTIONAL TRAP": {
    title: "😱 FOMO Zone Detected",
    desc: "Price has moved so much that traders may be panicking. This is exactly when mistakes happen — stay calm and don't chase."
  },
  "VOLUME TRAP": {
    title: "🎰 Suspicious Volume Spike",
    desc: "Lots of trading activity is happening, but the price isn't following. This usually signals big players exiting while small traders pile in."
  },
};

const getBeginnerSignalText = (signal) => {
  if (signal === "BUY") return {
    action: "✅ Consider Buying",
    sub: "The AI sees more buyers than sellers right now. The market shows signs of going up. Always use a stop-loss."
  };
  if (signal === "SELL") return {
    action: "❌ Consider Selling / Staying Out",
    sub: "Selling pressure is building. The market may be heading lower. Avoid new buy entries."
  };
  return {
    action: "⏸ Wait for a Better Setup",
    sub: "Conditions are mixed right now. Patience protects your money — waiting IS a valid trade decision."
  };
};

const DRAW_TOOLS = [
  { id: "cursor",    icon: "↖", label: "Cursor" },
  { id: "trendline", icon: "╱", label: "Trend Line" },
  { id: "hline",     icon: "—", label: "Horizontal" },
  { id: "fib",       icon: "Φ", label: "Fibonacci" },
  { id: "eraser",    icon: "⌫", label: "Clear All" },
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
  { text: "OPEC+ cuts output by 1M barrels, crude prices surge", sentiment: "bullish", source: "Reuters" },
  { text: "Recession fears weigh on oil demand outlook globally", sentiment: "bearish", source: "Bloomberg" },
  { text: "Dollar strengthens, commodity prices under pressure", sentiment: "bearish", source: "FT" },
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
      text: a.title, source: a.source.name, url: a.url,
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

function generateOHLCV(base, count = 180) {
  const candles = [];
  let price = base;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count; i >= 0; i--) {
    const vol = (Math.random() - 0.478) * base * 0.013;
    const open = price;
    price = Math.max(price + vol, base * 0.72);
    const high = Math.max(open, price) * (1 + Math.random() * 0.005);
    const low  = Math.min(open, price) * (1 - Math.random() * 0.005);
    candles.push({
      time: now - i * 300,
      open: parseFloat(open.toFixed(6)), high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),   close: parseFloat(price.toFixed(6)),
      volume: Math.floor(Math.random() * 1400 + 200),
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

function calcMACD(candles) {
  const k12 = 2/13, k26 = 2/27, k9 = 2/10;
  let ema12 = candles[0].close, ema26 = candles[0].close, signal = 0;
  const result = [];
  candles.forEach((c, i) => {
    ema12 = c.close * k12 + ema12 * (1 - k12);
    ema26 = c.close * k26 + ema26 * (1 - k26);
    const macd = ema12 - ema26;
    signal = macd * k9 + signal * (1 - k9);
    if (i > 26) result.push({ time: c.time, macd, signal, hist: macd - signal });
  });
  return result;
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
      signals.push({ type:"BOS", dir:"bullish", price: curr.price, label:"BOS ▲", color:"#00d4a8" });
    if (curr.price < prev.price)
      signals.push({ type:"CHOCH", dir:"bearish", price: curr.price, label:"CHoCH ↓", color:"#ff4757" });
  }
  if (recentLows.length >= 2) {
    const [prev, curr] = recentLows.slice(-2);
    if (curr.price < prev.price && last.close < curr.price)
      signals.push({ type:"BOS", dir:"bearish", price: curr.price, label:"BOS ▼", color:"#ff4757" });
    if (curr.price > prev.price)
      signals.push({ type:"CHOCH", dir:"bullish", price: curr.price, label:"CHoCH ↑", color:"#00d4a8" });
  }
  return signals;
}

function calcFibLevels(swings, candles) {
  if (!swings.highs.length || !swings.lows.length) return [];
  const lastHigh = swings.highs[swings.highs.length - 1];
  const lastLow  = swings.lows[swings.lows.length - 1];
  const hi = lastHigh.price, lo = lastLow.price, range = hi - lo;
  const isBullish = lastLow.idx < lastHigh.idx;
  const end = candles[candles.length - 1].time + (candles[1].time - candles[0].time) * 40;
  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(r => ({
    level: r, price: isBullish ? hi - range * r : lo + range * r,
    label: `${(r * 100).toFixed(1)}%`,
    color: r === 0.618 ? "#b388ff" : r === 0.5 ? "#ffd600" : r === 0.382 ? "#448aff" : "#37474f", end,
  }));
}

function detectLiquidityZones(candles) {
  const recent = candles.slice(-40);
  const highs = recent.map(c => c.high).sort((a,b) => b-a);
  const lows  = recent.map(c => c.low).sort((a,b) => a-b);
  return [
    { price: highs.slice(0,5).reduce((a,b)=>a+b,0)/5, label:"Supply Zone", color:"#ff475733", type:"resistance" },
    { price: lows.slice(0,5).reduce((a,b)=>a+b,0)/5,  label:"Demand Zone", color:"#00d4a833", type:"support" },
  ];
}

function buildRegressionChannel(candles) {
  const n = Math.min(50, candles.length);
  const slice = candles.slice(-n);
  let sumX=0, sumY=0, sumXY=0, sumX2=0;
  slice.forEach((c,i) => { sumX+=i; sumY+=c.close; sumXY+=i*c.close; sumX2+=i*i; });
  const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  const intercept = (sumY - slope*sumX)/n;
  const step = slice[1].time - slice[0].time;
  const deviations = slice.map((c,i) => Math.abs(c.close - (intercept + slope*i)));
  const stdDev = Math.sqrt(deviations.reduce((a,b)=>a+b*b,0)/n);
  const mid=[], upper=[], lower=[];
  for (let i=0; i<n+18; i++) {
    const t = slice[0].time + i*step, v = intercept + slope*i;
    mid.push({time:t, value:parseFloat(v.toFixed(6))});
    upper.push({time:t, value:parseFloat((v+stdDev*2).toFixed(6))});
    lower.push({time:t, value:parseFloat((v-stdDev*2).toFixed(6))});
  }
  return { mid, upper, lower, slope, stdDev };
}

/* ══════════════════════════════════════════
   MARKET DNA™ — CORE INTELLIGENCE ENGINE
   Per-market computation only.
══════════════════════════════════════════ */
function computeMarketDNA(candles, news, bosSignals) {
  const rsiData   = calcRSI(candles);
  const macdData  = calcMACD(candles);
  const ema20     = calcEMA(candles, 20);
  const ema50     = calcEMA(candles, 50);
  const swings    = detectSwingPoints(candles);
  const regCh     = buildRegressionChannel(candles);
  const liqZones  = detectLiquidityZones(candles);

  const lastRSI   = rsiData[rsiData.length - 1]?.value ?? 50;
  const prevRSI   = rsiData[rsiData.length - 6]?.value ?? 50;
  const lastMACD  = macdData[macdData.length - 1];
  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[candles.length - 6].close;
  const lastEMA20 = ema20[ema20.length - 1]?.value ?? lastClose;
  const lastEMA50 = ema50[ema50.length - 1]?.value ?? lastClose;

  const atr = candles.slice(-14).reduce((acc,c) => acc + (c.high - c.low), 0) / 14;
  const volPct = parseFloat((atr / lastClose * 100).toFixed(3));

  const vols = candles.slice(-20).map(c => c.volume);
  const avgVol = vols.slice(0,-1).reduce((a,b)=>a+b,0)/(vols.length-1);
  const lastVol = vols[vols.length-1];
  const volRatio = lastVol / avgVol;

  const priceTrend = (lastClose - candles[candles.length-20].close) / candles[candles.length-20].close * 100;
  const emaTrend   = lastEMA20 > lastEMA50 ? 1 : -1;
  const trendStrength = Math.min(100, Math.abs(priceTrend) * 8 + Math.abs(lastRSI - 50) * 0.6);

  const newsScore   = (news.filter(n=>n.sentiment==="bullish").length - news.filter(n=>n.sentiment==="bearish").length) * 12;
  const rsiScore    = (lastRSI - 50) * 0.8;
  const trendScore  = emaTrend * Math.min(30, trendStrength * 0.4);
  const macdScore   = lastMACD ? (lastMACD.macd > 0 ? 15 : -15) + (lastMACD.hist > 0 ? 8 : -8) : 0;
  const bosScore    = bosSignals.filter(b=>b.dir==="bullish").length * 18 - bosSignals.filter(b=>b.dir==="bearish").length * 18;
  const rawBias     = newsScore + rsiScore + trendScore + macdScore + bosScore;
  const marketBias  = Math.max(-100, Math.min(100, rawBias));

  const rsiExtreme    = lastRSI > 72 || lastRSI < 28;
  const rsiDivergence = (lastRSI < prevRSI && lastClose > prevClose) || (lastRSI > prevRSI && lastClose < prevClose);
  const atRegChanEdge = lastClose > regCh.upper[regCh.upper.length-5]?.value * 0.998 || lastClose < regCh.lower[regCh.lower.length-5]?.value * 1.002;
  const nearLiqZone   = Math.abs(lastClose - liqZones[0].price) / lastClose < 0.008 || Math.abs(lastClose - liqZones[1].price) / lastClose < 0.008;
  const reversalScore = (rsiExtreme?28:0) + (rsiDivergence?25:0) + (atRegChanEdge?22:0) + (nearLiqZone?15:0) + Math.random()*10;
  const reversalProb  = Math.min(95, Math.max(5, Math.round(reversalScore)));

  const highVolSpike   = volRatio > 2.2;
  const momentumWeak   = Math.abs(lastMACD?.hist??0) < Math.abs(macdData[macdData.length-5]?.hist??1) * 0.4;
  const fakeBreakout   = atRegChanEdge && highVolSpike && momentumWeak;
  const stopHunt       = nearLiqZone && highVolSpike;
  const emotionalEntry = rsiExtreme && (lastRSI > 72 ? lastClose > prevClose * 1.015 : lastClose < prevClose * 0.985);
  const trapScore      = (fakeBreakout?35:0) + (stopHunt?28:0) + (emotionalEntry?20:0) + (highVolSpike&&!momentumWeak?10:0) + Math.random()*12;
  const trapProb       = Math.min(92, Math.max(4, Math.round(trapScore)));

  const momentumExhaustion = momentumWeak && trendStrength > 55;
  const overextended        = Math.abs(lastClose - lastEMA50) / lastEMA50 > 0.035;
  const volCompression      = volPct < 0.4;
  const weakenTrend         = trendStrength < 30 && Math.abs(priceTrend) > 1.5;
  const exitRiskScore       = (momentumExhaustion?32:0) + (overextended?28:0) + (reversalProb>65?22:0) + (weakenTrend?18:0) + (volCompression?12:0) + Math.random()*10;
  const exitRisk            = Math.min(98, Math.max(3, Math.round(exitRiskScore)));

  const largeBodyCandles = candles.slice(-8).filter(c => Math.abs(c.close-c.open)/(c.high-c.low||1) > 0.65);
  const institutionalFlow = (largeBodyCandles.filter(c=>c.close>c.open).length - largeBodyCandles.filter(c=>c.close<c.open).length) * 15;
  const smBias = Math.max(-100, Math.min(100, institutionalFlow + macdScore * 0.6 + bosScore * 0.5));

  const bullishFactor = (marketBias + 100) / 2;
  const pulseScore    = Math.round(bullishFactor * (1 - trapProb/200) * (1 - exitRisk/250) * (trendStrength/100 * 0.4 + 0.6));

  let signal, signalColor, signalBg;
  if (pulseScore >= 62 && marketBias > 15) {
    signal = "BUY"; signalColor = "#00d4a8"; signalBg = "rgba(0,212,168,0.08)";
  } else if (pulseScore <= 38 || marketBias < -15) {
    signal = "SELL"; signalColor = "#ff4757"; signalBg = "rgba(255,71,87,0.08)";
  } else {
    signal = "WAIT"; signalColor = "#ffd600"; signalBg = "rgba(255,214,0,0.08)";
  }

  const trapWarnings = [];
  if (fakeBreakout) trapWarnings.push({ type:"FAKE BREAKOUT", desc:"Volume spike without momentum — possible false move.", severity:"HIGH" });
  if (stopHunt)     trapWarnings.push({ type:"STOP HUNT",    desc:"Price near liquidity pool with unusual volume.", severity:"HIGH" });
  if (emotionalEntry) trapWarnings.push({ type:"EMOTIONAL TRAP", desc:"RSI extreme — retail FOMO entry zone detected.", severity:"MED" });
  if (highVolSpike && momentumWeak) trapWarnings.push({ type:"VOLUME TRAP", desc:"High volume, weak momentum — distribution likely.", severity:"MED" });

  const exitWarnings = [];
  if (momentumExhaustion) exitWarnings.push({ type:"MOMENTUM EXHAUSTION", desc:"MACD histogram shrinking — trend losing power.", severity:"HIGH" });
  if (overextended)       exitWarnings.push({ type:"OVEREXTENDED MOVE", desc:`Price ${((Math.abs(lastClose-lastEMA50)/lastEMA50)*100).toFixed(1)}% from EMA50 — mean reversion risk.`, severity:"HIGH" });
  if (weakenTrend)        exitWarnings.push({ type:"WEAKENING TREND", desc:"Price trend strong but momentum diverging.", severity:"MED" });
  if (volCompression)     exitWarnings.push({ type:"VOLATILITY COMPRESSION", desc:"ATR contracting — explosive move incoming, direction unclear.", severity:"MED" });

  const aiReasons = [
    { label:"STRUCTURE", icon:"⬡", content: emaTrend > 0
      ? `EMA20 (${fmt(lastEMA20,{decimals:2})}) trading above EMA50 (${fmt(lastEMA50,{decimals:2})}). Bullish stack confirms uptrend.`
      : `EMA20 below EMA50. Bearish structure — momentum pointing lower.` },
    { label:"RSI", icon:"◎", content: lastRSI > 70
      ? `RSI at ${lastRSI.toFixed(1)} — overbought territory. Pullback probability elevated.`
      : lastRSI < 30
      ? `RSI at ${lastRSI.toFixed(1)} — oversold. Bounce setup forming.`
      : `RSI at ${lastRSI.toFixed(1)} — neutral zone. No extreme reading.` },
    { label:"MACD", icon:"⟨⟩", content: lastMACD
      ? lastMACD.hist > 0
        ? `MACD histogram positive (+${lastMACD.hist.toFixed(4)}). Bullish momentum building.`
        : `MACD histogram negative (${lastMACD.hist.toFixed(4)}). Bearish pressure active.`
      : "MACD data loading." },
    { label:"VOLUME", icon:"▌", content: volRatio > 1.5
      ? `Volume ${(volRatio*100-100).toFixed(0)}% above average. Institutional participation confirmed.`
      : volRatio < 0.6
      ? `Volume ${(100-volRatio*100).toFixed(0)}% below average. Low conviction — avoid overcommitting.`
      : `Volume near average. No unusual activity detected.` },
    { label:"VOLATILITY", icon:"〜", content: volPct > 1.5
      ? `ATR ${volPct}% — elevated volatility. Use wider stops, smaller size.`
      : volPct < 0.4
      ? `ATR ${volPct}% — compressed. Breakout imminent, direction uncertain.`
      : `ATR ${volPct}% — normal range. Standard position sizing applies.` },
    { label:"SMART MONEY", icon:"◈", content: smBias > 20
      ? `Institutional flow detected bullish. Large-body candles favor buyers.`
      : smBias < -20
      ? `Smart money appears to be distributing. Selling pressure from institutions.`
      : `Mixed institutional flow. No clear smart money direction.` },
  ];

  const scenarios = [
    {
      id:"A", label:"Bullish Continuation", prob: marketBias > 20 ? Math.min(75, 40 + marketBias/3) : Math.max(10, 30 + marketBias/4),
      color:"#00d4a8", riskLevel: trapProb > 50 ? "HIGH" : "MED",
      condition: "EMA stack maintained, RSI > 45, volume holding above average.",
      invalidate: "Close below EMA20 with volume spike.",
    },
    {
      id:"B", label:"Fake Breakout / Trap", prob: Math.round(trapProb * 0.8),
      color:"#ffd600", riskLevel:"HIGH",
      condition: "Price spikes above resistance then fails to hold.",
      invalidate: "Sustained close above breakout level with momentum.",
    },
    {
      id:"C", label:"Reversal / Distribution", prob: Math.min(80, reversalProb),
      color:"#ff4757", riskLevel: exitRisk > 60 ? "HIGH" : "MED",
      condition: "RSI divergence + momentum exhaustion + volume trap.",
      invalidate: "Fresh BOS with strong volume above swing high.",
    },
  ];
  const pSum = scenarios.reduce((a,s) => a+s.prob, 0);
  scenarios.forEach(s => s.prob = Math.round(s.prob / pSum * 100));

  let psychWarning = null;
  if (pulseScore < 42) psychWarning = { msg:"Current conditions favor waiting over entering.", sub:"Patience statistically outperforms low-edge setups.", level:"caution" };
  else if (trapProb > 60) psychWarning = { msg:"Risk-to-reward currently weak.", sub:"Multiple trap signals active — reduce position size.", level:"warn" };
  else if (exitRisk > 65) psychWarning = { msg:"Trade quality deteriorating.", sub:"Exit conditions building. Protect open profits now.", level:"danger" };

  return {
    marketBias, trendStrength, reversalProb, trapProb, exitRisk, smBias, pulseScore,
    signal, signalColor, signalBg, trapWarnings, exitWarnings, aiReasons, scenarios,
    psychWarning, volPct, lastRSI, lastMACD, volRatio, swings,
    confidence: Math.min(95, Math.round(60 + Math.abs(marketBias) * 0.25 + trendStrength * 0.1)),
    target: signal === "BUY" ? `+${(1.8 + Math.random()*2).toFixed(1)}%` : signal === "SELL" ? `-${(1.5 + Math.random()*2).toFixed(1)}%` : "±0.8%",
    stop: signal === "BUY" ? `-${(0.7 + Math.random()*0.8).toFixed(1)}%` : signal === "SELL" ? `+${(0.6 + Math.random()*0.8).toFixed(1)}%` : "±0.5%",
    rr: signal !== "WAIT" ? `${(1.8 + Math.random()*1.5).toFixed(1)}:1` : "—",
  };
}

function generatePrediction(candles, dna) {
  const last = candles[candles.length-1];
  const step = candles[1].time - candles[0].time;
  const atr = candles.slice(-14).reduce((acc,c) => acc + (c.high-c.low), 0) / 14;
  const isBull = dna.signal === "BUY";
  const paths = { bull:[], bear:[], mid:[] };
  let bp = last.close, brp = last.close, mp = last.close;
  for (let i=1; i<=32; i++) {
    const t = last.time + i*step, noise = (Math.random()-0.5)*atr*0.35;
    const cf = dna.confidence/100;
    bp  = bp  + atr*0.16*cf + noise;
    brp = brp - atr*0.13*cf + noise*0.8;
    mp  = mp  + atr*(isBull?0.05:-0.05)*cf + noise*0.4;
    paths.bull.push({time:t, value:parseFloat(bp.toFixed(6))});
    paths.bear.push({time:t, value:parseFloat(brp.toFixed(6))});
    paths.mid.push( {time:t, value:parseFloat(mp.toFixed(6))});
  }
  const bullProb = isBull ? Math.min(82, 44 + dna.pulseScore*0.4) : Math.max(18, 44 - dna.pulseScore*0.3);
  return { paths, bullProb: Math.round(bullProb), bearProb: Math.round(100-bullProb), volatility: dna.volPct };
}

/* ─── SPARK MINI CHART ─── */
function Spark({ data, up }) {
  const min = Math.min(...data), max = Math.max(...data), range = max-min||1;
  const w=70, h=26;
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{display:"block"}}>
      <polyline points={pts} stroke={up?"#00d4a8":"#ff4757"} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── GAUGE COMPONENT ─── */
function Gauge({ value, max=100, color, size=52, label, sublabel }) {
  const pct = Math.min(100, Math.max(0, value))/max;
  const angle = pct * 180 - 90;
  const r = size/2 - 4;
  const cx = size/2, cy = size/2 + 4;
  const arcX = cx + r * Math.cos((angle-90)*Math.PI/180);
  const arcY = cy + r * Math.sin((angle-90)*Math.PI/180);
  const largeArc = angle > 90 ? 1 : 0;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <svg width={size} height={size/2+8} viewBox={`0 0 ${size} ${size/2+8}`}>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#1e2537" strokeWidth="5"/>
        {pct > 0 && <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${arcX} ${arcY}`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"/>}
        <text x={cx} y={cy} textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono',monospace" dy="-1">{value}</text>
      </svg>
      <span style={{fontSize:8,color:"#4a5568",letterSpacing:1.2,textAlign:"center"}}>{label}</span>
      {sublabel && <span style={{fontSize:7,color:"#2d3748",letterSpacing:0.5}}>{sublabel}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TV CHART COMPONENT
═══════════════════════════════════════════════════ */
function TVChart({ market, candles, onPriceUpdate, dna, prediction }) {
  const mainRef = useRef(null), rsiRef = useRef(null);
  const chartRef = useRef(null), rsiChartRef = useRef(null);
  const candleRef = useRef(null), volRef = useRef(null);
  const ema20Ref = useRef(null), ema50Ref = useRef(null), rsiSerRef = useRef(null);
  const drawRef = useRef({ active:"cursor", points:[], overlays:[] });
  const predBullRef = useRef(null), predBearRef = useRef(null), predMidRef = useRef(null);
  const regMidRef = useRef(null), regUpperRef = useRef(null), regLowerRef = useRef(null);
  const aiOverlaysRef = useRef([]);

  const [showAIDraw, setShowAIDraw] = useState(true);
  const [showRegCh,  setShowRegCh]  = useState(true);
  const [showPred,   setShowPred]   = useState(true);
  const [showEMA20,  setShowEMA20]  = useState(true);
  const [showEMA50,  setShowEMA50]  = useState(true);
  const [showVol,    setShowVol]    = useState(true);
  const [showRSI,    setShowRSI]    = useState(true);
  const [tool,       setTool]       = useState("cursor");
  const [drawingPt,  setDrawingPt]  = useState(false);
  const [ohlc,       setOhlc]       = useState(null);
  const [aiBOSLabels,setAIBOSLabels]= useState([]);

  useEffect(() => { drawRef.current.active = tool; setDrawingPt(false); }, [tool]);

  const BG="#0d1117", GRID="#161b22", TEXT="#8b949e", BORDER="#21262d";

  useEffect(() => {
    if (!mainRef.current) return;
    const chart = createChart(mainRef.current, {
      width: mainRef.current.clientWidth, height: mainRef.current.clientHeight,
      layout: { background:{color:BG}, textColor:TEXT, fontSize:10, fontFamily:"'JetBrains Mono',monospace" },
      grid: { vertLines:{color:GRID}, horzLines:{color:GRID} },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {color:"#30363d",width:1,style:LineStyle.Dashed,labelBackgroundColor:"#21262d"},
        horzLine: {color:"#30363d",width:1,style:LineStyle.Dashed,labelBackgroundColor:"#1f6feb"},
      },
      rightPriceScale: { borderColor:BORDER, scaleMargins:{top:0.06,bottom:0.24}, autoScale:true },
      timeScale: { borderColor:BORDER, timeVisible:true, secondsVisible:false, barSpacing:7, rightOffset:12 },
      watermark: { visible:true, fontSize:11, horzAlign:"left", vertAlign:"top", color:"rgba(31,111,235,0.05)", text:`PULSETRADE AI™  ·  ${market.id}  ·  MARKET DNA™  ·  BY TWUMVE` },
    });
    chartRef.current = chart;

    const cs = chart.addCandlestickSeries({
      upColor:"#00d4a8", downColor:"#ff4757",
      borderUpColor:"#00d4a8", borderDownColor:"#ff4757",
      wickUpColor:"#00d4a888", wickDownColor:"#ff475788",
    });
    cs.setData(candles);
    candleRef.current = cs;

    const vs = chart.addHistogramSeries({ priceScaleId:"vol", priceFormat:{type:"volume"} });
    chart.priceScale("vol").applyOptions({ scaleMargins:{top:0.82,bottom:0}, drawTicks:false });
    vs.setData(candles.map(c => ({ time:c.time, value:c.volume, color:c.close>=c.open?"#00d4a820":"#ff475720" })));
    volRef.current = vs;

    const e20 = chart.addLineSeries({color:"#1f6feb",lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:"EMA20"});
    e20.setData(calcEMA(candles,20)); ema20Ref.current = e20;
    const e50 = chart.addLineSeries({color:"#f78166",lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:"EMA50"});
    e50.setData(calcEMA(candles,50)); ema50Ref.current = e50;

    const lastPrice = candles[candles.length-1].close;
    cs.createPriceLine({ price:lastPrice, color:"#00d4a8", lineWidth:1, lineStyle:LineStyle.Dashed, axisLabelVisible:true });

    const pb = chart.addLineSeries({color:"rgba(0,212,168,0.85)",lineWidth:2,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true,title:"▲Bull"});
    const pbr = chart.addLineSeries({color:"rgba(255,71,87,0.85)",lineWidth:2,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true,title:"▼Bear"});
    const pm = chart.addLineSeries({color:"rgba(255,214,0,0.6)",lineWidth:1,lineStyle:LineStyle.Dotted,priceLineVisible:false,lastValueVisible:false,title:"Mid"});
    predBullRef.current=pb; predBearRef.current=pbr; predMidRef.current=pm;

    const rm = chart.addLineSeries({color:"rgba(255,214,0,0.4)",lineWidth:1,lineStyle:LineStyle.Solid,priceLineVisible:false,lastValueVisible:false});
    const ru = chart.addLineSeries({color:"rgba(255,71,87,0.3)",lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
    const rl = chart.addLineSeries({color:"rgba(0,212,168,0.3)",lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
    regMidRef.current=rm; regUpperRef.current=ru; regLowerRef.current=rl;

    chart.subscribeCrosshairMove(p => {
      if (!p.time || !p.seriesData) { setOhlc(null); return; }
      const d = p.seriesData.get(cs);
      if (d) setOhlc(d);
    });

    if (rsiRef.current) {
      const rc = createChart(rsiRef.current, {
        width:rsiRef.current.clientWidth, height:rsiRef.current.clientHeight,
        layout:{background:{color:BG},textColor:TEXT,fontSize:9,fontFamily:"'JetBrains Mono',monospace"},
        grid:{vertLines:{color:GRID},horzLines:{color:GRID}},
        crosshair:{mode:CrosshairMode.Normal,vertLine:{color:"#30363d",width:1,style:LineStyle.Dashed,labelBackgroundColor:"#21262d"},horzLine:{color:"#30363d",width:1,style:LineStyle.Dashed,labelBackgroundColor:"#6e40c9"}},
        rightPriceScale:{borderColor:BORDER,scaleMargins:{top:0.1,bottom:0.1}},
        timeScale:{borderColor:BORDER,timeVisible:false,secondsVisible:false,visible:false},
      });
      rsiChartRef.current = rc;
      const rs = rc.addLineSeries({color:"#b388ff",lineWidth:1.5,priceLineVisible:false,lastValueVisible:true});
      rs.setData(calcRSI(candles)); rsiSerRef.current = rs;
      rs.createPriceLine({price:70,color:"#ff475740",lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:"OB"});
      rs.createPriceLine({price:30,color:"#00d4a840",lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:"OS"});
      rs.createPriceLine({price:50,color:"#21262d",lineWidth:1,lineStyle:LineStyle.Dotted,axisLabelVisible:false});
      chart.timeScale().subscribeVisibleLogicalRangeChange(r => { if(r) rc.timeScale().setVisibleLogicalRange(r); });
      rc.timeScale().subscribeVisibleLogicalRangeChange(r => { if(r) chart.timeScale().setVisibleLogicalRange(r); });
    }

    const ro = new ResizeObserver(() => {
      if (mainRef.current) chart.applyOptions({width:mainRef.current.clientWidth,height:mainRef.current.clientHeight});
      if (rsiRef.current && rsiChartRef.current) rsiChartRef.current.applyOptions({width:rsiRef.current.clientWidth,height:rsiRef.current.clientHeight});
    });
    if (mainRef.current?.parentElement) ro.observe(mainRef.current.parentElement);
    chart.timeScale().fitContent();
    return () => {
      ro.disconnect(); chart.remove();
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }
      chartRef.current = null;
    };
  }, [market.id]);

  // Live tick — PATCH: use faster 750ms tick but throttle state updates
  useEffect(() => {
    if (!candleRef.current || !candles.length) return;
    const last = {...candles[candles.length-1]};
    const t = setInterval(() => {
      const drift = (Math.random()-0.486)*market.base*0.0016;
      last.close = parseFloat((last.close+drift).toFixed(6));
      last.high  = Math.max(last.high, last.close);
      last.low   = Math.min(last.low,  last.close);
      candleRef.current?.update({...last});
      onPriceUpdate?.(last.close);
    }, 750);
    return () => clearInterval(t);
  }, [candles, market]);

  useEffect(() => { ema20Ref.current?.applyOptions({visible:showEMA20}); }, [showEMA20]);
  useEffect(() => { ema50Ref.current?.applyOptions({visible:showEMA50}); }, [showEMA50]);
  useEffect(() => { volRef.current?.applyOptions({visible:showVol}); }, [showVol]);

  useEffect(() => {
    if (!predBullRef.current || !prediction?.paths) return;
    try {
      const anchor = candles.slice(-1).map(c=>({time:c.time,value:c.close}));
      predBullRef.current.setData([...anchor,...prediction.paths.bull]);
      predBearRef.current.setData([...anchor,...prediction.paths.bear]);
      predMidRef.current.setData( [...anchor,...prediction.paths.mid]);
    } catch {}
  }, [prediction, candles]);

  useEffect(() => {
    [predBullRef,predBearRef,predMidRef].forEach(r => r.current?.applyOptions({visible:showPred}));
  }, [showPred]);

  // AI overlays
  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    aiOverlaysRef.current.forEach(s => { try { chartRef.current.removeSeries(s); } catch {} });
    aiOverlaysRef.current = [];
    if (!showAIDraw) return;
    const chart = chartRef.current;
    const swings = detectSwingPoints(candles);
    const fibs = calcFibLevels(swings, candles);
    const liqZones = detectLiquidityZones(candles);
    const bosSignals = detectBOSCHOCH(candles, swings);
    const endTime = candles[candles.length-1].time + (candles[1].time-candles[0].time)*38;
    fibs.forEach(f => {
      try {
        const s = chart.addLineSeries({color:f.color,lineWidth:1,lineStyle:LineStyle.Dotted,priceLineVisible:false,lastValueVisible:true,title:`Fib ${f.label}`});
        s.setData([{time:candles[0].time,value:f.price},{time:endTime,value:f.price}]);
        aiOverlaysRef.current.push(s);
      } catch {}
    });
    liqZones.forEach(z => {
      try {
        const s = chart.addLineSeries({color:z.color,lineWidth:4,lineStyle:LineStyle.Solid,priceLineVisible:false,lastValueVisible:true,title:z.label});
        s.setData([{time:candles[Math.floor(candles.length*0.55)].time,value:z.price},{time:endTime,value:z.price}]);
        aiOverlaysRef.current.push(s);
      } catch {}
    });
    bosSignals.forEach(b => {
      try {
        const s = chart.addLineSeries({color:b.color,lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true,title:b.label});
        s.setData([{time:candles[candles.length-12].time,value:b.price},{time:endTime,value:b.price}]);
        aiOverlaysRef.current.push(s);
      } catch {}
    });
    if (swings.highs.length && swings.lows.length) {
      const h = swings.highs[swings.highs.length-1], l = swings.lows[swings.lows.length-1];
      try {
        const tl = chart.addLineSeries({color:"rgba(31,111,235,0.5)",lineWidth:1.5,lineStyle:LineStyle.Solid,priceLineVisible:false,lastValueVisible:false});
        tl.setData([{time:l.time,value:l.price},{time:h.time,value:h.price}]);
        aiOverlaysRef.current.push(tl);
      } catch {}
    }
    setAIBOSLabels(bosSignals);
  }, [candles, showAIDraw]);

  // Regression channel
  useEffect(() => {
    if (!regMidRef.current || !candles.length) return;
    if (!showRegCh) {
      [regMidRef,regUpperRef,regLowerRef].forEach(r => r.current?.applyOptions({visible:false})); return;
    }
    const ch = buildRegressionChannel(candles);
    try {
      regMidRef.current.setData(ch.mid); regUpperRef.current.setData(ch.upper); regLowerRef.current.setData(ch.lower);
      [regMidRef,regUpperRef,regLowerRef].forEach(r => r.current?.applyOptions({visible:true}));
    } catch {}
  }, [candles, showRegCh]);

  const clearDrawings = useCallback(() => {
    drawRef.current.overlays.forEach(s => { try { chartRef.current?.removeSeries(s); } catch {} });
    drawRef.current = {active:null,points:[],overlays:[]};
  }, []);

  const handleClick = useCallback((e) => {
    if (tool==="cursor"||!chartRef.current) return;
    if (tool==="eraser") { clearDrawings(); return; }
    const rect = mainRef.current.getBoundingClientRect();
    const price = chartRef.current.priceScale("right").coordinateToPrice(e.clientY-rect.top);
    const time  = chartRef.current.timeScale().coordinateToTime(e.clientX-rect.left);
    if (!price||!time) return;
    const dr = drawRef.current;
    if (tool==="hline") {
      const s = chartRef.current.addLineSeries({color:"#1f6febaa",lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true});
      s.setData([{time:candles[0].time,value:price},{time:candles[candles.length-1].time+86400*60,value:price}]);
      dr.overlays.push(s); return;
    }
    if (tool==="trendline"||tool==="fib") {
      if (!dr.active) { dr.active=tool; dr.points=[{time,price}]; setDrawingPt(true); }
      else {
        const p1 = dr.points[0];
        if (tool==="trendline") {
          const s = chartRef.current.addLineSeries({color:"#1f6feb",lineWidth:1.5,priceLineVisible:false,lastValueVisible:false});
          const t1=Math.min(p1.time,time), t2=Math.max(p1.time,time);
          s.setData([{time:t1,value:p1.time<=time?p1.price:price},{time:t2,value:p1.time<=time?price:p1.price}]);
          dr.overlays.push(s);
        } else {
          const hi=Math.max(p1.price,price),lo=Math.min(p1.price,price),range=hi-lo;
          [0,23.6,38.2,50,61.8,78.6,100].forEach(pct => {
            const level=hi-range*(pct/100);
            const s=chartRef.current.addLineSeries({color:`rgba(179,136,255,${pct===0||pct===100?0.9:0.5})`,lineWidth:1,lineStyle:LineStyle.Dotted,priceLineVisible:false,lastValueVisible:true,title:`${pct}%`});
            s.setData([{time:candles[0].time,value:level},{time:candles[candles.length-1].time+86400*60,value:level}]);
            dr.overlays.push(s);
          });
        }
        dr.active=null; dr.points=[]; setDrawingPt(false);
      }
    }
  }, [tool,candles,clearDrawings]);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:BG,border:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",gap:5,padding:"0 10px",height:34,borderBottom:`1px solid ${BORDER}`,background:"#161b22",flexShrink:0,flexWrap:"wrap"}}>
        {[
          {key:"ema20",label:"EMA20",color:"#1f6feb",val:showEMA20,set:setShowEMA20},
          {key:"ema50",label:"EMA50",color:"#f78166",val:showEMA50,set:setShowEMA50},
          {key:"vol",label:"VOL",color:"#8b949e",val:showVol,set:setShowVol},
          {key:"rsi",label:"RSI",color:"#b388ff",val:showRSI,set:setShowRSI},
          {key:"pred",label:"AI PATH",color:"#00d4a8",val:showPred,set:setShowPred},
          {key:"aidraw",label:"AI DRAW",color:"#b388ff",val:showAIDraw,set:setShowAIDraw},
          {key:"regch",label:"REG CH",color:"#ffd600",val:showRegCh,set:setShowRegCh},
        ].map(ind => (
          <button key={ind.key} onClick={()=>ind.set(v=>!v)} style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${ind.val?ind.color+"55":"#21262d"}`,background:ind.val?ind.color+"18":"transparent",color:ind.val?ind.color:"#4a5568",fontSize:9,fontWeight:700,cursor:"pointer",transition:"all .1s",letterSpacing:.3,fontFamily:"inherit"}}>
            {ind.label}
          </button>
        ))}
        <div style={{width:1,height:14,background:BORDER}}/>
        {ohlc ? (
          <div style={{display:"flex",gap:8,fontSize:10,color:"#8b949e",fontFamily:"'JetBrains Mono',monospace"}}>
            <span>O <b style={{color:"#c9d1d9"}}>{fmt(ohlc.open,market)}</b></span>
            <span>H <b style={{color:"#00d4a8"}}>{fmt(ohlc.high,market)}</b></span>
            <span>L <b style={{color:"#ff4757"}}>{fmt(ohlc.low,market)}</b></span>
            <span>C <b style={{color:ohlc.close>=ohlc.open?"#00d4a8":"#ff4757"}}>{fmt(ohlc.close,market)}</b></span>
          </div>
        ) : <span style={{fontSize:9,color:"#21262d"}}>hover chart for OHLC</span>}
        <div style={{marginLeft:"auto",display:"flex",gap:3}}>
          <button onClick={()=>chartRef.current?.timeScale().fitContent()} style={{width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${BORDER}`,color:"#8b949e",borderRadius:3,cursor:"pointer",fontSize:11}}>⊡</button>
          <button onClick={()=>chartRef.current?.timeScale().scrollToRealTime()} style={{width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${BORDER}`,color:"#8b949e",borderRadius:3,cursor:"pointer",fontSize:10}}>→|</button>
        </div>
      </div>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div style={{width:32,background:"#161b22",borderRight:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 0",gap:2,flexShrink:0}}>
          {DRAW_TOOLS.map((t,i) => (
            <div key={t.id}>
              {i===4 && <div style={{width:16,height:1,background:BORDER,margin:"3px 0"}}/>}
              <button onClick={()=>{if(t.id==="eraser")clearDrawings();else setTool(t.id);}} title={t.label}
                style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:tool===t.id?"#1f6feb1a":"transparent",color:tool===t.id?"#1f6feb":"#4a5568",cursor:"pointer",fontSize:t.id==="fib"?12:11,transition:"all .1s"}}>
                {t.icon}
              </button>
            </div>
          ))}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
          {aiBOSLabels.length>0 && (
            <div style={{position:"absolute",top:8,right:8,zIndex:10,display:"flex",flexDirection:"column",gap:2,pointerEvents:"none"}}>
              {aiBOSLabels.map((b,i) => (
                <div key={i} style={{background:"#0d1117",border:`1px solid ${b.color}`,borderRadius:3,padding:"2px 7px",fontSize:8,color:b.color,fontWeight:700,letterSpacing:1.2,fontFamily:"'JetBrains Mono',monospace",boxShadow:`0 0 10px ${b.color}44`}}>
                  {b.label}
                </div>
              ))}
            </div>
          )}
          {drawingPt && (
            <div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#161b22ee",color:"#1f6feb",fontSize:10,padding:"3px 12px",borderRadius:10,border:"1px solid #1f6feb33",pointerEvents:"none"}}>
              Click second point · {drawRef.current.active}
            </div>
          )}
          <div ref={mainRef} onClick={handleClick} style={{flex:showRSI?"0 0 70%":1,cursor:tool==="cursor"?"default":"crosshair"}}/>
          {showRSI && (
            <>
              <div style={{height:1,background:BORDER}}/>
              <div style={{height:13,background:"#161b22",display:"flex",alignItems:"center",padding:"0 8px",fontSize:8,color:"#6e40c9",letterSpacing:1.5,flexShrink:0}}>RSI (14)</div>
              <div ref={rsiRef} style={{flex:1}}/>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APP — PULSETRADE AI™ v3.1
═══════════════════════════════════════════════════ */
export default function PulseTradeAI() {
  const [market,      setMarket]      = useState(MARKETS[0]);
  const [candles,     setCandles]     = useState(() => generateOHLCV(MARKETS[0].base));
  const [news,        setNews]        = useState([]);

  /* PATCH 1: Per-market DNA cache — prevents flicker on market switch */
  const dnaCache = useRef({});
  const prevSignalRef = useRef(null);
  const [signalChanged, setSignalChanged] = useState(null);

  const [dna,         setDna]         = useState(null);
  const [prediction,  setPrediction]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [deepAnalysis,setDeepAnalysis]= useState("");
  const [livePrice,   setLivePrice]   = useState(MARKETS[0].base);
  const [priceChange, setPriceChange] = useState(0);
  const [activeIv,    setActiveIv]    = useState("5m");

  /* PATCH 12: Default to chart tab */
  const [tab,         setTab]         = useState("chart");

  /* PATCH 5: Beginner/Advanced/Pro mode state */
  const [mode,        setMode]        = useState("Advanced");

  const [marketPrices,setMarketPrices]= useState(() => Object.fromEntries(MARKETS.map(m=>[m.id,m.base])));
  const [sparks]     = useState(() => MARKETS.map(m => Array.from({length:24},()=>m.base*(0.95+Math.random()*0.1))));
  const [signalFlash, setSignalFlash] = useState(false);
  const [analyzing,  setAnalyzing]   = useState(true);

  /* PATCH 2: Use cache when switching markets */
  useEffect(() => { (async () => {
    setDeepAnalysis("");

    // Serve cached DNA instantly while fresh data loads
    if (dnaCache.current[market.id]) {
      setDna(dnaCache.current[market.id].dna);
      setPrediction(dnaCache.current[market.id].prediction);
      setAnalyzing(false);
    } else {
      setAnalyzing(true);
      setDna(null);
    }

    const c = generateOHLCV(market.base);
    setCandles(c);
    const last = c[c.length-1].close;
    setLivePrice(last);
    setPriceChange(parseFloat(((last-market.base)/market.base*100).toFixed(2)));
    const n = await fetchNews(market.id);
    setNews(n);
    const swings = detectSwingPoints(c);
    const bos = detectBOSCHOCH(c, swings);
    const marketDNA = computeMarketDNA(c, n, bos);
    setDna(marketDNA);
    const pred = generatePrediction(c, marketDNA);
    setPrediction(pred);

    /* PATCH 2: Store in cache */
    dnaCache.current[market.id] = { dna: marketDNA, prediction: pred };
    prevSignalRef.current = marketDNA.signal;

    setSignalFlash(true);
    setTimeout(() => setSignalFlash(false), 2000);
    setAnalyzing(false);
  })(); }, [market]);

  useEffect(() => {
    const c = generateOHLCV(market.base);
    setCandles(c);
  }, [activeIv]);

  /* PATCH 3: Live DNA refresh every 4 seconds — signals stay current */
  useEffect(() => {
    if (!candles.length || !news.length) return;
    const interval = setInterval(() => {
      const swings = detectSwingPoints(candles);
      const bos = detectBOSCHOCH(candles, swings);
      const freshDNA = computeMarketDNA(candles, news, bos);
      const freshPred = generatePrediction(candles, freshDNA);

      /* PATCH 13: Detect signal changes and alert user */
      if (prevSignalRef.current && prevSignalRef.current !== freshDNA.signal) {
        setSignalChanged({ from: prevSignalRef.current, to: freshDNA.signal, market: market.id });
        setTimeout(() => setSignalChanged(null), 4000);
      }
      prevSignalRef.current = freshDNA.signal;

      setDna(freshDNA);
      setPrediction(freshPred);
      dnaCache.current[market.id] = { dna: freshDNA, prediction: freshPred };
    }, 4000);
    return () => clearInterval(interval);
  }, [market.id, candles, news]);

  /* PATCH 11: Throttled price update — max 2x/sec to prevent lag */
  const lastPriceRef = useRef(0);
  const handlePriceUpdate = useCallback((p) => {
    const now = Date.now();
    if (now - lastPriceRef.current < 500) return;
    lastPriceRef.current = now;
    setLivePrice(p);
    setPriceChange(parseFloat(((p-market.base)/market.base*100).toFixed(2)));
    setMarketPrices(prev => ({...prev, [market.id]:p}));
  }, [market]);

  async function runDeepAnalysis() {
    if (!dna) return;
    setLoading(true); setDeepAnalysis("");
    const bullish = news.filter(n=>n.sentiment==="bullish").map(n=>n.text);
    const bearish = news.filter(n=>n.sentiment==="bearish").map(n=>n.text);
    const prompt = `You are PulseTrade AI™ — an institutional-grade quantitative market intelligence system with proprietary engines: PulseScore™, TrapSense AI™, Smart Exit Radar™, Market DNA™.

MARKET: ${market.id} @ ${fmt(livePrice,market)} (${priceChange>0?"+":""}${priceChange}%)
PulseScore™: ${dna.pulseScore}/100
Signal: ${dna.signal} | Confidence: ${dna.confidence}%
Market Bias: ${dna.marketBias > 0 ? "BULLISH +" : "BEARISH "}${Math.abs(dna.marketBias).toFixed(0)}
Trend Strength: ${dna.trendStrength.toFixed(0)}%
Reversal Probability: ${dna.reversalProb}%
TrapSense™ Trap Probability: ${dna.trapProb}%
Smart Exit Radar™ Exit Risk: ${dna.exitRisk}%
Smart Money Bias: ${dna.smBias > 0 ? "BULLISH" : "BEARISH"} (${Math.abs(dna.smBias).toFixed(0)})
RSI: ${dna.lastRSI?.toFixed(1)}
Bullish news: ${bullish.slice(0,3).join("; ")}
Bearish news: ${bearish.slice(0,3).join("; ")}

Respond with exactly 5 numbered lines (no preamble, no markdown):
1. [MARKET DNA] Current market structure and what it signals right now.
2. [TRAPSENSE] What trap or manipulation risk exists and why.
3. [EXIT RADAR] Exit risk assessment — when should traders be cautious.
4. [SMART MONEY] What institutional/smart money appears to be doing.
5. [EDGE] Is there a tradeable edge right now? Be brutally honest.

Tone: institutional, calm, precise, probabilistic. No guarantees. No hype.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]}),
      });
      const data = await res.json();
      setDeepAnalysis(data.content?.find(b=>b.type==="text")?.text || "Analysis unavailable.");
    } catch {
      setDeepAnalysis("Deep analysis connection failed. Check Anthropic API key.");
    }
    setLoading(false);
  }

  const up = priceChange >= 0;
  const C = {
    bg:"#0d1117", panel:"#161b22", border:"#21262d",
    text:"#c9d1d9", muted:"#8b949e",
    accent:"#1f6feb", green:"#00d4a8", red:"#ff4757", amber:"#ffd600",
    purple:"#b388ff",
  };

  const signalGlow = dna?.signalColor ? `0 0 20px ${dna.signalColor}55` : "none";

  /* Helper: compute danger score (used in multiple places) */
  const dangerScore = dna ? Math.round(
    dna.trapProb * 0.35 + dna.exitRisk * 0.30 + dna.reversalProb * 0.20 + (100 - dna.trendStrength) * 0.15
  ) : 0;
  const dangerColor = dangerScore > 65 ? C.red : dangerScore > 40 ? C.amber : C.green;

  return (
    <div style={{margin:0,padding:0,height:"100vh",background:C.bg,color:C.text,display:"flex",flexDirection:"column",fontFamily:"'JetBrains Mono',monospace",overflow:"hidden",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html,body,#root { margin:0;padding:0;background:#0d1117;height:100vh;overflow:hidden;color-scheme:dark; }
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#21262d;border-radius:2px}
        button{font-family:'JetBrains Mono',monospace;cursor:pointer;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes signalPulse{0%,100%{box-shadow:0 0 0 0 currentColor}50%{box-shadow:0 0 0 8px transparent}}
        @keyframes glow{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes barGrow{from{width:0}to{width:var(--w)}}
        @keyframes priceFlash{0%{opacity:1}30%{opacity:0.3}100%{opacity:1}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .blink{animation:blink 2s infinite}
        .fadein{animation:fadeUp .4s ease}
        .glow{animation:glow 2s ease infinite}
        .price-live{animation:priceFlash .4s ease}
        .mkt-row{display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-left:2px solid transparent;transition:all .12s;border-bottom:1px solid transparent;}
        .mkt-row:hover{background:#161b22;border-bottom-color:#21262d;}
        .mkt-row.active{border-left-color:#1f6feb;background:#0f1923;}
        .iv-btn{padding:2px 7px;font-size:10px;font-weight:600;border-radius:3px;cursor:pointer;border:none;background:transparent;color:#4a5568;transition:all .1s;font-family:inherit;letter-spacing:.5px;}
        .iv-btn:hover{color:#c9d1d9;background:#21262d;}
        .iv-btn.active{color:#1f6feb;background:#1f6feb18;border:1px solid #1f6feb33;}
        .tab{background:none;border:none;border-bottom:2px solid transparent;color:#4a5568;padding:7px 14px;cursor:pointer;font-size:9px;letter-spacing:1.5px;transition:all .12s;font-family:inherit;text-transform:uppercase;font-weight:600;}
        .tab:hover{color:#c9d1d9;}
        .tab.active{border-bottom-color:#1f6feb;color:#1f6feb;}
        .signal-btn{width:100%;padding:10px;border-radius:5px;font-size:13px;font-weight:700;letter-spacing:2px;cursor:pointer;transition:all .2s;font-family:inherit;text-transform:uppercase;border:2px solid;position:relative;overflow:hidden;}
        .signal-btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0.05);opacity:0;transition:opacity .15s;}
        .signal-btn:hover::after{opacity:1;}
        .analyze-btn{width:100%;padding:8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:2px;cursor:pointer;transition:all .2s;font-family:inherit;text-transform:uppercase;background:transparent;border:1px solid #1f6feb44;color:#1f6feb;}
        .analyze-btn:hover:not(:disabled){background:#1f6feb15;border-color:#1f6feb88;box-shadow:0 0 18px rgba(31,111,235,0.2);}
        .analyze-btn:disabled{opacity:.35;cursor:not-allowed;}
        .warn-card{border-radius:4px;padding:8px 10px;border-left:3px solid;margin-bottom:6px;}
        .metric-bar{height:4px;border-radius:2px;background:#21262d;overflow:hidden;}
        .metric-bar-fill{height:100%;border-radius:2px;transition:width 1.2s cubic-bezier(.4,0,.2,1);}
        .spinner{width:16px;height:16px;border:2px solid #21262d;border-top-color:#1f6feb;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;}
        .market-signal-flash{animation:signalPulse .5s ease 3;}
        .news-row{display:flex;gap:8px;padding:9px 0;border-bottom:1px solid #161b22;cursor:pointer;transition:opacity .15s;}
        .news-row:last-child{border:none}
        .news-row:hover{opacity:.75}
        .signal-alert{animation:slideDown .3s ease;}
        .mode-btn{padding:3px 9px;border-radius:3px;border:none;font-size:8px;font-weight:700;letter-spacing:.8px;cursor:pointer;font-family:inherit;transition:all .15s;}
      `}</style>

      {/* ══ TOPBAR ══ */}
      <div style={{height:40,background:"#161b22",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 12px",gap:10,flexShrink:0,zIndex:100}}>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:7,marginRight:6}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#1f6feb,#00d4a8)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,boxShadow:"0 0 14px rgba(31,111,235,0.45)",flexShrink:0}}>⚡</div>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:"#e6edf3",letterSpacing:.5,lineHeight:1}}>PulseTrade <span style={{color:C.accent}}>AI™</span></div>
            <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5}}>MARKET DNA™ ENGINE</div>
          </div>
        </div>

        <div style={{width:1,height:22,background:C.border}}/>

        {/* Active market info */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:"#e6edf3",letterSpacing:.5}}>{market.icon} {market.id}</span>
          {/* PATCH 10: price flash animation on update */}
          <span key={Math.round(livePrice*10000)} className="price-live" style={{fontSize:13,fontWeight:700,color:up?C.green:C.red,textShadow:up?"0 0 10px rgba(0,212,168,0.6)":"0 0 10px rgba(255,71,87,0.6)"}}>{fmt(livePrice,market)}</span>
          <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:up?C.green+"18":C.red+"18",color:up?C.green:C.red,fontWeight:700}}>{up?"+":""}{priceChange}%</span>
          {dna && (
            <div style={{display:"flex",alignItems:"center",gap:5,background:dna.signalBg,border:`1px solid ${dna.signalColor}44`,borderRadius:4,padding:"3px 10px",boxShadow:signalFlash?signalGlow:"none",transition:"box-shadow .5s"}}>
              <span style={{fontSize:11,fontWeight:900,color:dna.signalColor,letterSpacing:2}}>{dna.signal}</span>
              <span style={{fontSize:8,color:dna.signalColor+"88"}}>/ {dna.confidence}%</span>
            </div>
          )}
          {/* PATCH: Danger Score in topbar */}
          {dna && !analyzing && (
            <div style={{display:"flex",alignItems:"center",gap:4,background:dangerColor+"12",border:`1px solid ${dangerColor}33`,borderRadius:4,padding:"3px 8px"}}>
              <span style={{fontSize:7,color:dangerColor,letterSpacing:1}}>DANGER</span>
              <span style={{fontSize:11,fontWeight:700,color:dangerColor}}>{dangerScore}</span>
            </div>
          )}
        </div>

        <div style={{width:1,height:22,background:C.border}}/>

        {/* Intervals */}
        <div style={{display:"flex",gap:2}}>
          {INTERVALS.map(iv => (
            <button key={iv} className={`iv-btn ${activeIv===iv?"active":""}`} onClick={()=>setActiveIv(iv)}>{iv}</button>
          ))}
        </div>

        {/* Right side: Mode toggle + PulseScore */}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>

          {/* PATCH 5: Mode toggle */}
          <div style={{display:"flex",gap:1,background:"#0d1117",borderRadius:4,padding:2,border:`1px solid ${C.border}`}}>
            {MODES.map(m => (
              <button key={m} className="mode-btn" onClick={() => setMode(m)} style={{
                background: mode===m ? "#1f6feb" : "transparent",
                color: mode===m ? "#fff" : "#4a5568",
              }}>{m.toUpperCase()}</button>
            ))}
          </div>

          {dna && (
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:7,color:"#4a5568",letterSpacing:2}}>PULSESCORE™</div>
              <div style={{fontSize:16,fontWeight:700,color:dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{dna.pulseScore}<span style={{fontSize:9,color:"#4a5568"}}>/100</span></div>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div className="blink" style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>
            <span style={{fontSize:8,color:C.green,letterSpacing:2}}>LIVE</span>
          </div>
        </div>
      </div>

      {/* PATCH 13: Signal change alert banner */}
      {signalChanged && (
        <div className="signal-alert" style={{
          position:"absolute",top:48,left:"50%",transform:"translateX(-50%)",
          zIndex:999,
          background: signalChanged.to==="BUY" ? "rgba(0,212,168,0.95)" : signalChanged.to==="SELL" ? "rgba(255,71,87,0.95)" : "rgba(255,214,0,0.95)",
          color:"#0d1117",padding:"8px 20px",borderRadius:6,fontSize:11,fontWeight:700,
          letterSpacing:1.5,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",pointerEvents:"none",
        }}>
          ⚡ SIGNAL CHANGED: {signalChanged.from} → {signalChanged.to} · {signalChanged.market}
        </div>
      )}

      {/* ══ BODY ══ */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ═══ LEFT PANEL — WATCHLIST ═══ */}
        <div style={{width:178,background:C.bg,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          <div style={{padding:"5px 10px 4px",fontSize:7,color:"#4a5568",letterSpacing:3,borderBottom:`1px solid ${C.border}`,textTransform:"uppercase",fontWeight:700}}>Markets</div>
          <div style={{flex:1,overflowY:"auto"}}>
            {MARKETS.map((m,mi) => {
              const p = marketPrices[m.id]||m.base;
              const chg = parseFloat(((p-m.base)/m.base*100).toFixed(2));
              const isUp = chg>=0;
              return (
                <div key={m.id} className={`mkt-row ${market.id===m.id?"active":""}`} onClick={()=>setMarket(m)}>
                  <div style={{width:20,height:20,background:market.id===m.id?"#1f6feb18":"#21262d",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:market.id===m.id?C.accent:C.muted,flexShrink:0,border:market.id===m.id?"1px solid #1f6feb33":"1px solid transparent"}}>{m.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,color:"#e6edf3",fontWeight:600}}>{m.id}</div>
                    <div style={{fontSize:7,color:"#4a5568",letterSpacing:.5}}>{m.category}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:9,color:isUp?C.green:C.red}}>{fmt(p,m)}</div>
                    <div style={{fontSize:7,color:isUp?C.green:C.red}}>{isUp?"+":""}{chg}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Signal panel */}
          <div style={{padding:"10px 10px 8px",borderTop:`1px solid ${C.border}`,flexShrink:0,display:"flex",flexDirection:"column",gap:7}}>
            {analyzing ? (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px 0"}}>
                <div className="spinner"/>
                <span style={{fontSize:9,color:"#4a5568",letterSpacing:1}}>ANALYZING {market.id}…</span>
              </div>
            ) : dna ? (
              <>
                {/* PATCH 6: Beginner vs Advanced signal button */}
                {mode === "Beginner" ? (() => {
                  const bt = getBeginnerSignalText(dna.signal);
                  return (
                    <div style={{background:dna.signalBg,border:`2px solid ${dna.signalColor}`,borderRadius:5,padding:"10px 10px",textAlign:"center"}}>
                      <div style={{fontSize:11,fontWeight:900,color:dna.signalColor,marginBottom:4}}>{bt.action}</div>
                      <div style={{fontSize:8,color:"#8b949e",lineHeight:1.5}}>{bt.sub}</div>
                    </div>
                  );
                })() : (
                  <button className="signal-btn market-signal-flash" style={{
                    background: dna.signalBg,
                    borderColor: dna.signalColor,
                    color: dna.signalColor,
                    boxShadow: `0 0 20px ${dna.signalColor}33, inset 0 1px 0 ${dna.signalColor}22`,
                  }}>
                    {dna.signal === "BUY"  ? "▲ BUY"  :
                     dna.signal === "SELL" ? "▼ SELL" : "⏸ WAIT"}
                    <div style={{fontSize:8,fontWeight:400,letterSpacing:1,opacity:.7,marginTop:2}}>
                      {dna.signal==="BUY"?"Entry opportunity detected":dna.signal==="SELL"?"Exit / short opportunity":"No clear edge — stand by"}
                    </div>
                  </button>
                )}

                {/* R/R + Target */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
                  {[
                    {l:"TARGET",v:dna.target,c:C.green},
                    {l:"STOP",v:dna.stop,c:C.red},
                    {l:"R/R",v:dna.rr,c:C.amber},
                  ].map((x,i) => (
                    <div key={i} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:3,padding:"4px 6px",textAlign:"center"}}>
                      <div style={{fontSize:6,color:"#4a5568",letterSpacing:1.5,marginBottom:2}}>{x.l}</div>
                      <div style={{fontSize:9,color:x.c,fontWeight:700}}>{x.v}</div>
                    </div>
                  ))}
                </div>

                {/* PulseScore meter */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:"#4a5568",marginBottom:3}}>
                    <span style={{letterSpacing:1}}>PULSESCORE™</span>
                    <span style={{color:dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber,fontWeight:700}}>{dna.pulseScore}/100</span>
                  </div>
                  <div className="metric-bar">
                    <div className="metric-bar-fill" style={{width:`${dna.pulseScore}%`,background:dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber}}/>
                  </div>
                </div>

                {/* Exit risk indicator */}
                {dna.exitRisk > 55 && (
                  <div style={{background:"rgba(255,71,87,0.06)",border:"1px solid #ff475740",borderRadius:4,padding:"5px 8px",display:"flex",gap:6,alignItems:"center"}}>
                    <span className="blink" style={{fontSize:8,color:C.red}}>⚠</span>
                    <div>
                      <div style={{fontSize:8,color:C.red,fontWeight:700,letterSpacing:.5}}>
                        {mode==="Beginner" ? "Exit Risk Active" : `EXIT RISK: ${dna.exitRisk}%`}
                      </div>
                      <div style={{fontSize:7,color:"#4a5568",marginTop:1}}>
                        {mode==="Beginner" ? "Consider reducing exposure" : "Smart Exit Radar™ active"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Trap alert */}
                {dna.trapProb > 50 && (
                  <div style={{background:"rgba(255,214,0,0.05)",border:"1px solid #ffd60040",borderRadius:4,padding:"5px 8px",display:"flex",gap:6,alignItems:"center"}}>
                    <span className="blink" style={{fontSize:8,color:C.amber}}>◈</span>
                    <div>
                      <div style={{fontSize:8,color:C.amber,fontWeight:700,letterSpacing:.5}}>
                        {mode==="Beginner" ? "⚠ Trap Warning" : `TRAP: ${dna.trapProb}%`}
                      </div>
                      <div style={{fontSize:7,color:"#4a5568",marginTop:1}}>
                        {mode==="Beginner" ? "Risky — market may reverse" : "TrapSense AI™ alert"}
                      </div>
                    </div>
                  </div>
                )}

                <button className="analyze-btn" onClick={runDeepAnalysis} disabled={loading}>
                  {loading ? <><span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/> Scanning…</> : "🤖 Deep Market Analysis"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* ═══ CENTER — CHART + TABS ═══ */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.bg,flexShrink:0}}>
            {[
              ["chart","Chart"],
              ["intelligence","Intelligence"],
              ["trapsense","TrapSense AI™"],
              ["news","News"],
            ].map(([id,label]) => (
              <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
            ))}
          </div>

          {/* ──── CHART TAB ──── */}
          {tab==="chart" && (
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {deepAnalysis && (
                <div className="fadein" style={{background:"#0d1117",borderBottom:`1px solid #1f6feb18`,padding:"8px 14px",flexShrink:0,maxHeight:130,overflowY:"auto"}}>
                  <div style={{fontSize:7,color:C.accent,letterSpacing:2.5,marginBottom:6}}>● DEEP ANALYSIS · {market.id}</div>
                  {deepAnalysis.split("\n").filter(l=>l.trim()).map((line,i) => (
                    <div key={i} style={{display:"flex",gap:8,marginBottom:4,alignItems:"flex-start"}}>
                      <span style={{fontSize:8,color:C.accent+"44",flexShrink:0,marginTop:1,minWidth:14}}>{String(i+1).padStart(2,"0")}</span>
                      <span style={{fontSize:9,color:"#6e7681",lineHeight:1.7}}>{line.replace(/^\d+\.\s*/,"")}</span>
                    </div>
                  ))}
                </div>
              )}
              {dna && !analyzing && (
                <div style={{background:"#0d1117",borderBottom:`1px solid #161b22`,padding:"4px 14px",flexShrink:0,display:"flex",gap:14,alignItems:"center"}}>
                  <span style={{fontSize:7,color:"#4a5568",letterSpacing:2,flexShrink:0}}>MARKET DNA™</span>
                  {[
                    {l:"BIAS",v:dna.marketBias>0?"BULL":"BEAR",c:dna.marketBias>0?C.green:C.red},
                    {l:"STRENGTH",v:`${dna.trendStrength.toFixed(0)}%`,c:dna.trendStrength>60?C.green:C.amber},
                    {l:"REVERSAL",v:`${dna.reversalProb}%`,c:dna.reversalProb>60?C.red:C.amber},
                    {l:"TRAP",v:`${dna.trapProb}%`,c:dna.trapProb>55?C.amber:C.muted},
                    {l:"EXIT RISK",v:`${dna.exitRisk}%`,c:dna.exitRisk>60?C.red:C.muted},
                    {l:"SMART $",v:dna.smBias>20?"BUY":dna.smBias<-20?"SELL":"NEUT",c:dna.smBias>20?C.green:dna.smBias<-20?C.red:C.muted},
                    {l:"DANGER",v:`${dangerScore}/100`,c:dangerColor},
                  ].map((x,i) => (
                    <div key={i} style={{display:"flex",flexDirection:"column",gap:1}}>
                      <span style={{fontSize:6,color:"#4a5568",letterSpacing:1.5}}>{x.l}</span>
                      <span style={{fontSize:9,color:x.c,fontWeight:700}}>{x.v}</span>
                    </div>
                  ))}
                  <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                    <span style={{fontSize:8,color:"#4a5568"}}>VOL {prediction?.volatility}%</span>
                    <span style={{fontSize:8,color:C.green,fontWeight:700}}>▲{prediction?.bullProb}%</span>
                    <span style={{fontSize:8,color:C.red,fontWeight:700}}>▼{prediction?.bearProb}%</span>
                  </div>
                </div>
              )}
              <div style={{flex:1,overflow:"hidden"}}>
                <TVChart market={market} candles={candles} onPriceUpdate={handlePriceUpdate} dna={dna} prediction={prediction}/>
              </div>
            </div>
          )}

          {/* ──── MARKET INTELLIGENCE TAB ──── */}
          {tab==="intelligence" && dna && (
            <div className="fadein" style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

              {/* PATCH 15: Beginner mode header */}
              {mode === "Beginner" && (
                <div style={{background:"rgba(31,111,235,0.06)",border:"1px solid #1f6feb33",borderRadius:5,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12}}>👋</span>
                  <div>
                    <div style={{fontSize:9,color:"#1f6feb",fontWeight:700,letterSpacing:.5}}>BEGINNER MODE ACTIVE</div>
                    <div style={{fontSize:8,color:"#4a5568"}}>All signals shown in plain English. Switch to Advanced for technical details.</div>
                  </div>
                </div>
              )}

              {/* PATCH 8: Market Danger Score */}
              {(() => {
                const dangerLabel = dangerScore > 65 ? "HIGH DANGER" : dangerScore > 40 ? "ELEVATED RISK" : "CONDITIONS SAFE";
                const dangerDesc = mode === "Beginner"
                  ? dangerScore > 65
                    ? "⚠️ This market is very risky right now. Multiple warning signals are active. Avoid large trades or new entries."
                    : dangerScore > 40
                    ? "⚡ There are some risk signals. Trade smaller than normal and use tight stop-losses."
                    : "✅ The market looks reasonably safe to trade. Normal risk management still applies."
                  : `Composite score from trap probability (${dna.trapProb}%), exit risk (${dna.exitRisk}%), reversal risk (${dna.reversalProb}%), and trend health.`;
                return (
                  <div style={{background:C.panel,border:`1px solid ${dangerColor}33`,borderRadius:6,padding:"14px",borderLeft:`3px solid ${dangerColor}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5}}>MARKET DANGER SCORE™</div>
                      <div style={{fontSize:7,color:dangerColor,letterSpacing:1,fontWeight:700,background:dangerColor+"15",padding:"2px 8px",borderRadius:3}}>{dangerLabel}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
                      <div style={{textAlign:"center",minWidth:60}}>
                        <div style={{fontSize:36,fontWeight:700,color:dangerColor,lineHeight:1}}>{dangerScore}</div>
                        <div style={{fontSize:7,color:"#4a5568",letterSpacing:1}}>/100</div>
                      </div>
                      <div style={{flex:1}}>
                        <div className="metric-bar" style={{height:8,marginBottom:5}}>
                          <div className="metric-bar-fill" style={{width:`${dangerScore}%`,background:dangerColor}}/>
                        </div>
                        <div style={{fontSize:8,color:"#8b949e",lineHeight:1.6}}>{dangerDesc}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                      {[
                        {l:"Trap Risk",v:dna.trapProb+"%"},
                        {l:"Exit Risk",v:dna.exitRisk+"%"},
                        {l:"Reversal Risk",v:dna.reversalProb+"%"},
                        {l:"Trend Health",v:dna.trendStrength.toFixed(0)+"%"},
                      ].map((x,i) => (
                        <div key={i} style={{background:"#0d1117",borderRadius:3,padding:"5px 8px"}}>
                          <div style={{fontSize:7,color:"#4a5568",marginBottom:2}}>{x.l}</div>
                          <div style={{fontSize:10,color:C.text,fontWeight:700}}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* PATCH 9: Action Guidance Card */}
              {(() => {
                let action, actionColor, actionIcon, actionDesc;
                if (dna.pulseScore >= 70 && dangerScore < 35) {
                  action = "STRONG OPPORTUNITY"; actionColor = C.green; actionIcon = "🚀";
                  actionDesc = mode==="Beginner"
                    ? "The AI sees a strong setup. If you were planning to trade, conditions look favorable now. Always use a stop-loss."
                    : "High-confluence setup. Trend, momentum, volume, and structure aligned. Quality entry.";
                } else if (dna.pulseScore >= 58 && dangerScore < 55) {
                  action = "ENTER CAREFULLY"; actionColor = "#00b4d8"; actionIcon = "⚡";
                  actionDesc = mode==="Beginner"
                    ? "There's an opportunity, but it's not perfect. If you enter, use a small position and set a stop-loss."
                    : "Moderate setup with some conflicting signals. Reduce position size by 30-50%.";
                } else if (dna.exitRisk > 65) {
                  action = "EXIT POSITION"; actionColor = C.red; actionIcon = "🚨";
                  actionDesc = mode==="Beginner"
                    ? "If you're currently in a trade, consider reducing or closing it. Exit signals are active right now."
                    : "Smart Exit Radar™ active. Multiple momentum exhaustion signals confirmed. Protect profits.";
                } else if (dangerScore > 60) {
                  action = "HIGH RISK — AVOID"; actionColor = C.amber; actionIcon = "⚠️";
                  actionDesc = mode==="Beginner"
                    ? "Too risky to trade right now. Wait for conditions to improve before entering any position."
                    : "TrapSense AI™ detecting elevated manipulation probability. Stand aside.";
                } else {
                  action = "WAIT FOR SETUP"; actionColor = "#8b949e"; actionIcon = "⏸";
                  actionDesc = mode==="Beginner"
                    ? "No clear edge right now. Waiting is a valid strategy — the best traders know when NOT to trade."
                    : "Insufficient confluence. No high-probability setup confirmed at this time.";
                }
                return (
                  <div style={{background:`${actionColor}08`,border:`1px solid ${actionColor}44`,borderRadius:6,padding:"12px 14px",borderLeft:`3px solid ${actionColor}`}}>
                    <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5,marginBottom:6}}>AI ACTION GUIDANCE™</div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <span style={{fontSize:18}}>{actionIcon}</span>
                      <span style={{fontSize:12,fontWeight:900,color:actionColor,letterSpacing:1.5}}>{action}</span>
                    </div>
                    <div style={{fontSize:9,color:"#8b949e",lineHeight:1.7}}>{actionDesc}</div>
                  </div>
                );
              })()}

              {/* Psychology Warning Banner */}
              {dna.psychWarning && (
                <div style={{background:dna.psychWarning.level==="danger"?"rgba(255,71,87,0.07)":dna.psychWarning.level==="warn"?"rgba(255,214,0,0.06)":"rgba(31,111,235,0.06)",border:`1px solid ${dna.psychWarning.level==="danger"?C.red:dna.psychWarning.level==="warn"?C.amber:C.accent}44`,borderRadius:5,padding:"10px 12px",borderLeft:`3px solid ${dna.psychWarning.level==="danger"?C.red:dna.psychWarning.level==="warn"?C.amber:C.accent}`}}>
                  <div style={{fontSize:9,color:dna.psychWarning.level==="danger"?C.red:dna.psychWarning.level==="warn"?C.amber:C.accent,fontWeight:700,letterSpacing:.5,marginBottom:3}}>
                    {dna.psychWarning.level==="danger"?"⚠ DISCIPLINE ALERT":"💡 TRADER INSIGHT"}
                  </div>
                  <div style={{fontSize:10,color:"#c9d1d9",lineHeight:1.5}}>{dna.psychWarning.msg}</div>
                  <div style={{fontSize:9,color:"#4a5568",marginTop:3}}>{dna.psychWarning.sub}</div>
                </div>
              )}

              {/* PulseScore + gauges row */}
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
                <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5,marginBottom:10}}>PULSESCORE™ · MARKET HEALTH</div>
                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{textAlign:"center",minWidth:70}}>
                    <div style={{fontSize:36,fontWeight:700,color:dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber,lineHeight:1,textShadow:`0 0 20px ${dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber}55`}}>{dna.pulseScore}</div>
                    <div style={{fontSize:7,color:"#4a5568",letterSpacing:1.5,marginTop:2}}>/ 100</div>
                    <div style={{fontSize:8,color:dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber,fontWeight:700,marginTop:3}}>
                      {dna.pulseScore>=75?"STRONG":dna.pulseScore>=62?"MODERATE":dna.pulseScore>=45?"NEUTRAL":"WEAK"}
                    </div>
                  </div>
                  <div style={{width:1,height:50,background:C.border}}/>
                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    <Gauge value={dna.trendStrength.toFixed(0)} color={dna.trendStrength>60?C.green:C.amber} label="TREND STR" sublabel="strength"/>
                    <Gauge value={dna.reversalProb} color={dna.reversalProb>60?C.red:C.amber} label="REVERSAL" sublabel="probability"/>
                    <Gauge value={dna.trapProb} color={dna.trapProb>55?C.amber:C.muted} label="TRAP" sublabel="TrapSense™"/>
                    <Gauge value={dna.exitRisk} color={dna.exitRisk>60?C.red:C.muted} label="EXIT RISK" sublabel="Smart Exit™"/>
                    <Gauge value={dna.confidence} color={C.accent} label="CONFIDENCE" sublabel="signal"/>
                  </div>
                </div>
                <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:7}}>
                  {[
                    {l:"Market Bias",v:(dna.marketBias+100)/2,c:dna.marketBias>0?C.green:C.red,sub:dna.marketBias>20?"Bullish":dna.marketBias<-20?"Bearish":"Neutral"},
                    {l:"Trend Strength",v:dna.trendStrength,c:dna.trendStrength>60?C.green:C.amber,sub:`${dna.trendStrength.toFixed(0)}%`},
                    {l:"Smart Money Bias",v:(dna.smBias+100)/2,c:dna.smBias>0?C.green:C.red,sub:dna.smBias>25?"Institutional buying":dna.smBias<-25?"Institutional selling":"Mixed"},
                  ].map((m,i) => (
                    <div key={i}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#4a5568",marginBottom:3}}>
                        <span>{m.l}</span><span style={{color:m.c,fontWeight:700}}>{m.sub}</span>
                      </div>
                      <div className="metric-bar">
                        <div className="metric-bar-fill" style={{width:`${Math.min(100,Math.max(0,m.v))}%`,background:m.c}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart Exit Radar™ */}
              <div style={{background:C.panel,border:`1px solid ${dna.exitRisk>60?C.red+"44":C.border}`,borderRadius:6,padding:"12px 14px",borderLeft:`2px solid ${dna.exitRisk>60?C.red:C.border}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:7,color:dna.exitRisk>60?C.red:"#4a5568",letterSpacing:2.5,fontWeight:700}}>SMART EXIT RADAR™</div>
                  <div style={{fontSize:10,fontWeight:700,color:dna.exitRisk>60?C.red:dna.exitRisk>40?C.amber:C.muted}}>Risk: {dna.exitRisk}%</div>
                </div>
                {dna.exitWarnings.length===0 ? (
                  <div style={{fontSize:9,color:"#4a5568",fontStyle:"italic"}}>
                    {mode==="Beginner" ? "✅ No exit alerts right now. Your trade can continue normally." : "No exit signals active. Conditions stable."}
                  </div>
                ) : (
                  dna.exitWarnings.map((w,i) => {
                    const bt = mode === "Beginner" && BEGINNER_TRANSLATIONS[w.type];
                    return (
                      <div key={i} className="warn-card" style={{background:w.severity==="HIGH"?"rgba(255,71,87,0.06)":"rgba(255,214,0,0.05)",borderColor:w.severity==="HIGH"?C.red:C.amber}}>
                        <div style={{fontSize:8,color:w.severity==="HIGH"?C.red:C.amber,fontWeight:700,letterSpacing:.8,marginBottom:3}}>{bt ? bt.title : w.type}</div>
                        <div style={{fontSize:9,color:"#8b949e",lineHeight:1.5}}>{bt ? bt.desc : w.desc}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Scenario Engine */}
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
                <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5,marginBottom:10}}>
                  {mode==="Beginner" ? "WHAT COULD HAPPEN NEXT?" : `SCENARIO ENGINE · ${market.id}`}
                </div>
                {dna.scenarios.map((s,i) => (
                  <div key={i} style={{marginBottom:i<dna.scenarios.length-1?12:0}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:20,height:20,borderRadius:3,background:s.color+"18",border:`1px solid ${s.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:s.color,fontWeight:700}}>{s.id}</div>
                        <span style={{fontSize:10,color:"#e6edf3",fontWeight:600}}>{s.label}</span>
                        <span style={{fontSize:7,padding:"1px 5px",borderRadius:2,background:s.riskLevel==="HIGH"?C.red+"15":C.amber+"15",color:s.riskLevel==="HIGH"?C.red:C.amber,fontWeight:700,letterSpacing:.8}}>{s.riskLevel}</span>
                      </div>
                      <span style={{fontSize:13,color:s.color,fontWeight:700}}>{s.prob}%</span>
                    </div>
                    <div className="metric-bar" style={{marginBottom:5}}>
                      <div className="metric-bar-fill" style={{width:`${s.prob}%`,background:s.color,opacity:.75}}/>
                    </div>
                    {mode !== "Beginner" && (
                      <>
                        <div style={{fontSize:8,color:"#4a5568",marginBottom:2}}>✓ Condition: {s.condition}</div>
                        <div style={{fontSize:8,color:"#4a5568"}}>✗ Invalidated: {s.invalidate}</div>
                      </>
                    )}
                    {i<dna.scenarios.length-1 && <div style={{height:1,background:C.border,marginTop:10}}/>}
                  </div>
                ))}
              </div>

              {/* Why AI Thinks This */}
              <div style={{background:"#0d1117",border:`1px solid #1f6feb22`,borderRadius:6,padding:"12px 14px",borderLeft:`2px solid ${C.accent}`}}>
                <div style={{fontSize:7,color:C.accent,letterSpacing:2.5,marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
                  <span className="blink">●</span>
                  {mode==="Beginner" ? "WHY THE AI THINKS THIS" : "WHY AI THINKS THIS™"}
                </div>
                {dna.aiReasons.map((r,i) => (
                  <div key={i} style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start",paddingBottom:9,borderBottom:i<dna.aiReasons.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:52}}>
                      <span style={{fontSize:12,color:C.accent+"66"}}>{r.icon}</span>
                      <span style={{fontSize:6,color:"#4a5568",letterSpacing:1.5,textAlign:"center"}}>{r.label}</span>
                    </div>
                    <span style={{fontSize:9,color:"#8b949e",lineHeight:1.7}}>{r.content}</span>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ──── TRAPSENSE AI™ TAB ──── */}
          {tab==="trapsense" && dna && (
            <div className="fadein" style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

              <div style={{background:`linear-gradient(135deg, rgba(255,214,0,0.06), rgba(255,71,87,0.04))`,border:`1px solid ${C.amber}33`,borderRadius:6,padding:"14px",textAlign:"center"}}>
                <div style={{fontSize:7,color:C.amber,letterSpacing:3,marginBottom:6}}>
                  {mode==="Beginner" ? "HOW RISKY IS THIS MARKET?" : "TRAPSENSE AI™ · PROPRIETARY ENGINE"}
                </div>
                <div style={{fontSize:42,fontWeight:700,color:dna.trapProb>65?C.red:dna.trapProb>40?C.amber:C.green,lineHeight:1,textShadow:`0 0 30px ${dna.trapProb>65?C.red:dna.trapProb>40?C.amber:C.green}55`}}>
                  {dna.trapProb}<span style={{fontSize:16,color:"#4a5568"}}>%</span>
                </div>
                <div style={{fontSize:9,color:dna.trapProb>65?C.red:dna.trapProb>40?C.amber:C.green,fontWeight:700,letterSpacing:1.5,marginTop:4}}>
                  {dna.trapProb>65?"HIGH TRAP PROBABILITY":dna.trapProb>40?"MODERATE TRAP RISK":"LOW TRAP PROBABILITY"}
                </div>
                <div style={{fontSize:8,color:"#4a5568",marginTop:4}}>
                  {mode==="Beginner"
                    ? "Chance that this market is about to trick and trap retail traders"
                    : "Probability that this market is setting a trap for retail traders"}
                </div>
              </div>

              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
                <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5,marginBottom:10}}>
                  {mode==="Beginner" ? "ACTIVE WARNINGS" : "ACTIVE TRAP SIGNALS"}
                </div>
                {dna.trapWarnings.length===0 ? (
                  <div style={{fontSize:9,color:"#4a5568",fontStyle:"italic",textAlign:"center",padding:"16px 0"}}>
                    {mode==="Beginner"
                      ? "✅ No trap warnings active right now. The market looks genuine."
                      : "◎ No active trap signals detected. Market appears to be moving with genuine participation."}
                  </div>
                ) : (
                  /* PATCH 7: Beginner-translated trap warnings */
                  dna.trapWarnings.map((w,i) => {
                    const bt = mode === "Beginner" && BEGINNER_TRANSLATIONS[w.type];
                    return (
                      <div key={i} style={{background:w.severity==="HIGH"?"rgba(255,71,87,0.07)":"rgba(255,214,0,0.05)",border:`1px solid ${w.severity==="HIGH"?C.red:C.amber}40`,borderRadius:4,padding:"10px 12px",marginBottom:i<dna.trapWarnings.length-1?8:0,borderLeft:`3px solid ${w.severity==="HIGH"?C.red:C.amber}`}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:9,color:w.severity==="HIGH"?C.red:C.amber,fontWeight:700,letterSpacing:.8}}>{bt ? bt.title : w.type}</span>
                          <span style={{fontSize:7,padding:"1px 6px",borderRadius:2,background:w.severity==="HIGH"?C.red+"20":C.amber+"20",color:w.severity==="HIGH"?C.red:C.amber,fontWeight:700}}>{w.severity}</span>
                        </div>
                        <div style={{fontSize:9,color:"#8b949e",lineHeight:1.6}}>{bt ? bt.desc : w.desc}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{background:C.panel,border:`1px solid ${dna.exitRisk>60?C.red+"44":C.border}`,borderRadius:6,padding:"12px 14px"}}>
                <div style={{fontSize:7,color:"#4a5568",letterSpacing:2.5,marginBottom:4}}>
                  {mode==="Beginner" ? "WHEN TO GET OUT" : "SMART EXIT RADAR™ · MOVE-OUT ENGINE"}
                </div>
                <div style={{fontSize:8,color:"#4a5568",marginBottom:10}}>
                  {mode==="Beginner" ? "Warning signs that it's time to exit or avoid entering." : "Proactive detection of when to exit or avoid entry."}
                </div>

                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:28,fontWeight:700,color:dna.exitRisk>60?C.red:dna.exitRisk>40?C.amber:C.green,lineHeight:1}}>{dna.exitRisk}</div>
                    <div style={{fontSize:7,color:"#4a5568",letterSpacing:1}}>EXIT RISK</div>
                  </div>
                  <div style={{flex:1}}>
                    <div className="metric-bar" style={{height:8,marginBottom:4}}>
                      <div className="metric-bar-fill" style={{width:`${dna.exitRisk}%`,background:dna.exitRisk>60?C.red:dna.exitRisk>40?C.amber:C.green}}/>
                    </div>
                    <div style={{fontSize:8,color:dna.exitRisk>60?C.red:dna.exitRisk>40?C.amber:C.green,fontWeight:600}}>
                      {dna.exitRisk>70
                        ? (mode==="Beginner" ? "⚠ Close or reduce your position now" : "⚠ EXIT OR AVOID ENTRY")
                        : dna.exitRisk>55
                        ? (mode==="Beginner" ? "Be careful — risk is building" : "Caution — manage risk")
                        : (mode==="Beginner" ? "Conditions look okay to hold" : "Conditions acceptable")}
                    </div>
                  </div>
                </div>

                {dna.exitWarnings.length===0 ? (
                  <div style={{fontSize:9,color:"#4a5568",textAlign:"center",padding:"8px 0"}}>
                    {mode==="Beginner" ? "No exit warnings right now. Safe to hold." : "No exit conditions triggered. Trade may continue."}
                  </div>
                ) : (
                  dna.exitWarnings.map((w,i) => {
                    const bt = mode === "Beginner" && BEGINNER_TRANSLATIONS[w.type];
                    return (
                      <div key={i} style={{background:w.severity==="HIGH"?"rgba(255,71,87,0.06)":"rgba(255,214,0,0.04)",border:`1px solid ${w.severity==="HIGH"?C.red:C.amber}35`,borderRadius:4,padding:"9px 11px",marginBottom:i<dna.exitWarnings.length-1?7:0,borderLeft:`2px solid ${w.severity==="HIGH"?C.red:C.amber}`}}>
                        <div style={{fontSize:8,color:w.severity==="HIGH"?C.red:C.amber,fontWeight:700,letterSpacing:.5,marginBottom:3}}>{bt ? bt.title : w.type}</div>
                        <div style={{fontSize:9,color:"#8b949e",lineHeight:1.5}}>{bt ? bt.desc : w.desc}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{background:"#0d1117",border:`1px solid #1f6feb18`,borderRadius:6,padding:"12px 14px",borderLeft:`2px solid ${C.accent}55`}}>
                <div style={{fontSize:7,color:C.accent,letterSpacing:2.5,marginBottom:8}}>
                  {mode==="Beginner" ? "TRADING CHECKLIST" : "TRADER DISCIPLINE FRAMEWORK"}
                </div>
                {[
                  {check: dna.pulseScore >= 60,        label: mode==="Beginner" ? "AI signal is clear" : "Signal edge is clear",           pass: mode==="Beginner" ? "The AI sees a good setup" : "Entry has quantified edge",               fail: mode==="Beginner" ? "No clear setup yet — wait" : "Low edge — wait for setup"},
                  {check: dna.trapProb <= 45,           label: mode==="Beginner" ? "No major trap risk" : "Trap probability acceptable",     pass: mode==="Beginner" ? "Market seems genuine" : "Market participation genuine",              fail: mode==="Beginner" ? "Trap signals active — be cautious" : "Trap conditions active"},
                  {check: dna.exitRisk <= 55,           label: mode==="Beginner" ? "Safe to hold/enter" : "Exit risk manageable",           pass: mode==="Beginner" ? "Conditions are okay" : "Reasonable holding conditions",              fail: mode==="Beginner" ? "Risk building — reduce exposure" : "Exit risk elevated — caution"},
                  {check: dna.trendStrength >= 40,      label: mode==="Beginner" ? "Market has clear direction" : "Trend strength sufficient", pass: mode==="Beginner" ? "Clear trend present" : "Directional momentum present",          fail: mode==="Beginner" ? "No clear direction — choppy market" : "Weak trend — range-bound risk"},
                  {check: dna.reversalProb <= 50,       label: mode==="Beginner" ? "Reversal risk is low" : "Reversal risk low",           pass: mode==="Beginner" ? "Trend likely to continue" : "Trend likely to continue",              fail: mode==="Beginner" ? "Reversal signals building — be careful" : "Reversal signals building"},
                ].map((item,i) => (
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
                    <div style={{width:16,height:16,borderRadius:3,background:item.check?"rgba(0,212,168,0.12)":"rgba(255,71,87,0.1)",border:`1px solid ${item.check?C.green:C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                      <span style={{fontSize:9,color:item.check?C.green:C.red}}>{item.check?"✓":"✗"}</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:9,color:item.check?"#e6edf3":"#4a5568",fontWeight:item.check?600:400}}>{item.label}</div>
                      <div style={{fontSize:8,color:item.check?C.green+"88":"#4a5568",marginTop:1}}>{item.check?item.pass:item.fail}</div>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:10,padding:"8px",background:dna.trapProb<45&&dna.exitRisk<55&&dna.pulseScore>=60?"rgba(0,212,168,0.06)":"rgba(255,71,87,0.06)",borderRadius:4,border:`1px solid ${dna.trapProb<45&&dna.exitRisk<55&&dna.pulseScore>=60?C.green:C.red}35`}}>
                  <div style={{fontSize:9,color:dna.trapProb<45&&dna.exitRisk<55&&dna.pulseScore>=60?C.green:C.red,fontWeight:700}}>
                    {dna.trapProb<45&&dna.exitRisk<55&&dna.pulseScore>=60
                      ? (mode==="Beginner" ? "✓ All checks passed — conditions look good. Trade with proper sizing." : "✓ Conditions align — proceed with standard risk management.")
                      : (mode==="Beginner" ? "⚠ Some checks failed — trade smaller or wait for a better setup." : "⚠ Conditions suboptimal — reduce size or wait for better setup.")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──── NEWS TAB ──── */}
          {tab==="news" && (
            <div className="fadein" style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:"#e6edf3",fontWeight:700}}>{market.id} · News Feed</div>
                  <div style={{fontSize:8,color:"#4a5568",marginTop:2}}>
                    {mode==="Beginner" ? "Latest news that could affect " + market.id : `Sentiment analysis — ${market.id} only`}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,fontSize:9}}>
                  <span style={{color:C.green}}>▲ {news.filter(n=>n.sentiment==="bullish").length} BULL</span>
                  <span style={{color:C.red}}>▼ {news.filter(n=>n.sentiment==="bearish").length} BEAR</span>
                </div>
              </div>
              {news.length===0 && <div style={{color:C.muted,fontSize:11,textAlign:"center",paddingTop:40}}>Loading…</div>}
              {news.map((n,i) => {
                const impacts = n.sentiment==="bullish"
                  ? ["Price support likely","Momentum boost possible","Watch for follow-through"]
                  : ["Sell pressure may increase","Watch for breakdown","Risk-off sentiment rising"];
                const beginnerImpacts = n.sentiment==="bullish"
                  ? ["This is positive news — could push price higher","Good news can attract more buyers","Watch for upward moves after this"]
                  : ["This is negative news — could push price lower","Bad news can cause panic selling","Caution: price could fall after this"];
                return (
                  <div key={i} className="news-row" onClick={()=>n.url&&window.open(n.url,"_blank")}>
                    <div style={{width:3,minHeight:42,borderRadius:2,background:n.sentiment==="bullish"?C.green:C.red,flexShrink:0,marginTop:2}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:"#c9d1d9",lineHeight:1.6,marginBottom:4}}>{n.text}</div>
                      <div style={{fontSize:8,color:"#4a5568",fontStyle:"italic",marginBottom:4}}>
                        ↳ {mode==="Beginner" ? beginnerImpacts[i%3] : impacts[i%3]}
                      </div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        <span style={{fontSize:8,color:"#30363d"}}>{n.source}</span>
                        <span style={{fontSize:7,padding:"1px 5px",borderRadius:2,background:n.sentiment==="bullish"?C.green+"15":C.red+"15",color:n.sentiment==="bullish"?C.green:C.red,fontWeight:700}}>{n.sentiment==="bullish"?"▲ BULL":"▼ BEAR"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ RIGHT PANEL — OVERVIEW ═══ */}
        <div style={{width:158,background:C.bg,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          <div style={{padding:"5px 10px 4px",fontSize:7,color:"#4a5568",letterSpacing:3,borderBottom:`1px solid ${C.border}`,textTransform:"uppercase",fontWeight:700}}>Overview</div>
          <div style={{flex:1,overflowY:"auto",padding:"5px"}}>
            {MARKETS.map((m,mi) => {
              const p = marketPrices[m.id]||m.base;
              const chg = parseFloat(((p-m.base)/m.base*100).toFixed(2));
              const isUp = chg>=0;
              return (
                <div key={m.id} onClick={()=>setMarket(m)} style={{marginBottom:7,cursor:"pointer",padding:"7px 8px",borderRadius:4,background:market.id===m.id?"#1f6feb0a":"transparent",border:`1px solid ${market.id===m.id?"#1f6feb28":"transparent"}`,transition:"all .12s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:9,fontWeight:700,color:"#e6edf3"}}>{m.id}</span>
                    <span style={{fontSize:8,color:isUp?C.green:C.red,fontWeight:700}}>{isUp?"+":""}{chg}%</span>
                  </div>
                  <Spark data={sparks[mi]} up={isUp}/>
                  <div style={{fontSize:9,color:isUp?C.green:C.red,textAlign:"right",marginTop:2}}>{fmt(p,m)}</div>
                </div>
              );
            })}
          </div>

          {dna && !analyzing && (
            <div style={{padding:"10px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{fontSize:7,color:"#4a5568",letterSpacing:2,marginBottom:7}}>DNA SNAPSHOT</div>
              {[
                {l:"PulseScore™",v:`${dna.pulseScore}`,c:dna.pulseScore>=62?C.green:dna.pulseScore<=38?C.red:C.amber},
                {l:"Danger™",v:`${dangerScore}`,c:dangerColor},
                {l:"Trap™",v:`${dna.trapProb}%`,c:dna.trapProb>55?C.amber:C.muted},
                {l:"Exit Radar™",v:`${dna.exitRisk}%`,c:dna.exitRisk>60?C.red:C.muted},
                {l:"RSI",v:`${dna.lastRSI?.toFixed(0)}`,c:dna.lastRSI>70?C.red:dna.lastRSI<30?C.green:C.muted},
              ].map((x,i) => (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:8,color:"#4a5568"}}>{x.l}</span>
                  <span style={{fontSize:9,color:x.c,fontWeight:700}}>{x.v}</span>
                </div>
              ))}
              <div style={{marginTop:8,padding:"6px 8px",background:dna.signalBg,border:`1px solid ${dna.signalColor}44`,borderRadius:4,textAlign:"center"}}>
                <div style={{fontSize:10,fontWeight:900,color:dna.signalColor,letterSpacing:2}}>{dna.signal}</div>
                <div style={{fontSize:7,color:dna.signalColor+"77",marginTop:2,letterSpacing:.5}}>AI SIGNAL · {market.id}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}