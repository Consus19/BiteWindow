const CACHE = 'bitewindow-shell-v03';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url=new URL(req.url);
  if(url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(req).then(response => { if(response.ok) {const c=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',c));}return response;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached || fetch(req)));
});
