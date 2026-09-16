import type { Provenance } from "@/lib/types";

const styles: Record<Provenance, string> = {
  LIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FALLBACK: "border-amber-200 bg-amber-50 text-amber-900",
  DEMO: "border-indigo-200 bg-indigo-50 text-indigo-900",
  SIMULATED: "border-sky-200 bg-sky-50 text-sky-900",
  FUTURE: "border-dashed border-slate-300 bg-slate-100 text-slate-700",
  UNAVAILABLE: "border-neutral-200 bg-neutral-100 text-neutral-600",
};

export default function ProvenanceBadge({ status, label }: { status: Provenance; label?: string }) {
  return <span data-testid={`status-${status.toLowerCase()}-badge`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label ?? status}</span>;
}