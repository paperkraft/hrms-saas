const AVATAR_CACHE_NAME = "sigma-avatars-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("sigma-avatars-") && name !== AVATAR_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Ignore non-http(s) requests (e.g., chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Stale-While-Revalidate caching for user avatars
  if (url.pathname.startsWith('/api/avatar/')) {
    event.respondWith(
      caches.open(AVATAR_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse || Response.error());

          // Return cached avatar immediately (0ms) if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Basic pass-through with error handling for other requests
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.debug("Service worker fetch failed for:", event.request.url, error);
      // Safely return a network error response without throwing a console exception
      return Response.error();
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.content,
      icon: "/app-logo.png",
      badge: "/app-logo.png",
      data: {
        link: data.link || "/dashboard/notifications",
      },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    console.error("Error showing push notification:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.link || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
