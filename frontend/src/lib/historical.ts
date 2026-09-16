/**
 * Historical incident replay: turns a dataset's hourly observations into replay timesteps and runs
 * each step through the same prototype fusion weights/thresholds as the live engine.
 *
 * Rules: null observations stay unavailable (never imputed); accumulations are trailing windows
 * summed from the dataset; nothing here uses Math.random or live weather.
 */
import { calculateInundation, categoryForScore, fuseSignals, normalizeSignals, type FusedRisk } from "@/lib/risk";
import type { HistoricalIncident, HistoricalObservation, RiskCategory, RiskFactors } from "@/lib/types";

export type AlertStatus = "NO ALERT" | "WATCH" | "WARNING" | "EXTREME WARNING";

export interface ReplayStep {
  index: number;
  /** ISO timestamp of the window end (dataset local time). */
  timestamp: string;
  label: string;
  windowHours: number;
  /** Peak hourly rainfall inside the window (mm/h). */
  intensity: number;
  /** Total rainfall inside the window (mm). */
  windowTotal: number;
  accumulation6: number;
  accumulation24: number;
  cloudCover: number | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  risk: FusedRisk;
  inundation: { score: number; category: RiskCategory; trend: "RISING" | "STABLE" | "EASING"; availableWeight: number };
  alertStatus: AlertStatus;
}

export const alertStatusFor = (category: RiskCategory): AlertStatus => ({ LOW: "NO ALERT", MODERATE: "WATCH", HIGH: "WARNING", EXTREME: "EXTREME WARNING" }[category] as AlertStatus);

export const FACTOR_LABELS: Record<keyof RiskFactors, string> = {
  rainfall: "Rainfall signal",
  probability: "Precipitation probability",
  accumulation: "Accumulation",
  nwp: "NWP signal",
  cloudRadar: "Radar / cloud signal",
  vulnerability: "Vulnerability proxy",
};

const IST = "Asia/Kolkata";
export const formatReplayDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(new Date(iso));
export const formatReplayDateTime = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST }).format(new Date(iso));

const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
const mean = (values: (number | null)[]): number | null => {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? present.reduce((total, value) => total + value, 0) / present.length : null;
};
const dayKey = (timestamp: string) => timestamp.slice(0, 10);

/** Prototype inundation fusion with the live engine's weights, renormalised over available inputs. */
const historicalInundation = (intensity: number, accumulation6: number, accumulation24: number, vulnerability: number | null) => {
  const weights = { intensity: 0.35, accumulation: 0.35, probability: 0.15, vulnerability: 0.15 };
  const inputs = {
    intensity: normalizeSignals.rainfall(intensity),
    accumulation: normalizeSignals.accumulation(accumulation6, accumulation24),
    probability: null as number | null, // not present in a reanalysis archive
    vulnerability,
  };
  const availableWeight = (Object.keys(weights) as (keyof typeof weights)[]).reduce((total, key) => total + (inputs[key] === null ? 0 : weights[key]), 0);
  const raw = (Object.keys(weights) as (keyof typeof weights)[]).reduce((total, key) => total + (inputs[key] === null ? 0 : (inputs[key] as number) * weights[key] / availableWeight), 0);
  const score = Math.round(raw);
  // Trend thresholds are the live engine's (calculateInundation); reuse them for parity.
  const trend = calculateInundation(intensity, accumulation6, 0, vulnerability ?? 0, accumulation24).trend;
  return { score, category: categoryForScore(score), trend, availableWeight };
};

/**
 * Build replay steps: one per day across the incident window, switching to `detailStepHours`
 * steps inside the configured detail window (documented peak).
 */
export const buildReplaySteps = (dataset: HistoricalIncident): ReplayStep[] => {
  const observations = dataset.observations;
  if (!observations.length) return [];
  const detail = dataset.replay;
  const detailHours = detail?.detailStepHours ?? 3;
  const inDetail = (timestamp: string) => !!detail && dayKey(timestamp) >= detail.detailStart && dayKey(timestamp) <= detail.detailEnd;

  const windows: { start: number; end: number }[] = [];
  let cursor = 0;
  while (cursor < observations.length) {
    const current = observations[cursor];
    const day = dayKey(current.timestamp);
    let end = cursor;
    if (inDetail(current.timestamp)) {
      end = Math.min(observations.length, cursor + detailHours);
    } else {
      while (end < observations.length && dayKey(observations[end].timestamp) === day) end += 1;
    }
    windows.push({ start: cursor, end });
    cursor = end;
  }

  return windows.map(({ start, end }, index) => {
    const slice = observations.slice(start, end);
    const rainfall = slice.map((item) => item.rainfall);
    const intensity = rainfall.reduce<number>((highest, value) => Math.max(highest, value ?? 0), 0);
    const trailing = (hours: number) => sum(observations.slice(Math.max(0, end - hours), end).map((item) => item.rainfall));
    const accumulation6 = trailing(6);
    const accumulation24 = trailing(24);
    const cloudCover = mean(slice.map((item) => item.cloudCover));
    const last: HistoricalObservation = slice[slice.length - 1];
    const vulnerability = last.vulnerabilityProxy;
    const nwp = mean(slice.map((item) => item.nwpSignal));
    const radar = mean(slice.map((item) => item.radarSignal));
    const satellite = mean(slice.map((item) => item.satelliteSignal));
    const probability = mean(slice.map((item) => item.precipitationProbability));
    const cloudRadar = radar ?? satellite ?? (cloudCover === null ? null : normalizeSignals.cloud(cloudCover));
    const risk = fuseSignals({
      rainfall: normalizeSignals.rainfall(intensity),
      probability,
      accumulation: normalizeSignals.accumulation(accumulation6, accumulation24),
      nwp,
      cloudRadar,
      vulnerability,
    });
    const windowHours = end - start;
    const label = windowHours >= 24 ? formatReplayDate(slice[0].timestamp) : `${formatReplayDateTime(slice[0].timestamp)}–${new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST }).format(new Date(new Date(last.timestamp).getTime() + 3600_000))}`;
    return {
      index,
      timestamp: last.timestamp,
      label,
      windowHours,
      intensity,
      windowTotal: sum(rainfall),
      accumulation6,
      accumulation24,
      cloudCover,
      temperature: mean(slice.map((item) => item.temperature)),
      humidity: mean(slice.map((item) => item.humidity)),
      windSpeed: mean(slice.map((item) => item.windSpeed)),
      risk,
      inundation: historicalInundation(intensity, accumulation6, accumulation24, vulnerability),
      alertStatus: alertStatusFor(risk.category),
    };
  });
};

export interface ReplaySummary {
  peakStep: ReplayStep;
  peakInundationStep: ReplayStep;
  firstAlertStep: ReplayStep | null;
  totalRainfall: number;
  stepsAbove: Record<RiskCategory, number>;
}

export const summariseReplay = (steps: ReplayStep[]): ReplaySummary | null => {
  if (!steps.length) return null;
  const peakStep = steps.reduce((best, step) => (step.risk.score > best.risk.score ? step : best), steps[0]);
  const peakInundationStep = steps.reduce((best, step) => (step.inundation.score > best.inundation.score ? step : best), steps[0]);
  const firstAlertStep = steps.find((step) => step.risk.category === "HIGH" || step.risk.category === "EXTREME") ?? null;
  const stepsAbove: Record<RiskCategory, number> = { LOW: 0, MODERATE: 0, HIGH: 0, EXTREME: 0 };
  for (const step of steps) stepsAbove[step.risk.category] += 1;
  return { peakStep, peakInundationStep, firstAlertStep, totalRainfall: steps.reduce((total, step) => total + step.windowTotal, 0), stepsAbove };
};

/** Human label for how much a factor contributed to the score at a step. */
export const contributionLabel = (points: number, score: number, available: boolean) => {
  if (!available) return "Unavailable";
  if (score === 0) return "None";
  const share = points / score;
  if (share >= 0.3) return "High contribution";
  if (share >= 0.15) return "Moderate contribution";
  return "Low contribution";
};
