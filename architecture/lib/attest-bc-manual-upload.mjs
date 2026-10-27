// VISURA 04 — import-boundary prototype: DO NOT attach to a live frontend.
// readRowsFromBytes MUST be a trusted XLSX parser supplied by a server-side
// adapter. This module does not parse XLSX, authenticate an actor or publish.
// It prevents the accidental design of a receipt from unrelated byte/row inputs.
import { createHash } from "node:crypto";
import { validateBCBatch } from "./validate-bc-batch.mjs";
import { createBCIntegrityReceipt } from "./bc-integrity-receipt.mjs";
import { digestNormalizedBCRows } from "./bc-row-frame-digest.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export async function attestManualBCImport({
  fileBytes, fileName, warehouse, readRowsFromBytes
} = {}) {
  if (!(fileBytes instanceof Uint8Array) || !fileBytes.byteLength ||
      typeof readRowsFromBytes !== "function") {
    throw new TypeError("Original Excel bytes and trusted parser are required");
  }
  // Copy original bytes before parser runs: detached browser buffers, mutable
  // views or subsequent caller writes cannot change the captured evidence.
  const original = Uint8Array.from(fileBytes);
  const baselineFileSha256 = sha256(original);
  const parseInput = Uint8Array.from(original);

  // Parser MUST derive rows solely from parseInput; never accept a separate
  // caller-provided rows array in the public API of this module.
  const rows = await readRowsFromBytes(parseInput);

  // Detect mutation of parser input: prevents SHA being generated from a
  // different binary buffer than the bytes observed by the parser.
  if (sha256(parseInput) !== baselineFileSha256) {
    throw new Error("Trusted XLSX parser modified source buffer");
  }
  if (!Array.isArray(rows)) throw new TypeError("Parser returned no row array");
  const validated = validateBCBatch({
    warehouse, fileName, rows, expectedRows: rows.length
  });
  if (!validated.valid) {
    return Object.freeze({
      valid:false,
      errors:validated.errors,
      warnings:validated.warnings,
      receipt:null,
      rowsDigestV2:null,
      normalizedRows:[]
    });
  }
  const receipt = createBCIntegrityReceipt({fileBytes:original,batch:validated});
  if (receipt.fileSha256 !== baselineFileSha256) {
    throw new Error("Original bytes changed across attestation");
  }
  return Object.freeze({
    valid:true,
    errors:[],
    warnings:validated.warnings,
    receipt,
    rowsDigestV2:digestNormalizedBCRows(validated),
    normalizedRows:validated.normalizedRows
  });
}
