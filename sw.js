const CACHE='mis-decimos-v1-5';
const ASSETS=['./','./index.html','./app.js','./manifest.json','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mis-decimos-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 const isAppAsset=url.origin===self.location.origin && (url.pathname.endsWith('/')||/\.(html|js|json|svg)$/.test(url.pathname));
 if(isAppAsset){
  event.respondWith(fetch(event.request).then(response=>{
   if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
   return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
 } else {
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
 }
});