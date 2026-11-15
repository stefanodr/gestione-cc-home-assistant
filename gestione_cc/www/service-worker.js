/* Gestione C/C PWA shell.
   No financial data, API responses, HTML pages or documents are cached. */
self.addEventListener("install", event => {
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
