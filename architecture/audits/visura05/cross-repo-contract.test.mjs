// VISURA 05: independent, synthetic, cross-repository contract regression.
// Productive modules are IMPORTED from pinned commits, not copied or changed.
import test from "node:test";
import assert from "node:assert/strict";
import { toPreparaFixedReadV1 } from "../../lib/to-prepara-fixed-read-v1.mjs";
import { classifyFixedPositions } from "../../../_prepara_readonly/src/fixed-position-report.mjs";

const WH = "COR_01_COR";
const NOW = "2026-10-27T19:00:00Z";
const trustedScope = Object.freeze({
  serverVerified:true, module:"prepara", role:"admin", warehouse:WH
});
const build = () => ({
  warehouse:WH, currentBatchId:"synthetic-batch", truncated:false,
  products:[{code:"0000123",description:"Synthetic article",unit:"UD"}],
  locations:[
    {warehouse_code:WH,location_code:"A-01",aisle:"A",zone:"Z"},
    {warehouse_code:WH,location_code:"A-02",aisle:"A",zone:"Z"}
  ],
  fixed:[{warehouse_code:WH,product_code:"0000123",location_code:"A-01"}],
  stockLines:[{
    warehouse_code:WH,product_code:"0000123",location_code:"A-01",
    lot:"L1",stock_calculated:"0",unit:"UD"
  }],
  batch:{
    id:"synthetic-batch",warehouse_code:WH,state:"published",
    source:"bc_excel_manual",expected_rows:1,validated_rows:1,
    file_name:"synthetic_manual.xlsx",published_at:"2026-10-27T18:00:00Z"
  },
  coverage:{
    stock:true,catalog:true,catalogScopeVerified:true,
    positions:true,positionsReconciled:true,
    locations:true,locationsScoped:true,zeroOmissionCertified:false
  },
  sourceCertification:{
    fileAndRowsAttested:true,parserApproved:true,zeroOmissionPolicyApproved:false
  },
  freshness:{maxAgeHours:24,forcedStale:false}
});
const cases = [
  ["explicit zero", s=>{}, true, "cero"],
  ["negative stock with lot", s=>{s.stockLines[0].stock_calculated="-2,5000";}, true, "negativo"],
  ["positive stock no incidence",s=>{s.stockLines[0].stock_calculated="10.25";},true,"none"],
  ["absent stock not zero",s=>{s.stockLines[0].location_code="A-02";},true,"insuficientes"],
  ["absent stock zero only if certified",s=>{
    s.stockLines[0].location_code="A-02";
    s.coverage.zeroOmissionCertified=true;
    s.sourceCertification.zeroOmissionPolicyApproved=true;
  },true,"cero"],
  ["unreconciled fixed positions",s=>{s.coverage.positionsReconciled=false;},true,"insuficientes"],
  ["catalog not certified",s=>{s.coverage.catalogScopeVerified=false;},true,"insuficientes"],
  ["locations not certified",s=>{s.coverage.locationsScoped=false;},true,"insuficientes"],
  ["stale import",s=>{s.freshness.forcedStale=true;},true,"insuficientes"],
  ["incomplete stock count",s=>{s.batch.expected_rows=2;},true,"insuficientes"],
  ["historical pointer",s=>{s.currentBatchId="next-batch";},false,null],
  ["cross-warehouse stock",s=>{s.stockLines[0].warehouse_code="COR_02_NAR";},false,null],
  ["orphan stock product",s=>{s.stockLines[0].product_code="NOT_FOUND";},false,null],
  ["truncated snapshot",s=>{s.truncated=true;},false,null],
  ["duplicate stock lot",s=>{s.stockLines.push({...s.stockLines[0]});},false,null],
  ["six-decimal precision",s=>{s.stockLines[0].stock_calculated="-0.000001";},true,"negativo"]
];
for (const [title,alter,expectedSuccess,category] of cases) {
  test("INVENTA→PREPARA: "+title,()=>{
    const snapshot = build(); alter(snapshot);
    const action = () => {
      const adapted = toPreparaFixedReadV1({
        snapshot,verifiedScope:trustedScope,now:NOW
      });
      const report = classifyFixedPositions(adapted);
      assert.equal(report.warehouse,WH);
      assert.equal(report.rows[0]?.category ?? "none",category);
      return {adapted,report};
    };
    if (!expectedSuccess) {
      assert.throws(action);
      return;
    }
    const {adapted,report}=action();
    assert.equal(adapted.meta.truncated,false);
    assert.equal(adapted.meta.authorized,true);
    if (title==="explicit zero") assert.equal(report.rows[0].positionQuantity,"0");
    if (title==="negative stock with lot") assert.equal(adapted.stock[0].quantity,"-2.5");
    if (title==="six-decimal precision") assert.equal(adapted.stock[0].quantity,"-0.000001");
    if (["unreconciled fixed positions","catalog not certified","locations not certified","stale import","incomplete stock count"].includes(title))
      assert.equal(report.complete,false);
  });
}

// Known consumer-only defense-in-depth issues belong to Chat 02; DO NOT
// mark these TODO checks as passed or change the consumer from Chat 05.
test.todo("PREPARA classifier must require meta.stale === false even without gateway");
test.todo("PREPARA classifier must require meta.truncated === false when called directly");
test.todo("PREPARA classifier must flag identical duplicate stock lots if called directly");
test.todo("Trusted central adapter must attest source BC export time independently from publication");
