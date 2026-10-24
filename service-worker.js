const CACHE='inventa-demo-v0244-01';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon.png'];
const SCANNER_LIBRARY='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
 self.skipWaiting();
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!=='GET')return;
 const u=new URL(r.url),externalScanner=u.href===SCANNER_LIBRARY;
 if(u.origin!==self.location.origin&&!externalScanner)return;
 e.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(response=>{
  if(response.ok){
   const cloned=response.clone();
   caches.open(CACHE).then(c=>c.put(r,cloned)).catch(()=>{});
  }
  return response;
 })));
});