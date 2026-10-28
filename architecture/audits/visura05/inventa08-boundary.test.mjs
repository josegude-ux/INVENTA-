// VISURA 05 — independent PR #25 compatibility audit; all fixtures synthetic.
// The module under test is the ORIGINAL PR #25 at an exact checked-out SHA.
// Passing 'KNOWN GAP' reproductions are NOT acceptance or security passes.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {toPreparaFixedReadV1} from "../../lib/to-prepara-fixed-read-v1.mjs";
import {buildFixedStockReport,ESTADOS} from "../../../_inventa08_readonly/fixed-stock-08/report.mjs";

const wh="COR_01_COR", time="2026-10-28T00:00:00Z";
const scope={serverVerified:true,module:"prepara",role:"admin",warehouse:wh};
function central(){
 return {
  warehouse:wh,currentBatchId:"BATCH-C1",truncated:false,
  products:[{code:"001",description:"Artículo inventado",unit:"UD"}],
  locations:[{warehouse_code:wh,location_code:"K02",aisle:"K",zone:"F"}],
  fixed:[{warehouse_code:wh,product_code:"001",location_code:"K02"}],
  stockLines:[{warehouse_code:wh,product_code:"001",location_code:"K02",lot:"",stock_calculated:"-2",unit:"UD"}],
  batch:{id:"BATCH-C1",warehouse_code:wh,state:"published",source:"bc_excel_manual",
         expected_rows:1,validated_rows:1,file_name:"bc_sintetico.xlsx",
         published_at:"2026-10-27T23:00:00Z"},
  coverage:{stock:true,catalog:true,catalogScopeVerified:true,positions:true,
            positionsReconciled:true,locations:true,locationsScoped:true,zeroOmissionCertified:false},
  sourceCertification:{fileAndRowsAttested:true,parserApproved:true,zeroOmissionPolicyApproved:false},
  freshness:{maxAgeHours:24,forcedStale:false}
 };
}
function currentPreparaShape(){
 return toPreparaFixedReadV1({snapshot:central(),verifiedScope:scope,now:time});
}
// This shim is a SYNTHETIC contract thought experiment, not an authorized
// implementation or attestation. Values below are invented only in the fixture.
function hypotheticalInventa08Shape(){
 const src=currentPreparaShape();
 return {
  ...src,
  meta:{...src.meta,verifiedByServer:true,publishedBatchId:src.meta.importId,
    snapshotId:"SYNTHETIC-S1",positionsVersion:"SYNTHETIC-P1",
    publishedAt:src.meta.importedAt},
  fixed:src.fixed.map((f,i)=>({...f,active:true,associationId:"SYNTHETIC-A"+i})),
  stock:src.stock.map(x=>({...x,importId:src.meta.importId}))
 };
}
function report(s){return buildFixedStockReport({...s,filters:{view:"all"}});}
test("Adapter PREPARA #22 cannot be used directly as INVENTA 08 verified contract",()=>{
 const p=currentPreparaShape(),r=report(p);
 assert.equal(r.rows.length,0,"PR #22 shapes must not fabricate active association IDs");
 assert.ok(r.issues.some(x=>x.includes("certificación")));
 assert.ok(r.issues.some(x=>x.includes("Faltan ámbito")));
 assert.ok(r.issues.some(x=>x.includes("versión")));
 assert.ok(!("associationId" in p.fixed[0]));
 assert.ok(!("importId" in p.stock[0]));
 assert.ok(!("verifiedByServer" in p.meta));
});
test("After purely synthetic field mapping, negative stock can be classified",()=>{
 const r=report(hypotheticalInventa08Shape());
 assert.deepEqual(r.issues,[]);
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].state,ESTADOS.NEGATIVO);
 assert.equal(r.rows[0].quantity,"-2");
 assert.equal(r.rows[0].warehouse,wh);
});
function observedGap(label,mutate){
 test("AUDIT REPRODUCTION — KNOWN GAP (NOT ACCEPTED): "+label,()=>{
  const s=hypotheticalInventa08Shape();
  mutate(s);
  const r=report(s);
  assert.deepEqual(r.issues,[],"The audit must be refreshed if fail-closed validation gets fixed");
  assert.equal(r.rows[0].state,ESTADOS.NEGATIVO);
  assert.equal(r.rows[0].quantity,"-2");
 });
}
observedGap("missing meta.truncated currently accepted",s=>{delete s.meta.truncated;});
observedGap("missing meta.stale currently accepted",s=>{delete s.meta.stale;});
observedGap("string 'false' authorization currently accepted",s=>{s.meta.authorized="false";});
observedGap("string 'false' server certification currently accepted",s=>{s.meta.verifiedByServer="false";});
observedGap("stock location absent from authoritative locations currently accepted",
 s=>{s.stock[0].location_code="UNKNOWN";});
test("Positive explicit stale or truncated correctly invalidates the report",()=>{
 for(const k of ["stale","truncated"]){
  const s=hypotheticalInventa08Shape();s.meta[k]=true;
  const r=report(s);
  assert.equal(r.rows[0].state,ESTADOS.NO_FIABLE);
  assert.equal(r.rows[0].quantity,null);
 }
});
test("Wrong BC import pointer correctly invalidates the report",()=>{
 const s=hypotheticalInventa08Shape();s.stock[0].importId="B-OLD";
 const r=report(s);
 assert.equal(r.rows[0].state,ESTADOS.NO_FIABLE);
});
test("No BC row is not zero unless certified rule exists",()=>{
 const s=hypotheticalInventa08Shape();s.stock=[];
 const r=report(s);
 assert.equal(r.rows[0].state,ESTADOS.SIN_DATOS);
 s.meta.absentStockIsZero=true;
 const unsafe=report(s);
 assert.equal(unsafe.rows[0].state,ESTADOS.NO_FIABLE);
});
test("Legacy migration 006 sums by fixed location and COALESCE absent stock",()=>{
 const src=readFileSync("supabase/migrations/006_admin_fixed_positions_report.sql","utf8");
 assert.match(src,/coalesce\(bc\.qty,0::numeric\)/i);
 assert.match(src,/line\.location_code=f\.location_code/i);
 assert.match(src,/bc_import_current cur on cur\.singleton=true/i);
});
test("Legacy migration 008 contains destructive replace on fixed assignments",()=>{
 const src=readFileSync("supabase/migrations/008_fixed_positions_safe_merge_mode.sql","utf8");
 assert.match(src,/if p_replace then\s*delete from public\.fixed_positions/i);
});
test("Live manager still invokes legacy RPC and DELETE, independent of new preview",()=>{
 const src=readFileSync("warehouse-management.js","utf8");
 assert.match(src,/rpc\/admin_fixed_positions_report/);
 assert.match(src,/api\('fixed_positions',filter,'DELETE'\)/);
 assert.match(src,/stock_snapshot.*campaign_id/);
});
test("No physical counting modules are imported by the isolated PR #25 reporter",()=>{
 const src=readFileSync("_inventa08_readonly/fixed-stock-08/report.mjs","utf8");
 assert.doesNotMatch(src,/from ["'].*(?:inventory-core|real-counts|counting|stock_snapshot)/);
});
test.todo("GATE: missing truncated/stale metadata must be rejected by INVENTA 08");
test.todo("GATE: authorization and server verified metadata must be strict booleans");
test.todo("GATE: stock lines must reference certified scoped location catalog");
test.todo("GATE: server adapter must supply immutable active association IDs/revision and provenance");
test.todo("GATE: real Supabase Auth/RLS for INVENTA admin stock, never physical counter");
test.todo("GATE: migration 006/008 and consumers adapted with reversible history");
