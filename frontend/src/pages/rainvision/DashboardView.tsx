import { Check, ChevronRight, CloudRain, Droplets, Gauge, LocateFixed, MapPinned, RefreshCw, ShieldAlert, Siren, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LeafletMap from "@/components/LeafletMap";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import RiskGauge from "@/components/RiskGauge";
import EmergencyPanel from "@/components/rainvision/EmergencyPanel";
import { MetricCard, RiskFactors, ChartTooltip, WavesIcon, AXIS_TICK, locationBadge } from "@/components/rainvision/primitives";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "@/lib/recharts";
import { formatNumber, makeFallbackForecast } from "@/lib/weather";
import { calculateRisk, riskColor } from "@/lib/risk";
import type { RainVisionModel } from "@/hooks/useRainVision";
import type { RiskResult } from "@/lib/types";

type Banner = { frame: string; iconFrame: string; Icon: LucideIcon; eyebrow: string; title: string; body: string };
const bannerFor = (activeAlert: boolean, showOffline: boolean, risk: RiskResult): Banner => {
  if (activeAlert) return { frame: "border-rose-300 bg-rose-50", iconFrame: "bg-rose-100 text-rose-700", Icon: ShieldAlert, eyebrow: "Geofenced alert", title: `${risk.category} rainfall & inundation risk detected`, body: risk.recommendation };
  if (showOffline) return { frame: "border-amber-300 bg-amber-50", iconFrame: "bg-amber-100 text-amber-800", Icon: WifiOff, eyebrow: "Automatic offline mode", title: "Latest known conditions remain available", body: "Live data is unavailable. The local alert engine is active using the last successful update." };
  return { frame: "border-emerald-200 bg-emerald-50", iconFrame: "bg-emerald-100 text-emerald-700", Icon: Check, eyebrow: "System assessment", title: "No immediate high-risk signal at the monitored point", body: "RAIN VISION is monitoring weather, model, and spatial signals for the selected coordinates." };
};

export default function DashboardView({ m }: { m: RainVisionModel }) {
  const { navigate, location, radiusKm, demoStage, showOffline, sourceMode, forecast, risk, mlRisk, current, rainfall24, accumulations, hourlyChartData, activeAlert, spatial, cities, spatialQuery, selectMapPoint, useMyLocation, startDemo, nextDemoStage, resetDemo, setOffline } = m;
  const banner = bannerFor(activeAlert, showOffline, risk);
  const simulateOffline = () => setOffline(true);

const earlyWarning = (() => {
  const hourly = forecast?.data?.hourly;
  if (!hourly?.time?.length || sourceMode !== "LIVE") return null;

  const now = Date.now();

  for (let i = 0; i < hourly.time.length; i += 1) {
    const when = new Date(hourly.time[i]).getTime();
    if (!Number.isFinite(when) || when <= now) continue;

    const probability = Number(hourly.precipitation_probability?.[i] ?? 0);
    const rain = Number(hourly.precipitation?.[i] ?? 0);

    if (probability >= 50 || rain >= 0.2) {
      return {
        when,
        probability,
        rain,
        hoursAway: Math.max(1, Math.round((when - now) / 3600000)),
      };
    }
  }

  return null;
})();

  return <>

      <section className="mb-5">
        <Card className="border-sky-200 bg-sky-50/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CloudRain size={18} className="text-sky-700" />
                  Early rain warning
                </CardTitle>
                <CardDescription>
                  Live hourly forecast for the current GPS location
                </CardDescription>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {sourceMode === "LIVE" ? "LIVE" : "WAITING"}
              </span>
            </div>
          </CardHeader>

          <CardContent>
            {earlyWarning ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Expected window</p>
                  <p className="text-lg font-bold">
                    {new Date(earlyWarning.when).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Time to window</p>
                  <p className="text-lg font-bold">
                    ~{earlyWarning.hoursAway} hr
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Rain probability</p>
                  <p className="text-lg font-bold">
                    {earlyWarning.probability}%
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No immediate rain window detected in the live hourly forecast.
              </p>
            )}

            <p className="mt-3 text-[11px] text-slate-400">
              Forecast-based early warning from the live Open-Meteo hourly signal.
              It is not an official government warning.
            </p>
          </CardContent>
        </Card>
      </section>


    <a
      href="tel:112"
      data-testid="button-sos-call"
      aria-label="SOS emergency call"
      title="SOS · Emergency call"
      className="fixed bottom-6 right-6 z-50 grid h-16 w-16 place-items-center rounded-full bg-rose-600 text-white shadow-[0_0_0_6px_rgba(244,63,94,0.12),0_0_32px_rgba(244,63,94,0.5)] ring-4 ring-rose-200/80 transition hover:scale-105 hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-300 animate-pulse"
    >
      <Siren size={28} />
      <span className="sr-only">SOS emergency call</span>
    </a>
    <section data-testid="ml-live-signal-card" className="mb-5">
      <Card className="border-slate-200 bg-white/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">LIVE ML SIGNAL</CardTitle>
              <p className="text-xs text-slate-500">
                RandomForest prototype • live weather features
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {mlRisk?.status === "LIVE" ? "LIVE" : "WAITING"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {mlRisk ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Model class</p>
                <p className="text-lg font-bold">{mlRisk.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Prediction</p>
                <p className="text-lg font-bold">{mlRisk.prediction}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Rain 1h</p>
                <p className="text-lg font-bold">{mlRisk.features?.rain_1h_mm ?? 0} mm</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Precip. probability</p>
                <p className="text-lg font-bold">{mlRisk.features?.precip_probability ?? 0}%</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Waiting for live GPS/weather model inference…
            </p>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Operational risk remains governed by the RAIN VISION fusion engine.
            ML output is an additional prototype signal.
          </p>
        </CardContent>
      </Card>
    </section>

    <section data-testid="emergency-status-banner" className={`mb-5 overflow-hidden rounded-2xl border ${banner.frame}`}><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${banner.iconFrame}`}><banner.Icon size={20} /></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{banner.eyebrow}</p><h2 data-testid="danger-assessment" className="mt-1 text-lg font-semibold text-slate-950">{banner.title}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">{banner.body}</p></div></div><div className="flex shrink-0 items-center gap-2"><ProvenanceBadge status={sourceMode} /><Button data-testid="button-view-alerts" variant="outline" size="sm" onClick={() => navigate("/alerts")}>View alerts <ChevronRight size={14} /></Button></div></div></section>
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">

      {/* Risk */}
      <div data-testid="dashboard-metric-risk" className={`rain-metric-card rain-metric-risk ${risk.category === "EXTREME" ? "rain-metric-danger" : ""}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="rain-metric-label">Risk score</p>
            <p className="rain-metric-value">{risk.score}<span>/100</span></p>
          </div>
          <div className="rain-metric-icon rain-icon-rose"><Gauge size={18} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rain-metric-status rain-status-rose">{risk.category}</span>
          <span className="rain-metric-small">Overall risk</span>
        </div>
        <div className="rain-segment-bar mt-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={i < Math.ceil(risk.score / 10) ? "active rose" : ""} />
          ))}
        </div>
        <p className="rain-metric-caption">High likelihood of inundation</p>
      </div>

      {/* Precipitation */}
      <div data-testid="dashboard-metric-precipitation" className="rain-metric-card rain-metric-blue">
        <div className="flex items-start justify-between">
          <div>
            <p className="rain-metric-label">Precipitation</p>
            <p className="rain-metric-value">{formatNumber(current.precipitation ?? current.rain)}<span> mm</span></p>
          </div>
          <div className="rain-metric-icon rain-icon-blue"><Droplets size={18} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rain-metric-status rain-status-blue">CURRENT</span>
          <span className="rain-metric-small">Intensity</span>
        </div>
        <div className="rain-mini-bars mt-3">
          {[18, 30, 24, 42, 28, 52, 35, 62, 44, 70].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="rain-metric-caption">Current rainfall intensity</p>
      </div>

      {/* Forecast */}
      <div data-testid="dashboard-metric-forecast" className="rain-metric-card rain-metric-purple">
        <div className="flex items-start justify-between">
          <div>
            <p className="rain-metric-label">Next 6 hours</p>
            <p className="rain-metric-value">{formatNumber(accumulations.six)}<span> mm</span></p>
          </div>
          <div className="rain-metric-icon rain-icon-purple"><CloudRain size={18} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rain-metric-status rain-status-purple">FORECAST</span>
          <span className="rain-metric-small">Accumulation</span>
        </div>
        <div className="rain-mini-bars purple mt-3">
          {[25, 38, 30, 55, 42, 64, 48, 72, 55, 82].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="rain-metric-caption">Expected rainfall accumulation</p>
      </div>

      {/* Inundation */}
      <div data-testid="dashboard-metric-inundation" className="rain-metric-card rain-metric-amber">
        <div className="flex items-start justify-between">
          <div>
            <p className="rain-metric-label">Inundation</p>
            <p className="rain-metric-value">{risk.inundation.score}<span>/100</span></p>
          </div>
          <div className="rain-metric-icon rain-icon-amber"><Droplets size={18} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rain-metric-status rain-status-amber">{risk.inundation.category}</span>
          <span className="rain-metric-small">Surface risk</span>
        </div>
        <div className="rain-segment-bar mt-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={i < Math.ceil(risk.inundation.score / 10) ? "active amber" : ""} />
          ))}
        </div>
        <p className="rain-metric-caption">Surface water pressure estimate</p>
      </div>

      {/* Network */}
      <div data-testid="dashboard-metric-network" className={`rain-metric-card ${showOffline ? "rain-metric-offline" : "rain-metric-green"}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="rain-metric-label">Network</p>
            <p className="rain-metric-value rain-network-value">{showOffline ? "OFFLINE" : "ONLINE"}</p>
          </div>
          <div className={`rain-metric-icon ${showOffline ? "rain-icon-amber" : "rain-icon-green"}`}>
            {showOffline ? <WifiOff size={18} /> : <Wifi size={18} />}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className={`rain-metric-status ${showOffline ? "rain-status-amber" : "rain-status-green"}`}>
            {showOffline ? "FALLBACK" : "LIVE"}
          </span>
          <span className="rain-metric-small">{showOffline ? "Cache active" : "Requests active"}</span>
        </div>
        <div className="rain-mini-bars green mt-3">
          {[35, 48, 30, 62, 42, 70, 50, 76, 58, 88].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="rain-metric-caption">{showOffline ? "Latest known data available" : "All systems operational"}</p>
      </div>

    </div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <Card data-testid="dashboard-map-card" className="overflow-hidden rain-glass rounded-3xl shadow-none"><CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-white/30 dark:border-white/10 pb-4"><div><CardTitle className="flex items-center gap-2 text-lg"><MapPinned size={18} className="text-sky-700" />Live risk map</CardTitle><CardDescription className="mt-1">{location.source === "GPS" ? "YOU ARE HERE · browser GPS" : "Selected monitoring point"} · {location.name}</CardDescription></div><Button data-testid="button-open-map" variant="outline" size="sm" onClick={() => navigate("/map")}>Expand map <ChevronRight size={14} /></Button></CardHeader><CardContent className="p-3"><LeafletMap location={location} radiusKm={radiusKm} spatial={spatial} cities={cities} onSelect={selectMapPoint} /></CardContent></Card>
      <div className="space-y-5"><Card data-testid="location-summary-card" className="rain-glass rounded-3xl shadow-none"><CardHeader className="pb-3"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">Active location</p><CardTitle className="mt-1 text-lg">{location.name}</CardTitle><CardDescription>{location.state ?? location.country ?? "Exact selected coordinates"}</CardDescription></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><LocateFixed size={19} /></div></div></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">Latitude</span><strong data-testid="active-latitude" className="mt-1 block font-mono text-slate-900">{location.latitude.toFixed(5)}°</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">Longitude</span><strong data-testid="active-longitude" className="mt-1 block font-mono text-slate-900">{location.longitude.toFixed(5)}°</strong></div></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{location.accuracy ? `GPS accuracy ±${Math.round(location.accuracy)} m` : "Coordinate source: selected point"}</span><ProvenanceBadge {...locationBadge(location)} /></div><Button data-testid="button-refresh-location" className="mt-4 w-full" size="sm" onClick={useMyLocation}><RefreshCw size={14} />Refresh my location</Button></CardContent></Card><Card data-testid="risk-fusion-card" className="rain-glass rounded-3xl shadow-none"><CardHeader className="pb-3"><div className="flex items-center justify-between"><div><CardTitle className="text-lg">Fusion risk engine</CardTitle><CardDescription>Deterministic prototype data fusion</CardDescription></div><ProvenanceBadge status={sourceMode} /></div></CardHeader><CardContent><RiskGauge risk={risk} compact /><div className="my-4 border-t border-white/30 dark:border-white/10 pt-4"><RiskFactors risk={risk} /></div><p className="text-[11px] leading-relaxed text-slate-500">Prototype thresholds require calibration against historical observations before operational deployment.</p></CardContent></Card></div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr_0.8fr]"><Card data-testid="rainfall-preview-card" className="rain-glass rounded-3xl shadow-none lg:col-span-2"><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2 text-lg"><CloudRain size={18} className="text-sky-700" />Next 24 hours</CardTitle><CardDescription>Rainfall and precipitation probability · {forecast.provider}</CardDescription></div><Button data-testid="button-open-forecast" variant="ghost" size="sm" onClick={() => navigate("/forecast")}>Full forecast <ChevronRight size={14} /></Button></CardHeader><CardContent className="h-[235px] px-2"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyChartData}><defs><linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0284c7" stopOpacity={0.28} /><stop offset="100%" stopColor="#0284c7" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="time" tick={AXIS_TICK} interval={3} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="rainfall" name="mm" stroke="#0284c7" fill="url(#rainFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></CardContent></Card><Card data-testid="inundation-preview-card" className="rain-glass rounded-3xl shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><WavesIcon size={18} className="text-amber-700" />Prototype inundation</CardTitle><CardDescription>Surface water pressure estimate</CardDescription></CardHeader><CardContent><RiskGauge risk={{ ...risk, score: risk.inundation.score, category: risk.inundation.category }} compact /><div className="mt-5 space-y-3"><div className="flex justify-between text-sm"><span className="text-slate-600">Trend</span><strong className="font-mono text-slate-900">{risk.inundation.trend}</strong></div><div className="flex justify-between text-sm"><span className="text-slate-600">24h rainfall</span><strong className="font-mono text-slate-900">{formatNumber(rainfall24)} mm</strong></div></div><p className="mt-4 text-[11px] leading-relaxed text-slate-500">Not a validated street-level flood-depth prediction.</p></CardContent></Card></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><Card data-testid="nearby-risk-card" className="rain-glass rounded-3xl shadow-none"><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle className="text-lg">Nearby risk</CardTitle><CardDescription>Prototype spatial visualization · {radiusKm} km radius</CardDescription></div><Button data-testid="button-radius-settings" variant="outline" size="sm" onClick={() => navigate("/settings")}>Radius {radiusKm} km</Button></CardHeader><CardContent><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{spatial.filter((point) => point.name !== "CENTER").slice(0, 6).map((point) => { const pointForecast = makeFallbackForecast(point.latitude, point.longitude); const pointRisk = calculateRisk({ ...pointForecast, status: "LIVE", data: { ...pointForecast.data, current: point.current } }); return <div key={point.name} data-testid={`nearby-point-${point.name.toLowerCase()}`} className="rounded-xl border border-white/30 dark:border-white/10 bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold text-slate-500">{point.name}</span><span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor(pointRisk.category) }} /></div><p className="mt-2 font-mono text-lg font-bold text-slate-900">{pointRisk.score}</p><p className="text-[11px] text-slate-500">{point.distance_km} km · {formatNumber(point.current.precipitation ?? point.current.rain)} mm</p></div>; })}</div>{spatialQuery.isLoading && <p className="mt-3 text-xs text-slate-500">Loading actual surrounding coordinates…</p>}{!spatial.length && !spatialQuery.isLoading && <p className="text-sm text-slate-500">Spatial points will appear when live weather is available.</p>}</CardContent></Card><EmergencyPanel demoStage={demoStage} start={startDemo} next={nextDemoStage} reset={resetDemo} simulateOffline={simulateOffline} /></div>
</>;
}
