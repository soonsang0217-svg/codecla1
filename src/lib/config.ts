import { getKV, setKV } from "./db";

export interface AppSettings {
  stockSymbols: string[];
  homeAddress: string;
  newsCountry: string;
}

const SETTINGS_KEY = "settings";

function defaultSettings(): AppSettings {
  return {
    stockSymbols: (process.env.STOCK_SYMBOLS || "AAPL,MSFT,NVDA")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    homeAddress: process.env.HOME_ADDRESS || "",
    newsCountry: process.env.NEWS_COUNTRY || "kr",
  };
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await getKV<Partial<AppSettings>>(SETTINGS_KEY);
  return { ...defaultSettings(), ...stored };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...patch };
  await setKV(SETTINGS_KEY, next);
  return next;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
