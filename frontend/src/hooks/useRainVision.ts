import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { calculateRisk, demoRisk } from "@/lib/risk";
import { clearRainVisionStorage, getCacheSnapshot, getRegistration, isDemoOffline, saveCacheSnapshot, saveRegistration, setDemoOfflineStorage } from "@/lib/storage";
import { makeFallbackForecast } from "@/lib/weather";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { DEFAULT_LOCATION, DEMO_OFFLINE_FROM, DEMO_RESTORE_STAGE, demoStages, riskRank, viewFromPath } from "@/pages/rainvision/config";
import type { ForecastEnvelope, GeocodeResponse, HistoryPoint, LocationState, PanIndiaResponse, RadarResponse, RegisteredLocation, SmsAlertRequest, SmsConfigResponse, SmsDeliveryStatusResponse, SmsSendResponse, SpatialResponse } from "@/lib/types";

const NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;
const LAST_NOTIFICATION_KEY = "rain-vision-last-notification";
const LAST_SMS_KEY = "rain-vision-last-sms-key";
const E164 = /^\+[1-9]\d{7,14}$/;
const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 };

const sumHours = (values: number[] | undefined, hours: number) => (values ?? []).slice(0, hours).reduce((total, value) => total + Number(value || 0), 0);
const gpsLocation = (position: GeolocationPosition, name: string): LocationState => ({ name, country: "India", latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, source: "GPS" });
const sameCoordinates = (a: { latitude: number; longitude: number } | undefined, b: { latitude: number; longitude: number }) => !!a && Math.abs(a.latitude - b.latitude) < 0.0001 && Math.abs(a.longitude - b.longitude) < 0.0001;

/**
 * All RAIN VISION state, data fetching, derived risk and side effects. Views receive the returned
 * model and stay purely presentational.
 */
export function useRainVision() {
  const route = useLocation();
  const navigate = useNavigate();
  const cacheSeed = useRef(getCacheSnapshot());
  const [location, setLocation] = useState<LocationState>(cacheSeed.current?.location ?? DEFAULT_LOCATION);
  const [radiusKm, setRadiusKm] = useState(cacheSeed.current?.spatial?.radius_km ?? 10);
  const [demoOffline, setDemoOffline] = useState(isDemoOffline());
  const [demoStage, setDemoStage] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveLocation, setLiveLocation] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const [registration, setRegistration] = useState<RegisteredLocation | undefined>(getRegistration());
  const [registrationForm, setRegistrationForm] = useState({ name: "", phone: "", email: "" });
  const [history, setHistory] = useState<HistoryPoint[]>(cacheSeed.current?.history ?? []);
  const [smsMessageSid, setSmsMessageSid] = useState<string | undefined>();

  const currentView = viewFromPath(route.pathname);
  const networkOnline = useNetworkStatus({
    onOnline: () => { if (!demoOffline) { toast.success("Network restored", { description: "Refreshing live data…" }); refreshLive(); } },
    onOffline: () => toast.warning("Network offline", { description: "Automatic offline mode is active." }),
  });
  const isOnline = networkOnline && !demoOffline;
  // Historical backtest mode must not mix live weather into the replay, so live fetching pauses on that view.
  const liveFetchEnabled = isOnline && currentView !== "historical";
  const coordinateKey = `${location.latitude.toFixed(5)}&longitude=${location.longitude.toFixed(5)}`;

  const forecastQuery = useQuery({
    queryKey: ["forecast", location.latitude.toFixed(4), location.longitude.toFixed(4)],
    queryFn: () => apiGet<ForecastEnvelope>(`/forecast?latitude=${coordinateKey}`),
    enabled: liveFetchEnabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchInterval: autoRefresh && liveFetchEnabled ? 15 * 60 * 1000 : false,
    initialData: sameCoordinates(cacheSeed.current?.forecast, location) ? cacheSeed.current?.forecast : makeFallbackForecast(location.latitude, location.longitude),
    initialDataUpdatedAt: cacheSeed.current?.savedAt ? new Date(cacheSeed.current.savedAt).getTime() : undefined,
  });
  const radarQuery = useQuery({ queryKey: ["radar"], queryFn: () => apiGet<RadarResponse>("/radar"), enabled: liveFetchEnabled, staleTime: 5 * 60 * 1000, refetchInterval: autoRefresh && liveFetchEnabled ? 5 * 60 * 1000 : false, initialData: cacheSeed.current?.radar });
  const spatialQuery = useQuery({ queryKey: ["spatial", location.latitude.toFixed(3), location.longitude.toFixed(3), radiusKm], queryFn: () => apiGet<SpatialResponse>(`/spatial?latitude=${coordinateKey}&radiusKm=${radiusKm}`), enabled: liveFetchEnabled, staleTime: 5 * 60 * 1000, initialData: cacheSeed.current?.spatial?.radius_km === radiusKm ? cacheSeed.current?.spatial : undefined });
  const panIndiaQuery = useQuery({ queryKey: ["pan-india"], queryFn: () => apiGet<PanIndiaResponse>("/pan-india"), enabled: liveFetchEnabled, staleTime: 5 * 60 * 1000 });
  const searchQuery = useQuery({ queryKey: ["geocode", searchTerm], queryFn: () => apiGet<GeocodeResponse>(`/geocode?name=${encodeURIComponent(searchTerm)}&countryCode=IN`), enabled: Boolean(searchTerm) && isOnline, retry: false });
  const smsConfigQuery = useQuery({ queryKey: ["sms-config"], queryFn: () => apiGet<SmsConfigResponse>("/sms/config"), enabled: isOnline, staleTime: 5 * 60 * 1000, retry: false });
  const smsStatusQuery = useQuery({ queryKey: ["sms-status", smsMessageSid], queryFn: () => apiGet<SmsDeliveryStatusResponse>(`/sms/status/${smsMessageSid}`), enabled: Boolean(smsMessageSid) && isOnline, refetchInterval: smsMessageSid ? 5000 : false, retry: false });

  const { refetch: refetchForecast } = forecastQuery;
  const { refetch: refetchRadar } = radarQuery;
  const { refetch: refetchSpatial } = spatialQuery;
  const refreshLive = useCallback(() => { void refetchForecast(); void refetchRadar(); void refetchSpatial(); }, [refetchForecast, refetchRadar, refetchSpatial]);

  // ---- derived state ----
  const forecast = forecastQuery.data ?? makeFallbackForecast(location.latitude, location.longitude);
  const radarLive = radarQuery.data?.status === "LIVE";
  const liveStatus = useMemo((): "LIVE" | "FALLBACK" | "DEMO" => {
    if (demoStage !== null) return "DEMO";
    if (isOnline && forecastQuery.data?.status === "LIVE" && !forecastQuery.isError) return "LIVE";
    return cacheSeed.current ? "FALLBACK" : "DEMO";
  }, [demoStage, forecastQuery.data?.status, forecastQuery.isError, isOnline]);
  const risk = useMemo(() => (demoStage === null ? calculateRisk(forecast, radarLive) : demoRisk(demoStage)), [demoStage, forecast, radarLive]);
  const hourlyChartData = useMemo(() => (forecast.data.hourly?.time ?? []).slice(0, 24).map((time, index) => ({ time: formatTime(time), rainfall: Number(forecast.data.hourly?.precipitation?.[index] ?? 0), probability: Number(forecast.data.hourly?.precipitation_probability?.[index] ?? 0) })), [forecast]);
  const current = forecast.data.current ?? {};
  const currentRainfall = Number(current.precipitation ?? current.rain ?? 0);
  const rainfall24 = sumHours(forecast.data.hourly?.precipitation, 24);
  const accumulations = { one: sumHours(forecast.data.hourly?.precipitation, 1), three: sumHours(forecast.data.hourly?.precipitation, 3), six: sumHours(forecast.data.hourly?.precipitation, 6), twentyFour: rainfall24 };
  const activeAlert = risk.category === "HIGH" || risk.category === "EXTREME";
  const lastUpdated = forecast.fetched_at;
  const showOffline = !isOnline;
  const sourceMode: "LIVE" | "FALLBACK" | "DEMO" = demoStage !== null ? "DEMO" : liveStatus;
  const spatial = spatialQuery.data?.points ?? [];
  const cities = panIndiaQuery.data?.cities ?? [];
  const searchResults = searchQuery.data?.results ?? [];

  // ---- SMS ----
  const buildSmsRequest = useCallback((testMode: boolean): SmsAlertRequest => ({
    recipient: registration?.phone ?? "",
    location: location.name,
    risk: risk.score,
    severity: risk.category,
    rainfall: currentRainfall,
    inundation: risk.inundation.score,
    last_live_update: lastUpdated,
    recommended_action: risk.recommendation,
    idempotency_key: `${testMode ? "test" : "alert"}-${location.latitude.toFixed(4)}-${location.longitude.toFixed(4)}-${risk.category}-${testMode ? Date.now() : lastUpdated}`,
    test_mode: testMode,
  }), [currentRainfall, lastUpdated, location.latitude, location.longitude, location.name, registration?.phone, risk]);
  const smsSendMutation = useMutation({
    mutationFn: (payload: SmsAlertRequest) => apiPost<SmsSendResponse>("/sms/alerts", payload),
    onSuccess: (result) => {
      if (result.message_sid) setSmsMessageSid(result.message_sid);
      if (result.status === "FAILED" || result.status === "UNDELIVERED") toast.error("SMS was not accepted for delivery", { description: result.detail });
      else if (result.status === "NOT_CONFIGURED") toast.warning("SMS gateway is not configured", { description: result.detail });
      else toast.success("SMS submitted to Twilio", { description: "Delivery remains pending until Twilio confirms it." });
    },
    onError: () => toast.error("SMS request failed", { description: "No message delivery is claimed." }),
  });
  const { mutate: sendSms } = smsSendMutation;

  // ---- handlers ----
  const setOffline = useCallback((value: boolean) => {
    setDemoOffline(value);
    setDemoOfflineStorage(value);
    if (value) { toast.warning("Offline mode activated", { description: "Latest known data remains available; live requests are paused." }); return; }
    toast.success("Network restored", { description: "Refreshing live data…" });
    refreshLive();
  }, [refreshLive]);
  const selectLocation = useCallback((next: LocationState) => { setLocation(next); toast.success("Monitoring location updated", { description: `${next.name} · ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}` }); navigate("/"); }, [navigate]);
  const selectMapPoint = useCallback((latitude: number, longitude: number) => selectLocation({ name: "Selected map point", latitude, longitude, source: "MAP" }), [selectLocation]);
  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocation is not available in this browser"); return; }
    navigator.geolocation.getCurrentPosition((position) => selectLocation(gpsLocation(position, "Current GPS location")), () => toast.error("Location access not available", { description: "Search or select a point on the map instead." }), GPS_OPTIONS);
  }, [selectLocation]);
  const startDemo = useCallback(() => { setDemoStage(0); setOffline(false); }, [setOffline]);
  const nextDemoStage = useCallback(() => setDemoStage((stage) => (stage === null ? 0 : Math.min(stage + 1, demoStages.length - 1))), []);
  const resetDemo = useCallback(() => { setDemoStage(null); setOffline(false); }, [setOffline]);
  const runSearch = () => { if (searchInput.trim().length < 2) { toast.error("Enter at least two characters to search"); return; } setSearchTerm(searchInput.trim()); };
  const enableNotifications = async () => {
    if (typeof Notification === "undefined") { toast.error("Browser notifications are not supported"); return; }
    const granted = (await Notification.requestPermission()) === "granted";
    setNotificationsEnabled(granted);
    if (granted) toast.success("Browser alerts enabled", { description: "High and extreme conditions will trigger a device notification." });
    else toast.warning("Browser alerts not enabled", { description: "In-app alerts remain available." });
  };
  const registerLocation = (event: FormEvent) => {
    event.preventDefault();
    if (!registrationForm.name || !E164.test(registrationForm.phone)) { toast.error("Use a name and E.164 phone number", { description: "Example: +919876543210" }); return; }
    const next: RegisteredLocation = { ...registrationForm, latitude: location.latitude, longitude: location.longitude, radiusKm, threshold: "HIGH", savedAt: new Date().toISOString() };
    saveRegistration(next);
    setRegistration(next);
    toast.success("Location monitoring registered", { description: "DEMO LOCAL REGISTRATION saved on this device." });
  };
  const sendTestSms = () => { if (!registration) { toast.error("Register a recipient first"); return; } sendSms(buildSmsRequest(true)); };
  const resetAll = () => { clearRainVisionStorage(); setRegistration(undefined); setHistory([]); setDemoStage(null); setOffline(false); setLocation(DEFAULT_LOCATION); toast.success("Local data reset"); };

  // ---- effects ----
  // One-shot native GPS request on startup; failure silently keeps the explicit fallback location.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => setLocation(gpsLocation(position, "Current GPS location")), () => undefined, { ...GPS_OPTIONS, timeout: 8000 });
  }, []);
  useEffect(() => {
    if (!liveLocation || !navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition((position) => setLocation(gpsLocation(position, "Live GPS location")), undefined, { enableHighAccuracy: true, maximumAge: 60000 });
    return () => navigator.geolocation.clearWatch(watcher);
  }, [liveLocation]);
  useEffect(() => {
    if (demoStage === null) return;
    const timer = window.setInterval(() => setDemoStage((stage) => (stage === null || stage >= demoStages.length - 1 ? stage : stage + 1)), 1800);
    return () => window.clearInterval(timer);
  }, [demoStage]);
  useEffect(() => {
    if (demoStage !== null && demoStage >= DEMO_OFFLINE_FROM && demoStage < DEMO_RESTORE_STAGE) setOffline(true);
    if (demoStage === DEMO_RESTORE_STAGE) setOffline(false);
  }, [demoStage, setOffline]);
  // Every successful live snapshot is cached so offline mode can show latest known data after a refresh.
  useEffect(() => {
    const liveForecast = forecastQuery.data;
    if (!liveForecast || liveForecast.status !== "LIVE" || !isOnline || demoStage !== null) return;
    const nextPoint: HistoryPoint = { timestamp: liveForecast.fetched_at, score: risk.score, rainfall: currentRainfall, inundation: risk.inundation.score };
    setHistory((existing) => {
      const next = [...existing.filter((point) => Date.now() - new Date(point.timestamp).getTime() < 86400000), nextPoint].slice(-24);
      saveCacheSnapshot({ location, forecast: liveForecast, risk, radar: radarQuery.data, spatial: spatialQuery.data, savedAt: new Date().toISOString(), history: next });
      return next;
    });
  }, [currentRainfall, demoStage, forecastQuery.data, isOnline, location, radarQuery.data, risk, spatialQuery.data]);
  useEffect(() => {
    if (!activeAlert || !notificationsEnabled || typeof Notification === "undefined") return;
    const last = Number(localStorage.getItem(LAST_NOTIFICATION_KEY) ?? 0);
    if (Date.now() - last < NOTIFICATION_COOLDOWN_MS) return;
    new Notification("RAIN VISION WARNING", { body: `${risk.category} rainfall and inundation risk near ${location.name}. Risk ${risk.score}/100.` });
    localStorage.setItem(LAST_NOTIFICATION_KEY, String(Date.now()));
    toast.error("Browser warning triggered", { description: `${risk.category} risk detected near ${location.name}.` });
  }, [activeAlert, location.name, notificationsEnabled, risk.category, risk.score]);
  // Automatic SMS only for live HIGH/EXTREME with a Twilio-verified sender; never in demo or historical mode.
  useEffect(() => {
    const config = smsConfigQuery.data;
    const armed = config?.configured && config.sender_verification === "VERIFIED" && config.automatic_alerts;
    if (!activeAlert || !registration || !isOnline || demoStage !== null || currentView === "historical" || !armed || riskRank[risk.category] < riskRank[registration.threshold]) return;
    const key = `alert-${location.latitude.toFixed(4)}-${location.longitude.toFixed(4)}-${risk.category}-${lastUpdated}`;
    if (localStorage.getItem(LAST_SMS_KEY) === key) return;
    localStorage.setItem(LAST_SMS_KEY, key);
    sendSms({ ...buildSmsRequest(false), idempotency_key: key });
  }, [activeAlert, buildSmsRequest, currentView, demoStage, isOnline, lastUpdated, location.latitude, location.longitude, registration, risk.category, sendSms, smsConfigQuery.data]);

  return {
    navigate, currentView, location, radiusKm, setRadiusKm, demoStage, isOnline, showOffline, liveStatus, sourceMode,
    forecast, risk, current, rainfall24, accumulations, hourlyChartData, activeAlert, lastUpdated, spatial, cities, history,
    forecastQuery, radarQuery, spatialQuery, smsConfigQuery, smsStatusQuery, smsSendMutation, cacheSeed,
    searchInput, setSearchInput, searchResults, runSearch, setSearchTerm,
    registration, registrationForm, setRegistrationForm, registerLocation, sendTestSms,
    autoRefresh, setAutoRefresh, liveLocation, setLiveLocation, notificationsEnabled, enableNotifications,
    refreshLive, setOffline, selectLocation, selectMapPoint, useMyLocation, startDemo, nextDemoStage, resetDemo, resetAll,
  };
}

export type RainVisionModel = ReturnType<typeof useRainVision>;
