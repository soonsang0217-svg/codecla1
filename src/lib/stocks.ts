import { getKV, setKV } from "./db";
import { formatMarketStatusLabel, getMarketStatus } from "./marketHours";

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
  isMarketOpen: boolean;
  /** e.g. "장중 · 15:30 마감" or "장마감 · 8/7 09:00 개장", always in KST. */
  marketStatusLabel: string;
  error?: string;
}

// The raw per-source quote, before market-open/close status (computed fresh
// on every call in getStockQuotes, not cached) is merged in.
type QuoteData = Omit<StockQuote, "isMarketOpen" | "marketStatusLabel">;

const CACHE_TTL_SECONDS = 60;
const KOREAN_STOCK_CODE = /^\d{6}$/;
// Company names essentially never change, so this is cached far longer than
// the price itself to avoid re-hitting Finnhub's profile endpoint every load.
const NAME_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // day high
  l: number; // day low
  pc: number; // previous close
}

interface FinnhubProfile {
  name?: string;
}

async function fetchFinnhubName(symbol: string, apiKey: string): Promise<string | undefined> {
  const cacheKey = `stock-name:${symbol}`;
  const cached = await getKV<string>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Finnhub profile returned ${res.status}`);
    const data = (await res.json()) as FinnhubProfile;
    if (!data.name) return undefined;

    await setKV(cacheKey, data.name, NAME_CACHE_TTL_SECONDS);
    return data.name;
  } catch (err) {
    console.error(`Failed to fetch Finnhub company name for ${symbol}`, err);
    return undefined;
  }
}

async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<QuoteData> {
  const cacheKey = `stock:${symbol}`;
  const cached = await getKV<QuoteData>(cacheKey);
  if (cached) return cached;

  try {
    const [res, name] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`, {
        cache: "no-store",
      }),
      fetchFinnhubName(symbol, apiKey),
    ]);
    if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);
    const data = (await res.json()) as FinnhubQuote;

    if (data.c === 0 && data.pc === 0) {
      throw new Error("symbol not found");
    }

    const quote: QuoteData = {
      symbol,
      name,
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

async function fetchNaverQuote(code: string): Promise<QuoteData> {
  const cacheKey = `stock:${code}`;
  const cached = await getKV<QuoteData>(cacheKey);
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

    const quote: QuoteData = {
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

function withMarketStatus(quote: QuoteData, isKorean: boolean): StockQuote {
  const now = new Date();
  const status = getMarketStatus(isKorean ? "KR" : "US", now);
  return {
    ...quote,
    isMarketOpen: status.isOpen,
    marketStatusLabel: formatMarketStatusLabel(status, now),
  };
}

export async function getStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const apiKey = process.env.FINNHUB_API_KEY;

  return Promise.all(
    symbols.map(async (symbol) => {
      const isKorean = KOREAN_STOCK_CODE.test(symbol);

      if (isKorean) {
        return withMarketStatus(await fetchNaverQuote(symbol), true);
      }
      if (!apiKey) {
        return withMarketStatus(
          {
            symbol,
            price: null,
            change: null,
            changePercent: null,
            previousClose: null,
            error: "FINNHUB_API_KEY not configured",
          },
          false
        );
      }
      return withMarketStatus(await fetchFinnhubQuote(symbol, apiKey), false);
    })
  );
}
