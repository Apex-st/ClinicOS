/* ClinicOS: только уведомления. Кэш страниц не трогаем. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/schedule";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "denta-open", url: target });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
