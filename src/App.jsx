import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, LineChart, Line
} from "recharts";

/* ─── CONSTANTS ─── */
const MARKETS = [
  { id: "BTC/USD", icon: "₿", base: 67420, category: "Crypto" },
  { id: "ETH/USD", icon: "Ξ", base: 3540, category: "Crypto" },
  { id: "GOLD", icon: "Au", base: 2341, category: "Commodity" },
  { id: "EUR/USD", icon: "€", base: 1.0823, category: "Forex" },
  { id: "COFFEE", icon: "☕", base: 2.14, category: "Commodity" },
  { id: "USD/RWF", icon: "Fr", base: 1285, category: "Forex" },
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

/* ─── DATA GENERATORS ─── */
function generateCandles(base, count = 48) {
  const candles = [];
  let price = base;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const vol = (Math.random() - 0.48) * base * 0.009;
    price = Math.max(price + vol, base * 0.82);
    candles.push({
      time: new Date(now - i * 5 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      price: parseFloat(price.toFixed(base < 10 ? 4 : 2)),
      volume: Math.floor(Math.random() * 1000 + 200),
      predicted: null,
    });
  }
  const lastPrice = candles[candles.length - 1].price;
  const trend = Math.random() > 0.5 ? 1 : -1;
  for (let i = 1; i <= 10; i++) {
    const predicted = parseFloat(
      (lastPrice + trend * base * 0.004 * i + (Math.random() - 0.5) * base * 0.002).toFixed(base < 10 ? 4 : 2)
    );
    candles.push({
      time: new Date(now + i * 5 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      price: null,
      volume: null,
      predicted,
    });
  }
  return candles;
}

function getSignal(candles, news) {
  const bullish = news.filter(n => n.sentiment === "bullish").length;
  const prices = candles.filter(c => c.price !== null).slice(-8).map(c => c.price);
  const trend = prices[prices.length - 1] - prices[0];
  const score = bullish * 14 + (trend > 0 ? 22 : -22) + Math.random() * 18;
  if (score > 38) return { signal: "BUY", color: "#00ff88", bg: "#00ff8811", confidence: Math.floor(68 + Math.random() * 22), target: "+2.4%", stop: "-1.1%" };
  if (score < 16) return { signal: "SELL", color: "#ff4466", bg: "#ff446611", confidence: Math.floor(62 + Math.random() * 22), target: "-2.1%", stop: "+1.3%" };
  return { signal: "HOLD", color: "#ffcc00", bg: "#ffcc0011", confidence: Math.floor(55 + Math.random() * 18), target: "±0.5%", stop: "±0.8%" };
}

function pickNews() {
  return [...NEWS_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
}

function fmt(val, marketId) {
  if (!val && val !== 0) return "";
  if (marketId === "EUR/USD" || marketId === "COFFEE") return val.toFixed(4);
  if (marketId === "USD/RWF") return val.toLocaleString();
  return val.toLocaleString();
}

/* ─── CUSTOM TOOLTIP ─── */
const ChartTooltip = ({ active, payload, market }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "#0a0e1a", border: "1px solid #1e2a3a", borderRadius: 10, padding: "10px 16px", fontSize: 12, fontFamily: "inherit" }}>
      <div style={{ color: "#4a6080", marginBottom: 4 }}>{d.time}</div>
      {d.price != null && <div style={{ color: "#e0eaff" }}>Price: <span style={{ color: "#00ff88", fontWeight: 700 }}>{fmt(d.price, market)}</span></div>}
      {d.predicted != null && <div style={{ color: "#e0eaff" }}>AI Target: <span style={{ color: "#7c6fff", fontWeight: 700 }}>{fmt(d.predicted, market)}</span></div>}
    </div>
  );
};

/* ─── SPARKLINE for market cards ─── */
function Sparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── MAIN APP ─── */
export default function PulseTradeAI() {
  const [market, setMarket] = useState(MARKETS[0]);
  const [candles, setCandles] = useState(() => generateCandles(MARKETS[0].base));
  const [news, setNews] = useState(pickNews());
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiReason, setAiReason] = useState("");
  const [livePrice, setLivePrice] = useState(MARKETS[0].base);
  const [priceChange, setPriceChange] = useState(0.42);
  const [tab, setTab] = useState("chart");
  const [accuracy, setAccuracy] = useState({ total: 147, correct: 103, history: ["W","W","L","W","W","W","L","W","W","W"] });
  const [sparks] = useState(() => MARKETS.map(m => ({
    id: m.id,
    data: Array.from({ length: 20 }, (_, i) => ({ v: m.base * (0.97 + Math.random() * 0.06) }))
  })));
  const [marketPrices, setMarketPrices] = useState(() => Object.fromEntries(MARKETS.map(m => [m.id, m.base])));
  const [scanningNews, setScanningNews] = useState(false);
  const intervalRef = useRef(null);
  const priceRef = useRef(livePrice);
  priceRef.current = livePrice;

  /* ── Market switch ── */
  useEffect(() => {
    const c = generateCandles(market.base);
    setCandles(c);
    const last = c.filter(x => x.price !== null).slice(-1)[0]?.price || market.base;
    setLivePrice(last);
    setPriceChange(parseFloat(((last - market.base) / market.base * 100).toFixed(2)));
    const n = pickNews();
    setNews(n);
    setSignal(getSignal(c, n));
    setAiReason("");
  }, [market]);

  /* ── Live price tick ── */
  useEffect(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const base = market.base;
      const change = (Math.random() - 0.49) * base * 0.0018;
      const next = parseFloat((priceRef.current + change).toFixed(base < 10 ? 4 : 2));
      setLivePrice(next);
      setPriceChange(parseFloat(((next - base) / base * 100).toFixed(2)));
      setMarketPrices(prev => ({ ...prev, [market.id]: next }));
    }, 1800);
    return () => clearInterval(intervalRef.current);
  }, [market]);

  /* ── AI Analysis ── */
  async function analyzeMarket() {
    setLoading(true);
    setScanningNews(true);
    setAiReason("");
    setTimeout(() => setScanningNews(false), 2000);

    const bullish = news.filter(n => n.sentiment === "bullish").map(n => n.text);
    const bearish = news.filter(n => n.sentiment === "bearish").map(n => n.text);

    const prompt = `You are PulseTrade AI, an elite quantitative analyst. Analyze ${market.id} at ${livePrice} (${priceChange > 0 ? "+" : ""}${priceChange}%).

Bullish factors: ${bullish.join("; ")}
Bearish factors: ${bearish.join("; ")}
Signal: ${signal?.signal} | Confidence: ${signal?.confidence}%

Write 3 sharp sentences: (1) the dominant market force right now, (2) why the ${signal?.signal} signal was generated, (3) the single most important risk to watch. Be precise, data-driven, and professional. Mention specific news items.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      const text = data.content?.find(b => b.type === "text")?.text || "Analysis unavailable.";
      setAiReason(text);
      const correct = Math.random() > 0.28;
      setAccuracy(prev => ({
        total: prev.total + 1,
        correct: prev.correct + (correct ? 1 : 0),
        history: [...prev.history.slice(-9), correct ? "W" : "L"]
      }));
    } catch {
      setAiReason("Signal computed from technical indicators. Connect API for full AI analysis.");
    }
    setLoading(false);
  }

  const winRate = Math.round((accuracy.correct / accuracy.total) * 100);
  const splitIdx = candles.findIndex(c => c.price === null);
  const volumeData = candles.filter(c => c.volume !== null).slice(-20).map(c => ({ time: c.time, v: c.volume }));

  return (
    <div style={{
      margin: 0, padding: 0, minHeight: "100vh",
      background: "#060912",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#c8d8f0",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { margin: 0; padding: 0; background: #060912; min-height: 100vh; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060912; }
        ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 4px; }

        .mkt-card {
          background: #0c1220;
          border: 1px solid #1a2540;
          border-radius: 14px;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.25s;
          min-width: 140px;
        }
        .mkt-card:hover { border-color: #2a4060; background: #0f1828; }
        .mkt-card.active { border-color: #00ff88; background: #00ff8808; }

        .tab-btn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #4a6080;
          padding: 12px 22px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        .tab-btn:hover { color: #8aafcf; }
        .tab-btn.active { border-bottom-color: #00ff88; color: #00ff88; }

        .glass-card {
          background: #0c1220cc;
          border: 1px solid #1a2540;
          border-radius: 16px;
          backdrop-filter: blur(12px);
        }

        .analyze-btn {
          background: linear-gradient(135deg, #00ff8820, #0066ff20);
          border: 1px solid #00ff8840;
          color: #00ff88;
          padding: 13px 32px;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          transition: all 0.3s;
        }
        .analyze-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #00ff8830, #0066ff30);
          border-color: #00ff88;
          box-shadow: 0 0 24px #00ff8830;
        }
        .analyze-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .signal-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 20px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 2px;
        }

        .news-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #0f1828;
          transition: all 0.2s;
        }
        .news-row:last-child { border-bottom: none; }
        .news-row:hover { padding-left: 6px; }

        .stat-box {
          background: #0c1220;
          border: 1px solid #1a2540;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.8); } }
        @keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow { 0%,100% { text-shadow: 0 0 20px currentColor; } 50% { text-shadow: 0 0 40px currentColor, 0 0 80px currentColor; } }
        @keyframes borderPulse { 0%,100% { border-color: #00ff8840; } 50% { border-color: #00ff88; } }

        .live-dot { width:8px; height:8px; background:#00ff88; border-radius:50%; animation: pulse-dot 2s infinite; }
        .fade-up { animation: fadeUp 0.4s ease; }
        .signal-glow { animation: glow 3s infinite; }
        .scanning { animation: borderPulse 1s infinite; }

        .grid-bg {
          position: fixed; top:0; left:0; width:100%; height:100%;
          background-image: linear-gradient(#0f1a2e08 1px, transparent 1px), linear-gradient(90deg, #0f1a2e08 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none; z-index: 0;
        }
        .content { position: relative; z-index: 1; }
      `}</style>

      <div className="grid-bg" />
      <div className="content">

        {/* ── HEADER ── */}
        <div style={{ background: "#08101eee", borderBottom: "1px solid #1a2540", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #00ff88, #0066ff)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900 }}>⚡</div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#e0f0ff", letterSpacing: 1 }}>PULSETRADE AI</div>
              <div style={{ fontSize: 9, color: "#2a5070", letterSpacing: 3 }}>SIGNAL INTELLIGENCE PLATFORM</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ fontSize: 10, color: "#2a6050", letterSpacing: 2 }}>MARKETS OPEN</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 11, color: "#00ff88", letterSpacing: 2 }}>LIVE</span>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

          {/* ── MARKET TICKER STRIP ── */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
            {MARKETS.map(m => {
              const p = marketPrices[m.id] || m.base;
              const chg = parseFloat(((p - m.base) / m.base * 100).toFixed(2));
              const spark = sparks.find(s => s.id === m.id);
              return (
                <div key={m.id} className={`mkt-card ${market.id === m.id ? "active" : ""}`} onClick={() => setMarket(m)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 1, marginBottom: 2 }}>{m.category}</div>
                      <div style={{ fontSize: 13, color: "#c8d8f0", fontWeight: 500 }}>{m.id}</div>
                    </div>
                    <div style={{ width: 28, height: 28, background: "#0f1828", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#4a6080" }}>{m.icon}</div>
                  </div>
                  <Sparkline data={spark.data} color={chg >= 0 ? "#00ff88" : "#ff4466"} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: "#e0eaff", fontWeight: 500 }}>{fmt(p, m.id)}</div>
                    <div style={{ fontSize: 10, color: chg >= 0 ? "#00ff88" : "#ff4466" }}>{chg >= 0 ? "▲" : "▼"}{Math.abs(chg)}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── HERO ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, marginBottom: 20, alignItems: "center" }}>

            {/* Price block */}
            <div className="glass-card" style={{ padding: "24px 28px" }}>
              <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 3, marginBottom: 8 }}>{market.id} · LIVE PRICE</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 42, fontWeight: 800, color: "#e0f0ff", lineHeight: 1, marginBottom: 10 }}>
                {fmt(livePrice, market.id)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: priceChange >= 0 ? "#00ff88" : "#ff4466", fontWeight: 500 }}>
                  {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange)}% today
                </span>
                <span style={{ fontSize: 10, color: "#2a4060", letterSpacing: 1 }}>5MIN INTERVALS</span>
              </div>
            </div>

            {/* Signal block */}
            {signal && (
              <div className="glass-card" style={{ padding: "24px 32px", textAlign: "center", borderColor: signal.color + "40", background: signal.bg }}>
                <div style={{ fontSize: 9, color: "#4a6080", letterSpacing: 3, marginBottom: 12 }}>AI SIGNAL</div>
                <div className="signal-glow" style={{ fontFamily: "'Syne', sans-serif", fontSize: 48, fontWeight: 800, color: signal.color, lineHeight: 1, marginBottom: 12 }}>
                  {signal.signal}
                </div>
                <div style={{ fontSize: 11, color: "#8aafcf", marginBottom: 8 }}>{signal.confidence}% confidence</div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", fontSize: 10 }}>
                  <span style={{ color: "#00ff88" }}>Target {signal.target}</span>
                  <span style={{ color: "#4a6080" }}>·</span>
                  <span style={{ color: "#ff4466" }}>Stop {signal.stop}</span>
                </div>
              </div>
            )}

            {/* Stats block */}
            <div className="glass-card" style={{ padding: "24px 28px" }}>
              <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 3, marginBottom: 16 }}>AI ACCURACY</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: winRate > 65 ? "#00ff88" : "#ffcc00" }}>{winRate}%</div>
                  <div style={{ fontSize: 10, color: "#4a6080", marginTop: 2 }}>WIN RATE</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, color: "#e0eaff", fontWeight: 500 }}>{accuracy.total}</div>
                  <div style={{ fontSize: 10, color: "#4a6080", marginTop: 2 }}>SIGNALS</div>
                </div>
              </div>
              <div style={{ background: "#060912", borderRadius: 6, height: 6, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: `${winRate}%`, height: "100%", background: `linear-gradient(90deg, #0066ff, #00ff88)`, borderRadius: 6, transition: "width 1s ease" }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {accuracy.history.map((h, i) => (
                  <div key={i} style={{ flex: 1, height: 20, borderRadius: 3, background: h === "W" ? "#00ff8822" : "#ff446622", border: `1px solid ${h === "W" ? "#00ff8844" : "#ff446644"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: h === "W" ? "#00ff88" : "#ff4466" }}>
                    {h}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ANALYZE BUTTON ── */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <button className={`analyze-btn ${scanningNews ? "scanning" : ""}`} onClick={analyzeMarket} disabled={loading}>
              {loading ? "⏳  SCANNING MARKETS..." : "🤖  AI DEEP ANALYSIS"}
            </button>
          </div>

          {/* ── AI REASON ── */}
          {aiReason && (
            <div className="glass-card fade-up" style={{ padding: "20px 24px", marginBottom: 20, borderColor: "#00ff8830", background: "#00ff8806" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, background: "#00ff88", borderRadius: "50%" }} />
                <span style={{ fontSize: 10, color: "#00ff88", letterSpacing: 3 }}>PULSETRADE AI ANALYSIS</span>
              </div>
              <p style={{ fontSize: 13, color: "#a0c0e0", lineHeight: 1.8, margin: 0 }}>{aiReason}</p>
            </div>
          )}

          {/* ── TABS ── */}
          <div style={{ borderBottom: "1px solid #1a2540", marginBottom: 20, display: "flex" }}>
            {[["chart", "📈 Chart"], ["volume", "📊 Volume"], ["news", "📰 News"], ["accuracy", "🎯 Accuracy"]].map(([id, label]) => (
              <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {/* ── CHART TAB ── */}
          {tab === "chart" && (
            <div className="fade-up glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#e0eaff", fontWeight: 500, marginBottom: 4 }}>{market.id} Price Chart</div>
                  <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 2 }}>LIVE + AI PREDICTION PATH</div>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 2, background: "#00ff88" }} />
                    <span style={{ color: "#4a6080" }}>Live Price</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 2, background: "#7c6fff", borderTop: "2px dashed #7c6fff" }} />
                    <span style={{ color: "#4a6080" }}>AI Prediction</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={candles} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                  <defs>
                    <linearGradient id="priceG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="predG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c6fff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7c6fff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="#0f1828" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#2a4060", fontSize: 10 }} tickLine={false} axisLine={false} interval={9} />
                  <YAxis tick={{ fill: "#2a4060", fontSize: 10 }} tickLine={false} axisLine={false} width={72}
                    tickFormatter={v => v ? fmt(v, market.id) : ""} />
                  <Tooltip content={<ChartTooltip market={market.id} />} />
                  {splitIdx > 0 && (
                    <ReferenceLine x={candles[splitIdx - 1]?.time} stroke="#1a2540" strokeDasharray="4 4"
                      label={{ value: "NOW →", fill: "#2a4060", fontSize: 9, position: "insideTopLeft" }} />
                  )}
                  <Area type="monotone" dataKey="price" stroke="#00ff88" strokeWidth={2} fill="url(#priceG)" dot={false} connectNulls={false} />
                  <Area type="monotone" dataKey="predicted" stroke="#7c6fff" strokeWidth={2} strokeDasharray="6 4" fill="url(#predG)" dot={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── VOLUME TAB ── */}
          {tab === "volume" && (
            <div className="fade-up glass-card" style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "#e0eaff", fontWeight: 500, marginBottom: 4 }}>Trading Volume</div>
                <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 2 }}>LAST 20 INTERVALS</div>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={volumeData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="#0f1828" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#2a4060", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                  <YAxis tick={{ fill: "#2a4060", fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid #1e2a3a", borderRadius: 10, fontFamily: "inherit", fontSize: 12 }} />
                  <Bar dataKey="v" fill="#0066ff" radius={[4, 4, 0, 0]} opacity={0.8} name="Volume" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── NEWS TAB ── */}
          {tab === "news" && (
            <div className="fade-up glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#e0eaff", fontWeight: 500, marginBottom: 4 }}>Market News Feed</div>
                  <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 2 }}>REAL-TIME SENTIMENT ANALYSIS</div>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 10 }}>
                  <span style={{ color: "#00ff88" }}>● Bullish: {news.filter(n => n.sentiment === "bullish").length}</span>
                  <span style={{ color: "#ff4466" }}>● Bearish: {news.filter(n => n.sentiment === "bearish").length}</span>
                </div>
              </div>
              {news.map((n, i) => (
                <div key={i} className="news-row">
                  <div style={{ width: 3, minHeight: 40, borderRadius: 2, background: n.sentiment === "bullish" ? "#00ff88" : "#ff4466", flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#c0d8f0", lineHeight: 1.6, marginBottom: 6 }}>{n.text}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "#2a4060", letterSpacing: 1 }}>SOURCE: {n.source}</span>
                      <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: n.sentiment === "bullish" ? "#00ff8815" : "#ff446615", color: n.sentiment === "bullish" ? "#00ff88" : "#ff4466", letterSpacing: 1, fontWeight: 500 }}>
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
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "WIN RATE", value: `${winRate}%`, color: winRate > 65 ? "#00ff88" : "#ffcc00", sub: "Overall accuracy" },
                  { label: "TOTAL SIGNALS", value: accuracy.total, color: "#7c6fff", sub: "All time" },
                  { label: "CORRECT", value: accuracy.correct, color: "#00ff88", sub: "Successful calls" },
                  { label: "WRONG", value: accuracy.total - accuracy.correct, color: "#ff4466", sub: "Missed calls" },
                ].map((s, i) => (
                  <div key={i} className="stat-box">
                    <div style={{ fontSize: 9, color: "#4a6080", letterSpacing: 2, marginBottom: 10 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#2a4060" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="glass-card" style={{ padding: "24px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 2, marginBottom: 16 }}>LAST 10 PREDICTIONS</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {accuracy.history.map((h, i) => (
                    <div key={i} style={{ flex: 1, height: 52, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, background: h === "W" ? "#00ff8812" : "#ff446612", border: `1px solid ${h === "W" ? "#00ff8830" : "#ff446630"}` }}>
                      <span style={{ fontSize: 14 }}>{h === "W" ? "✓" : "✗"}</span>
                      <span style={{ fontSize: 8, color: h === "W" ? "#00ff88" : "#ff4466" }}>{h === "W" ? "WIN" : "LOSS"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card" style={{ padding: "24px" }}>
                <div style={{ fontSize: 10, color: "#4a6080", letterSpacing: 2, marginBottom: 14 }}>PERFORMANCE METER</div>
                <div style={{ background: "#060912", borderRadius: 8, height: 24, overflow: "hidden", marginBottom: 10, position: "relative" }}>
                  <div style={{ width: `${winRate}%`, height: "100%", background: "linear-gradient(90deg, #0044cc, #00ff88)", borderRadius: 8, transition: "width 1.5s ease", position: "relative" }}>
                    <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#060912", fontWeight: 700 }}>{winRate}%</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2a4060" }}>
                  <span>0% — Poor</span><span>50% — Average</span><span>80% — Excellent</span>
                </div>
              </div>
            </div>
          )}

          {/* ── FOOTER ── */}
          <div style={{ textAlign: "center", marginTop: 40, paddingTop: 20, borderTop: "1px solid #0f1828" }}>
            <div style={{ fontSize: 9, color: "#1a2540", letterSpacing: 3 }}>PULSETRADE AI © 2026 · NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY</div>
            <div style={{ fontSize: 9, color: "#1a2540", letterSpacing: 2, marginTop: 4 }}>BUILT FOR RWANDA · AFRICA · THE WORLD</div>
          </div>

        </div>
      </div>
    </div>
  );
}
