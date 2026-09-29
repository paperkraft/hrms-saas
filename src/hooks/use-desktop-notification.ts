import { useCallback, useEffect, useState } from "react";

export function useDesktopNotification() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!("Notification" in window)) return;
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        // Modern browsers (Promise-based)
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
      } catch (e) {
        // Fallback for older browsers (Callback-based)
        return new Promise<NotificationPermission>((resolve) => {
          Notification.requestPermission((result) => {
            setPermission(result);
            resolve(result);
          });
        });
      }
    }
    return "denied";
  }, []);

  const sendNotification = useCallback(
    async (title: string, options?: NotificationOptions & { onClick?: () => void }) => {
      // Haptic feedback trigger (vibrates immediately if app is active)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const defaultOptions = {
        icon: "/app-logo.png",
        badge: "/app-logo.png",
        vibrate: [200, 100, 200], // Native vibration pattern for standard notifications
        ...options,
      };

      try {
        // Try Service Worker first (preferred for PWAs and Chrome)
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && "showNotification" in registration) {
            await registration.showNotification(title, defaultOptions);
            return;
          }
        }

        // Fallback to traditional Notification API
        const notification = new Notification(title, defaultOptions);
        if (options?.onClick) {
          notification.onclick = (e) => {
            e.preventDefault();
            window.focus();
            options.onClick!();
            notification.close();
          };
        }
        return notification;
      } catch (error) {
        console.error("Failed to send notification:", error);
        
        // Final fallback: try traditional Notification if SW failed
        try {
          const notification = new Notification(title, defaultOptions);
          return notification;
        } catch (innerError) {
          console.error("All notification methods failed:", innerError);
        }
      }
    },
    []
  );

  return { permission, requestPermission, sendNotification };
}
