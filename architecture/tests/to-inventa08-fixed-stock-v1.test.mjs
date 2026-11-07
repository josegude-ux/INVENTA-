import test from "node:test";
import assert from "node:assert/strict";
import {toInventa08FixedStockV1} from "../lib/to-inventa08-fixed-stock-v1.mjs";
const now="2026-10-28T05:30:00Z";
const scope=()=>({serverVerified:true,sessionValid:true,active:true,
 module:"inventa",role:"admin",warehouse:"COR_01_COR"});
const fixture=()=>({
 warehouse:"COR_01_COR",currentBatchId:"batch-1",snapshotId:"rr-snapshot-001",
 positionsVersion:"fixed-revision-12",truncated:false,
 products:[{code:"0000123",description:"Cafe",unit:"UD"}],
 locations:[
  {warehouse_code:"COR_01_COR",location_code:"SUELO 3",aisle:"S",zone:"1"},
  {warehouse_code:"COR_01_COR",location_code:"A-01",aisle:"A",zone:"1"},
  {warehouse_code:"COR_01_COR",location_code:"B-01",aisle:"B",zone:"2"}],
 fixed:[
  {warehouse_code:"COR_01_COR",associationId:"assoc-1",product_code:"0000123",
   location_code:"A-01",active:true,revision:2},
  {warehouse_code:"COR_01_COR",associationId:"assoc-2",product_code:"0000123",
   location_code:"B-01",active:true,revision:3}
 ],
 stockLines:[
  {warehouse_code:"COR_01_COR",product_code:"0000123",location_code:"A-01",
   lot:"L1",unit:"UD",stock_calculated:"-2,250"},
  {warehouse_code:"COR_01_COR",product_code:"0000123",location_code:"SUELO 3",
   lot:"L2",unit:"UD",stock_calculated:"5.250"}
 ],
 batch:{id:"batch-1",warehouse_code:"COR_01_COR",state:"published",
  source:"bc_excel_manual",expected_rows:2,validated_rows:2,
  file_name:"BC.xlsx",exported_at:"2026-10-28T04:00:00Z",
  imported_at:"2026-10-28T04:15:00Z",published_at:"2026-10-28T04:30:00Z"},
 coverage:{stock:true,catalog:true,catalogScopeVerified:true,
  locations:true,locationsScoped:true,positions:true,positionsReconciled:true},
 sourceCertification:{fileAndRowsAttested:true,parserApproved:true,
  exportDateAttested:true,importDateAttested:true},
 freshness:{maxAgeHours:24,forcedStale:false}
});
const run=(snapshot=fixture(),ctx=scope())=>
 toInventa08FixedStockV1({snapshot,serverContext:ctx,now});
test("INVENTA08 exact envelope: two active fixed positions but all BC stock lines",()=>{
 const r=run();
 assert.equal(r.meta.stockComplete,true);
 assert.equal(r.meta.stale,false);
 assert.equal(r.fixed.length,2);
 assert.equal(r.stock.length,2);
 assert.equal(r.stock[1].location_code,"SUELO 3");
 assert.equal(r.stock[0].quantity,"-2.25");
 assert.equal(r.meta.publishedBatchId,"batch-1");
 assert.equal(r.meta.snapshotId,"rr-snapshot-001");
 assert.equal(r.meta.positionsVersion,"fixed-revision-12");
 assert.equal(r.fixed[0].associationId,"assoc-1");
 assert.equal(r.fixed[0].revision,2);
 assert.equal(r.meta.exportedAt,"2026-10-28T04:00:00.000Z");
 assert.equal(r.meta.importedAt,"2026-10-28T04:15:00.000Z");
 assert.equal(r.meta.publishedAt,"2026-10-28T04:30:00.000Z");
});
test("incomplete roles and theoretical reader permission denied",()=>{
 for(const x of [{role:"operator"},{module:"prepara"},{warehouse:"COR_02_NAR"},
 {serverVerified:"true"},{sessionValid:false},{active:false}]){
  assert.throws(()=>run(fixture(),{...scope(),...x}),/authorization/);
 }
});
test("warehouse and association origin cannot be forged or inferred",()=>{
 const s=fixture();s.fixed[0].warehouse_code="COR_02_NAR";
 assert.throws(()=>run(s),/foreign association/);
 s.fixed[0].warehouse_code="COR_01_COR";delete s.fixed[0].associationId;
 assert.throws(()=>run(s),/Unversioned/);
 s.fixed[0].associationId="assoc-1";delete s.positionsVersion;
 assert.throws(()=>run(s),/snapshot and positions version/);
});
test("reject stock in unknown location even if location is not fixed",()=>{
 const s=fixture();s.stockLines[1].location_code="UNKNOWN";
 assert.throws(()=>run(s),/unresolved BC/);
});
test("stock missing is not zero; stale and completeness fail closed",()=>{
 const s=fixture();s.stockLines=[];s.batch.expected_rows=0;s.batch.validated_rows=0;
 assert.equal(run(s).meta.stockComplete,false);
 const b=fixture();delete b.batch.exported_at;
 assert.equal(run(b).meta.stale,true);
 const x=fixture();delete x.freshness.forcedStale;
 assert.equal(run(x).meta.stale,true);
 const y=fixture();y.coverage.positionsReconciled=false;
 assert.equal(run(y).meta.positionsComplete,false);
});
test("reject duplicate active fixed, lot collision and historical pointer",()=>{
 const a=fixture();a.fixed.push({...a.fixed[0],associationId:"assoc-new"});
 assert.throws(()=>run(a),/Duplicate active association/);
 const b=fixture();b.stockLines.push({...b.stockLines[0]});
 assert.throws(()=>run(b),/Duplicate BC stock lot/);
 const c=fixture();c.currentBatchId="previous";
 assert.throws(()=>run(c),/current BC batch/);
});
test("zero omitted only if exporter policy and rule id verified",()=>{
 const a=fixture();a.coverage.zeroOmissionCertified=true;
 assert.equal(run(a).meta.absentStockIsZero,false);
 a.sourceCertification.zeroOmissionPolicyApproved=true;
 a.sourceCertification.zeroOmissionRuleId="BC-RULE-1";
 assert.equal(run(a).meta.absentStockIsZero,true);
 a.sourceCertification.zeroOmissionRuleId="";
 assert.equal(run(a).meta.absentStockIsZero,false);
});
test("only canonical stock quantity strings, never JS Number",()=>{
 const a=fixture();a.stockLines[0].stock_calculated=-2.25;
 assert.throws(()=>run(a),/exact text/);
 const b=fixture();b.stockLines[0].stock_calculated="99999999999.123456";
 assert.equal(run(b).stock[0].quantity,"99999999999.123456");
});

test("INVENTA08 refuses to declare an export fresh without trusted date attestation",()=>{
 const s=fixture();s.sourceCertification.exportDateAttested=false;
 assert.equal(run(s).meta.stale,true);
 s.sourceCertification.exportDateAttested=true;
 s.batch.exported_at="2026-10-01T04:00:00Z";
 s.batch.published_at="2026-10-28T04:30:00Z";
 assert.equal(run(s).meta.stale,true);
});
