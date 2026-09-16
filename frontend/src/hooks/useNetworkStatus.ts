import { useEffect, useRef, useState } from "react";

export function useNetworkStatus({
  onOnline,
  onOffline,
}: {
  onOnline?: () => void;
  onOffline?: () => void;
} = {}) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const handlers = useRef({ onOnline, onOffline });
  const offlineTimer = useRef<number | null>(null);

  useEffect(() => {
    handlers.current = { onOnline, onOffline };
  }, [onOnline, onOffline]);

  useEffect(() => {
    const goOnline = () => {
      if (offlineTimer.current !== null) {
        window.clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
      }

      setOnline(true);
      handlers.current.onOnline?.();
    };

    const goOffline = () => {
      if (offlineTimer.current !== null) return;

      offlineTimer.current = window.setTimeout(() => {
        offlineTimer.current = null;
        setOnline(false);
        handlers.current.onOffline?.();
      }, 3000);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);

      if (offlineTimer.current !== null) {
        window.clearTimeout(offlineTimer.current);
      }
    };
  }, []);

  return online;
}
