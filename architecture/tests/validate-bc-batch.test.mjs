import test from "node:test";
import assert from "node:assert/strict";
import {validateBCBatch,decimalBC} from "../lib/validate-bc-batch.mjs";
const row=(x={})=>({almacen:"COR_01_COR",codigoArticulo:"0000123",descripcion:"Producto",unidad:"UD",ubicacion:"A-01",lote:"L1",stockCalculado:"12,2500",...x});
const run=(rows,x={})=>validateBCBatch({warehouse:"COR_01_COR",fileName:"BC.xlsx",expectedRows:rows.length,rows,...x});
test("valid preserving zero-padded SKU and decimal",()=>{
 const a=run([row()]);assert.equal(a.valid,true);assert.equal(a.normalizedRows[0].codigoArticulo,"0000123");assert.equal(a.normalizedRows[0].stockCalculado,"12.25");
});
test("different lots, zero and negative BC stock are valid; negatives warned",()=>{
 const a=run([row({lote:"L1",stockCalculado:"0"}),row({lote:"L2",stockCalculado:"-2.5"})]);assert.equal(a.valid,true);assert.equal(a.warnings.length,1);
});
test("wrong warehouse cannot leak partial batch",()=>{
 const a=run([row(),row({almacen:"FER_01_FER",lote:"L2"})]);assert.equal(a.valid,false);assert.deepEqual(a.normalizedRows,[]);
});
test("physical stock never substituted for calculated stock",()=>{
 const a=run([row({stockCalculado:undefined,stockFisico:"55"})]);assert.equal(a.valid,false);assert.deepEqual(a.normalizedRows,[]);
});
test("duplicate SKU+location+lot is blocked",()=>assert.ok(run([row(),row()]).errors.some(e=>e.code==="DUPLICATE_POSITION_LOT")));
test("incomplete expected count is blocked",()=>assert.equal(run([row()],{expectedRows:2}).valid,false));
test("BC only; xlsx only",()=>{assert.equal(run([row()],{source:"bc_api"}).valid,false);assert.equal(run([row()],{fileName:"x.csv"}).valid,false)});
test("formula-like descriptive text blocked",()=>assert.equal(run([row({descripcion:"=SUM(A1:A3)"})]).valid,false));
test("invalid numeric literal blocked",()=>{assert.equal(decimalBC("1e99"),null);assert.equal(decimalBC("0,0000001"),null);assert.equal(decimalBC(Infinity),null)});
test("no mutation of input",()=>{const r=row(),str=JSON.stringify(r);run([r]);assert.equal(JSON.stringify(r),str)});
test("empty or unbounded data blocked",()=>{assert.equal(run([]).valid,false);assert.equal(run([row()],{expectedRows:200001}).valid,false)});
test("source absent lot normalized to empty",()=>{const a=run([row({lote:undefined})]);assert.equal(a.valid,true);assert.equal(a.normalizedRows[0].lote,"")});

test("BC decimal must be source lexical text, never already-rounded JS Number",()=>{
 const source="99999999999.123456";
 assert.equal(decimalBC(source),source);
 assert.equal(decimalBC(Number(source)),null);
 assert.equal(decimalBC(0),null);
 const rowNumeric=row({stockCalculado:Number(source)});
 const checked=run([rowNumeric]);
 assert.equal(checked.valid,false);
 assert.ok(checked.errors.some(e=>e.code==="INVALID_STOCK_CALCULATED"));
 const rowText=row({stockCalculado:source});
 assert.equal(run([rowText]).normalizedRows[0].stockCalculado,source);
});
