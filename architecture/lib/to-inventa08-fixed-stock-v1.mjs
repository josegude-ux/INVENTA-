// VISURA 04 — isolated INVENTA08 read-envelope adapter, NOT a public API.
// No source tables duplicated; needs a consistent, server-authorized snapshot.
// An actual gateway MUST verify Auth, ACL and a repeatable-read transaction.
import {decimalBC} from "./validate-bc-batch.mjs";
export const INVENTA08_READ_CONTRACT="visura-inventa08-fixed-stock-v1";
const fail=(test,reason)=>{if(!test)throw new TypeError(reason);};
const whPattern=/^[A-Z0-9_]{3,40}$/;
const isCode=x=>typeof x==="string"&&x.trim().length>0&&x===x.trim();
const at=x=>typeof x==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x)&&
  Number.isFinite(Date.parse(x))?Date.parse(x):null;
function unique(list,parts,label){
 const seen=new Set();
 for(const record of list){const k=JSON.stringify(parts.map(p=>record[p]));
  fail(!seen.has(k),"Duplicate "+label);seen.add(k);
 }
}
// This validates the envelope shape, not an Auth session or Excel provenance.
// Claims of verifiedByServer must NEVER be accepted from the browser.
export function toInventa08FixedStockV1({snapshot,serverContext,now}={}){
 fail(snapshot&&typeof snapshot==="object","Missing central snapshot");
 const warehouse=snapshot.warehouse;
 fail(typeof warehouse==="string"&&whPattern.test(warehouse),"Invalid warehouse");
 fail(serverContext?.serverVerified===true&&serverContext?.sessionValid===true&&
  serverContext?.active===true&&serverContext?.module==="inventa"&&
  serverContext?.role==="admin"&&serverContext?.warehouse===warehouse,
  "INVENTA admin warehouse authorization not verified");
 fail(snapshot.truncated===false,"Incomplete or truncated central snapshot");
 for(const k of ["products","locations","fixed","stockLines"])
  fail(Array.isArray(snapshot[k])&&snapshot[k].length<=100000,"Invalid "+k);
 const batch=snapshot.batch;
 fail(batch&&batch.warehouse_code===warehouse&&isCode(batch.id)&&
  batch.id===snapshot.currentBatchId,"Warehouse's current BC batch is unverified");
 fail(isCode(snapshot.snapshotId)&&isCode(snapshot.positionsVersion),
  "Consistent snapshot and positions version required");
 const pmap=new Map();
 const products=snapshot.products.map(p=>{
  fail(p&&isCode(p.code)&&isCode(p.description)&&isCode(p.unit),"Invalid central product");
  fail(p.warehouse_code===undefined||p.warehouse_code===warehouse,"Foreign catalog product");
  fail(!pmap.has(p.code),"Duplicate central product");
  pmap.set(p.code,p.unit);
  return {code:p.code,description:p.description,unit:p.unit};
 });
 const lmap=new Set();
 const locations=snapshot.locations.map(l=>{
  fail(l&&l.warehouse_code===warehouse&&isCode(l.location_code),"Foreign/invalid location");
  fail(!lmap.has(l.location_code),"Duplicate warehouse location");
  lmap.add(l.location_code);
  return {warehouse,code:l.location_code,aisle:l.aisle??"",zone:l.zone??""};
 });
 const seenAssociations=new Set();
 const fixed=snapshot.fixed.map(a=>{
  fail(a&&a.warehouse_code===warehouse&&isCode(a.associationId)&&
   isCode(a.product_code)&&isCode(a.location_code)&&typeof a.active==="boolean"&&
   Number.isSafeInteger(a.revision)&&a.revision>=1,"Unversioned or foreign association");
  fail(!seenAssociations.has(a.associationId),"Duplicate associationId");
  seenAssociations.add(a.associationId);
  fail(pmap.has(a.product_code)&&lmap.has(a.location_code),
   "Association is not reconciled to warehouse masters");
  return {warehouse,associationId:a.associationId,product_code:a.product_code,
   location_code:a.location_code,active:a.active,revision:a.revision};
 });
 unique(fixed.filter(a=>a.active),["warehouse","product_code","location_code"],"active association");
 const stock=snapshot.stockLines.map(l=>{
  fail(l&&l.warehouse_code===warehouse&&pmap.has(l.product_code)&&
   lmap.has(l.location_code)&&typeof l.lot==="string"&&
   l.unit===pmap.get(l.product_code),"Foreign/unresolved BC stock line");
  fail(typeof l.stock_calculated==="string","BC amount must be exact text");
  const quantity=decimalBC(l.stock_calculated);
  fail(quantity!==null&&/^-?\d{1,12}(?:\.\d{1,6})?$/.test(quantity),
   "BC decimal precision outside contract");
  return {warehouse,importId:batch.id,product_code:l.product_code,
   location_code:l.location_code,lot:l.lot,quantity,unit:l.unit};
 });
 unique(stock,["warehouse","importId","product_code","location_code","lot"],"BC stock lot");
 const countsValid=Number.isSafeInteger(batch.expected_rows)&&batch.expected_rows>=1&&
  batch.validated_rows===batch.expected_rows&&batch.expected_rows===stock.length;
 const c=snapshot.coverage??{},proof=snapshot.sourceCertification??{};
 const stockComplete=batch.state==="published"&&batch.source==="bc_excel_manual"&&
  countsValid&&c.stock===true&&proof.fileAndRowsAttested===true&&proof.parserApproved===true;
 const catalogComplete=c.catalog===true&&c.catalogScopeVerified===true;
 const locationsComplete=c.locations===true&&c.locationsScoped===true;
 const positionsComplete=c.positions===true&&c.positionsReconciled===true;
 const published=at(batch.published_at),imported=at(batch.imported_at);
 const exported=at(batch.exported_at),clock=at(now);
 fail(clock!==null,"Trusted clock not supplied");
 const age=snapshot.freshness?.maxAgeHours;
 const stale=snapshot.freshness?.forcedStale!==false||
  !Number.isSafeInteger(age)||age<=0||age>8760||exported===null||
  exported>clock||clock-exported>age*3600000||
  imported===null||published===null||imported>published||published>clock;
 const zeroCertified=stockComplete&&c.zeroOmissionCertified===true&&
  proof.zeroOmissionPolicyApproved===true&&isCode(proof.zeroOmissionRuleId);
 return {
  meta:{
   warehouse,verifiedByServer:true,authorized:true,stockComplete,
   catalogComplete,locationsComplete,positionsComplete,
   truncated:false,stale,positionsVersion:snapshot.positionsVersion,
   snapshotId:snapshot.snapshotId,publishedBatchId:batch.id,
   sourceFile:batch.file_name??null,exportedAt:exported===null?null:new Date(exported).toISOString(),
   importedAt:imported===null?null:new Date(imported).toISOString(),
   publishedAt:published===null?null:new Date(published).toISOString(),
   absentStockIsZero:zeroCertified,
   zeroOmissionRuleId:zeroCertified?proof.zeroOmissionRuleId:null,
   expectedStockRows:stock.length,expectedProducts:products.length,
   expectedLocations:locations.length,expectedFixedRows:fixed.filter(a=>a.active).length,
   contractVersion:INVENTA08_READ_CONTRACT
  },products,locations,fixed,stock
 };
}
