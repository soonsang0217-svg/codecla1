import { Redis } from "@upstash/redis";

declare global {
  var __briefingRedis: Redis | undefined;
}

function getRedis(): Redis {
  if (!globalThis.__briefingRedis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN environment variables are not set"
      );
    }
    globalThis.__briefingRedis = new Redis({ url, token });
  }
  return globalThis.__briefingRedis;
}

export async function getKV<T>(key: string): Promise<T | null> {
  const value = await getRedis().get<T>(key);
  return value ?? null;
}

export async function setKV(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  await getRedis().set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
}

export async function deleteKV(key: string): Promise<void> {
  await getRedis().del(key);
}
