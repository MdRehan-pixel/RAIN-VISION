import type { CacheSnapshot, RegisteredLocation } from "@/lib/types";

const CACHE_KEY = "rain-vision-cache-v1";
const REGISTRATION_KEY = "rain-vision-registration-v1";
const DEMO_OFFLINE_KEY = "rain-vision-demo-offline-v1";

const RAIN_VISION_OFFLINE_QUEUE = "rain-vision-offline-queue-v1";

export type OfflineSyncRecord = {
  id: string;
  captured_at: string;
  latitude?: number;
  longitude?: number;
  location?: unknown;
  ml?: unknown;
  forecast?: unknown;
  risk?: unknown;
  source: "browser-offline-cache";
};

const parse = <T>(key: string): T | undefined => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : undefined;
  } catch {
    return undefined;
  }
};

export const getCacheSnapshot = () => parse<CacheSnapshot>(CACHE_KEY);
export const saveCacheSnapshot = (snapshot: CacheSnapshot) => localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
export const getRegistration = () => parse<RegisteredLocation>(REGISTRATION_KEY);
export const saveRegistration = (registration: RegisteredLocation) => localStorage.setItem(REGISTRATION_KEY, JSON.stringify(registration));
export const isDemoOffline = () => localStorage.getItem(DEMO_OFFLINE_KEY) === "true";
export const setDemoOfflineStorage = (value: boolean) => localStorage.setItem(DEMO_OFFLINE_KEY, String(value));
export const clearRainVisionStorage = () => [CACHE_KEY, REGISTRATION_KEY, DEMO_OFFLINE_KEY].forEach((key) => localStorage.removeItem(key));

export const getOfflineQueue = () =>
  parse<OfflineSyncRecord[]>(RAIN_VISION_OFFLINE_QUEUE) ?? [];

export const queueOfflineRecord = (record: OfflineSyncRecord) => {
  const existing = getOfflineQueue();
  if (existing.some((item) => item.id === record.id)) return existing;
  const next = [...existing, record].slice(-50);
  localStorage.setItem(RAIN_VISION_OFFLINE_QUEUE, JSON.stringify(next));
  return next;
};

export const clearOfflineQueue = () =>
  localStorage.removeItem(RAIN_VISION_OFFLINE_QUEUE);

export const saveOfflineQueue = (records: OfflineSyncRecord[]) =>
  localStorage.setItem(RAIN_VISION_OFFLINE_QUEUE, JSON.stringify(records));
