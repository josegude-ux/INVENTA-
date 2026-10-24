/* INVENTA: versioned offline shell with network-first navigation. */
const CACHE='inventa-demo-v0270-01';
const FILES=['./','./index.html','./warehouse-management.js','./consultation-core.js','./consultation-ui.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon.png'];
const SCANNER_LIBRARY='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
const INDEX_URL=new URL('./index.html',self.registration.scope).href;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('inventa-demo-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 const local=url.origin===self.location.origin;
 const scanner=url.href===SCANNER_LIBRARY;
 if(!local&&!scanner)return;
 const navigation=local&&(request.mode==='navigate'||url.pathname.endsWith('/index.html'));
 if(navigation){
  event.respondWith((async()=>{
   try{
    // The live file wins whenever the device is online, even if an old app shell exists.
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)throw new Error('Server status '+response.status);
    const cache=await caches.open(CACHE);
    event.waitUntil(cache.put(INDEX_URL,response.clone()).catch(()=>{}));
    return response;
   }catch(error){
    // Offline counting still works with the last downloaded application shell.
    const old=await caches.match(request)||await caches.match(INDEX_URL,{ignoreSearch:true});
    return old||Response.error();
   }
  })());
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
  if(response.ok){
   const clone=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)).catch(()=>{}));
  }
  return response;
 })));
});