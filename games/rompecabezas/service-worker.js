/**
 * service-worker.js v3.01
 * Encargado del cacheo de recursos para funcionamiento Offline (PWA).
 */

const CACHE_NAME = 'puzzle-v6.3'; // Versión actualizada para limpiar caché viejo

// 1. GENERACIÓN DINÁMICA DE RUTAS DE NIVELES
// Evita escribir manualmente 40 líneas de código para imágenes y thumbnails.
const LEVEL_ASSETS = [];
const TOTAL_LEVELS = 20;

for (let i = 1; i <= TOTAL_LEVELS; i++) {
    // Imagen en alta calidad (Juego)
    LEVEL_ASSETS.push(`./assets/Nivel${i}.webp`);
    
    // Miniatura (Menú)
    LEVEL_ASSETS.push(`./assets/thumbnails/Nivel${i}_thumb.webp`);
}

// 2. LISTA MAESTRA DE ARCHIVOS A CACHEAR (App Shell)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  
  // Estilos y Lógica
  './src/style.css',
  './src/main.js',
  './src/core/PuzzleEngine.js',
  './src/core/LevelManager.js',
  './src/systems/AudioSynth.js',
  './src/systems/Storage.js',
  './src/systems/Economy.js',
  './src/ui/UIController.js',
  './public/levels.json',

  // Iconos PWA
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  
  // Expandimos la lista de niveles generada arriba
  ...LEVEL_ASSETS
];

// --- EVENTO INSTALL: Cacheo inicial ---
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Iniciando caché de assets...');
        // addAll es "todo o nada". Si un solo archivo falla (404), la instalación falla.
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[Service Worker] Instalación completada.');
        return self.skipWaiting(); // Forzar activación inmediata sin esperar a cerrar pestañas
      })
      .catch((err) => {
        console.error('[Service Worker] Error crítico en instalación:', err);
      })
  );
});

// --- EVENTO ACTIVATE: Limpieza de versiones viejas ---
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Tomar control de los clientes inmediatamente
});

// --- EVENTO FETCH: Intercepción de red ---
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // ESTRATEGIA 1: Fuentes de Google (Cache First + Network Fallback)
  // Permite que las fuentes se guarden dinámicamente la primera vez que se cargan
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request).then((fResponse) => {
          // Si la descargamos de internet, guardamos una copia
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, fResponse.clone());
            return fResponse;
          });
        });
      })
    );
    return;
  }

  // ESTRATEGIA 2: Archivos Locales (Cache First)
  // Busca en caché primero. Si no está, va a la red.
  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) {
        return response; // Hit en caché
      }
      return fetch(e.request); // Fallback a red
    })
  );
});
