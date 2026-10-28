// VISURA 04: server-only pure allowlist for INVENTA 07 blind counts.
// Server context MUST come from trusted Auth, campaign, assignment and terminal
// validation on every request. Never pass client assertions as serverContext.
const need=(predicate,reason)=>{if(!predicate)throw new TypeError(reason);};
const code=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.\/ -]{0,79}$/.test(x)&&x.trim()===x;
function physicalQuantity(raw,explicit){
 if(raw==null||raw==="")return null;
 need(typeof raw==="string" && /^(?:0|[1-9]\d*)(?:[.,]\d{1,3})?$/.test(raw),"Invalid physical quantity");
 const canonical=raw.replace(",",".");
 const zero=/^0(?:\.0+)?$/.test(canonical);
 need(zero?explicit===true:explicit!==true,"Physical zero must be explicit");
 return canonical;
}
function cleanRef(r){
 need(r&&typeof r==="object"&&!Array.isArray(r)&&code(r.product_code),"Invalid physical product reference");
 need(typeof r.lot==="string"&&r.lot.length<=120,"Invalid physical lot");
 need(["uncounted","draft","confirmed"].includes(r.physical_status),"Invalid physical reference status");
 const quantity=physicalQuantity(r.physical_quantity,r.explicit_zero);
 need(r.physical_status!=="confirmed"||quantity!==null,"Confirmed physical entry lacks amount");
 return {
   productCode:r.product_code,lot:r.lot,description:typeof r.description==="string"?r.description:"",
   status:r.physical_status,quantity,explicitZero:r.explicit_zero===true,
   correctionPending:r.correction_pending===true
 };
}
function cleanProvisional(r){
 need(r&&typeof r==="object"&&!Array.isArray(r)&&code(r.barcode),"Invalid provisional barcode");
 need(["uncounted","draft","confirmed","pending"].includes(r.physical_status),"Invalid provisional status");
 const quantity=physicalQuantity(r.physical_quantity,r.explicit_zero);
 need(r.physical_status!=="confirmed"||quantity!==null,"Confirmed provisional amount absent");
 return {
   barcode:r.barcode,description:typeof r.description==="string"?r.description:"",
   physicalStatus:r.physical_status,
   status:r.admin_status==="resolved"||r.admin_status==="resolved_duplicate"?r.admin_status:"pending",
   quantity,explicitZero:r.explicit_zero===true
 };
}
export function toInventa07BlindLocationV1({snapshot,serverContext}={}){
 need(snapshot&&typeof snapshot==="object","Missing physical source snapshot");
 const {campaign_id,warehouse_code,location_code,location_status}=snapshot;
 need(code(warehouse_code)&&code(location_code)&&code(campaign_id),"Invalid physical scope");
 need(serverContext?.serverVerified===true&&serverContext?.sessionValid===true&&
   serverContext?.active===true&&serverContext?.terminalBound===true&&
   serverContext?.module==="inventa"&&serverContext?.role==="operator"&&
   serverContext?.campaignId===campaign_id&&
   serverContext?.warehouse===warehouse_code&&
   serverContext?.location===location_code&&
   serverContext?.assignmentValid===true,"No valid physical operator scope");
 need(snapshot.truncated===false,"Physical snapshot is truncated");
 need(["not_started","in_progress","finished"].includes(location_status),"Invalid location state");
 need(Array.isArray(snapshot.references)&&snapshot.references.length<=100000&&
   Array.isArray(snapshot.provisionals)&&snapshot.provisionals.length<=100000,"Invalid physical arrays");
 const references=snapshot.references.map(cleanRef);
 const provisionals=snapshot.provisionals.map(cleanProvisional);
 // Explicit property allowlist: never copy stock_calculated, BC batches,
 // theoretical totals, difference, prices or nested source metadata.
 return {locationCode:location_code,locationStatus:location_status,references,provisionals};
}
