/* Kinetic Studio Service Worker — offline & PWA capability (Zero-Server) */
const CACHE_NAME = 'kinetic-studio-v1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './studio.css',
  './studio.js',
  './studio-smart.js',
  './studio-gestures.js',
  './engine.js',
  './presets.motion.js',
  './presets/packs.js',
  './content.sample.js',
  './content.hindi.js',
  './geo.js',
  './media.js',
  './charts.js',
  './director.js',
  './voice.js',
  './assets/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Pre-cache local assets; ignore errors for optional ones
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          fetch(url, { cache: 'no-cache' }).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Only intercept GET requests
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // If local file, serve cache-first or network-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
