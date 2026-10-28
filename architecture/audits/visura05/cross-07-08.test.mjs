import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import {buildFixedStockReport,ESTADOS} from "../../../_inventa08_readonly/fixed-stock-08/report.mjs";
import {buildFixedStockXlsx} from "../../../_inventa08_readonly/fixed-stock-08/xlsx.mjs";
import {transitionFixedAssociation} from "../../../_inventa08_readonly/fixed-stock-08/associations.mjs";
const require=createRequire(import.meta.url);
const physicalView=require("../../../_inventa07_readonly/inventory-ui/location-view.js");
const physicalFlow=require("../../../_inventa07_readonly/inventory-core/workflow.cjs");
const rectifications=require("../../../_inventa07_readonly/inventory-core/rectifications.cjs");
const outbox=require("../../../_inventa07_readonly/inventory-core/outbox-compat.cjs");
const teams=require("../../../_inventa07_readonly/inventory-core/team-session.cjs");
const wh="COR_01_COR",fer="COR_02_NAR";
function theoretical(warehouse=wh) {return {
 meta:{warehouse,verifiedByServer:true,authorized:true,stockComplete:true,
  positionsComplete:true,catalogComplete:true,locationsComplete:true,
  truncated:false,stale:false,publishedBatchId:"BC-DEMO-01",
  snapshotId:"SNAP-DEMO-01",positionsVersion:"POS-DEMO-01",
  sourceFile:"ficcion.xlsx",exportedAt:"2026-10-27T08:00:00Z",
  importedAt:"2026-10-27T09:00:00Z",publishedAt:"2026-10-27T10:00:00Z",
  absentStockIsZero:false,expectedStockRows:2},
 products:[{code:"00001234",description:"Articulo ficticio",unit:"UD"}],
 locations:[{warehouse,code:"K02",aisle:"K"},{warehouse,code:"K10",aisle:"K"},{warehouse,code:"K99",aisle:"K"}],
 fixed:[{associationId:"FIX-A",warehouse,product_code:"00001234",location_code:"K02",active:true,revision:1},
        {associationId:"FIX-B",warehouse,product_code:"00001234",location_code:"K10",active:true,revision:1}],
 stock:[{warehouse,importId:"BC-DEMO-01",product_code:"00001234",location_code:"K99",lot:"L0007",quantity:"-20.125"},
        {warehouse,importId:"BC-DEMO-01",product_code:"00001234",location_code:"K02",lot:"L0008",quantity:"8"}]
};}
const physical=()=>({locationCode:"K02",locationStatus:"in_progress",
 references:[{productCode:"00001234",lot:"L0007",description:"Articulo fisico",
  status:"confirmed",quantity:"0",explicitZero:true}],provisionals:[]});
const admin=(s,filters={})=>buildFixedStockReport({...s,filters:{view:"all",...filters},
 generatedAt:"2026-10-28T01:00:00Z"});
test("Total BC por SKU incluye ubicacion no fija y NO se iguala a cero fisico",()=>{
 const r=admin(theoretical()),p=physicalView.buildLocationView(physical());
 assert.deepEqual(r.issues,[]);
 assert.equal(r.rows.length,2);
 assert.deepEqual(r.rows.map(x=>x.quantity),["-12.125","-12.125"]);
 assert.equal(r.indicators.negativeReferences,1);
 assert.equal(r.indicators.affectedAssociations,2);
 assert.ok(r.rows.every(x=>x.state===ESTADOS.NEGATIVO));
 assert.equal(p.confirmed[0].quantity,"0");
 assert.equal(p.summary.explicitZeros,1);
});
test("Proyeccion fisica elimina campos adicionales de BC y administracion",()=>{
 const input=physical();
 Object.assign(input,{stockCalculated:"-99999",publishedBatchId:"LEAK-BATCH"});
 Object.assign(input.references[0],{theoreticalStock:"-99999",bcQuantity:"SECRET-BC",
  fixedAssociations:["SECRET-FIX"],exportedAt:"SECRET-TIME"});
 const p=physicalView.buildLocationView(input),serialized=JSON.stringify(p);
 for(const marker of ["-99999","SECRET-BC","SECRET-FIX","SECRET-TIME","LEAK-BATCH","theoreticalStock","bcQuantity"])
  assert.equal(serialized.includes(marker),false,marker);
 assert.equal(p.requiresServerAuthorization,true);
 assert.equal(p.confirmed[0].lot,"L0007");
 assert.equal(p.confirmed[0].code,"00001234");
});
test("Referencia fisica sin contar permanece NULL pese a cantidad BC",()=>{
 const s=physical();s.references[0].status="uncounted";
 s.references[0].quantity=null;s.references[0].explicitZero=false;
 s.references[0].theoreticalStock="-12.125";
 const p=physicalView.buildLocationView(s);
 assert.equal(p.pending[0].quantity,null);
 assert.equal(p.physicallyReadyCandidate,false);
 assert.equal(admin(theoretical()).rows[0].quantity,"-12.125");
});
test("Publicacion de nuevo BC no cambia cierre fisico historico",()=>{
 const closed=rectifications.closeOriginal({campaignId:"CAMP-FISICA-1",closureId:"CLOSE-001",
  closedAt:"2026-10-28T00:00:00Z",closedBy:"ADMIN",physicalComplete:true,
  administrativeReviewed:true,rows:[{locationCode:"K02",productCode:"00001234",
   lot:"L0007",quantity:"0",confirmed:true}]});
 const before=JSON.stringify(closed),old=theoretical(),next=theoretical();
 next.meta.publishedBatchId="BC-DEMO-02";next.meta.snapshotId="SNAP-DEMO-02";
 next.stock.forEach(x=>x.importId=next.meta.publishedBatchId);
 next.stock[0].quantity="-30.125";
 assert.equal(admin(old).rows[0].quantity,"-12.125");
 assert.equal(admin(next).rows[0].quantity,"-22.125");
 assert.equal(JSON.stringify(closed),before);
 assert.equal(closed.rows[0].quantity,"0");
});
test("Retirada de fija no modifica cierre fisico ni asociacion original",()=>{
 const s=theoretical(),original=s.fixed[0];
 const closed=rectifications.closeOriginal({campaignId:"CAMP",closureId:"CLOSE-2",
  closedAt:"2026-10-28T00:00:00Z",closedBy:"ADMIN",
  physicalComplete:true,administrativeReviewed:true,
  rows:[{locationCode:"K02",productCode:"00001234",lot:"L0007",quantity:"2",confirmed:true}]});
 const previous=JSON.stringify(closed);
 const changed=transitionFixedAssociation({association:original,
  actor:{serverAuthorized:true,userId:"ADMIN",warehouseGrants:[wh]},
  action:"RETIRAR",reason:"REUBICACION",revision:2,at:"2026-10-28T01:00:00Z"});
 assert.equal(changed.association.active,false);
 assert.equal(original.active,true);
 assert.equal(JSON.stringify(closed),previous);
 s.fixed[0]=changed.association;
 assert.equal(admin(s).rows.length,1);
});
test("Finalizacion fisica es manual e independiente de stock teorico",()=>{
 const started=physicalFlow.advanceLocation(null,"zero-marked",{campaignStatus:"open"});
 const review=physicalFlow.reviewLocation({knownReferences:[
  {status:"confirmed",quantity:"0",explicitZero:true}]});
 assert.equal(review.ready,true);
 assert.equal(started.status,"in_progress");
 assert.equal(admin(theoretical()).rows[0].state,ESTADOS.NEGATIVO);
 const done=physicalFlow.advanceLocation(started,"finish",
  {campaignStatus:"open",ready:review.ready});
 assert.equal(done.status,"finished");
 assert.throws(()=>physicalFlow.advanceLocation(done,"quantity-entered",{campaignStatus:"closed"}));
});
test("Provisional confirmado fisicamente sigue pendiente para Administracion",()=>{
 const p=physicalView.buildLocationView({locationCode:"K02",locationStatus:"in_progress",
  references:[],provisionals:[{barcode:"TEMP-0001",status:"pending",
   physicalStatus:"confirmed",quantity:"1",explicitZero:false}]});
 assert.equal(p.confirmed.length,1);
 assert.equal(p.confirmed[0].administrativePending,true);
 assert.equal(p.summary.administrativePending,1);
 assert.equal(admin(theoretical()).rows.some(x=>x.code==="TEMP-0001"),false);
});
test("Fuente BC no fiable no sustituye recuento fisico",()=>{
 const s=theoretical();s.meta.stockComplete=false;s.meta.stale=true;
 assert.ok(admin(s,{view:"unreliable"}).rows.every(x=>x.state===ESTADOS.NO_FIABLE));
 assert.equal(physicalView.buildLocationView(physical()).confirmed[0].quantity,"0");
});
test("Un mismo K02 en almacenes distintos no mezcla filas teoricas",()=>{
 const cor=admin(theoretical(wh)),nar=admin(theoretical(fer));
 assert.equal(cor.warehouse,wh);assert.equal(nar.warehouse,fer);
 assert.ok(cor.rows.every(x=>x.warehouse===wh));
 assert.ok(nar.rows.every(x=>x.warehouse===fer));
 const foreign=theoretical();foreign.fixed.push({...foreign.fixed[0],
  associationId:"EXTRANJERA",warehouse:fer});
 const invalid=admin(foreign);
 assert.ok(invalid.rows.every(x=>x.warehouse===wh&&x.state===ESTADOS.NO_FIABLE));
});
test("Cola V1 intacta al publicar BC o retirar fija de modo puro",()=>{
 const queue=[{body:{actor_id:"OPERARIO",client_mutation_id:"MUT-1",
  campaign_id:"CAMP",location_code:"K02",product_code:"00001234",quantity:"0"}}];
 const old=JSON.stringify(queue);
 const inspection=outbox.auditLegacyQueue({userId:"OPERARIO",rows:queue});
 const s=theoretical();admin(s);
 transitionFixedAssociation({association:s.fixed[0],
  actor:{serverAuthorized:true,userId:"ADMIN",warehouseGrants:[wh]},
  action:"RETIRAR",reason:"CAMBIO_OPERATIVO",at:"2026-10-28T01:00:00Z",revision:2});
 assert.equal(inspection.action,"preserve-in-place");
 assert.equal(inspection.mayAutoDiscard,false);
 assert.equal(JSON.stringify(queue),old);
});
test("Revocacion 401/403 deja el outbox en HOLD",()=>{
 for(const status of [401,403]){
  const outcome=outbox.failurePolicy({status});
  assert.equal(outcome.action,"hold");
  assert.equal(outcome.retrySameMutationId,false);
 }
});
test("Sesion de pareja y miembros originales sobreviven al informe administrativo",()=>{
 const team=teams.startTeam({campaignId:"CAMP",locationCode:"K02",
  teamId:"TEAM-1",originalOperators:["A","B"],authenticatedUserId:"A",
  sessionId:"SESSION-A",authorizedOperators:["A","B"],
  at:"2026-10-28T01:00:00Z",eventId:"EV-1"});
 const old=JSON.stringify(team);admin(theoretical());
 assert.equal(JSON.stringify(team),old);
 assert.throws(()=>teams.switchMode(team,{mode:"individual",
  authenticatedUserId:"C",sessionId:"SESSION-C",
  authorizedOperators:["A","B","C"],expectedRevision:0,
  at:"2026-10-28T01:01:00Z",eventId:"EV-2"}));
});
test("XLSX admin contiene una sola hoja y conjunto filtrado",()=>{
 const result=admin(theoretical(),{location:"K10"});
 assert.equal(result.rows.length,1);
 const bytes=Buffer.from(buildFixedStockXlsx({report:result,
  generatedAt:"2026-10-28T01:00:00Z"}));
 assert.equal(bytes.readUInt32LE(0),0x04034b50);
 const data=bytes.toString("utf8");
 assert.ok(data.includes("xl/worksheets/sheet1.xml"));
 assert.ok(!data.includes("xl/worksheets/sheet2.xml"));
 assert.ok(data.includes("-12.125"));
});
test("No hay importacion directa de teoria en la proyeccion fisica",()=>{
 const physicalSource=readFileSync("_inventa07_readonly/inventory-ui/location-view.js","utf8");
 const adminSource=readFileSync("_inventa08_readonly/fixed-stock-08/report.mjs","utf8");
 assert.doesNotMatch(physicalSource,/stock_snapshot|stockCalculated|theoreticalStock|bc_import_lines|supabase\.co|fetch\(/i);
 assert.doesNotMatch(adminSource,/stock_snapshot|real-counts\.js|inventory-core\/counting/);
});
test.todo("Gateway Auth debe verificar modulo, almacen y sesion en servidor");
test.todo("RLS efectiva debe negar teoria a un operario revocado");
test.todo("Almacen de la campana fisica debe estar vinculado al contexto Auth");
test.todo("Migracion reversible debe preservar asociaciones e historico fisico");
test.todo("Excel BC autentico y fecha de exportacion requieren acreditacion");
test.todo("Safari y outbox offline V1/V2 reales requieren E2E autorizado");
