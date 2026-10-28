import test from "node:test";
import assert from "node:assert/strict";
import { attestManualBCImport } from "../lib/attest-bc-manual-upload.mjs";
import { verifyBCIntegrityReceipt } from "../lib/bc-integrity-receipt.mjs";
import { validateBCBatch } from "../lib/validate-bc-batch.mjs";
import { digestNormalizedBCRows } from "../lib/bc-row-frame-digest.mjs";

const bytes = text => new TextEncoder().encode(text);
const row = (rest={})=>({
 almacen:"COR_01_COR",codigoArticulo:"0000123",descripcion:"Niño / Café",
 unidad:"UD",ubicacion:"PLV USAD",lote:"L1",stockCalculado:"0",...rest
});
const args = (more={})=>({
 fileBytes:bytes("fake XLSX bytes, synthetic only"),fileName:"BC.xlsx",
 warehouse:"COR_01_COR", readRowsFromBytes:async seen=>{
   assert.ok(seen instanceof Uint8Array);
   return {rows:[row(),row({lote:"L2",ubicacion:"SUELO 3",stockCalculado:"-2.500"})],expectedRows:2};
 },...more
});

test("requires one trusted parser callback over copied file bytes",async()=>{
 const a=args();const original=Array.from(a.fileBytes);let calls=0;
 const r=await attestManualBCImport({...a,readRowsFromBytes:async seen=>{
   calls++;assert.deepEqual(Array.from(seen),original);
   return {rows:[row(),row({lote:"L2",ubicacion:"SUELO 3",stockCalculado:"-2.500"})],expectedRows:2};
 }});
 assert.equal(calls,1);assert.equal(r.valid,true);
 assert.equal(r.normalizedRows[0].codigoArticulo,"0000123");
 assert.equal(r.normalizedRows[1].stockCalculado,"-2.5");
 assert.equal(r.warnings.length,1);
 assert.deepEqual(Array.from(a.fileBytes),original);
 const b=validateBCBatch({warehouse:"COR_01_COR",fileName:"BC.xlsx",
   expectedRows:2,rows:r.normalizedRows});
 assert.equal(r.rowsDigestV2,digestNormalizedBCRows(b));
 assert.ok(verifyBCIntegrityReceipt({
   fileBytes:a.fileBytes,batch:b,expectedReceipt:r.receipt}));
});
test("does not attest altered source bytes, missing calculated stock or mixed warehouses",async()=>{
 const config=args();
 const attested=await attestManualBCImport(config);
 const b=validateBCBatch({warehouse:"COR_01_COR",fileName:"BC.xlsx",
  expectedRows:2,rows:attested.normalizedRows});
 assert.equal(verifyBCIntegrityReceipt({
  fileBytes:bytes("different file"),batch:b,expectedReceipt:attested.receipt}),false);
 const invalid=await attestManualBCImport(args({readRowsFromBytes:()=>({rows:[
   row({stockCalculado:undefined,stockFisico:"42"}),
   row({lote:"L2",stockCalculado:"-2"})
 ],expectedRows:2})}));
 assert.equal(invalid.valid,false);
 assert.equal(invalid.receipt,null);assert.deepEqual(invalid.normalizedRows,[]);
 const mixed=await attestManualBCImport(args({readRowsFromBytes:()=>({rows:[
  row(),row({lote:"L2",almacen:"COR_02_NAR"})
 ],expectedRows:2})}));
 assert.equal(mixed.valid,false);assert.equal(mixed.rowsDigestV2,null);
});
test("parser mutating input buffer is rejected, caller original is protected",async()=>{
 const src=bytes("synthetic workbook");const before=Array.from(src);
 await assert.rejects(attestManualBCImport(args({
   fileBytes:src,readRowsFromBytes:async b=>{b[0]^=0xff;return {rows:[row()],expectedRows:1};}
 })),/modified source buffer/);
 assert.deepEqual(Array.from(src),before);
});
test("missing parser, empty file or invalid parser output cannot mint evidence",async()=>{
 await assert.rejects(attestManualBCImport(args({readRowsFromBytes:null})),TypeError);
 await assert.rejects(attestManualBCImport(args({fileBytes:bytes("")})),TypeError);
 await assert.rejects(attestManualBCImport(args({readRowsFromBytes:()=>null})),TypeError);
 await assert.rejects(attestManualBCImport(args({readRowsFromBytes:()=>{throw Error("parser rejected corrupt XLSX");}})),/corrupt XLSX/);
});

test("declared source row count cannot be inferred from truncated rows",async()=>{
 const out=await attestManualBCImport(args({readRowsFromBytes:()=>({rows:[row()],expectedRows:2})}));
 assert.equal(out.valid,false);
 assert.equal(out.receipt,null);
 assert.ok(out.errors.some(e=>e.code==="ROW_COUNT_MISMATCH"));
});

test("parser returning rounded Number never receives a valid signed receipt",async()=>{
 const x=await attestManualBCImport(args({readRowsFromBytes:async()=>({
  expectedRows:1,rows:[row({stockCalculado:Number("99999999999.123456")})]
 })}));
 assert.equal(x.valid,false);
 assert.equal(x.receipt,null);
 assert.equal(x.rowsDigestV2,null);
 assert.ok(x.errors.some(e=>e.code==="INVALID_STOCK_CALCULATED"));
});
