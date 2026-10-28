
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";
const oldSW=readFileSync("_prepara80_readonly/sw.js","utf8");
const newSW=oldSW.replace("kontrola-integral-visura-v074-fijas-ge-cierre",
  "kontrola-integral-visura-v075-fijas-contract-v1")
  .replace('"./src/admin-fixed-positions.mjs",',
  '"./src/admin-fixed-positions.mjs","./src/fixed-position-contract-v1.mjs",');
const modules=new Map();
for(const name of ["admin-fixed-positions","fixed-position-report","fixed-position-contract-v1",
 "fixed-position-print","fixed-position-xlsx"]){
 modules.set("src/"+name+".mjs",readFileSync("_prepara76_readonly/src/"+name+".mjs","utf8"));
}
let upgrade=false;
const html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>VISURA 05 PWA fixture</main></body></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1"),parts=url.pathname.split("/").filter(Boolean);
 const scope=parts[0],path=parts.slice(1).join("/");
 if(!["bad","good","upgrade"].includes(scope)){res.writeHead(404);res.end();return;}
 let data,type="text/plain";
 if(path==="sw.js"){data=scope==="good"||(scope==="upgrade"&&upgrade)?newSW:oldSW;type="text/javascript";}
 else if(path===""||path==="index.html"){data=html;type="text/html";}
 else if(modules.has(path)){data=modules.get(path);type="text/javascript";}
 else if(path.endsWith(".mjs")||path.endsWith(".js")){data="export {};";type="text/javascript";}
 else if(path.endsWith(".css")){data="body{margin:0}";type="text/css";}
 else data="fixture";
 res.writeHead(200,{"content-type":type,"cache-control":"no-store"});res.end(data);
});
const listen=()=>new Promise(ok=>server.listen(0,"127.0.0.1",()=>ok(server.address().port)));
const close=()=>new Promise(ok=>server.close(ok));
const register=page=>page.evaluate(async()=>{
 await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
 await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller) await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error("No SW controller")),10000);
  navigator.serviceWorker.addEventListener("controllerchange",()=>{clearTimeout(timeout);resolve();},{once:true});
 });
});
const attempt=page=>page.evaluate(async()=>{
 try{await import("./src/admin-fixed-positions.mjs");return "ok";}
 catch(e){return "missing:"+String(e.message);}
});
test("Chromium install/offline and old-to-new SW update in disposable origin",{timeout:180000},async()=>{
 const port=await listen();
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [scope,expected] of [["bad","missing:"],["good","ok"]]){
   const context=await browser.newContext({serviceWorkers:"allow"});
   try{
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:"+port+"/"+scope+"/");
    await page.evaluate(()=>localStorage.setItem("visura-audit-pref","conservar"));
    await register(page);
    await context.setOffline(true);
    const result=await attempt(page);
    assert.ok(result.startsWith(expected),scope+": "+result);
    assert.equal(await page.evaluate(()=>localStorage.getItem("visura-audit-pref")),"conservar");
   }finally{await context.close();}
  }
  const context=await browser.newContext({serviceWorkers:"allow"});
  try{
   const page=await context.newPage();
   await page.goto("http://127.0.0.1:"+port+"/upgrade/");
   await page.evaluate(()=>localStorage.setItem("visura-audit-pref","guardada"));
   await register(page);
   const before=await page.evaluate(()=>caches.keys());
   assert.ok(before.includes("kontrola-integral-visura-v074-fijas-ge-cierre"));
   upgrade=true;
   await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
   await page.waitForFunction(async()=>{
     const names=await caches.keys();
     return names.includes("kontrola-integral-visura-v075-fijas-contract-v1")
       && !names.includes("kontrola-integral-visura-v074-fijas-ge-cierre");
   },{timeout:20000});
   await context.setOffline(true);
   assert.equal(await attempt(page),"ok");
   assert.equal(await page.evaluate(()=>localStorage.getItem("visura-audit-pref")),"guardada");
  }finally{await context.close();}
 }finally{await browser.close();await close();}
});
