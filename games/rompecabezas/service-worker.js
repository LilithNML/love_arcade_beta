/**
 * service-worker.js — DISABLED
 * This file exists only to unregister itself and purge all previously
 * cached assets. It will never cache anything new.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// No fetch handler — all requests go straight to the network.
