// VISURA shared core: offline, side-effect-free validation, NO publication authorization.
export const CONTRACT_VERSION = "visura-bc-batch-v1";
const code = s => typeof s === "string" && /^[A-Za-z0-9][A-Za-z0-9_.\/-]{0,79}$/.test(s.trim()) ? s.trim() : null;
const locationCode = s => typeof s === "string" && /^[A-Za-z0-9][A-Za-z0-9_.\/ -]{0,79}$/.test(s.trim()) && !/(^|[\\/])\\.\\.(?:[\\/]|$)/.test(s.trim()) ? s.trim() : null;
const text = (v,max=500) => typeof v==="string" && v.trim().length && v.trim().length<=max && !/[\x00-\x1f\x7f]/.test(v) ? v.trim() : null;
export function decimalBC(value) {
  if (typeof value!=="string" && typeof value!=="number") return null;
  if (typeof value==="number" && !Number.isFinite(value)) return null;
  const s=String(value).trim();
  if (!/^-?(?:0|[1-9]\d{0,13})(?:[.,]\d{1,6})?$/.test(s)) return null;
  const a=s.replace(",",".").split(".");
  const fraction=(a[1]||"").replace(/0+$/,"");
  const integer=a[0].replace("-","");
  const zero=integer==="0" && !fraction;
  return (s.startsWith("-")&&!zero?"-":"")+integer+(fraction?"."+fraction:"");
}
export function validateBCBatch({warehouse,fileName,expectedRows,rows,source="bc_excel_manual"}={}) {
  const errors=[],warnings=[],out=[],seen=new Set(),wh=code(warehouse);
  if (!wh) errors.push({code:"INVALID_WAREHOUSE"});
  if (!text(fileName,250) || !/\.xlsx$/i.test(fileName)) errors.push({code:"INVALID_FILE_NAME"});
  if (source!=="bc_excel_manual") errors.push({code:"INVALID_SOURCE"});
  if (!Number.isSafeInteger(expectedRows) || expectedRows<1 || expectedRows>200000) errors.push({code:"INVALID_EXPECTED_ROWS"});
  if (!Array.isArray(rows) || rows.length<1 || rows.length>200000) errors.push({code:"INVALID_ROWS"});
  if (!Array.isArray(rows) || rows.length>200000) return {valid:false,errors,warnings,normalizedRows:[]};
  if (rows.length!==expectedRows) errors.push({code:"ROW_COUNT_MISMATCH"});
  rows.forEach((r,i)=>{
    const line=i+1;
    if (!r || typeof r!=="object" || Array.isArray(r)) { errors.push({code:"INVALID_ROW",line}); return; }
    const almacen=code(r.almacen),codigoArticulo=code(r.codigoArticulo),ubicacion=locationCode(r.ubicacion);
    const unidad=text(r.unidad,32),descripcion=text(r.descripcion,500);
    const lote=r.lote==null||r.lote===""?"":text(r.lote,120);
    const stockCalculado=decimalBC(r.stockCalculado);
    if (!almacen || almacen!==wh) errors.push({code:"WAREHOUSE_MISMATCH",line});
    if (!codigoArticulo) errors.push({code:"INVALID_SKU",line});
    if (!ubicacion) errors.push({code:"INVALID_LOCATION",line});
    if (!unidad || /^\s*[=+@]/.test(unidad)) errors.push({code:"INVALID_UNIT",line});
    if (!descripcion || /^\s*[=+@]/.test(descripcion)) errors.push({code:"INVALID_DESCRIPTION",line});
    if (lote===null || /^\s*[=+@]/.test(lote)) errors.push({code:"INVALID_LOT",line});
    if (stockCalculado===null) errors.push({code:"INVALID_STOCK_CALCULATED",line});
    if (codigoArticulo && ubicacion && lote!==null) {
      const key=JSON.stringify([codigoArticulo,ubicacion,lote]);
      if (seen.has(key)) errors.push({code:"DUPLICATE_POSITION_LOT",line});
      seen.add(key);
    }
    if (stockCalculado!==null && stockCalculado.startsWith("-")) warnings.push({code:"NEGATIVE_CALCULATED_STOCK",line});
    if (almacen && codigoArticulo && ubicacion && unidad && descripcion && lote!==null && stockCalculado!==null)
      out.push({almacen,codigoArticulo,descripcion,unidad,ubicacion,lote,stockCalculado});
  });
  return {valid:errors.length===0,contractVersion:CONTRACT_VERSION,warehouse:wh,expectedRows,actualRows:rows.length,errors,warnings,normalizedRows:errors.length?[]:out};
}
