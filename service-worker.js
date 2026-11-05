/* INVENTA: versioned offline shell with network-first navigation. */
const CACHE='inventa-demo-v0307-01';
const FILES=['./','./index.html','./warehouse-management.js?v=0.30.5','./bc-excel-import.js?v=0.30.5','./fixed-positions-import.js?v=0.30.5','./real-counts.js?v=0.30.6','./consultation-core.js?v=0.30.5','./consultation-ui.js?v=0.30.5','./manifest.webmanifest','./assets/menu/settings-3d.webp','./assets/brand/inventa-warehouse.webp','./assets/brand/inventa-logo.svg','./assets/brand/app-icon-192.png','./assets/brand/app-icon-512.png','./assets/menu/inventory-3d.webp','./assets/menu/consult-3d.webp','./assets/menu/management-3d.webp',
  /* Maquetación A / 3 imágenes aprobadas: cacheadas SOLO en laboratorio R1/L3. */
  './assets/css/visura-operativo-3d-lab.css',
  './assets/css/visura-maquetacion-a-v1-lab.css',
  './assets/css/visura-maquetacion-a-aprobadas-r1l2.css',
  './assets/maquetacion-a/inventory-photo-approved-crop.webp',
  './assets/maquetacion-a/consultation-photo-approved-crop.webp',
  './assets/maquetacion-a/management-photo-approved-crop.webp',
  './assets/maquetacion-a/aprobadas-r1l2/hacer-inventario-banner.webp',
  './assets/maquetacion-a/aprobadas-r1l2/hacer-inventario-movil-foto.webp',
  './assets/maquetacion-a/aprobadas-r1l2/realizar-consulta-banner.webp',
  './assets/maquetacion-a/aprobadas-r1l2/realizar-consulta-movil-foto.webp',
  './assets/maquetacion-a/aprobadas-r1l2/gestion-almacen-banner.webp',
  './assets/maquetacion-a/aprobadas-r1l2/gestion-almacen-movil-foto.webp'];
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
