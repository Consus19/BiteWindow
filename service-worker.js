const CACHE='bitewindow-shell-v08-1';
const SHELL=['./','./index.html','./privacy.html','./manifest.webmanifest','./community-config.js','./community.js','./forecast-model.js','./health-alerts.js','./app.js','./icon-192.png','./icon-512.png','./data/health.json','./data/us-counties.json'];
const ALLOWED=new Set(SHELL.map(p=>new URL(p,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bitewindow-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!ALLOWED.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
  try{const response=await fetch(request,{signal:controller.signal});if(response.ok)await cache.put(request,response.clone());return response}
  catch(error){const cached=await cache.match(request);if(cached)return cached;throw error}
  finally{clearTimeout(timer)}
 })());
});
