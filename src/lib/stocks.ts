import { getKV, setKV } from "./db";

export interface StockQuote {
  symbol: string;
  name?: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  /** Today's low/high, when the source provides them — powers the day-range bar. */
  dayLow?: number | null;
  dayHigh?: number | null;
  error?: string;
}

const CACHE_TTL_SECONDS = 60;
const KOREAN_STOCK_CODE = /^\d{6}$/;

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // day high
  l: number; // day low
  pc: number; // previous close
}

async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<StockQuote> {
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
      dayLow: data.l || null,
      dayHigh: data.h || null,
    };
    await setKV(cacheKey, quote, CACHE_TTL_SECONDS);
    return quote;
  } catch (err) {
    console.error(`Failed to fetch Finnhub quote for ${symbol}`, err);
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

interface NaverDirection {
  code: string; // "1" 상한가, "2" 상승, "3" 보합, "4" 하한가, "5" 하락
}

interface NaverBasicResponse {
  itemCode: string;
  stockName: string;
  closePrice: string; // comma-formatted, e.g. "246,000"
  compareToPreviousClosePrice: string; // comma-formatted, unsigned
  compareToPreviousPrice: NaverDirection;
  fluctuationsRatio: string; // percent, unsigned
}

// /basic has no high/low; /integration's totalInfos carries them as a flat
// list of {code, value} rows (alongside PER, market cap, etc.) instead of
// dedicated fields — verified against a live response.
interface NaverTotalInfoItem {
  code: string;
  value: string;
}

interface NaverIntegrationResponse {
  totalInfos?: NaverTotalInfoItem[];
}

function parseNaverNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}

// Naver's unsigned fields report direction separately via this code.
function naverSign(code: string): 1 | -1 {
  return code === "4" || code === "5" ? -1 : 1;
}

async function fetchNaverDayRange(code: string): Promise<{ high: number | null; low: number | null }> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Naver Finance returned ${res.status}`);
    const data = (await res.json()) as NaverIntegrationResponse;

    const findValue = (infoCode: string) =>
      data.totalInfos?.find((item) => item.code === infoCode)?.value;

    const high = findValue("highPrice");
    const low = findValue("lowPrice");
    return {
      high: high ? parseNaverNumber(high) : null,
      low: low ? parseNaverNumber(low) : null,
    };
  } catch (err) {
    console.error(`Failed to fetch Naver day range for ${code}`, err);
    return { high: null, low: null };
  }
}

async function fetchNaverQuote(code: string): Promise<StockQuote> {
  const cacheKey = `stock:${code}`;
  const cached = await getKV<StockQuote>(cacheKey);
  if (cached) return cached;

  try {
    const [basicRes, dayRange] = await Promise.all([
      fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, { cache: "no-store" }),
      fetchNaverDayRange(code),
    ]);
    if (!basicRes.ok) throw new Error(`Naver Finance returned ${basicRes.status}`);
    const data = (await basicRes.json()) as NaverBasicResponse;

    const sign = naverSign(data.compareToPreviousPrice?.code ?? "3");
    const price = parseNaverNumber(data.closePrice);
    const change = sign * Math.abs(parseNaverNumber(data.compareToPreviousClosePrice));
    const changePercent = sign * Math.abs(parseNaverNumber(data.fluctuationsRatio));

    const quote: StockQuote = {
      symbol: code,
      name: data.stockName,
      price,
      change,
      changePercent,
      previousClose: price - change,
      dayLow: dayRange.low,
      dayHigh: dayRange.high,
    };
    await setKV(cacheKey, quote, CACHE_TTL_SECONDS);
    return quote;
  } catch (err) {
    console.error(`Failed to fetch Naver quote for ${code}`, err);
    return {
      symbol: code,
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

  return Promise.all(
    symbols.map((symbol) => {
      if (KOREAN_STOCK_CODE.test(symbol)) {
        return fetchNaverQuote(symbol);
      }
      if (!apiKey) {
        return Promise.resolve<StockQuote>({
          symbol,
          price: null,
          change: null,
          changePercent: null,
          previousClose: null,
          error: "FINNHUB_API_KEY not configured",
        });
      }
      return fetchFinnhubQuote(symbol, apiKey);
    })
  );
}
