import test from "node:test";
import assert from "node:assert/strict";
import {toInventa07BlindLocationV1} from "../lib/to-inventa07-blind-location-v1.mjs";
const scope=()=>({serverVerified:true,sessionValid:true,active:true,terminalBound:true,
 module:"inventa",role:"operator",warehouse:"COR_01_COR",campaignId:"CAMP-01",
 location:"A-01",assignmentValid:true});
const sample=()=>({campaign_id:"CAMP-01",warehouse_code:"COR_01_COR",
 location_code:"A-01",location_status:"in_progress",truncated:false,
 stock_calculated:"1000",bcBatchId:"secret-bc",warehouseTotal:"12345",
 references:[{product_code:"000123",lot:"0001",description:"Articulo",
   physical_status:"confirmed",physical_quantity:"0",explicit_zero:true,
   stock_calculated:"12345",difference:"9999",metadata:{bc_secret:"x"}}],
 provisionals:[{barcode:"0000ABC",description:"Sin catalogar",
   physical_status:"draft",physical_quantity:null,explicit_zero:false,
   theoretical_stock:"999"}]});
test("blind operator view exposes ONLY compatible PR24 physical fields",()=>{
 const out=toInventa07BlindLocationV1({snapshot:sample(),serverContext:scope()});
 assert.deepEqual(Object.keys(out).sort(),["locationCode","locationStatus","provisionals","references"]);
 assert.deepEqual(Object.keys(out.references[0]).sort(),
  ["correctionPending","description","explicitZero","lot","productCode","quantity","status"]);
 assert.equal(out.references[0].quantity,"0");
 assert.equal(out.references[0].productCode,"000123");
 assert.equal(out.provisionals[0].barcode,"0000ABC");
 const json=JSON.stringify(out);
 for(const leak of ["stock_calculated","difference","bc_secret","secret-bc","theoretical_stock","warehouseTotal"])
  assert.equal(json.includes(leak),false);
});
test("reject revoked operator, other warehouse, reassigned location and unbound terminal",()=>{
 for(const changed of [{active:false},{sessionValid:false},{assignmentValid:false},
   {terminalBound:false},{serverVerified:"true"},{role:"admin"},
   {warehouse:"COR_02_NAR"},{location:"SUELO 3"},{campaignId:"CAMP-02"}]){
  assert.throws(()=>toInventa07BlindLocationV1({
   snapshot:sample(),serverContext:{...scope(),...changed}}),/scope/);
 }
});
test("explicit physical zero, no BC substitution and incomplete snapshot",()=>{
 const s=sample();
 s.references[0].physical_quantity=null;
 assert.throws(()=>toInventa07BlindLocationV1({snapshot:s,serverContext:scope()}),/amount/);
 s.references[0].physical_quantity="0";s.references[0].explicit_zero=false;
 assert.throws(()=>toInventa07BlindLocationV1({snapshot:s,serverContext:scope()}),/zero/);
 s.references[0].explicit_zero=true;s.truncated=true;
 assert.throws(()=>toInventa07BlindLocationV1({snapshot:s,serverContext:scope()}),/truncated/);
});
