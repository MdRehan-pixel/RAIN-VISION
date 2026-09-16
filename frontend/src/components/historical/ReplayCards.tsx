import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "@/lib/recharts";
import { ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AXIS_TICK, RISK_DOMAIN } from "@/components/rainvision/primitives";
import { FACTOR_LABELS, contributionLabel, type ReplayStep, type ReplaySummary } from "@/lib/historical";
import { RISK_WEIGHTS, riskColor } from "@/lib/risk";
import type { useReplayPlayer } from "@/hooks/useReplayPlayer";
import type { HistoricalIncident, HistoricalStatus, RiskFactors } from "@/lib/types";

const SMALL_TICK = { fontSize: 9 };
const NAVY = "#0f172a";

const statusStyles: Record<HistoricalStatus, string> = {
  HISTORICAL: "border-slate-300 bg-slate-100 text-slate-800",
  DERIVED: "border-sky-200 bg-sky-50 text-sky-900",
  PROTOTYPE: "border-indigo-200 bg-indigo-50 text-indigo-900",
  UNAVAILABLE: "border-dashed border-neutral-300 bg-neutral-50 text-neutral-500",
};

export function StatusPill({ status, label }: { status: HistoricalStatus; label?: string }) {
  return <span data-testid={`historical-status-${status.toLowerCase()}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${statusStyles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label ?? status}</span>;
}

export function InfoRow({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span><span data-testid={testId} className="text-right font-medium text-slate-900">{value}</span></div>;
}

export function Stat({ label, value, sub, color, testId }: { label: string; value: string; sub?: string; color?: string; testId: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p data-testid={testId} className="mt-1 font-mono text-2xl font-bold tracking-tight" style={{ color: color ?? NAVY }}>{value}</p>{sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}</div>;
}

function ReplayTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl"><p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p>{payload.map((item) => <p key={item.name} className="mt-1 font-semibold text-slate-800">{item.name}: {typeof item.value === "number" ? item.value.toFixed(1) : item.value}</p>)}</div>;
}

const fmt = (value: number | null | undefined, digits = 1, unit = "") => (value === null || value === undefined ? "DATA UNAVAILABLE" : `${value.toFixed(digits)}${unit}`);

/** Display value of a dataset variable at the current replay step. */
const variableValue = (key: string, current: ReplayStep | undefined): string => {
  if (!current) return "—";
  switch (key) {
    case "rainfall": return fmt(current.intensity, 1, " mm/h peak");
    case "accumulation": return `${current.accumulation6.toFixed(1)} mm / 6 h · ${current.accumulation24.toFixed(1)} mm / 24 h`;
    case "temperature": return fmt(current.temperature, 1, " °C");
    case "humidity": return fmt(current.humidity, 0, " %");
    case "windSpeed": return fmt(current.windSpeed, 1, " km/h");
    case "cloudCover": return fmt(current.cloudCover, 0, " %");
    case "vulnerabilityProxy": return fmt(current.risk.factors.vulnerability, 0, " / 100");
    default: return "DATA UNAVAILABLE";
  }
};

export type ChartPoint = { label: string; rainfall: number; peak: number; risk: number; inundation: number };
type Player = ReturnType<typeof useReplayPlayer>;

export function InputsCard({ dataset, current }: { dataset: HistoricalIncident; current: ReplayStep | undefined }) {
  return <Card data-testid="historical-inputs-card" className="mt-5 border-slate-200 shadow-sm">
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">Historical input data</CardTitle><CardDescription>{dataset.provenance.source} · retrieved {dataset.provenance.retrievedAt} · grid {dataset.provenance.gridLatitude.toFixed(2)}, {dataset.provenance.gridLongitude.toFixed(2)}</CardDescription></div><StatusPill status="HISTORICAL" label="Historical (reanalysis)" /></div></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{dataset.variables.map((variable) => <div key={variable.key} data-testid={`variable-${variable.key}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{variable.label}</span><StatusPill status={variable.status} /></div><p data-testid={`variable-value-${variable.key}`} className={`mt-2 font-mono text-sm ${variable.status === "UNAVAILABLE" ? "text-neutral-500" : "text-slate-900"}`}>{variable.status === "UNAVAILABLE" ? "NOT AVAILABLE IN PROTOTYPE DATASET" : variableValue(variable.key, current)}</p><p className="mt-1 text-[11px] text-slate-500">{variable.source}</p></div>)}</div>
          <p data-testid="reanalysis-note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{dataset.provenance.note}</p>
        </CardContent>
      </Card>;
}

export function TimelineCard({ dataset, steps, player, chartData }: { dataset: HistoricalIncident; steps: ReplayStep[]; player: Player; chartData: ChartPoint[] }) {
  const { current } = player;
  return <Card data-testid="replay-card" className="mt-5 border-slate-200 shadow-sm">
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">Replay timeline</CardTitle><CardDescription>{steps.length} timesteps · {dataset.replay?.note ?? "Daily steps"}</CardDescription></div><div className="flex flex-wrap gap-2">{player.state === "PLAYING" ? <Button data-testid="button-replay-pause" size="sm" variant="outline" onClick={player.pause}><Pause size={14} />Pause</Button> : <Button data-testid="button-replay-play" size="sm" variant="outline" onClick={player.play} disabled={!steps.length || player.state === "COMPLETE"}><Play size={14} />Play replay</Button>}<Button data-testid="button-replay-next" size="sm" variant="outline" onClick={player.next} disabled={!steps.length || player.state === "COMPLETE"}><ChevronRight size={14} />Next step</Button><Button data-testid="button-replay-reset" size="sm" variant="ghost" onClick={player.reset} disabled={player.state === "IDLE"}><RotateCcw size={14} />Reset</Button></div></div></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Current replay time" value={current ? current.label : "—"} sub={current ? `${current.windowHours} h window · step ${player.stepIndex + 1} of ${steps.length}` : "Run the replay to start"} testId="replay-current-time" />
            <Stat label="Current risk score" value={current ? `${current.risk.score} / 100` : "—"} sub={current ? `Inputs available: ${Math.round(current.risk.availableWeight * 100)}% of nominal weight` : undefined} color={current ? riskColor(current.risk.category) : undefined} testId="replay-current-score" />
            <Stat label="Current risk level" value={current ? current.risk.category : "—"} sub={current ? `Alert engine: ${current.alertStatus}` : undefined} color={current ? riskColor(current.risk.category) : undefined} testId="replay-current-level" />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div data-testid="replay-progress" className="h-full rounded-full bg-slate-900 transition-[width] duration-300" style={{ width: `${steps.length ? ((player.stepIndex + 1) / steps.length) * 100 : 0}%` }} /></div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div data-testid="chart-rainfall-vs-time"><p className="mb-2 text-sm font-semibold text-slate-800">Rainfall vs time <span className="font-mono text-[10px] font-normal text-slate-500">· mm per step (ERA5)</span></p><div className="h-[240px]">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} /><Tooltip content={<ReplayTooltip />} /><Bar dataKey="rainfall" name="Rainfall mm" fill="#0284c7" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">Rainfall series appears as the replay runs.</div>}</div></div>
            <div data-testid="chart-risk-vs-time"><p className="mb-2 text-sm font-semibold text-slate-800">Risk score & inundation vs time <span className="font-mono text-[10px] font-normal text-slate-500">· threshold zones</span></p><div className="h-[240px]">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><ReferenceArea y1={0} y2={30} fill="#059669" fillOpacity={0.06} /><ReferenceArea y1={30} y2={50} fill="#d97706" fillOpacity={0.07} /><ReferenceArea y1={50} y2={70} fill="#ea580c" fillOpacity={0.08} /><ReferenceArea y1={70} y2={100} fill="#dc2626" fillOpacity={0.08} /><ReferenceLine y={30} stroke="#d97706" strokeDasharray="4 4" label={{ value: "MODERATE", fontSize: 9, position: "insideTopLeft", fill: "#92400e" }} /><ReferenceLine y={50} stroke="#ea580c" strokeDasharray="4 4" label={{ value: "HIGH", fontSize: 9, position: "insideTopLeft", fill: "#9a3412" }} /><ReferenceLine y={70} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "EXTREME", fontSize: 9, position: "insideTopLeft", fill: "#991b1b" }} /><XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" tickLine={false} axisLine={false} /><YAxis domain={RISK_DOMAIN} tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} /><Tooltip content={<ReplayTooltip />} /><Line type="monotone" dataKey="risk" name="Risk score" stroke="#0f172a" strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="inundation" name="Inundation risk" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">Risk evolution appears as the replay runs.</div>}</div></div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Precipitation probability vs time: NOT AVAILABLE IN PROTOTYPE DATASET (reanalysis archives carry no probabilistic forecast).</p>
        </CardContent>
      </Card>;
}

export function IncidentFactsCard({ dataset }: { dataset: HistoricalIncident }) {
  return <Card data-testid="historical-incident-card" className="border-slate-200 shadow-sm">
          <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">Historical incident</CardTitle><CardDescription>Documented observations and reported impacts</CardDescription></div><StatusPill status="HISTORICAL" label="Documented" /></div></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-600">{dataset.incident.summary}</p>
            <div className="mt-4 space-y-2">{dataset.documentedFacts.map((fact) => <div key={fact.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{fact.label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</p><p className="mt-0.5 text-[11px] text-slate-500">Source: {fact.source}</p></div>)}</div>
            <div className="mt-4"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Not available in prototype dataset</p><p data-testid="unavailable-list" className="mt-1 text-xs leading-relaxed text-neutral-600">{dataset.unavailable.join(" · ")}</p></div>
          </CardContent>
        </Card>;
}

export function OutputCard({ current }: { current: ReplayStep | undefined }) {
  return <Card data-testid="rain-vision-output-card" className={`border-slate-200 shadow-sm ${current && (current.risk.category === "HIGH" || current.risk.category === "EXTREME") ? "border-l-4 border-l-rose-500" : ""}`}>
          <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">RAIN VISION output</CardTitle><CardDescription>Prototype risk engine · {current ? current.label : "awaiting replay"}</CardDescription></div><StatusPill status="PROTOTYPE" label="Historical backtest" /></div></CardHeader>
          <CardContent>
            {current ? <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Risk score" value={`${current.risk.score} / 100`} color={riskColor(current.risk.category)} testId="output-risk-score" />
                <Stat label="Heavy rainfall risk" value={current.risk.category} color={riskColor(current.risk.category)} testId="output-risk-category" />
                <Stat label="Prototype inundation risk" value={current.inundation.category} sub={`${current.inundation.score} / 100 · ${current.inundation.trend}`} color={riskColor(current.inundation.category)} testId="output-inundation" />
                <Stat label="Alert status" value={current.alertStatus} color={current.alertStatus === "NO ALERT" ? "#0f172a" : riskColor(current.risk.category)} testId="output-alert-status" />
              </div>
              <div className="mt-5"><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Risk drivers</p><div data-testid="risk-drivers" className="space-y-2.5">{(Object.keys(RISK_WEIGHTS) as (keyof RiskFactors)[]).map((key) => { const value = current.risk.factors[key]; const points = current.risk.contributions[key]; const available = value !== null; return <div key={key} data-testid={`driver-${key}`}><div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-700">{FACTOR_LABELS[key]} <span className="font-mono text-[10px] text-slate-400">{Math.round(RISK_WEIGHTS[key] * 100)}%{available && current.risk.effectiveWeights[key] !== RISK_WEIGHTS[key] ? ` → ${Math.round(current.risk.effectiveWeights[key] * 100)}%` : ""}</span></span><span className={`font-mono ${available ? "text-slate-800" : "text-neutral-400"}`}>{available ? `${Math.round(value)} · +${points.toFixed(1)} pts` : "UNAVAILABLE"}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${available ? Math.max(1, value) : 0}%`, backgroundColor: available ? "#0284c7" : "transparent" }} /></div><p className="mt-0.5 text-[10px] text-slate-500">{contributionLabel(points, current.risk.score, available)}</p></div>; })}</div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2.5"><p className="font-mono text-[10px] uppercase text-slate-500">Alert engine</p><p data-testid="alert-engine-state" className="mt-0.5 font-semibold text-slate-900">{current.alertStatus === "NO ALERT" ? "NOT TRIGGERED" : "TRIGGERED (historical, no dispatch)"}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="font-mono text-[10px] uppercase text-slate-500">Browser alert</p><p className="mt-0.5 font-semibold text-slate-900">DEMO · suppressed in backtest</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="font-mono text-[10px] uppercase text-slate-500">SMS gateway</p><p data-testid="replay-sms-state" className="mt-0.5 font-semibold text-slate-900">NO SEND IN HISTORICAL MODE</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="font-mono text-[10px] uppercase text-slate-500">Data status</p><p className="mt-0.5 font-semibold text-slate-900">HISTORICAL BACKTEST</p></div></div>
            </> : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Run the historical replay to see calculated risk, inundation, alert state and drivers for each timestep.</div>}
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Prototype risk thresholds and weights require calibration against historical observations before operational deployment. Weights for unavailable signals are renormalised over the available inputs — nothing is imputed.</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Prototype inundation-risk estimate. Production deployment requires DEM/topography, drainage, river levels, soil moisture, land use and hydrological/hydrodynamic modelling.</p>
          </CardContent>
        </Card>;
}

export function ComparisonCard({ dataset, steps, summary }: { dataset: HistoricalIncident; steps: ReplayStep[]; summary: ReplaySummary }) {
  return <Card data-testid="backtest-comparison-card" className="mt-5 border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg">Historical event vs RAIN VISION output</CardTitle><CardDescription>Prototype historical replay completed. Formal model validation requires a larger labelled historical dataset.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Historical event</p><p className="text-sm font-semibold text-slate-900">Documented extreme rainfall and urban inundation</p><p className="mt-1 text-sm text-slate-600">{dataset.documentedFacts[0]?.value} ({dataset.documentedFacts[0]?.label}). ERA5 grid total across the replay window: {summary.totalRainfall.toFixed(0)} mm.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Highest calculated risk" value={`${summary.peakStep.risk.score} / 100`} sub={summary.peakStep.label} color={riskColor(summary.peakStep.risk.category)} testId="summary-peak-risk" />
            <Stat label="Peak risk level" value={summary.peakStep.risk.category} sub={`${summary.stepsAbove.HIGH + summary.stepsAbove.EXTREME} of ${steps.length} steps ≥ HIGH`} color={riskColor(summary.peakStep.risk.category)} testId="summary-peak-level" />
            <Stat label="Peak inundation risk" value={summary.peakInundationStep.inundation.category} sub={`${summary.peakInundationStep.inundation.score} / 100 · ${summary.peakInundationStep.label}`} color={riskColor(summary.peakInundationStep.inundation.category)} testId="summary-peak-inundation" />
            <Stat label="Alert trigger" value={summary.firstAlertStep ? "TRIGGERED" : "NOT TRIGGERED"} sub={summary.firstAlertStep ? `First at ${summary.firstAlertStep.label}` : "No step reached HIGH on available inputs"} color={summary.firstAlertStep ? "#b91c1c" : "#0f172a"} testId="summary-alert-trigger" />
          </div>
          <p className="text-xs leading-relaxed text-slate-500 lg:col-span-2">RAIN VISION replays a documented historical event and evaluates the available historical signals through its prototype risk engine. This is not a claim that the prototype predicted the event; no accuracy metric is reported because ground-truth labels and an evaluation methodology are not part of the prototype dataset.</p>
        </CardContent>
      </Card>;
}

export function HowItWorksCard() {
  return <Card data-testid="how-this-test-works-card" className="mt-5 border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg">How this test works</CardTitle></CardHeader>
        <CardContent><ol className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">{["Select a documented historical incident.", "Load available historical observations.", "Feed the observations into the RAIN VISION data-fusion engine.", "Calculate risk for each historical timestep.", "Observe how the risk changes over time.", "Compare the prototype output with the documented historical event.", "Use the result to identify where further model calibration and validation are required."].map((step, index) => <li key={step} className="flex gap-2 rounded-lg bg-slate-50 p-2.5"><span className="font-mono text-xs font-bold text-sky-700">{index + 1}</span><span>{step}</span></li>)}</ol><p className="mt-3 text-[11px] text-slate-500">Risk score = Σ (normalised signal × weight) with the prototype weights rainfall 30%, probability 20%, accumulation 20%, NWP 15%, radar/cloud 5%, vulnerability 10%; 0–29 LOW, 30–49 MODERATE, 50–69 HIGH, 70–100 EXTREME. Rainfall is normalised as mm/h × 20; accumulation as 6 h mm × 8 + 24 h mm × 0.7 (trailing windows); cloud as % × 0.55.</p></CardContent>
      </Card>;
}
