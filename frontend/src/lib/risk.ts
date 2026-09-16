import type { CurrentWeather, ForecastEnvelope, InundationResult, RiskCategory, RiskResult } from "@/lib/types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

export const categoryForScore = (score: number): RiskCategory => {
  if (score >= 70) return "EXTREME";
  if (score >= 50) return "HIGH";
  if (score >= 30) return "MODERATE";
  return "LOW";
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
  const recommendation = category === "EXTREME"
    ? "Move to higher ground, avoid underpasses and follow official emergency instructions."
    : category === "HIGH"
      ? "Avoid low-lying roads and prepare to shelter away from drainage channels."
      : category === "MODERATE"
        ? "Monitor updates and avoid unnecessary travel during peak rainfall."
        : "Conditions are within prototype monitoring range; continue normal awareness.";
  return { score, category, factors: { rainfall, probability, accumulation, nwp, cloudRadar, vulnerability }, recommendation, inundation };
};

export const calculateInundation = (intensity: number, accumulation6: number, probability: number, vulnerability: number, accumulation24: number): InundationResult => {
  const factors = {
    intensity: clamp(intensity * 20),
    accumulation: clamp(accumulation6 * 8 + accumulation24 * 0.7),
    probability: clamp(probability),
    vulnerability: clamp(vulnerability),
  };
  const score = Math.round(factors.intensity * 0.35 + factors.accumulation * 0.35 + factors.probability * 0.15 + factors.vulnerability * 0.15);
  const trend = accumulation6 > 12 ? "RISING" : accumulation6 > 4 ? "STABLE" : "EASING";
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
    recommendation: category === "EXTREME" || category === "HIGH" ? "Emergency scenario: move to higher ground and follow local authority guidance." : "Emergency scenario is escalating; keep monitoring the command center.",
    inundation: { score: Math.max(0, score - 4), category: categoryForScore(Math.max(0, score - 4)), factors: { intensity: score, accumulation: Math.max(0, score - 8), probability: Math.min(100, score + 4), vulnerability: 40 }, trend: score > 50 ? "RISING" : "STABLE" },
  };
};