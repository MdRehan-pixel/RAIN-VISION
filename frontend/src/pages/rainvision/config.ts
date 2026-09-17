import type { LocationState, RiskCategory } from "@/lib/types";

export type View = "dashboard" | "map" | "forecast" | "inundation" | "alerts" | "sos" | "sources" | "offline" | "analytics" | "historical" | "settings";

export const DEFAULT_LOCATION: LocationState = { name: "Bengaluru", state: "Karnataka", country: "India", latitude: 12.9716, longitude: 77.5946, source: "DEMO_FALLBACK" };

export const navItems: { view: View; label: string; path: string }[] = [
  { view: "dashboard", label: "Dashboard", path: "/" },
  { view: "map", label: "Live Risk Map", path: "/map" },
  { view: "forecast", label: "Rainfall Forecast", path: "/forecast" },
  { view: "inundation", label: "Inundation Risk", path: "/inundation" },
  { view: "alerts", label: "Alerts", path: "/alerts" },
  { view: "sos", label: "SOS", path: "/sos" },
  { view: "sources", label: "Data Sources", path: "/sources" },
  { view: "offline", label: "Offline Mode", path: "/offline" },
  { view: "analytics", label: "Analytics", path: "/analytics" },
  { view: "historical", label: "Historical Incident Replay", path: "/historical" },
  { view: "settings", label: "Settings", path: "/settings" },
];

export const demoStages = ["NORMAL", "RAINFALL INCREASE", "MODERATE RISK", "HIGH RISK", "EXTREME RISK", "ALERT TRIGGERED", "GEOFENCED WARNING"];

export const viewFromPath = (pathname: string): View => navItems.find((item) => item.path === pathname)?.view ?? "dashboard";
export const riskRank: Record<RiskCategory, number> = { LOW: 0, MODERATE: 1, HIGH: 2, EXTREME: 3 };
export const RADIUS_OPTIONS = [5, 10, 25, 50];
