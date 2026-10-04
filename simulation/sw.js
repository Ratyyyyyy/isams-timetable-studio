const CACHE_NAME = "pupil-timetable-v4-20261004";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=202610041335",
  "./app.js?v=202610041335",
  "./import-csv.js?v=202610032200",
  "./logo-data.js?v=202609200450",
  "./guide-data.js?v=202609201120",
  "./manifest.webmanifest",
  "./pwa-icon.svg",
  "./pwa-192.png",
  "./pwa-512.png",
  "./assets/guide/new-portal-1.png",
  "./assets/guide/new-portal-2.png",
  "./assets/guide/new-portal-3.png",
  "./assets/guide/new-portal-4.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(APP_SHELL.map(function (url) { return new Request(url, { cache: "reload" }); }));
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.startsWith("pupil-timetable-") && key !== CACHE_NAME;
    }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(function (response) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put("./", copy); });
      return response;
    }).catch(function () {
      return caches.match("./");
    }));
    return;
  }

  event.respondWith(caches.match(event.request).then(function (cached) {
    const network = fetch(event.request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return cached || network;
  }));
});
