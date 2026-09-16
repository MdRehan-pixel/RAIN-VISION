import type { ReactNode } from "react";
import { Droplets, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { RISK_WEIGHTS } from "@/lib/risk";
import type { LocationState, Provenance, RiskResult } from "@/lib/types";

/** Static recharts tick style shared by every chart (avoids a new object per render). */
export const AXIS_TICK = { fontSize: 10 };
export const RISK_DOMAIN: [number, number] = [0, 100];

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p data-testid={`eyebrow-${eyebrow.toLowerCase().replaceAll(" ", "-")}`} className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">{eyebrow}</p><h2 data-testid={`heading-${title.toLowerCase().replaceAll(" ", "-")}`} className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>{description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}</div>{action}</div>;
}

const metricTones = { slate: "bg-slate-50 text-slate-700", blue: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-800", rose: "bg-rose-50 text-rose-800" };
export type MetricTone = keyof typeof metricTones;

export function MetricCard({ label, value, detail, icon: Icon, tone = "slate" }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: MetricTone }) {
  return <Card data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`} className="border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className={`grid h-9 w-9 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={17} /></div></div></CardContent></Card>;
}

export function StatusRow({ label, status, detail }: { label: string; status: Provenance; detail: string }) {
  return <div data-testid={`source-status-${label.toLowerCase().replaceAll(" ", "-")}`} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{label}</p><p className="truncate text-xs text-slate-500">{detail}</p></div><ProvenanceBadge status={status} /></div>;
}

const factorRows: [keyof RiskResult["factors"], string][] = [["rainfall", "Rainfall intensity"], ["probability", "Probability"], ["accumulation", "Accumulation"], ["nwp", "NWP model"], ["cloudRadar", "Cloud / radar"], ["vulnerability", "Vulnerability proxy"]];

export function RiskFactors({ risk }: { risk: RiskResult }) {
  return <div data-testid="risk-factors" className="space-y-3">{factorRows.map(([key, label]) => { const value = risk.factors[key]; return <div key={key}><div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{label} <span className="font-mono text-[10px] text-slate-400">{Math.round(RISK_WEIGHTS[key] * 100)}%</span></span><span className="font-mono font-semibold text-slate-800">{Math.round(value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600 transition-[width] duration-500" style={{ width: `${value}%` }} /></div></div>; })}</div>;
}

export function SourceCard({ icon: Icon, title, source, status, description }: { icon: LucideIcon; title: string; source: string; status: Provenance; description: string }) {
  return <Card data-testid={`source-card-${title.toLowerCase().replaceAll(" ", "-")}`} className="border-slate-200 shadow-sm"><div className="p-6 pb-3"><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon size={19} /></div><ProvenanceBadge status={status} /></div><h3 className="pt-2 text-base font-semibold text-slate-900">{title}</h3><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{source}</p></div><CardContent><p className="text-sm leading-relaxed text-slate-600">{description}</p></CardContent></Card>;
}

export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl"><p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p>{payload.map((item) => <p key={item.name} className="mt-1 font-semibold text-slate-800">{item.name}: {typeof item.value === "number" ? item.value.toFixed(1) : item.value}</p>)}</div>;
}

export function ToggleRow({ testId, label, detail, enabled, onChange }: { testId: string; label: string; detail: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="text-sm font-semibold text-slate-800">{label}</p><p className="text-xs text-slate-500">{detail}</p></div><button data-testid={testId} aria-pressed={enabled} onClick={() => onChange(!enabled)} className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${enabled ? "bg-sky-700" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-6" : "translate-x-1"}`} /></button></div>;
}

export function WavesIcon({ size = 18, className = "" }: { size?: number; className?: string }) { return <Droplets size={size} className={className} />; }

/** Provenance badge props for the active location's coordinate source. */
export const locationBadge = (location: LocationState): { status: Provenance; label: string } => {
  if (location.source === "GPS") return { status: "LIVE", label: "GPS" };
  if (location.source === "DEMO_FALLBACK") return { status: "DEMO", label: "DEMO" };
  return { status: "SIMULATED", label: location.source };
};
