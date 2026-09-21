import ThemeToggle from "@/components/rainvision/ThemeToggle";
import { LocateFixed, Radio, RefreshCw, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { useRainVision, type RainVisionModel } from "@/hooks/useRainVision";
import { demoStages, navItems, type View } from "@/pages/rainvision/config";
import HistoricalReplay from "@/pages/HistoricalReplay";
import DashboardView from "@/pages/rainvision/DashboardView";
import MapView from "@/pages/rainvision/MapView";
import ForecastView from "@/pages/rainvision/ForecastView";
import InundationView from "@/pages/rainvision/InundationView";
import AlertsView from "@/pages/rainvision/AlertsView";
import SourcesView from "@/pages/rainvision/SourcesView";
import OfflineView from "@/pages/rainvision/OfflineView";
import AnalyticsView from "@/pages/rainvision/AnalyticsView";
import SettingsView from "@/pages/rainvision/SettingsView";
import type { Provenance } from "@/lib/types";

const views: Record<View, (m: RainVisionModel) => React.ReactNode> = {
  dashboard: (m) => <DashboardView m={m} />,
  map: (m) => <MapView m={m} />,
  forecast: (m) => <ForecastView m={m} />,
  inundation: (m) => <InundationView m={m} />,
  alerts: (m) => <AlertsView m={m} />,
  sources: (m) => <SourcesView m={m} />,
  offline: (m) => <OfflineView m={m} />,
  analytics: (m) => <AnalyticsView m={m} />,
  historical: () => <HistoricalReplay />,
  settings: (m) => <SettingsView m={m} />,
};

/** Top-of-page data-mode badge: historical backtest, demo scenario, or the live/fallback status. */
const modeBadge = (m: RainVisionModel): { status: Provenance; label: string } => {
  if (m.currentView === "historical") return { status: "FALLBACK", label: "HISTORICAL BACKTEST MODE" };
  if (m.demoStage !== null) return { status: "DEMO", label: `DEMO SCENARIO · ${demoStages[m.demoStage]}` };
  return { status: m.liveStatus, label: `${m.liveStatus} DATA MODE` };
};

export default function RainVision() {
  const m = useRainVision();
  const { navigate, currentView, location, showOffline, demoStage, isOnline, startDemo, useMyLocation, refreshLive } = m;
  const historical = currentView === "historical";
  return <div data-testid="rain-vision-app" data-demo-stage={demoStage ?? "idle"} className="rain-dashboard relative isolate min-h-svh overflow-x-hidden text-slate-900 transition-colors duration-500 dark:text-slate-100">
    <Toaster richColors />
    <header data-testid="app-header" className="sticky top-0 z-50 border-b border-white/40 bg-white/65 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/55">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6">
        <button data-testid="brand-home-button" onClick={() => navigate("/")} className="flex shrink-0 items-center gap-2 text-left"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_8px_24px_rgba(6,182,212,0.3)] transition-transform duration-300 hover:scale-105"><Radio size={18} /></span><span className="hidden sm:block"><span className="block font-mono text-sm font-bold tracking-[0.13em] text-slate-950 dark:text-white">RAIN VISION</span><span className="block text-[10px] text-slate-500 dark:text-slate-400">Pan-India early warning system</span></span></button>
        <nav data-testid="primary-navigation" className="order-3 flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-2xl border border-white/35 bg-white/35 p-1 shadow-inner shadow-white/40 backdrop-blur-xl lg:order-2 dark:border-white/10 dark:bg-white/[0.04]">{navItems.map((item) => <button data-testid={`nav-${item.view}`} key={item.view} onClick={() => navigate(item.path)} className={`whitespace-nowrap rounded-xl px-2.5 py-2 text-[11px] font-semibold transition-all duration-300 ${currentView === item.view ? "bg-slate-900 text-white shadow-md shadow-slate-900/15 dark:bg-cyan-400 dark:text-slate-950" : "text-slate-600 hover:-translate-y-0.5 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}>{item.label}</button>)}</nav>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3">\n          <ThemeToggle />
          <div data-testid="status-network-badge" className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider sm:flex ${showOffline ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{showOffline ? "Offline" : "Online"}</div>
          <Button data-testid="button-start-emergency-demo" size="sm" variant={demoStage !== null ? "secondary" : "default"} onClick={startDemo}><Zap size={14} />{demoStage !== null ? "Demo active" : "Emergency demo"}</Button>
        </div>
      </div>
    </header>
    <main className="relative mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:py-10">
      <div className="rain-hero-panel mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="rain-hero-decor" aria-hidden="true">
  <span className="rain-square rain-square-cyan"></span>
  <span className="rain-square rain-square-purple"></span>
  <span className="rain-square rain-square-blue"></span>
  <span className="rain-square rain-square-amber"></span>
  <span className="rain-square rain-square-white"></span>
  <span className="rain-square rain-square-pink"></span>
</div>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Smart India Hackathon 2026 · command center</span><ProvenanceBadge {...modeBadge(m)} /></div>
          <h1 data-testid="page-title" className="bg-gradient-to-r from-slate-950 via-slate-800 to-sky-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-white dark:via-slate-100 dark:to-cyan-300">Pan-India rainfall intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{historical ? "Backtesting the prototype risk engine against a documented historical event. Live weather is paused on this view and no alerts are dispatched." : `Heavy rainfall and prototype inundation early warning for ${location.name}, grounded in real coordinates and transparent data provenance.`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="button-top-use-location" variant="outline" size="sm" onClick={useMyLocation}><LocateFixed size={14} />{location.source === "GPS" ? "Refresh GPS" : "Use my location"}</Button>
          <Button data-testid="button-top-refresh" variant="outline" size="sm" disabled={!isOnline} onClick={refreshLive}><RefreshCw size={14} />Refresh data</Button>
        </div>
      </div>
      {showOffline && <div data-testid="offline-strip" className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span className="flex items-center gap-2"><WifiOff size={16} />OFFLINE MODE: AUTOMATICALLY ACTIVATED · latest known data remains available</span><button data-testid="offline-strip-open-button" className="font-semibold underline" onClick={() => navigate("/offline")}>View resilience details</button></div>}
      {views[currentView](m)}
    </main>
    <footer className="border-t border-white/30 bg-white/35 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/35"><div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"><span data-testid="footer-prototype-label">RAIN VISION · prototype decision-support system · not an official government warning</span><span data-testid="footer-attribution">Open-Meteo · RainViewer · OpenStreetMap</span></div></footer>
  </div>;
}
