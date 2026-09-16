import type { CurrentWeather, ForecastEnvelope, InundationResult, RiskCategory, RiskFactors, RiskResult } from "@/lib/types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

export const categoryForScore = (score: number): RiskCategory => {
  if (score >= 70) return "EXTREME";
  if (score >= 50) return "HIGH";
  if (score >= 30) return "MODERATE";
  return "LOW";
};

/** Plain-language safety guidance per category (prototype, not an official advisory). */
export const RECOMMENDATIONS: Record<RiskCategory, string> = {
  EXTREME: "Move to higher ground, avoid underpasses and follow official emergency instructions.",
  HIGH: "Avoid low-lying roads and prepare to shelter away from drainage channels.",
  MODERATE: "Monitor updates and avoid unnecessary travel during peak rainfall.",
  LOW: "Conditions are within prototype monitoring range; continue normal awareness.",
};

export const riskColor = (category: RiskCategory) => ({
  LOW: "#059669",
  MODERATE: "#D97706",
  HIGH: "#EA580C",
  EXTREME: "#DC2626",
}[category]);

const value = (current: CurrentWeather | undefined, key: keyof CurrentWeather) => Number(current?.[key] ?? 0);

export const accumulationForHours = (forecast: ForecastEnvelope, hours: number) => {
  const values = forecast.data.hourly?.precipitation ?? [];
  return values.slice(0, hours).reduce((total, item) => total + Number(item || 0), 0);
};

const probabilityForHours = (forecast: ForecastEnvelope, hours: number) => {
  const values = forecast.data.hourly?.precipitation_probability ?? [];
  return values.slice(0, hours).reduce((highest, item) => Math.max(highest, Number(item || 0)), 0);
};

export const calculateRisk = (forecast: ForecastEnvelope, radarLive = false): RiskResult => {
  const current = forecast.data.current;
  const intensity = Math.max(value(current, "precipitation"), value(current, "rain"), value(current, "showers"));
  const accumulation6 = accumulationForHours(forecast, 6);
  const accumulation24 = accumulationForHours(forecast, 24);
  const rainfall = clamp(intensity * 20);
  const probability = clamp(probabilityForHours(forecast, 6));
  const accumulation = clamp(accumulation6 * 8 + accumulation24 * 0.7);
  const nwp = clamp(accumulation24 * 2.5 + probability * 0.35);
  const cloudRadar = clamp(Math.max(value(current, "cloud_cover") * 0.55, radarLive ? 58 : 0));
  const vulnerability = 40;
  const score = Math.round(rainfall * 0.3 + probability * 0.2 + accumulation * 0.2 + nwp * 0.15 + cloudRadar * 0.05 + vulnerability * 0.1);
  const category = categoryForScore(score);
  const inundation = calculateInundation(intensity, accumulation6, probability, vulnerability, accumulation24);
  const recommendation = RECOMMENDATIONS[category];
  return { score, category, factors: { rainfall, probability, accumulation, nwp, cloudRadar, vulnerability }, recommendation, inundation };
};

/** Prototype fusion weights shared by the live engine and historical replay. */
export const RISK_WEIGHTS: Record<keyof RiskFactors, number> = { rainfall: 0.3, probability: 0.2, accumulation: 0.2, nwp: 0.15, cloudRadar: 0.05, vulnerability: 0.1 };

/** Same normalisers as calculateRisk, exposed so historical replay uses identical scaling. */
export const normalizeSignals = {
  rainfall: (intensityMmPerHour: number) => clamp(intensityMmPerHour * 20),
  accumulation: (accumulation6: number, accumulation24: number) => clamp(accumulation6 * 8 + accumulation24 * 0.7),
  cloud: (cloudCoverPercent: number) => clamp(cloudCoverPercent * 0.55),
};

export type SignalInputs = Record<keyof RiskFactors, number | null>;

export interface FusedRisk {
  score: number;
  category: RiskCategory;
  /** Normalised 0-100 input per factor; null when the signal was unavailable. */
  factors: SignalInputs;
  /** Effective weight after renormalising over available signals. */
  effectiveWeights: Record<keyof RiskFactors, number>;
  /** Points each factor contributed to the final score (value x effective weight). */
  contributions: Record<keyof RiskFactors, number>;
  /** Share of the nominal weight that was available (1 = every signal present). */
  availableWeight: number;
}

/**
 * Fuse already-normalised 0-100 signals with the prototype weights. Signals that are `null`
 * (unavailable) are excluded and the remaining weights are renormalised so the score still
 * spans 0-100. Nothing is imputed for a missing signal.
 */
export const fuseSignals = (inputs: SignalInputs): FusedRisk => {
  const keys = Object.keys(RISK_WEIGHTS) as (keyof RiskFactors)[];
  const availableWeight = keys.reduce((total, key) => total + (inputs[key] === null ? 0 : RISK_WEIGHTS[key]), 0);
  const effectiveWeights = {} as Record<keyof RiskFactors, number>;
  const contributions = {} as Record<keyof RiskFactors, number>;
  let score = 0;
  for (const key of keys) {
    const value = inputs[key];
    effectiveWeights[key] = value === null || availableWeight === 0 ? 0 : RISK_WEIGHTS[key] / availableWeight;
    contributions[key] = value === null ? 0 : clamp(value) * effectiveWeights[key];
    score += contributions[key];
  }
  const rounded = Math.round(score);
  return { score: rounded, category: categoryForScore(rounded), factors: inputs, effectiveWeights, contributions, availableWeight };
};

const inundationTrend = (accumulation6: number): InundationResult["trend"] => {
  if (accumulation6 > 12) return "RISING";
  if (accumulation6 > 4) return "STABLE";
  return "EASING";
};

export const calculateInundation = (intensity: number, accumulation6: number, probability: number, vulnerability: number, accumulation24: number): InundationResult => {
  const factors = {
    intensity: clamp(intensity * 20),
    accumulation: clamp(accumulation6 * 8 + accumulation24 * 0.7),
    probability: clamp(probability),
    vulnerability: clamp(vulnerability),
  };
  const score = Math.round(factors.intensity * 0.35 + factors.accumulation * 0.35 + factors.probability * 0.15 + factors.vulnerability * 0.15);
  const trend = inundationTrend(accumulation6);
  return { score, category: categoryForScore(score), factors, trend };
};

export const demoRisk = (stage: number): RiskResult => {
  const scores = [18, 36, 47, 61, 82, 84, 88, 88, 88, 42];
  const score = scores[Math.min(stage, scores.length - 1)];
  const category = categoryForScore(score);
  const factors = { rainfall: score, probability: Math.min(100, score + 7), accumulation: Math.min(100, score - 5), nwp: Math.min(100, score - 10), cloudRadar: Math.min(100, score + 3), vulnerability: 40 };
  return {
    score,
    category,
    factors,
    recommendation: score >= 50 ? "Emergency scenario: move to higher ground and follow local authority guidance." : "Emergency scenario is escalating; keep monitoring the command center.",
    inundation: { score: Math.max(0, score - 4), category: categoryForScore(Math.max(0, score - 4)), factors: { intensity: score, accumulation: Math.max(0, score - 8), probability: Math.min(100, score + 4), vulnerability: 40 }, trend: score > 50 ? "RISING" : "STABLE" },
  };
};