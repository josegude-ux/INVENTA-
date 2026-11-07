// VISURA 04 — independent Node side of binary row digest contract V2.
// No XLSX parser, no real Supabase access, no permission or publication granted.
// A digest comparison detects altered normalized rows; it does NOT prove parser
// origin or authorize a client-supplied actor / forged receipt.
import { createHash } from "node:crypto";
import { CONTRACT_VERSION, validateBCBatch } from "./validate-bc-batch.mjs";

export const ROWS_DIGEST_VERSION = "visura-bc-rows-len32-v1";
const FIELD_ORDER = Object.freeze([
  "almacen", "codigoArticulo", "descripcion", "unidad",
  "ubicacion", "lote", "stockCalculado"
]);

function writeField(hash, text) {
  if (typeof text !== "string") throw new TypeError("Expected canonical string");
  const data = Buffer.from(text, "utf8");
  if (data.byteLength > 0xffffffff) throw new RangeError("Oversized encoded field");
  const size = Buffer.allocUnsafe(4);
  size.writeUInt32BE(data.byteLength);
  hash.update(size);
  hash.update(data);
}

export function digestNormalizedBCRows(batch) {
  if (!batch || !batch.valid || batch.contractVersion !== CONTRACT_VERSION ||
      !Number.isSafeInteger(batch.expectedRows) || batch.expectedRows < 1 ||
      !Array.isArray(batch.normalizedRows) ||
      batch.normalizedRows.length !== batch.expectedRows ||
      !Array.isArray(batch.errors) || batch.errors.length) {
    throw new TypeError("Valid full BC batch required");
  }
  // Never trust a caller to set valid:true and bypass the actual validation.
  const verified = validateBCBatch({
    warehouse: batch.warehouse, fileName: "verified.xlsx",
    expectedRows: batch.expectedRows, rows: batch.normalizedRows
  });
  if (!verified.valid ||
      JSON.stringify(verified.normalizedRows) !== JSON.stringify(batch.normalizedRows)) {
    throw new TypeError("Normalized input differs from independent revalidation");
  }
  const hash = createHash("sha256");
  // Prefix: four-byte big-endian UTF-8 lengths + UTF-8 text for every field.
  // The row count and fixed seven-column ordering disambiguate row boundaries.
  for (const value of [ROWS_DIGEST_VERSION, CONTRACT_VERSION, batch.warehouse,
                       String(batch.expectedRows)]) writeField(hash, value);
  for (const row of batch.normalizedRows) {
    for (const field of FIELD_ORDER) writeField(hash, row[field]);
  }
  return hash.digest("hex");
}
