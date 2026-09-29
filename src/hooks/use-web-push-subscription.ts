import { useCallback, useState } from "react";
import { subscribeToPush } from "@/actions/push-subscription";

export function useWebPushSubscription() {
  const [isSubscribing, setIsSubscribing] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.error("Web Push not supported");
      return { success: false, error: "Web Push not supported" };
    }

    try {
      setIsSubscribing(true);
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await subscribeToPush(existingSub.toJSON(), navigator.userAgent);
        return { success: true };
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "")
      });

      const res = await subscribeToPush(subscription.toJSON(), navigator.userAgent);
      return res;
    } catch (error) {
      console.error("Failed to subscribe to web push:", error);
      return { success: false, error: String(error) };
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  return { subscribe, isSubscribing };
}
