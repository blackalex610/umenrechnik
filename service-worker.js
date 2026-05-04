// Disable caching on localhost to prevent live-reload conflicts
if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => {
    self.clients.matchAll({ type: 'all' }).then(clients => clients.forEach(c => c.postMessage({ type: 'SW_BYPASS' })));
    return self.clients.claim();
  });
  // pass-through fetch — no caching
  self.addEventListener('fetch', event => event.respondWith(fetch(event.request)));
} else {

// ── Production: redirect legacy Python backend calls to Supabase edge function ──
const SUPABASE_URL = 'https://rylhgdjmjcaqcuyxybtd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Zx1KSexoo_ME7zNO0hSw3A_ALX_YEl6';
const LEGACY_API = 'http://127.0.0.1:8001';

// Map old Python endpoints → edge function { type } values
const ENDPOINT_TYPE_MAP = {
  'chat': 'chat',
  'generate-wrong-answers': 'generate-wrong-answers',
  'generate-reading-comprehension': 'generate-reading-comprehension',
  'generate-open-clause': 'generate-open-clause',
  'generate-gap-fill': 'generate-gap-fill',
  'generate-gap-fill-verb-form': 'generate-gap-fill-verb-form',
  'structure-words': 'structure-words',
};

async function proxyToEdgeFunction(event) {
  const url = event.request.url;
  const endpoint = url.replace(LEGACY_API, '').replace(/^\//, '').split('?')[0];
  const type = ENDPOINT_TYPE_MAP[endpoint] || endpoint;

  // Read body once
  const bodyText = await event.request.text();
  let payload;
  try { payload = JSON.parse(bodyText); } catch { payload = { raw_text: bodyText }; }

  // Forward auth header if present (set by bridge.js via supabase client)
  const authHeader = event.request.headers.get('Authorization');

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
  if (authHeader) headers['Authorization'] = authHeader;

  return fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type, payload }),
  });
}

const CACHE_NAME = 'umen-rechnik-v5';
const urlsToCache = [
  '/app.html',
  '/index.html',
  '/script.js',
  '/style.css',
  '/translations.js',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Intercept legacy Python API calls and proxy to edge function
  if (event.request.url.startsWith(LEGACY_API)) {
    event.respondWith(proxyToEdgeFunction(event));
    return;
  }

  // Always prefer fresh auth/bridge modules to avoid stale OAuth behavior.
  if (event.request.url.includes('/supabase/frontend/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation requests can involve redirects; fetch by URL to ensure redirects are followed.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request.url)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Only cache GET requests; POST/PUT/etc. should pass through.
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

} // end non-localhost block
