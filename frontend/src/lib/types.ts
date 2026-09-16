export type Provenance = "LIVE" | "FALLBACK" | "DEMO" | "SIMULATED" | "FUTURE" | "UNAVAILABLE";
export type RiskCategory = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface CurrentWeather {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  rain?: number;
  showers?: number;
  weather_code?: number;
  cloud_cover?: number;
  surface_pressure?: number;
  wind_speed_10m?: number;
}

export interface HourlyWeather {
  time: string[];
  precipitation: number[];
  rain?: number[];
  showers?: number[];
  precipitation_probability: number[];
  temperature_2m?: number[];
  relative_humidity_2m?: number[];
  wind_speed_10m?: number[];
  cloud_cover?: number[];
}

export interface WeatherPayload {
  latitude: number;
  longitude: number;
  timezone?: string;
  current?: CurrentWeather;
  hourly?: HourlyWeather;
  current_units?: Record<string, string>;
  hourly_units?: Record<string, string>;
}

export interface ForecastEnvelope {
  status: "LIVE" | "FALLBACK";
  provider: string;
  model: string;
  latitude: number;
  longitude: number;
  fetched_at: string;
  cached: boolean;
  data: WeatherPayload;
}

export interface GeoResult {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
}

export interface GeocodeResponse {
  results: GeoResult[];
  status: "LIVE" | "FALLBACK";
  fetched_at: string;
}

export interface CityWeather {
  name: string;
  latitude: number;
  longitude: number;
  current: CurrentWeather;
}

export interface PanIndiaResponse {
  status: "LIVE" | "FALLBACK";
  fetched_at: string;
  cities: CityWeather[];
}

export interface SpatialPoint {
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  current: CurrentWeather;
}

export interface SpatialResponse {
  status: "LIVE" | "FALLBACK";
  radius_km: number;
  fetched_at: string;
  points: SpatialPoint[];
}

export interface RadarFrame {
  time: number;
  tile_template: string;
}

export interface RadarResponse {
  status: "LIVE" | "UNAVAILABLE";
  generated?: number;
  fetched_at: string;
  frames: RadarFrame[];
}

export interface LocationState {
  name: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "GPS" | "SEARCH" | "MAP" | "DEMO_FALLBACK";
}

export interface RiskFactors {
  rainfall: number;
  probability: number;
  accumulation: number;
  nwp: number;
  cloudRadar: number;
  vulnerability: number;
}

export interface InundationResult {
  score: number;
  category: RiskCategory;
  factors: { intensity: number; accumulation: number; probability: number; vulnerability: number };
  trend: "RISING" | "STABLE" | "EASING";
}

export interface RiskResult {
  score: number;
  category: RiskCategory;
  factors: RiskFactors;
  recommendation: string;
  inundation: InundationResult;
}

export interface RegisteredLocation {
  name: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  threshold: RiskCategory;
  savedAt: string;
}

export interface HistoryPoint {
  timestamp: string;
  score: number;
  rainfall: number;
  inundation: number;
}

export interface CacheSnapshot {
  location: LocationState;
  forecast: ForecastEnvelope;
  risk: RiskResult;
  radar?: RadarResponse;
  spatial?: SpatialResponse;
  savedAt: string;
  history: HistoryPoint[];
}

export type SmsDeliveryStatus = "NOT_CONFIGURED" | "QUEUED" | "ACCEPTED" | "SCHEDULED" | "SENDING" | "SENT" | "DELIVERED" | "UNDELIVERED" | "FAILED" | "UNKNOWN";

export interface SmsAlertRequest {
  recipient: string;
  location: string;
  risk: number;
  severity: RiskCategory;
  rainfall: number;
  inundation: number;
  last_live_update: string;
  recommended_action: string;
  idempotency_key: string;
  test_mode: boolean;
}

export type SmsSenderVerification = "VERIFIED" | "NOT_PROVISIONED" | "UNVERIFIED" | "NOT_CONFIGURED";

export interface SmsConfigResponse {
  configured: boolean;
  gateway: string;
  sender_type: "MESSAGING_SERVICE" | "PHONE_NUMBER" | "NONE";
  sender_masked?: string;
  sender_verification: SmsSenderVerification;
  account_type?: string;
  callback_configured: boolean;
  automatic_alerts: boolean;
  detail: string;
}

export interface SmsSendResponse {
  configured: boolean;
  gateway: string;
  status: SmsDeliveryStatus;
  message_sid?: string;
  provider_status?: string;
  error_code?: string;
  detail: string;
  updated_at: string;
  duplicate: boolean;
}

export interface SmsDeliveryStatusResponse {
  message_sid: string;
  status: SmsDeliveryStatus;
  provider_status: string;
  recipient_masked: string;
  error_code?: string;
  updated_at: string;
}