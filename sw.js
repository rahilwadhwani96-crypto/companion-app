/**
 * Service Worker
 * Handles offline support, caching, and PWA functionality
 */

const CACHE_NAME = 'companion-v1';
const RUNTIME_CACHE = 'companion-runtime-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/styles/reset.css',
  '/styles/variables.css',
  '/styles/safe-area.css',
  '/styles/typography.css',
  '/styles/layout.css',
  '/styles/animations.css',
  '/styles/components.css',
  '/styles/responsive.css',
  '/styles/his-theme.css',
  '/styles/her-theme.css'
];

// ============================================================================
// INSTALL EVENT - Cache assets
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Caching assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('⚠️ Some assets failed to cache:', err);
        // Continue even if some assets fail
        return Promise.resolve();
      });
    })
  );

  self.skipWaiting();
});

// ============================================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// ============================================================================
// FETCH EVENT - Network strategy
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy for API calls (Apps Script)
  if (url.pathname.includes('/macros/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy for HTML, CSS, JS
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: Cache first for images and other assets
  event.respondWith(cacheFirst(request));
});

// ============================================================================
// CACHE STRATEGIES
// ============================================================================

/**
 * Cache First Strategy
 * Return from cache if available, fallback to network
 */
function cacheFirst(request) {
  return caches.match(request).then((response) => {
    if (response) {
      return response;
    }

    return fetch(request).then((response) => {
      // Don't cache non-successful responses
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // Clone the response
      const responseToCache = response.clone();

      caches.open(RUNTIME_CACHE).then((cache) => {
        cache.put(request, responseToCache);
      });

      return response;
    }).catch(() => {
      // Return offline page or cached version
      return caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match('/index.html');
      });
    });
  });
}

/**
 * Network First Strategy
 * Try network first, fallback to cache
 */
function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      // Check if valid response
      if (!response || response.status !== 200) {
        return response;
      }

      // Clone and cache successful responses
      const responseToCache = response.clone();

      caches.open(RUNTIME_CACHE).then((cache) => {
        cache.put(request, responseToCache);
      });

      return response;
    })
    .catch(() => {
      // Fallback to cache
      return caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        // Return offline response
        return new Response(
          JSON.stringify({
            error: 'You are offline',
            message: 'This action requires an internet connection'
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          }
        );
      });
    });
}

// ============================================================================
// MESSAGE HANDLING (Optional - for future communication)
// ============================================================================

self.addEventListener('message', (event) => {
  console.log('📨 SW received message:', event.data);

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    caches.delete(RUNTIME_CACHE);
    event.ports[0].postMessage({ success: true });
  }
});

// ============================================================================
// BACKGROUND SYNC (Future: sync tasks when back online)
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync event:', event.tag);

  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // Future implementation: sync pending changes with backend
  console.log('📤 Syncing tasks...');
  return Promise.resolve();
}

// ============================================================================
// PUSH NOTIFICATIONS (Future)
// ============================================================================

self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received:', event);

  if (!event.data) {
    return;
  }

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || 'Companion', {
      body: data.body || 'You have a new notification',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234a5fa5" width="192" height="192"/><text x="50%" y="50%" font-size="110" text-anchor="middle" dominant-baseline="central" fill="white">💕</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><circle cx="96" cy="96" r="96" fill="%234a5fa5"/><text x="50%" y="50%" font-size="110" text-anchor="middle" dominant-baseline="central" fill="white">💕</text></svg>',
      tag: data.tag || 'companion-notification',
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app window exists, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow('/companion-app/');
      }
    })
  );
});
