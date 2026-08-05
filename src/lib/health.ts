import { getKV, setKV } from "./db";

export interface HealthSnapshot {
  sleepDurationMinutes: number | null;
  sleepScore: number | null;
  heartRate: number | null;
  /** Heart rate variability (SDNN), in milliseconds. */
  heartRateVariability: number | null;
  /** When Apple Health recorded these readings (from the Shortcut), ISO string. */
  recordedAt: string | null;
  /** When our server last received an update, ISO string. */
  updatedAt: string;
}

export interface HealthSnapshotInput {
  sleepDurationMinutes?: number | null;
  sleepScore?: number | null;
  heartRate?: number | null;
  heartRateVariability?: number | null;
  recordedAt?: string | null;
}

const HEALTH_KEY = "health:latest";

export async function getLatestHealth(): Promise<HealthSnapshot | null> {
  return getKV<HealthSnapshot>(HEALTH_KEY);
}

export async function saveHealthSnapshot(input: HealthSnapshotInput): Promise<HealthSnapshot> {
  const existing = await getLatestHealth();
  const next: HealthSnapshot = {
    sleepDurationMinutes: input.sleepDurationMinutes ?? existing?.sleepDurationMinutes ?? null,
    sleepScore: input.sleepScore ?? existing?.sleepScore ?? null,
    heartRate: input.heartRate ?? existing?.heartRate ?? null,
    heartRateVariability: input.heartRateVariability ?? existing?.heartRateVariability ?? null,
    recordedAt: input.recordedAt ?? existing?.recordedAt ?? null,
    updatedAt: new Date().toISOString(),
  };
  await setKV(HEALTH_KEY, next);
  return next;
}
