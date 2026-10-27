// VISURA 04 — pure shape-only adapter. No RPC, Auth validation, or DB IO.
// Input MUST be a trusted server snapshot; never call from an untrusted browser.
import { decimalBC } from "./validate-bc-batch.mjs";
export const FIXED_CONTRACT_VERSION="visura-prepara-fixed-read-v1";
const warehousePattern=/^[A-Z0-9_]{3,40}$/;
const ok=(value,message)=>{if(!value)throw new TypeError(message);};
const clean=x=>typeof x==="string"?x.trim():"";
const timestamp=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
function scoped(record,warehouse,type){
 ok(record&&typeof record==="object"&&record.warehouse_code===warehouse,type+" lacks scoped warehouse");
}
function noDuplicates(items,fields,label){
 const used=new Set();
 for(const item of items){
  const key=JSON.stringify(fields.map(f=>item[f]));
  ok(!used.has(key),"Duplicate "+label+" "+key);used.add(key);
 }
}
// The verified scope MUST originate from a future trusted server gateway.
// This function alone cannot authenticate identity. It deliberately does not
// run SQL, issue user tokens, grant privileges or expose an endpoint.
export function toPreparaFixedReadV1({snapshot,verifiedScope,now}={}){
 ok(snapshot&&typeof snapshot==="object","Missing central snapshot");
 const warehouse=clean(snapshot.warehouse);
 ok(warehousePattern.test(warehouse),"Invalid warehouse");
 ok(verifiedScope?.serverVerified===true&&verifiedScope.module==="prepara"&&
    verifiedScope.role==="admin"&&verifiedScope.warehouse===warehouse,
    "Trusted PREPARA administrative warehouse scope missing");
 ok(snapshot.truncated===false,"Truncated snapshot");
 for(const name of ["products","locations","fixed","stockLines"])
  ok(Array.isArray(snapshot[name])&&snapshot[name].length<=100000,"Invalid "+name);
 const batch=snapshot.batch;
 ok(batch&&batch.warehouse_code===warehouse,"Missing warehouse-specific import");
 ok(typeof now==="string"&&timestamp(now)!==null,"Trusted server clock required");
 const productCodes=new Map();
 const products=snapshot.products.map(p=>{
  ok(p&&clean(p.code)&&clean(p.description)&&clean(p.unit),"Invalid central product");
  if(p.warehouse_code!==undefined)scoped(p,warehouse,"product");
  ok(!productCodes.has(p.code),"Duplicate product");
  productCodes.set(p.code,p.unit);
  return {code:p.code,description:p.description,unit:p.unit};
 });
 const knownLocations=new Set();
 const locations=snapshot.locations.map(l=>{
  scoped(l,warehouse,"location");
  ok(clean(l.location_code),"Invalid location");
  ok(!knownLocations.has(l.location_code),"Duplicate location in warehouse");
  knownLocations.add(l.location_code);
  return {warehouse,code:l.location_code,aisle:clean(l.aisle),zone:clean(l.zone)};
 });
 const fixed=snapshot.fixed.map(f=>{
  scoped(f,warehouse,"fixed");
  ok(productCodes.has(f.product_code)&&knownLocations.has(f.location_code),"Unresolved fixed position");
  return {warehouse,product_code:f.product_code,location_code:f.location_code};
 });
 noDuplicates(fixed,["product_code","location_code"],"fixed position");
 const stock=snapshot.stockLines.map(l=>{
  scoped(l,warehouse,"stock");
  ok(productCodes.has(l.product_code)&&knownLocations.has(l.location_code),"Stock references unknown master");
  ok(typeof l.lot==="string"&&l.unit===productCodes.get(l.product_code),"Invalid lot/unit");
  ok(typeof l.stock_calculated==="string","Stock decimal must be a lossless text");
  const quantity=decimalBC(l.stock_calculated);
  ok(quantity!==null&&/^-?\d{1,12}(?:\.\d{1,6})?$/.test(quantity),"Unsafe decimal");
  return {warehouse,product_code:l.product_code,location_code:l.location_code,
    lot:l.lot,quantity,unit:l.unit,
    ...(l.expiry_date===undefined?{}:{expiryDate:l.expiry_date??null})};
 });
 noDuplicates(stock,["product_code","location_code","lot"],"stock lot");
 const coverage=snapshot.coverage??{};
 const proof=snapshot.sourceCertification??{};
 const stockRows=stock.length;
 // This is a stock-specific batch, not total rows of a mixed Excel import.
 const countOK=Number.isSafeInteger(batch.expected_rows)&&
  batch.expected_rows===batch.validated_rows && batch.expected_rows===stockRows;
 const importedMs=timestamp(batch.published_at),currentMs=timestamp(now);
 const hours=snapshot.freshness?.maxAgeHours;
 const ageOK=Number.isSafeInteger(hours)&&hours>0&&hours<=8760;
 const stale=batch.state!=="published"||importedMs===null||!ageOK||
   importedMs>currentMs||currentMs-importedMs>hours*3600000||
   snapshot.freshness?.forcedStale!==false;
 const stockComplete=batch.state==="published"&&batch.source==="bc_excel_manual"&&
   countOK&&coverage.stock===true&&proof.fileAndRowsAttested===true&&
   proof.parserApproved===true&&clean(batch.file_name)!==""&&importedMs!==null;
 const catalogComplete=coverage.catalog===true&&coverage.catalogScopeVerified===true;
 const positionsComplete=coverage.positions===true&&coverage.positionsReconciled===true;
 const locationsComplete=coverage.locations===true&&coverage.locationsScoped===true;
 const absentStockIsZero=stockComplete&&coverage.zeroOmissionCertified===true&&
   proof.zeroOmissionPolicyApproved===true;
 return {warehouse,meta:{
  warehouse,authorized:true,truncated:false,stockComplete,catalogComplete,
  positionsComplete,locationsComplete,absentStockIsZero,stale,
  sourceFile:clean(batch.file_name)||null,
  importedAt:importedMs===null?null:new Date(importedMs).toISOString(),
  importId:batch.id??null,contractVersion:FIXED_CONTRACT_VERSION,
  stockRows,stockExpectedRows:batch.expected_rows,
  totalImportRows:Number.isSafeInteger(batch.total_import_rows)?batch.total_import_rows:null
 },products,locations,fixed,stock};
}
