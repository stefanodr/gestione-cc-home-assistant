/* Gestione C/C: service worker minimale. Non memorizza mai HTML, API o dati finanziari. */
const SW_VERSION = "gestione-cc-shell-v1";
self.addEventListener("install", event => {
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("gestione-cc-") && key !== SW_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Le risposte dell'API, le pagine HTML e gli allegati restano sempre fuori dalla cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/attachments/") || request.mode === "navigate") return;
  // Nessuna cache locale: il server rimane sempre la fonte aggiornata.
});
