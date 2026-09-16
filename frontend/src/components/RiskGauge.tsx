import type { RiskResult } from "@/lib/types";
import { riskColor } from "@/lib/risk";

export default function RiskGauge({ risk, compact = false }: { risk: RiskResult; compact?: boolean }) {
  const color = riskColor(risk.category);
  return <div data-testid="risk-gauge" className={`flex items-center ${compact ? "gap-3" : "gap-5"}`}>
    <div className={`relative grid shrink-0 place-items-center rounded-full ${compact ? "h-16 w-16" : "h-28 w-28"}`} style={{ background: `conic-gradient(${color} ${risk.score * 3.6}deg, #e2e8f0 0deg)` }}>
      <div className={`grid place-items-center rounded-full bg-white ${compact ? "h-12 w-12" : "h-[5.25rem] w-[5.25rem]"}`}><span data-testid="risk-score-value" className={`${compact ? "text-lg" : "text-3xl"} font-mono font-bold text-slate-950`}>{risk.score}</span><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">/ 100</span></div>
    </div>
    <div><p data-testid="risk-category-value" className="font-mono text-xs font-bold uppercase tracking-[0.18em]" style={{ color }}>{risk.category}</p><p className="mt-1 text-sm text-slate-600">Prototype fusion score</p></div>
  </div>;
}