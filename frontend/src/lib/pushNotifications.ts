export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported.");
    return null;
  }

  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      console.error("VITE_VAPID_PUBLIC_KEY is missing.");
      return null;
    }

    const registration = await registerPushServiceWorker();

    if (!registration) {
      return null;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("Notification permission was not granted.");
      return null;
    }

    const existingSubscription =
      await registration.pushManager.getSubscription();

    if (existingSubscription) {
      return existingSubscription;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
     applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });

    console.log("RAIN VISION push subscription created.");

    return subscription;
  } catch (error) {
    console.error("Push subscription failed:", error);
    return null;
  }
}
export async function savePushSubscription(
  subscription: PushSubscription
): Promise<boolean> {
  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      console.error("Failed to save push subscription:", await response.text());
      return false;
    }

    console.log("RAIN VISION push subscription saved.");
    return true;
  } catch (error) {
    console.error("Push subscription save failed:", error);
    return false;
  }
}