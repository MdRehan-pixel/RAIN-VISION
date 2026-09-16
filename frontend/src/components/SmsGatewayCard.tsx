import { Check, RefreshCw, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import type { Provenance, RegisteredLocation, SmsConfigResponse, SmsDeliveryStatus, SmsDeliveryStatusResponse, SmsSendResponse } from "@/lib/types";

const maskPhone = (phone: string) => (phone.length > 6 ? `${phone.slice(0, 3)} ${phone.slice(3, 5)}*** **${phone.slice(-3)}` : "Recipient not configured");

type GatewayStatus = SmsDeliveryStatus | "CHECKING" | "READY" | "SENDER_NOT_PROVISIONED" | "UNVERIFIED";

/** Gateway state before any send: only READY when Twilio confirms the sender is owned. */
const idleStatusFor = (config?: SmsConfigResponse): GatewayStatus => {
  if (!config) return "CHECKING";
  if (!config.configured) return "NOT_CONFIGURED";
  if (config.sender_verification === "VERIFIED") return "READY";
  if (config.sender_verification === "NOT_PROVISIONED") return "SENDER_NOT_PROVISIONED";
  return "UNVERIFIED";
};

const badgeFor = (status: GatewayStatus): Provenance => {
  if (status === "DELIVERED" || status === "SENT" || status === "READY") return "LIVE";
  if (status === "FAILED" || status === "UNDELIVERED" || status === "SENDER_NOT_PROVISIONED") return "UNAVAILABLE";
  if (status === "NOT_CONFIGURED") return "FUTURE";
  return "SIMULATED";
};

const formatCallbackTime = (value: string) => new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export default function SmsGatewayCard({ registration, config, sendResult, delivery, isPending, isOnline, onSendTest }: { registration?: RegisteredLocation; config?: SmsConfigResponse; sendResult?: SmsSendResponse; delivery?: SmsDeliveryStatusResponse; isPending: boolean; isOnline: boolean; onSendTest: () => void }) {
  const gatewayReady = !!config?.configured && config.sender_verification === "VERIFIED";
  const status: GatewayStatus = delivery?.status ?? sendResult?.status ?? idleStatusFor(config);
  const badgeStatus = badgeFor(status);
  let detail = config?.detail ?? "Checking the SMS gateway configuration…";
  if (delivery) detail = `Twilio callback confirmed ${delivery.provider_status.toUpperCase()} at ${formatCallbackTime(delivery.updated_at)}.`;
  else if (sendResult) detail = sendResult.detail;
  return <Card data-testid="recipient-status-card" className="border-slate-200 shadow-sm">
    <CardHeader>
      <div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Smartphone size={18} className="text-slate-700" />Recipient & SMS gateway</CardTitle><CardDescription>Twilio Programmable Messaging · provider-confirmed states only</CardDescription></div><ProvenanceBadge status={badgeStatus} label={status} /></div>
    </CardHeader>
    <CardContent>
      {registration ? <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-900">{registration.name}</p><p data-testid="sms-masked-recipient" className="mt-1 font-mono text-sm text-slate-600">{maskPhone(registration.phone)}</p><p className="mt-1 text-xs text-slate-500">Monitoring {registration.radiusKm} km · threshold {registration.threshold}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><div><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">SMS gateway status</p><p data-testid="sms-delivery-status" className="mt-1 font-semibold text-slate-800">{status}</p></div>{isPending && <RefreshCw size={16} className="animate-spin text-sky-700" />}</div><p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>{config?.configured && <p data-testid="sms-sender-verification" className="mt-2 font-mono text-[10px] text-slate-400">Sender {config.sender_masked ?? "—"} · ownership {config.sender_verification}{config.account_type ? ` · ${config.account_type} account` : ""}</p>}{sendResult?.error_code && <p data-testid="sms-error-code" className="mt-1 font-mono text-[10px] text-rose-600">Twilio error code {sendResult.error_code}</p>}{sendResult?.message_sid && <p data-testid="sms-message-sid" className="mt-2 truncate font-mono text-[10px] text-slate-400">Message SID: {sendResult.message_sid}</p>}</div>
        <div className={`rounded-xl border p-3 text-xs ${gatewayReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><p className="flex items-center gap-1.5 font-semibold"><Check size={13} />Automatic HIGH/EXTREME alerts: {gatewayReady && config?.automatic_alerts ? "ARMED" : "DISABLED"}</p><p className="mt-1">{gatewayReady ? "Demo scenario stages never submit a real SMS." : "Disabled until Twilio confirms a provisioned sender. Demo scenario stages never submit a real SMS."}</p></div>
        <Button data-testid="button-send-test-sms" className="w-full" variant="outline" onClick={onSendTest} disabled={!config?.configured || !isOnline || isPending}><Send size={14} />{isPending ? "Submitting to Twilio…" : "Send provider test alert"}</Button>
      </div> : <div className="text-sm leading-relaxed text-slate-600">Register a monitored recipient in Settings using E.164 format. The phone stays masked in the interface and is transmitted only when an SMS is submitted.</div>}
    </CardContent>
  </Card>;
}