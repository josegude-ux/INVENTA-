import test from "node:test";
import assert from "node:assert/strict";
import { validateBCBatch } from "../lib/validate-bc-batch.mjs";

// These are real *code shapes* in the INVENTA location catalog, not business quantities.
const row = (ubicacion, lote) => ({
  almacen: "COR_01_COR",
  codigoArticulo: "0000123",
  descripcion: "Producto de prueba",
  unidad: "UD",
  ubicacion,
  lote,
  stockCalculado: "0",
});
const validate = rows => validateBCBatch({
  warehouse: "COR_01_COR",
  fileName: "prueba-manual.xlsx",
  source: "bc_excel_manual",
  expectedRows: rows.length,
  rows,
});

test("accepts actual INVENTA location code shapes with internal spaces", () => {
  const result = validate([row("PLV USAD", "A"), row("SUELO 3", "B")]);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.normalizedRows.map(x => x.ubicacion), ["PLV USAD", "SUELO 3"]);
});

test("remains strict on control characters and formula-like location codes", () => {
  for (const loc of ["SUELO\t3", "=1+1", "A\n01", "../..", ""]) {
    const result = validate([row(loc, "A")]);
    assert.equal(result.valid, false, loc);
    assert.deepEqual(result.normalizedRows, []);
  }
});

test("SKU remains strict while location spaces are supported", () => {
  const result = validate([{ ...row("PLV USAD", "A"), codigoArticulo: "ART 0001" }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.code === "INVALID_SKU"));
});
