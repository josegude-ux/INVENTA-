import test from "node:test";
import assert from "node:assert/strict";
import {createPreparaFixedReadGateway} from "../lib/prepara-fixed-read-gateway-seam.mjs";
const now="2026-10-27T18:00:00Z";
const snapshot=warehouse=>({
 warehouse,truncated:false,
 products:[{code:"0000123",description:"Producto",unit:"UD"}],
 locations:[{warehouse_code:warehouse,location_code:"A-01",aisle:"A",zone:"Z"}],
 fixed:[{warehouse_code:warehouse,product_code:"0000123",location_code:"A-01"}],
 stockLines:[{warehouse_code:warehouse,product_code:"0000123",
  location_code:"A-01",lot:"",stock_calculated:"0",unit:"UD"}],
 batch:{id:"x",warehouse_code:warehouse,state:"published",source:"bc_excel_manual",
   expected_rows:1,validated_rows:1,file_name:"BC.xlsx",published_at:now},
 coverage:{stock:true,catalog:true,catalogScopeVerified:true,positions:true,
  positionsReconciled:true,locations:true,locationsScoped:true},
 sourceCertification:{fileAndRowsAttested:true,parserApproved:true},
 freshness:{maxAgeHours:24,forcedStale:false}
});
const grant=warehouse=>({active:true,sessionValid:true,enabled:true,approved:true,
 module:"prepara",role:"admin",warehouse,userId:"synthetic-admin"});
test("authorized server session reads only assigned warehouse",async()=>{
 let authorized=0,loaded=0;
 const gw=createPreparaFixedReadGateway({
  authorize:async({session,warehouse,module})=>{
   authorized++;assert.equal(session.token,"synthetic session");
   assert.equal(module,"prepara");return grant(warehouse);
  },
  loadSnapshot:async({warehouse,userId})=>{
   loaded++;assert.equal(userId,"synthetic-admin");return snapshot(warehouse);
  },
  serverNow:()=>now
 });
 const x=await gw.readFixedPositions({session:{token:"synthetic session"},warehouse:"COR_01_COR"});
 assert.equal(x.meta.authorized,true);
 assert.equal(x.stock[0].quantity,"0");
 assert.equal(authorized,1);assert.equal(loaded,1);
});
test("authorization refusal must happen BEFORE any private data load",async()=>{
 for(const changed of [{active:false},{sessionValid:false},{enabled:false},
   {approved:false},{role:"operator"},{module:"inventa"},
   {warehouse:"COR_02_NAR"},{userId:null}]){
  let loads=0;
  const gw=createPreparaFixedReadGateway({
   authorize:async()=>({...grant("COR_01_COR"),...changed}),
   loadSnapshot:async()=>{loads++;return snapshot("COR_01_COR")},
   serverNow:()=>now
  });
  await assert.rejects(gw.readFixedPositions({session:"session",warehouse:"COR_01_COR"}),/denied/);
  assert.equal(loads,0);
 }
});
test("session revocation between requests is checked again",async()=>{
 let active=true,loaded=0;
 const gw=createPreparaFixedReadGateway({
  authorize:async()=>({...grant("COR_01_COR"),sessionValid:active}),
  loadSnapshot:async()=>{loaded++;return snapshot("COR_01_COR")},
  serverNow:()=>now
 });
 await gw.readFixedPositions({session:"session",warehouse:"COR_01_COR"});
 active=false;
 await assert.rejects(gw.readFixedPositions({session:"session",warehouse:"COR_01_COR"}),/denied/);
 assert.equal(loaded,1);
});
test("wrong warehouse returned by storage is never released to PREPARA",async()=>{
 const gw=createPreparaFixedReadGateway({
  authorize:async()=>grant("COR_01_COR"),
  loadSnapshot:async()=>snapshot("COR_02_NAR"),
  serverNow:()=>now
 });
 await assert.rejects(gw.readFixedPositions({session:"session",warehouse:"COR_01_COR"}),/mismatch/);
});
test("no authorization or missing trusted server dependencies fails closed",async()=>{
 assert.throws(()=>createPreparaFixedReadGateway(),TypeError);
 let queries=0;
 const gw=createPreparaFixedReadGateway({
  authorize:async()=>grant("COR_01_COR"),
  loadSnapshot:async()=>{queries++;return snapshot("COR_01_COR")},
  serverNow:()=>now
 });
 await assert.rejects(gw.readFixedPositions({session:null,warehouse:"COR_01_COR"}),/Authentication/);
 await assert.rejects(gw.readFixedPositions({session:"s",warehouse:"bad"}),/Invalid/);
 assert.equal(queries,0);
});
