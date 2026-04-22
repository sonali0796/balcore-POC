import axios from "axios";

async function getDailyCandle(symbol = "BTCUSDT") {
  const res = await axios.get(
    "https://api.binance.com/api/v3/klines",
    {
      params: {
        symbol,
        interval: "1d",
        limit: 2,
      },
    }
  );

  const prev = res.data[res.data.length - 2];

  return {
    high: parseFloat(prev[2]),
    low: parseFloat(prev[3]),
    close: parseFloat(prev[4]),
  };
}

function calculatePivotPoints({ high, low, close }) {
  const P = (high + low + close) / 3;

  return {
    pivot: P,
    r1: (2 * P) - low,
    s1: (2 * P) - high,
    r2: P + (high - low),
    s2: P - (high - low),
    r3: high + 2 * (P - low),
    s3: low - 2 * (high - P),
  };
}

(async () => {
  const ohlc = await getDailyCandle("BTCUSDT");
  const pivots = calculatePivotPoints(ohlc);

  console.log(pivots);
})();