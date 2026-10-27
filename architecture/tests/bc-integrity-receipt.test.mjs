import test from "node:test";
import assert from "node:assert/strict";
import {validateBCBatch} from "../lib/validate-bc-batch.mjs";
import {RECEIPT_VERSION, canonicalBCPayload, createBCIntegrityReceipt,
        verifyBCIntegrityReceipt} from "../lib/bc-integrity-receipt.mjs";

const bytes = text => new TextEncoder().encode(text);
const row = (more={})=>({
 almacen:"COR_01_COR",codigoArticulo:"0000123",descripcion:"Aceite Coruña",
 unidad:"UD",ubicacion:"PLV USAD",lote:"L-01",stockCalculado:"0",...more
});
const batch = (rows,warehouse="COR_01_COR")=>
 validateBCBatch({warehouse,fileName:"import.xlsx",expectedRows:rows.length,rows});

test("evidence binds exact original bytes and canonicalized normalized records",()=>{
 const b=batch([row({stockCalculado:"0,000000"}),row({lote:"L-02",stockCalculado:"-2,500"})]);
 assert.equal(b.valid,true);
 const receipt=createBCIntegrityReceipt({fileBytes:bytes("fake XLSX bytes A"),batch:b});
 assert.equal(receipt.receiptVersion,RECEIPT_VERSION);
 assert.match(receipt.fileSha256,/^[a-f0-9]{64}$/);
 assert.match(receipt.normalizedRowsSha256,/^[a-f0-9]{64}$/);
 assert.ok(verifyBCIntegrityReceipt({fileBytes:bytes("fake XLSX bytes A"),batch:b,expectedReceipt:receipt}));
 assert.ok(!verifyBCIntegrityReceipt({fileBytes:bytes("fake XLSX bytes B"),batch:b,expectedReceipt:receipt}));
 assert.ok(!verifyBCIntegrityReceipt({fileBytes:bytes("fake XLSX bytes A"),batch:batch([row({stockCalculado:"1"}),row({lote:"L-02",stockCalculado:"-2,500"})]),expectedReceipt:receipt}));
});
test("normalized decimal spelling is equivalent; SKU, location and stock remain exact",()=>{
 const a=batch([row({stockCalculado:"12,5000"})]);
 const b=batch([row({stockCalculado:"12.5"})]);
 assert.equal(canonicalBCPayload(a),canonicalBCPayload(b));
 const evidence=createBCIntegrityReceipt({fileBytes:bytes("A"),batch:a});
 assert.ok(verifyBCIntegrityReceipt({fileBytes:bytes("A"),batch:b,expectedReceipt:evidence}));
 assert.ok(!verifyBCIntegrityReceipt({fileBytes:bytes("A"),batch:batch([row({codigoArticulo:"123",stockCalculado:"12.5"})]),expectedReceipt:evidence}));
 assert.ok(!verifyBCIntegrityReceipt({fileBytes:bytes("A"),batch:batch([row({ubicacion:"SUELO 3",stockCalculado:"12.5"})]),expectedReceipt:evidence}));
});
test("row order and warehouse are bound to the receipt",()=>{
 const a=batch([row({lote:"A"}),row({lote:"B"})]);
 const r=createBCIntegrityReceipt({fileBytes:bytes("BC source"),batch:a});
 const rev=batch([row({lote:"B"}),row({lote:"A"})]);
 assert.ok(!verifyBCIntegrityReceipt({fileBytes:bytes("BC source"),batch:rev,expectedReceipt:r}));
 const other=batch([row({almacen:"COR_02_NAR",lote:"A"}),row({almacen:"COR_02_NAR",lote:"B"})],"COR_02_NAR");
 assert.ok(!verifyBCIntegrityReceipt({fileBytes:bytes("BC source"),batch:other,expectedReceipt:r}));
});
test("reject invalid, incomplete, or fabricated normalized data",()=>{
 const good=batch([row()]);
 assert.throws(()=>createBCIntegrityReceipt({batch:good,fileBytes:"file text"}),TypeError);
 assert.throws(()=>createBCIntegrityReceipt({batch:good,fileBytes:bytes("")}),TypeError);
 assert.throws(()=>canonicalBCPayload({...good,normalizedRows:[{...good.normalizedRows[0],stockCalculado:"5e90"}]}),TypeError);
 assert.throws(()=>canonicalBCPayload({...good,expectedRows:2}),TypeError);
 assert.throws(()=>canonicalBCPayload(batch([row({stockCalculado:undefined})])),TypeError);
 assert.equal(verifyBCIntegrityReceipt({fileBytes:bytes("x"),batch:good,expectedReceipt:{...createBCIntegrityReceipt({fileBytes:bytes("x"),batch:good}),fileSha256:"g".repeat(64)}}),false);
});
test("no mutation of original batch or supplied file bytes",()=>{
 const original=row();
 const b=batch([original]);
 const before=JSON.stringify(b),file=bytes("immutable source"),fileBefore=Array.from(file);
 const r=createBCIntegrityReceipt({fileBytes:file,batch:b});
 assert.ok(Object.isFrozen(r));
 assert.equal(JSON.stringify(b),before);
 assert.deepEqual(Array.from(file),fileBefore);
});
