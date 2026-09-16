import type { CacheSnapshot, RegisteredLocation } from "@/lib/types";

const CACHE_KEY = "rain-vision-cache-v1";
const REGISTRATION_KEY = "rain-vision-registration-v1";
const DEMO_OFFLINE_KEY = "rain-vision-demo-offline-v1";

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