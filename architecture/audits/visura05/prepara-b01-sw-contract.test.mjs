
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {analyzeDocument,hasDocumentedBCQuantityOverride} from "../../../_prepara75_readonly/src/document-review.mjs";
import {assertPreparaFixedReadV1} from "../../../_prepara76_readonly/src/fixed-position-contract-v1.mjs";
import {classifyFixedPositions,filterFixedRows,fixedReportCsv} from "../../../_prepara76_readonly/src/fixed-position-report.mjs";
import {buildFixedXlsx} from "../../../_prepara76_readonly/src/fixed-position-xlsx.mjs";
import {buildFixedPrintHtml} from "../../../_prepara76_readonly/src/fixed-position-print.mjs";
const read=p=>readFileSync(p,"utf8");
const original=read("_prepara80_readonly/sw.js");
const admin76=read("_prepara76_readonly/src/admin-fixed-positions.mjs");
const admin80=read("_prepara80_readonly/src/admin-fixed-positions.mjs");
const wh="COR_01_COR",fer="COR_02_NAR";
function metadata(sw){
  const m=sw.match(/^const CACHE="([^"]+)";const ASSETS=(\[[^\n]+\]);/);
  assert.ok(m);return {name:m[1],assets:JSON.parse(m[2])};
}
function proposal(){
 return original.replace("kontrola-integral-visura-v074-fijas-ge-cierre",
    "kontrola-integral-visura-v075-fijas-contract-v1")
    .replace('"./src/admin-fixed-positions.mjs",',
     '"./src/admin-fixed-positions.mjs","./src/fixed-position-contract-v1.mjs",');
}
function simulatedWorker(source,{available=true,failAsset="",shared=new Map()}={}){
 const handlers={},norm=v=>String(v?.url??v).replace(/^https?:\/\/[^/]+\//,"").replace(/^\.\//,"");
 let online=available;
 const reply=()=>({ok:true,clone(){return reply();}});
 const caches={
  open:async name=>{
   if(!shared.has(name))shared.set(name,new Map());
   const storage=shared.get(name);
   return {put:async(k,v)=>{storage.set(norm(k),v);}};
  },
  keys:async()=>[...shared.keys()],
  delete:async k=>shared.delete(k),
  match:async k=>{
   for(const store of shared.values())if(store.has(norm(k)))return store.get(norm(k));
  }
 };
 const self={addEventListener:(event,handler)=>{handlers[event]=handler;},
   skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const fetch=async k=>{
   if(!online||norm(k)===failAsset)throw Error("Network failed "+norm(k));
   return reply();
 };
 vm.runInNewContext(source,{self,caches,fetch,location:{origin:"https://lab.invalid"},
   URL,Error,Promise,console},{timeout:2000});
 const send=async(event,args={})=>{
   let pending;handlers[event]({...args,waitUntil:p=>{pending=p;},
     respondWith:p=>{pending=p;}});return await pending;
 };
 return {install:()=>send("install"),activate:()=>send("activate"),
   request:path=>send("fetch",{request:{method:"GET",mode:"cors",
     url:"https://lab.invalid/"+norm(path)}}),
   setOnline:x=>{online=x;},shared};
}
test("Old B01 manifest lacks V1 despite four legacy report modules",()=>{
 const before=metadata(original),after=metadata(proposal());
 for(const name of ["admin-fixed-positions","fixed-position-report",
                    "fixed-position-print","fixed-position-xlsx"])
   assert.ok(before.assets.includes("./src/"+name+".mjs"));
 assert.ok(admin76.includes("assertPreparaFixedReadV1"));
 assert.ok(!admin80.includes("assertPreparaFixedReadV1"));
 assert.ok(!before.assets.includes("./src/fixed-position-contract-v1.mjs"));
 assert.ok(after.assets.includes("./src/fixed-position-contract-v1.mjs"));
 assert.notEqual(before.name,after.name);
});
test("Successful old SW install cannot load new contract offline",async()=>{
 const sw=simulatedWorker(original);await sw.install();await sw.activate();
 sw.setOnline(false);
 assert.ok(await sw.request("./src/admin-fixed-positions.mjs"));
 assert.equal(await sw.request("./src/fixed-position-contract-v1.mjs"),undefined);
});
test("Proposed atomic manifest installs and caches V1 for offline",async()=>{
 const sw=simulatedWorker(proposal());await sw.install();await sw.activate();
 sw.setOnline(false);
 assert.ok(await sw.request("./src/admin-fixed-positions.mjs"));
 assert.ok(await sw.request("./src/fixed-position-contract-v1.mjs"));
});
test("Missing V1 rejects install without triggering delete of previous cache",async()=>{
 const key=metadata(original).name,previous=new Map([[key,new Map([["index.html",{ok:true}]])]]);
 const sw=simulatedWorker(proposal(),{failAsset:"src/fixed-position-contract-v1.mjs",shared:previous});
 await assert.rejects(sw.install(),/Network failed/);
 assert.ok(previous.has(key));
 assert.ok(previous.get(key).has("index.html"));
});
test("Reconnection after offline miss permits runtime fetching new dependency",async()=>{
 const sw=simulatedWorker(original);await sw.install();await sw.activate();sw.setOnline(false);
 assert.equal(await sw.request("src/fixed-position-contract-v1.mjs"),undefined);
 sw.setOnline(true);
 assert.ok(await sw.request("src/fixed-position-contract-v1.mjs"));
 sw.setOnline(false);
 assert.ok(await sw.request("src/fixed-position-contract-v1.mjs"));
});
test("SW versions do not contain commands deleting local user preferences",()=>{
 for(const sw of [original,proposal()])assert.doesNotMatch(sw,/localStorage|indexedDB|deleteDatabase/);
});
const correction=(line,before,after,tipo="dato_pdf_bc")=>({
 line,field:"qty",tipo,before,after,by:"ADMIN",
 at:"2026-10-28T05:00:00Z",justificacion:"Verificado contra documento original y BC"});
const net=()=>({id:"LP26-96001",warehouse:wh,refs:2,declaredTotal:5,actualTotal:5,
 products:[{sku:"A",qty:4,pdfOriginal:{qty:2}},{sku:"B",qty:1,pdfOriginal:{qty:3}}],
 verified:true,warnings:[],corrections:[]});
test("Net-zero 2+3 to 4+1 requires events on both lines",()=>{
 const input=net();
 assert.ok(analyzeDocument(input).some(x=>x.code==="quantity_change_unaudited"));
 input.corrections=[correction(1,2,4)];
 assert.equal(hasDocumentedBCQuantityOverride(input),false);
 assert.ok(analyzeDocument(input).some(x=>x.code==="quantity_bc_evidence_missing"));
 input.corrections=[correction(1,2,4),correction(2,3,1)];
 assert.equal(hasDocumentedBCQuantityOverride(input),true);
 assert.ok(!analyzeDocument(input).some(x=>["quantity_change_unaudited",
   "quantity_bc_evidence_missing"].includes(x.code)));
});
function payload(warehouse=wh,n=2){
 const products=[],fixed=[],stock=[];
 for(let i=1;i<=n;i++){
  const code=String(i).padStart(8,"0");
  products.push({code,description:"Ficticio "+code,unit:"UD"});
  fixed.push({warehouse,product_code:code,location_code:"K02"});
  stock.push({warehouse,product_code:code,location_code:"K02",
   lot:"L0001",quantity:"-1.125",unit:"UD"});
 }
 return {warehouse,meta:{warehouse,authorized:true,truncated:false,
   contractVersion:"visura-prepara-fixed-read-v1",importId:"BATCH01",
   stockComplete:true,catalogComplete:true,positionsComplete:true,
   locationsComplete:true,absentStockIsZero:false,stale:false,
   sourceFile:"FICTICIO.xlsx",stockRows:n,stockExpectedRows:n,
   exportedAt:"2026-10-28T04:00:00.000Z",importedAt:"2026-10-28T04:15:00.000Z",
   publishedAt:"2026-10-28T04:30:00.000Z"},
  products,locations:[{warehouse,code:"K02",aisle:"K",zone:"Z"}],fixed,stock};
}
test("Strict V1 rejects foreign stock, missing flags, Number and duplicate lots",()=>{
 for(const edit of [p=>p.stock[0].warehouse=fer,p=>delete p.meta.truncated,
  p=>delete p.meta.stale,p=>p.meta.authorized="true",
  p=>p.stock[0].quantity=-1.125,
  p=>{p.stock.push({...p.stock[0]});p.meta.stockRows++;p.meta.stockExpectedRows++;}]){
  const p=payload();edit(p);
  assert.throws(()=>assertPreparaFixedReadV1(p,{warehouse:wh}));
 }
});
test("Identical location names in two warehouses stay separate",()=>{
 const a=payload(wh),b=payload(fer);
 assert.equal(assertPreparaFixedReadV1(a,{warehouse:wh}),a);
 assert.equal(assertPreparaFixedReadV1(b,{warehouse:fer}),b);
 assert.equal(classifyFixedPositions(a).warehouse,wh);
 assert.equal(classifyFixedPositions(b).warehouse,fer);
 assert.throws(()=>assertPreparaFixedReadV1(b,{warehouse:wh}));
});
test("1205 filtered rows reach two-sheet XLSX, CSV and multipage printable HTML",()=>{
 const p=payload(wh,1205);
 assertPreparaFixedReadV1(p,{warehouse:wh});
 const r=classifyFixedPositions(p),rows=filterFixedRows(r.rows,{category:"negativo",sort:"code"});
 assert.equal(rows.length,1205);
 const meta={warehouse:wh,sourceFile:p.meta.sourceFile,exportedAt:p.meta.exportedAt,
   importedAt:p.meta.importedAt,publishedAt:p.meta.publishedAt,
   generatedAt:"2026-10-28T06:00:00.000Z"};
 const csv=fixedReportCsv(rows,meta);
 assert.ok(csv.includes("00001205"));
 const xlsx=Buffer.from(buildFixedXlsx({report:r,rows,generatedAt:meta.generatedAt}));
 assert.equal(xlsx.readUInt32LE(0),0x04034b50);
 for(const name of ["xl/worksheets/sheet1.xml","xl/worksheets/sheet2.xml"])
  assert.ok(xlsx.toString("utf8").includes(name));
 const html=buildFixedPrintHtml({report:r,rows,pageSize:18,generatedAt:meta.generatedAt});
 assert.ok(html.includes("00001205"));
});
test.todo("Safari iPhone and actual installed PWA upgrade");
test.todo("Real Auth/RLS, revocation, authenticated stock and session");
