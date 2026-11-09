// Shows a notification from the server, and opens the site when it is pressed (REQ-11).
self.addEventListener("push", (event) => {
  const { title, body } = event.data ? event.data.json() : { title: "נוכחות", body: "" };
  event.waitUntil(self.registration.showNotification(title, { body, lang: "he", dir: "rtl" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
