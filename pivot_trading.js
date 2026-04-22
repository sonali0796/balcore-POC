/**
 * pivot_trading.js
 *
 * Replicates TradingView's built-in "Pivot Points Standard" indicator:
 *   - Type             : Traditional
 *   - Pivots Timeframe : Weekly
 *   - Number of Pivots : 1  (previous completed week only)
 *   - Use Daily-based  : ON  ← aggregates daily candles, NOT the raw weekly bar
 *   - Levels           : P, R1, R2, R3, S1, S2, S3
 *
 * Data source : Bybit V5 API → BTCUSDT Linear Perpetual (BTCUSDT.P on TV)
 *
 * ── FORMULA (Traditional) ──────────────────────────────────────────────────
 *   P  = (H + L + C) / 3
 *   R1 = 2P − L          S1 = 2P − H
 *   R2 = P  + (H − L)    S2 = P  − (H − L)
 *   R3 = H  + 2(P − L)   S3 = L  − 2(H − P)
 *
 * Where H / L / C come from the PREVIOUS completed week's daily candles:
 *   H = max  of all daily highs  in that week
 *   L = min  of all daily lows   in that week
 *   C = close of the last daily candle in that week (Sunday / last trading day)
 * ───────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BYBIT_KLINE_URL = "https://api.bybit.com/v5/market/kline";
const SYMBOL          = "BTCUSDT";   // Bybit linear perpetual
const CATEGORY        = "linear";
const FETCH_DAYS      = 20;          // 20 daily candles safely covers 2+ full weeks

// ─── 1. FETCH DAILY CANDLES FROM BYBIT ───────────────────────────────────────

/**
 * Fetches daily candles from Bybit V5.
 * Bybit returns newest-first → we reverse to oldest-first for easy filtering.
 *
 * Candle shape: { timestamp (ms, open time), open, high, low, close, volume }
 */
async function fetchDailyCandles(symbol = SYMBOL, days = FETCH_DAYS) {
  const response = await axios.get(BYBIT_KLINE_URL, {
    params: {
      category : CATEGORY,
      symbol,
      interval : "D",
      limit    : days,
    },
  });

  const { retCode, retMsg, result } = response.data;

  if (retCode !== 0) {
    throw new Error(`Bybit API error [${retCode}]: ${retMsg}`);
  }

  // result.list columns: [startTime, open, high, low, close, volume, turnover]
  return result.list
    .map((c) => ({
      timestamp : parseInt(c[0]),    // open time in ms (UTC)
      open      : parseFloat(c[1]),
      high      : parseFloat(c[2]),
      low       : parseFloat(c[3]),
      close     : parseFloat(c[4]),
      volume    : parseFloat(c[5]),
    }))
    .reverse();                      // oldest → newest
}

// ─── 2. WEEK BOUNDARY HELPERS ─────────────────────────────────────────────────

/**
 * TradingView treats Monday 00:00 UTC as the start of a trading week
 * for crypto perpetuals on Bybit.
 *
 * Returns the Monday 00:00 UTC timestamp (ms) for the week containing `date`.
 */
function getMondayStartOfWeek(date) {
  const d   = new Date(date);
  const day = d.getUTCDay();              // 0 = Sun, 1 = Mon … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // days to subtract to reach Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Returns the open/close timestamps (ms) for the PREVIOUS completed week:
 *   previousWeekStart = last Monday 00:00 UTC  (inclusive)
 *   previousWeekEnd   = this Monday 00:00 UTC  (exclusive)
 */
function getPreviousWeekRange() {
  const thisWeekStart = getMondayStartOfWeek(Date.now());
  const prevWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;

  return {
    start    : prevWeekStart,
    end      : thisWeekStart,
    startStr : new Date(prevWeekStart).toISOString().split("T")[0],
    endStr   : new Date(thisWeekStart).toISOString().split("T")[0],
  };
}

// ─── 3. AGGREGATE DAILY CANDLES → WEEKLY H / L / C ───────────────────────────

/**
 * Mirrors TradingView's "Use Daily-based Values" setting:
 *   weekHigh  = max of all daily highs  in the previous week
 *   weekLow   = min of all daily lows   in the previous week
 *   weekClose = close of the last daily candle (Sunday / final trading day)
 */
function aggregateWeeklyOHLC(prevWeekCandles) {
  if (!prevWeekCandles.length) {
    throw new Error(
      "No daily candles found for the previous week. " +
      "Try increasing FETCH_DAYS."
    );
  }

  return {
    high  : Math.max(...prevWeekCandles.map((c) => c.high)),
    low   : Math.min(...prevWeekCandles.map((c) => c.low)),
    close : prevWeekCandles.at(-1).close,   // last candle's close
  };
}

// ─── 4. TRADITIONAL PIVOT POINT FORMULAS ─────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Calculates all 7 Traditional pivot levels.
 * Returned in top-to-bottom order matching TradingView's display (R3 → S3).
 */
function calculateTraditionalPivots({ high: H, low: L, close: C }) {
  const P = (H + L + C) / 3;

  return {
    R3 : round2(H + 2 * (P - L)),
    R2 : round2(P + (H - L)),
    R1 : round2(2 * P - L),
    P  : round2(P),
    S1 : round2(2 * P - H),
    S2 : round2(P - (H - L)),
    S3 : round2(L - 2 * (H - P)),
  };
}

// ─── 5. DISPLAY ───────────────────────────────────────────────────────────────

function printResults(weekRange, candles, ohlc, pivots) {
  const toDate = (ms) => new Date(ms).toISOString().split("T")[0];

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   TradingView — Pivot Points Standard                ║");
  console.log("║   Symbol  : BTCUSDT.P  (Bybit Linear Perpetual)     ║");
  console.log("║   Type    : Traditional   |   Timeframe : Weekly    ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  console.log(`\n📅 Previous Week : ${weekRange.startStr}  →  ${weekRange.endStr}`);
  console.log(`   Daily candles used : ${candles.length}\n`);

  candles.forEach((c) =>
    console.log(
      `   ${toDate(c.timestamp)}` +
      `  H: ${c.high.toFixed(2).padStart(12)}` +
      `  L: ${c.low.toFixed(2).padStart(12)}` +
      `  C: ${c.close.toFixed(2).padStart(12)}`
    )
  );

  console.log("\n📐 Aggregated Weekly OHLC  (Daily-based values):");
  console.log(`   High  (H) :  ${ohlc.high}`);
  console.log(`   Low   (L) :  ${ohlc.low}`);
  console.log(`   Close (C) :  ${ohlc.close}`);

  console.log("\n📊 Pivot Levels  (matches TradingView output):");
  console.log("   ┌───────────────────────────┐");
  console.log(`   │  R3  :  ${String(pivots.R3).padStart(13)}        │`);
  console.log(`   │  R2  :  ${String(pivots.R2).padStart(13)}        │`);
  console.log(`   │  R1  :  ${String(pivots.R1).padStart(13)}        │`);
  console.log("   │───────────────────────────│");
  console.log(`   │   P  :  ${String(pivots.P).padStart(13)}        │`);
  console.log("   │───────────────────────────│");
  console.log(`   │  S1  :  ${String(pivots.S1).padStart(13)}        │`);
  console.log(`   │  S2  :  ${String(pivots.S2).padStart(13)}        │`);
  console.log(`   │  S3  :  ${String(pivots.S3).padStart(13)}        │`);
  console.log("   └───────────────────────────┘\n");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    // Step 1 — Pull daily candles from Bybit
    const allCandles = await fetchDailyCandles(SYMBOL, FETCH_DAYS);

    // Step 2 — Calculate previous week's Mon 00:00 UTC → this Mon 00:00 UTC
    const weekRange = getPreviousWeekRange();

    // Step 3 — Keep only candles that opened inside the previous week
    const prevWeekCandles = allCandles.filter(
      (c) => c.timestamp >= weekRange.start && c.timestamp < weekRange.end
    );

    // Step 4 — Aggregate H / L / C (daily-based, matching TradingView)
    const weeklyOHLC = aggregateWeeklyOHLC(prevWeekCandles);

    // Step 5 — Apply Traditional pivot formulas
    const pivots = calculateTraditionalPivots(weeklyOHLC);

    // Step 6 — Print
    printResults(weekRange, prevWeekCandles, weeklyOHLC, pivots);

    // Optionally export for use in other modules
    return pivots;

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
