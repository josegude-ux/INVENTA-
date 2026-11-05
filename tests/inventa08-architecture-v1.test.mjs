import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {toInventa08FixedStockV1,INVENTA08_READ_CONTRACT} from "../_visura04_readonly/architecture/lib/to-inventa08-fixed-stock-v1.mjs";
import {buildFixedStockReport,ESTADOS} from "../fixed-stock-08/report.mjs";
import {buildFixedStockXlsx} from "../fixed-stock-08/xlsx.mjs";

// Contract consumer against PINNED unmodified PR #22, not a fabricated adapter.
const wh="COR_01_COR",now="2026-10-28T05:30:00Z";
const context=()=>({serverVerified:true,sessionValid:true,active:true,module:"inventa",role:"admin",warehouse:wh});
function fixture(){
 return {
  warehouse:wh,currentBatchId:"B-CERT",snapshotId:"RR-READ-001",positionsVersion:"FIXED-V10",
  truncated:false,
  products:[{code:"0000123",description:"Artículo negativo",unit:"UD"},
   {code:"0000456",description:"Artículo cero",unit:"UD"}],
  locations:[
   {warehouse_code:wh,location_code:"A-01",aisle:"A",zone:"1"},
   {warehouse_code:wh,location_code:"B-01",aisle:"B",zone:"1"},
   {warehouse_code:wh,location_code:"SUELO 3",aisle:"S",zone:"2"}],
  fixed:[
   {warehouse_code:wh,associationId:"assoc-01",product_code:"0000123",
    location_code:"A-01",active:true,revision:2},
   {warehouse_code:wh,associationId:"assoc-02",product_code:"0000123",
    location_code:"B-01",active:true,revision:3},
   {warehouse_code:wh,associationId:"assoc-03",product_code:"0000456",
    location_code:"B-01",active:true,revision:2},
   {warehouse_code:wh,associationId:"assoc-04",product_code:"0000456",
    location_code:"A-01",active:false,revision:3}],
  stockLines:[
   {warehouse_code:wh,product_code:"0000123",location_code:"A-01",lot:"X1",unit:"UD",stock_calculated:"-20.125"},
   {warehouse_code:wh,product_code:"0000123",location_code:"SUELO 3",lot:"X2",unit:"UD",stock_calculated:"8"},
   {warehouse_code:wh,product_code:"0000456",location_code:"B-01",lot:"Y1",unit:"UD",stock_calculated:"4"},
   {warehouse_code:wh,product_code:"0000456",location_code:"SUELO 3",lot:"Y2",unit:"UD",stock_calculated:"-4"}],
  batch:{id:"B-CERT",warehouse_code:wh,state:"published",source:"bc_excel_manual",
   expected_rows:4,validated_rows:4,file_name:"EXCEL_FICTICIO.xlsx",
   exported_at:"2026-10-28T04:00:00Z",imported_at:"2026-10-28T04:15:00Z",
   published_at:"2026-10-28T04:30:00Z"},
  coverage:{stock:true,catalog:true,catalogScopeVerified:true,locations:true,
   locationsScoped:true,positions:true,positionsReconciled:true},
  sourceCertification:{fileAndRowsAttested:true,parserApproved:true,
   exportDateAttested:true,importDateAttested:true},
  freshness:{maxAgeHours:24,forcedStale:false}
 };
}
const adapted=(s=fixture(),c=context())=>toInventa08FixedStockV1({snapshot:s,serverContext:c,now});
const report=(s=fixture(),c=context(),filters={})=>buildFixedStockReport({...adapted(s,c),filters});
test("PR22 pinned and genuine INVENTA08 envelope accepted without bridge",()=>{
 const a=adapted(),r=report();
 assert.equal(a.meta.contractVersion,INVENTA08_READ_CONTRACT);
 assert.equal(a.meta.verifiedByServer,true);
 assert.equal(a.meta.truncated,false);
 assert.equal(a.meta.stale,false);
 assert.equal(a.meta.snapshotId,"RR-READ-001");
 assert.equal(a.meta.positionsVersion,"FIXED-V10");
 assert.equal(a.meta.publishedBatchId,"B-CERT");
 assert.deepEqual([a.meta.exportedAt,a.meta.importedAt,a.meta.publishedAt],
 ["2026-10-28T04:00:00.000Z","2026-10-28T04:15:00.000Z","2026-10-28T04:30:00.000Z"]);
 assert.deepEqual(r.issues,[]);
 assert.equal(r.indicators.negativeReferences,1);
 assert.equal(r.indicators.zeroReferences,1);
 assert.equal(r.indicators.affectedAssociations,3);
 assert.equal(r.indicators.affectedPositions,2);
 assert.equal(r.rows.find(v=>v.code==="0000123").quantity,"-12.125");
 assert.equal(r.rows.filter(v=>v.code==="0000123").length,2);
 assert.equal(r.rows.find(v=>v.code==="0000456").quantity,"0");
 assert.equal(r.rows.some(v=>v.associationId==="assoc-04"),false);
 assert.equal(r.rows.some(v=>v.location==="SUELO 3"),false);
});
test("PR22 admin is role- and session-gated before stock reaches renderer",()=>{
 for(const change of [{role:"operator"},{sessionValid:false},{active:false},
  {warehouse:"COR_02_NAR"},{module:"prepara"},{serverVerified:"true"}]){
  assert.throws(()=>adapted(fixture(),{...context(),...change}),/authorization/);
 }
});
test("PR22 unknown non-fixed BC location is rejected before report",()=>{
 const x=fixture();x.stockLines[1].location_code="UNKNOWN";
 assert.throws(()=>adapted(x),/unresolved BC/);
});
test("PR22 incompleteness/staleness has no accredited zero or negative",()=>{
 const x=fixture();x.coverage.stock=false;
 const r=report(x,context(),{view:"all"});
 assert.ok(r.rows.every(row=>row.state===ESTADOS.NO_FIABLE&&row.quantity===null));
 const y=fixture();delete y.batch.exported_at;
 const stale=report(y,context(),{view:"all"});
 assert.ok(stale.rows.every(row=>row.state===ESTADOS.NO_FIABLE));
});
test("PR22 exact high-precision decimal survives total and single-sheet XLSX",()=>{
 const x=fixture();
 x.stockLines[0].stock_calculated="99999999999.123456";
 x.stockLines[1].stock_calculated="0";
 const r=report(x,context(),{view:"all"});
 assert.equal(r.rows.find(row=>row.code==="0000123").quantity,"99999999999.123456");
 const zip=Buffer.from(buildFixedStockXlsx({report:r}));
 assert.ok(zip.includes(Buffer.from("99999999999.123456")));
 assert.ok(zip.includes(Buffer.from("xl/worksheets/sheet1.xml")));
 assert.ok(!zip.includes(Buffer.from("xl/worksheets/sheet2.xml")));
 assert.ok(!zip.includes(Buffer.from("<f>")));
});
test("PR22 inactive association and no certified zero omission cannot infer stock",()=>{
 const x=fixture();x.fixed[0].active=false;
 const r=report(x);
 assert.equal(r.rows.filter(v=>v.code==="0000123").length,1);
 const y=fixture();y.stockLines=y.stockLines.filter(v=>v.product_code!=="0000456");
 y.batch.expected_rows=y.stockLines.length;y.batch.validated_rows=y.stockLines.length;
 const missing=report(y,context(),{view:"unreliable"});
 assert.equal(missing.rows.find(v=>v.code==="0000456").state,ESTADOS.SIN_DATOS);
});
test("PR22 rejects ambiguous association identity instead of fabricating ID",()=>{
 const x=fixture();delete x.fixed[0].associationId;
 assert.throws(()=>adapted(x),/Unversioned/);
 const y=fixture();y.fixed[1].associationId=y.fixed[0].associationId;
 assert.throws(()=>adapted(y),/Duplicate associationId/);
});
