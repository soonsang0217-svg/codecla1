import { getKV, setKV } from "./db";

export interface StockQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  error?: string;
}

const CACHE_TTL_SECONDS = 60;

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  pc: number; // previous close
}

async function fetchQuote(symbol: string, apiKey: string): Promise<StockQuote> {
  const cacheKey = `stock:${symbol}`;
  const cached = await getKV<StockQuote>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);
    const data = (await res.json()) as FinnhubQuote;

    if (data.c === 0 && data.pc === 0) {
      throw new Error("symbol not found");
    }

    const quote: StockQuote = {
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      previousClose: data.pc,
    };
    await setKV(cacheKey, quote, CACHE_TTL_SECONDS);
    return quote;
  } catch (err) {
    return {
      symbol,
      price: null,
      change: null,
      changePercent: null,
      previousClose: null,
      error: err instanceof Error ? err.message : "failed to fetch quote",
    };
  }
}

export async function getStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return symbols.map((symbol) => ({
      symbol,
      price: null,
      change: null,
      changePercent: null,
      previousClose: null,
      error: "FINNHUB_API_KEY not configured",
    }));
  }
  return Promise.all(symbols.map((symbol) => fetchQuote(symbol, apiKey)));
}
