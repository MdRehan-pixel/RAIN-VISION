import { AlertTriangle, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import SmsGatewayCard from "@/components/SmsGatewayCard";
import { SectionHeading } from "@/components/rainvision/primitives";
import { formatNumber } from "@/lib/weather";
import { formatTime } from "@/lib/format";
import type { RainVisionModel } from "@/hooks/useRainVision";

export default function AlertsView({ m }: { m: RainVisionModel }) {
  const { location, radiusKm, isOnline, sourceMode, risk, current, activeAlert, lastUpdated, smsConfigQuery, smsStatusQuery, smsSendMutation, registration, sendTestSms, enableNotifications } = m;
  return <>
    <SectionHeading eyebrow="Alert operations" title="Alerts & geofencing" description="Browser warnings remain local; SMS states come only from Twilio submission responses and signed delivery callbacks." action={<Button data-testid="button-enable-alerts" onClick={() => void enableNotifications()}><BellRing size={15} />Enable browser alerts</Button>} />
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card data-testid="active-alerts-card" className={`border-slate-200 shadow-sm ${activeAlert ? "border-l-4 border-l-rose-500" : ""}`}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><AlertTriangle size={19} className={activeAlert ? "text-rose-600" : "text-emerald-600"} />{activeAlert ? "Active geofenced warning" : "No active high-severity alert"}</CardTitle><CardDescription className="mt-1">{location.name} · radius {radiusKm} km</CardDescription></div><ProvenanceBadge status={sourceMode} /></div></CardHeader><CardContent>{activeAlert ? <div className="space-y-4"><div className="rounded-xl bg-rose-50 p-4"><p className="font-mono text-xs font-bold uppercase tracking-wider text-rose-800">GEOFENCED ALERT: {risk.category} RAINFALL & INUNDATION RISK DETECTED</p><p className="mt-2 text-sm leading-relaxed text-rose-950">{risk.recommendation}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Risk", `${risk.score}/100`], ["Rainfall", `${formatNumber(current.precipitation ?? current.rain)} mm/h`], ["Inundation", `${risk.inundation.score}/100`], ["Last update", formatTime(lastUpdated)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-slate-900">{value}</p></div>)}</div></div> : <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">The local alert engine is monitoring the active point. HIGH and EXTREME live states can trigger browser notifications and an automatic SMS for a registered recipient.</div>}</CardContent></Card>
      <SmsGatewayCard registration={registration} config={smsConfigQuery.data} sendResult={smsSendMutation.data} delivery={smsStatusQuery.data} isPending={smsSendMutation.isPending || smsStatusQuery.isFetching} isOnline={isOnline} onSendTest={sendTestSms} />
    </div>
</>;
}
