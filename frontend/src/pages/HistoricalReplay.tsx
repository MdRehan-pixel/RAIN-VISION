import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MapPinned, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LeafletMap from "@/components/LeafletMap";
import { ComparisonCard, HowItWorksCard, IncidentFactsCard, InfoRow, InputsCard, OutputCard, StatusPill, TimelineCard, type ChartPoint } from "@/components/historical/ReplayCards";
import { apiGet } from "@/lib/api";
import { buildReplaySteps, summariseReplay } from "@/lib/historical";
import { useReplayPlayer, type ReplayState } from "@/hooks/useReplayPlayer";
import type { CityWeather, HistoricalIncident, IncidentListResponse, LocationState, SpatialPoint } from "@/lib/types";

const NO_SPATIAL: SpatialPoint[] = [];
const NO_CITIES: CityWeather[] = [];
const ignoreMapClick = () => undefined;

const statusLabel = (state: ReplayState) => {
  if (state === "IDLE") return "Ready for replay";
  if (state === "COMPLETE") return "Replay complete";
  return `Replay ${state.toLowerCase()}`;
};

export default function HistoricalReplay() {
  const incidentsQuery = useQuery({ queryKey: ["historical-incidents"], queryFn: () => apiGet<IncidentListResponse>("/historical/incidents"), staleTime: Infinity });
  const incidents = incidentsQuery.data?.incidents ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? incidents.find((item) => item.primaryDemo)?.id ?? incidents[0]?.id ?? null;
  const datasetQuery = useQuery({ queryKey: ["historical-incident", activeId], queryFn: () => apiGet<HistoricalIncident>(`/historical/incidents/${activeId}`), enabled: Boolean(activeId), staleTime: Infinity });
  const dataset = datasetQuery.data;

  const steps = useMemo(() => (dataset ? buildReplaySteps(dataset) : []), [dataset]);
  const player = useReplayPlayer(steps, activeId);
  const { state, current, shown } = player;
  const summary = useMemo(() => (state === "COMPLETE" ? summariseReplay(steps) : null), [state, steps]);
  const chartData: ChartPoint[] = useMemo(() => shown.map((step) => ({ label: step.label, rainfall: Number(step.windowTotal.toFixed(1)), peak: Number(step.intensity.toFixed(1)), risk: step.risk.score, inundation: step.inundation.score })), [shown]);
  const mapLocation: LocationState | null = useMemo(() => (dataset ? { name: `${dataset.incident.location.city} · historical incident`, state: dataset.incident.location.state, country: dataset.incident.location.country, latitude: dataset.incident.location.latitude, longitude: dataset.incident.location.longitude, source: "SEARCH" } : null), [dataset]);

  return <div data-testid="historical-replay-page">
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Model testing · backtest</p><h2 data-testid="heading-historical-incident-replay" className="text-2xl font-semibold tracking-tight text-slate-950">Historical incident replay</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Replay documented historical rainfall/flood events through the RAIN VISION prototype risk engine.</p></div>
      <span data-testid="historical-mode-badge" className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-900 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white"><History size={12} />Historical backtest mode</span>
    </div>

    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card data-testid="incident-card" className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg">Incident</CardTitle><CardDescription>Only incidents with a verified local dataset are listed.</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2" data-testid="incident-selector">
            {incidents.map((item) => <button key={item.id} data-testid={`incident-option-${item.id}`} onClick={() => setSelectedId(item.id)} aria-pressed={item.id === activeId} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${item.id === activeId ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{item.name}{item.primaryDemo && <span className="ml-2 font-mono text-[9px] uppercase tracking-wider opacity-70">Primary demo</span>}</button>)}
            {incidentsQuery.isLoading && <span className="text-xs text-slate-500">Loading incident list…</span>}
            {!incidentsQuery.isLoading && !incidents.length && <span className="text-xs text-slate-500">No historical dataset available.</span>}
          </div>
          {dataset && <>
            <InfoRow label="Incident" value={dataset.incident.name} testId="incident-name" />
            <InfoRow label="Location" value={`${dataset.incident.location.city}, ${dataset.incident.location.state}`} testId="incident-location" />
            <InfoRow label="Event type" value={dataset.incident.eventType} testId="incident-event-type" />
            <InfoRow label="Period" value={`${dataset.incident.period.start} → ${dataset.incident.period.end}`} testId="incident-period" />
            <InfoRow label="Data type" value="Historical / Backtest" testId="incident-data-type" />
            <InfoRow label="Status" value={<StatusPill status="HISTORICAL" label={statusLabel(state)} />} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button data-testid="button-run-historical-replay" onClick={player.run} disabled={!steps.length}><Play size={14} />Run historical replay</Button>
              <Button data-testid="button-reset-replay" variant="outline" onClick={player.reset} disabled={state === "IDLE"}><RotateCcw size={14} />Reset replay</Button>
            </div>
          </>}
        </CardContent>
      </Card>
      <div className="relative">
        {mapLocation && <LeafletMap location={mapLocation} radiusKm={10} spatial={NO_SPATIAL} cities={NO_CITIES} onSelect={ignoreMapClick} hudLabel="Historical incident location" />}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-lg border border-white/80 bg-white/95 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700 shadow"><MapPinned size={11} className="mr-1 inline" />Historical incident location</div>
      </div>
    </div>

    {dataset && <>
      <InputsCard dataset={dataset} current={current} />
      <TimelineCard dataset={dataset} steps={steps} player={player} chartData={chartData} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <IncidentFactsCard dataset={dataset} />
        <OutputCard current={current} />
      </div>
      {summary && <ComparisonCard dataset={dataset} steps={steps} summary={summary} />}
      <HowItWorksCard />
    </>}
    {datasetQuery.isError && <p data-testid="historical-load-error" className="mt-4 text-sm text-rose-700">The historical dataset could not be loaded from the server.</p>}
  </div>;
}
