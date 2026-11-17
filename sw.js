// Last Plate offline helper. VERSION changes with every build so updates arrive on their own.
const VERSION = 'lp-036d1aeb3900';
const CORE = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lp-') && k !== VERSION && k !== 'lp-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function withTimeout(p, ms){ return Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]); }
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const scopePath = new URL(self.registration.scope).pathname;
    const key = url.pathname === scopePath || url.pathname === scopePath + 'index.html' ? 'index.html' : url.pathname === scopePath + 'app.js' ? 'app.js' : '';
    if (key) {   // the game itself: network first so updates land; saved copy when offline
      e.respondWith(withTimeout(fetch(req, {cache:'no-store'}), 5000)
        .then(res => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key)));
      return;
    }
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('lp-fonts').then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
  }
});
