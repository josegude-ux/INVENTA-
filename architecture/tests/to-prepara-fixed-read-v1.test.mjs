import test from "node:test";
import assert from "node:assert/strict";
import {toPreparaFixedReadV1,FIXED_CONTRACT_VERSION} from "../lib/to-prepara-fixed-read-v1.mjs";
const now="2026-10-27T18:00:00Z";
const scope=(warehouse="COR_01_COR")=>({
 serverVerified:true,module:"prepara",role:"admin",warehouse
});
const snap=(warehouse="COR_01_COR")=>({
 warehouse,truncated:false,currentBatchId:"a",
 products:[{code:"0000123",description:"Producto",unit:"UD"}],
 locations:[{warehouse_code:warehouse,location_code:"SUELO 3",aisle:"S",zone:"Z"}],
 fixed:[{warehouse_code:warehouse,product_code:"0000123",location_code:"SUELO 3"}],
 stockLines:[{warehouse_code:warehouse,product_code:"0000123",location_code:"SUELO 3",
   lot:"L1",stock_calculated:"-2,5000",unit:"UD",expiry_date:"2027-08-01"}],
 batch:{id:"a",warehouse_code:warehouse,state:"published",source:"bc_excel_manual",
   expected_rows:1,validated_rows:1,total_import_rows:7,file_name:"BC.xlsx",
   exported_at:"2026-10-27T08:00:00Z",imported_at:"2026-10-27T09:00:00Z",
   published_at:"2026-10-27T10:00:00Z"},
 coverage:{stock:true,catalog:true,catalogScopeVerified:true,
  positions:true,positionsReconciled:true,locations:true,locationsScoped:true,
  zeroOmissionCertified:false},
 sourceCertification:{fileAndRowsAttested:true,parserApproved:true,
  exportDateAttested:true,importDateAttested:true,
  zeroOmissionPolicyApproved:false},
 freshness:{forcedStale:false,maxAgeHours:24}
});
const adapt=(snapshot,verifiedScope=scope(snapshot.warehouse),date=now)=>
 toPreparaFixedReadV1({snapshot,verifiedScope,now:date});
test("PR76 exact collections and central warehouse keys, negative decimal, provenance",()=>{
 const x=adapt(snap());
 assert.equal(x.warehouse,"COR_01_COR");
 assert.deepEqual(Object.keys(x).sort(),["fixed","locations","meta","products","stock","warehouse"]);
 assert.equal(x.meta.contractVersion,FIXED_CONTRACT_VERSION);
 assert.equal(x.meta.stockComplete,true);assert.equal(x.meta.catalogComplete,true);
 assert.equal(x.meta.positionsComplete,true);assert.equal(x.meta.locationsComplete,true);
 assert.equal(x.meta.absentStockIsZero,false);
 assert.equal(x.meta.stale,false);
 assert.equal(x.meta.sourceFile,"BC.xlsx");
 assert.equal(x.meta.stockRows,1);
 assert.equal(x.meta.totalImportRows,7); // not the same as stock-specific lines
 assert.equal(x.stock[0].quantity,"-2.5");
 assert.equal(x.stock[0].expiryDate,"2027-08-01");
 assert.deepEqual(x.fixed,[{warehouse:"COR_01_COR",product_code:"0000123",location_code:"SUELO 3"}]);
});
test("isolation: same location code may safely exist in both warehouses",()=>{
 const a=adapt(snap("COR_01_COR"));
 const b=adapt(snap("COR_02_NAR"),scope("COR_02_NAR"));
 assert.equal(a.locations[0].code,b.locations[0].code);
 assert.notEqual(a.locations[0].warehouse,b.locations[0].warehouse);
 assert.notEqual(a.fixed[0].warehouse,b.fixed[0].warehouse);
 assert.throws(()=>adapt(snap("COR_02_NAR"),scope("COR_01_COR")),/scope/);
 const crossing=snap();
 crossing.fixed[0].warehouse_code="COR_02_NAR";
 assert.throws(()=>adapt(crossing),/scoped warehouse/);
});
test("all completeness flags need independent attestations, not array presence",()=>{
 const s=snap();
 s.coverage.positionsReconciled=false;s.coverage.locationsScoped=false;
 s.coverage.catalogScopeVerified=false;s.sourceCertification.parserApproved=false;
 const x=adapt(s);
 assert.equal(x.meta.stockComplete,false);
 assert.equal(x.meta.catalogComplete,false);
 assert.equal(x.meta.positionsComplete,false);
 assert.equal(x.meta.locationsComplete,false);
 assert.equal(x.meta.absentStockIsZero,false);
 assert.equal(x.meta.truncated,false);
});
test("no stock row is UNKNOWN, never automatic zero",()=>{
 const s=snap();s.stockLines=[];s.batch.expected_rows=0;s.batch.validated_rows=0;
 const x=adapt(s);
 assert.equal(x.stock.length,0);assert.equal(x.meta.absentStockIsZero,false);
 assert.equal(x.meta.stockComplete,false); // no approved empty-batch model; absence remains UNKNOWN
 const missing=snap();missing.stockLines=[]; // count not reconciled
 assert.equal(adapt(missing).meta.stockComplete,false);
});
test("zero omission requires explicit independently approved certificate",()=>{
 const s=snap();s.coverage.zeroOmissionCertified=true;
 assert.equal(adapt(s).meta.absentStockIsZero,false);
 s.sourceCertification.zeroOmissionPolicyApproved=true;
 assert.equal(adapt(s).meta.absentStockIsZero,true);
 s.sourceCertification.parserApproved=false;
 assert.equal(adapt(s).meta.absentStockIsZero,false);
});
test("stale defaults to true unless server certifies max age and not forced stale",()=>{
 const s=snap();delete s.freshness;
 assert.equal(adapt(s).meta.stale,true);
 s.freshness={maxAgeHours:24};assert.equal(adapt(s).meta.stale,true);
 s.freshness.forcedStale=false;
 assert.equal(adapt(s).meta.stale,false);
 assert.equal(adapt(s,scope(),"2026-11-01T10:00:00Z").meta.stale,true);
 s.batch.published_at="2026-10-28T10:00:00Z";
 assert.equal(adapt(s).meta.stale,true); // future timestamps never fresh
});
test("reject unverified admin, broad role, cross-warehouse or truncated snapshot",()=>{
 const s=snap();
 assert.throws(()=>adapt(s,{...scope(),serverVerified:false}),/scope/);
 assert.throws(()=>adapt(s,{...scope(),role:"operator"}),/scope/);
 assert.throws(()=>adapt({...s,truncated:true}),/Truncated/);
 assert.throws(()=>adapt({...s,batch:{...s.batch,warehouse_code:"COR_02_NAR"}}),/warehouse-specific/);
});
test("reject unsafe decimals, collisions and missing master references",()=>{
 const s=snap();s.stockLines[0].stock_calculated="9999999999999";
 assert.throws(()=>adapt(s),/Unsafe decimal/);
 const dup=snap();dup.stockLines.push({...dup.stockLines[0]});
 assert.throws(()=>adapt(dup),/Duplicate stock lot/);
 const unknown=snap();unknown.fixed[0].product_code="MISSING";
 assert.throws(()=>adapt(unknown),/Unresolved fixed/);
});
test("imported stock rows never confused with mixed import total rows",()=>{
 const s=snap();s.batch.total_import_rows=3041;s.batch.expected_rows=1;
 assert.equal(adapt(s).meta.stockComplete,true);
 assert.equal(adapt(s).meta.totalImportRows,3041);
 s.batch.expected_rows=3041;
 assert.equal(adapt(s).meta.stockComplete,false);
});

test("a validated historical batch cannot impersonate the warehouse's current pointer",()=>{
 const s=snap();
 s.currentBatchId="newer-batch";
 assert.throws(()=>adapt(s),/current warehouse pointer/);
 s.currentBatchId=s.batch.id;
 assert.equal(adapt(s).meta.stockComplete,true);
 delete s.currentBatchId;
 assert.throws(()=>adapt(s),/current warehouse pointer/);
});

test("an old BC export remains stale even after recent publication",()=>{
 const s=snap();s.batch.exported_at="2026-10-01T10:00:00Z";
 s.batch.imported_at="2026-10-27T09:00:00Z";
 s.batch.published_at="2026-10-27T10:00:00Z";
 assert.equal(adapt(s).meta.stale,true);
 s.batch.exported_at="2026-10-27T08:00:00Z";
 assert.equal(adapt(s).meta.stale,false);
 s.sourceCertification.exportDateAttested=false;
 assert.equal(adapt(s).meta.stale,true);
 assert.equal(adapt(s).meta.stockComplete,false);
});
