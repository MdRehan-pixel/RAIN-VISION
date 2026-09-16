import { useEffect, useRef, useState } from "react";

/**
 * Tracks real browser connectivity via navigator.onLine and the window online/offline events.
 * Callbacks are read through a ref so listeners are registered exactly once.
 */
export function useNetworkStatus({ onOnline, onOffline }: { onOnline?: () => void; onOffline?: () => void } = {}) {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const handlers = useRef({ onOnline, onOffline });
  useEffect(() => { handlers.current = { onOnline, onOffline }; }, [onOnline, onOffline]);
  useEffect(() => {
    const goOnline = () => { setOnline(true); handlers.current.onOnline?.(); };
    const goOffline = () => { setOnline(false); handlers.current.onOffline?.(); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  return online;
}
