/* RUSH — service worker : l'app se charge instantanément et marche hors ligne.
   Stratégie : réseau d'abord (les mises à jour arrivent toutes seules),
   cache en secours (hors ligne = ça marche quand même).
   scores.php n'est JAMAIS mis en cache (toujours en direct). */
const CACHE = "rush-v29";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(["./", "./index.html", "./manifest.webmanifest"]).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.pathname.endsWith("scores.php")) return; // classements : toujours en direct
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copie = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
