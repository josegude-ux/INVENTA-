// VISURA 04: pure, offline SHA-256 evidence for a MANUALLY uploaded BC Excel.
// NEVER establishes identity, parses XLSX, stages, approves or publishes stock.
// A trusted importer must bind these bytes to the rows it actually parsed.
import { createHash, timingSafeEqual } from "node:crypto";
import { CONTRACT_VERSION, validateBCBatch } from "./validate-bc-batch.mjs";

export const RECEIPT_VERSION = "visura-bc-evidence-sha256-v1";
const FIELDS = ["almacen","codigoArticulo","descripcion","unidad","ubicacion","lote","stockCalculado"];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const sha256 = data => createHash("sha256").update(data).digest("hex");
const isBytes = x => x instanceof Uint8Array;

export function canonicalBCPayload(batch) {
  if (!batch || batch.valid !== true || batch.contractVersion !== CONTRACT_VERSION ||
      !Array.isArray(batch.normalizedRows) || !Number.isSafeInteger(batch.expectedRows) ||
      batch.expectedRows !== batch.normalizedRows.length || batch.expectedRows < 1 ||
      !Array.isArray(batch.errors) || batch.errors.length !== 0) {
    throw new TypeError("Expected a complete and valid normalized BC batch");
  }
  // Revalidate even when 'valid' is asserted by an untrusted caller.
  const rechecked = validateBCBatch({
    warehouse: batch.warehouse, fileName: "receipt-recheck.xlsx",
    expectedRows: batch.expectedRows, rows: batch.normalizedRows
  });
  if (!rechecked.valid || JSON.stringify(rechecked.normalizedRows) !==
      JSON.stringify(batch.normalizedRows)) {
    throw new TypeError("Batch normalization failed independent validation");
  }
  // Explicit column order and positional arrays prevent JSON key-order ambiguity.
  // Canonical decimals and UTF-8 are guaranteed by the batch validator.
  return JSON.stringify([
    RECEIPT_VERSION, CONTRACT_VERSION, batch.warehouse, batch.expectedRows,
    batch.normalizedRows.map(r => FIELDS.map(field => r[field]))
  ]);
}

export function createBCIntegrityReceipt({ fileBytes, batch } = {}) {
  if (!isBytes(fileBytes) || fileBytes.byteLength === 0) {
    throw new TypeError("Original Excel file bytes (Uint8Array) are required");
  }
  const payload = canonicalBCPayload(batch);
  return Object.freeze({
    receiptVersion: RECEIPT_VERSION,
    batchContractVersion: CONTRACT_VERSION,
    warehouse: batch.warehouse,
    source: "bc_excel_manual",
    expectedRows: batch.expectedRows,
    fileSha256: sha256(fileBytes),
    normalizedRowsSha256: sha256(Buffer.from(payload, "utf8"))
  });
}

export function verifyBCIntegrityReceipt({ fileBytes, batch, expectedReceipt } = {}) {
  if (!expectedReceipt || expectedReceipt.receiptVersion !== RECEIPT_VERSION ||
      expectedReceipt.batchContractVersion !== CONTRACT_VERSION ||
      expectedReceipt.source !== "bc_excel_manual" ||
      typeof expectedReceipt.warehouse !== "string" ||
      !Number.isSafeInteger(expectedReceipt.expectedRows) ||
      !HASH_PATTERN.test(expectedReceipt.fileSha256 ?? "") ||
      !HASH_PATTERN.test(expectedReceipt.normalizedRowsSha256 ?? "")) return false;
  let actual;
  try { actual = createBCIntegrityReceipt({ fileBytes, batch }); }
  catch { return false; }
  if (actual.warehouse !== expectedReceipt.warehouse ||
      actual.expectedRows !== expectedReceipt.expectedRows) return false;
  return timingSafeEqual(Buffer.from(actual.fileSha256,"hex"),
                         Buffer.from(expectedReceipt.fileSha256,"hex")) &&
         timingSafeEqual(Buffer.from(actual.normalizedRowsSha256,"hex"),
                         Buffer.from(expectedReceipt.normalizedRowsSha256,"hex"));
}
