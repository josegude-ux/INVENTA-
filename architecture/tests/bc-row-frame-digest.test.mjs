import test from "node:test";
import assert from "node:assert/strict";
import {validateBCBatch} from "../lib/validate-bc-batch.mjs";
import {ROWS_DIGEST_VERSION,digestNormalizedBCRows} from "../lib/bc-row-frame-digest.mjs";
const mk=(r)=>validateBCBatch({
  warehouse:"COR_01_COR",fileName:"manual.xlsx",expectedRows:r.length,rows:r
});
const record=(rest={})=>({
  almacen:"COR_01_COR",codigoArticulo:"0000123",descripcion:"Niño / Café",
  unidad:"UD",ubicacion:"A-01",lote:"L1",stockCalculado:"0",...rest
});
test("binary row contract v2: independent Python length-prefix SHA256 vector",()=>{
  assert.equal(ROWS_DIGEST_VERSION,"visura-bc-rows-len32-v1");
  const b=mk([record(),record({
    descripcion:"Otro producto",lote:"L2",stockCalculado:"-2,5000"
  })]);
  assert.equal(b.valid,true);
  assert.equal(digestNormalizedBCRows(b),
    "d9db1f1eabf30fd0fd6369315671196bada3efd7773a4e7d9d6a8a8d93ca2515");
});
test("equivalent canonical decimals yield same hash; amount or order differ",()=>{
  const a=mk([record({stockCalculado:"12.250000"}),record({lote:"L2",stockCalculado:"-2,5000"})]);
  const b=mk([record({stockCalculado:"12,25"}),record({lote:"L2",stockCalculado:"-2.5"})]);
  assert.equal(digestNormalizedBCRows(a),digestNormalizedBCRows(b));
  assert.notEqual(digestNormalizedBCRows(b),
    digestNormalizedBCRows(mk([record({stockCalculado:"12,26"}),record({lote:"L2",stockCalculado:"-2.5"})])));
  assert.notEqual(digestNormalizedBCRows(b),
    digestNormalizedBCRows(mk([record({lote:"L2",stockCalculado:"-2.5"}),record({stockCalculado:"12,25"})])));
});
test("forged valid flag and partial or invalid rows are rejected",()=>{
  const good=mk([record()]);
  assert.throws(()=>digestNormalizedBCRows({...good,normalizedRows:[{
    ...good.normalizedRows[0],stockCalculado:"999e3"
  }]}),TypeError);
  assert.throws(()=>digestNormalizedBCRows({...good,expectedRows:2}),TypeError);
  assert.throws(()=>digestNormalizedBCRows({...good,valid:false}),TypeError);
});
