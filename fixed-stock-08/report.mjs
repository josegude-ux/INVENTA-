/* VISURA INVENTA 08 — motor PURO: solo datos certificados por backend.
 * Sin red, credenciales, tablas, recuentos físicos ni escrituras. */
export const ESTADOS=Object.freeze({CERO:"CERO",NEGATIVO:"NEGATIVO",POSITIVO:"POSITIVO",SIN_DATOS:"SIN DATOS",NO_FIABLE:"NO FIABLE"});
const natural=new Intl.Collator("es",{numeric:true,sensitivity:"base"});
const key=(...v)=>JSON.stringify(v);
const txt=v=>String(v??"").trim();
function decimal(v){
 const s=txt(v);
 if(!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s))throw Error("Cantidad BC decimal inválida");
 const negative=s[0]==="-",unsigned=s.replace(/^[+-]/,""),parts=unsigned.split(".");
 return {n:BigInt((negative?"-":"")+(parts[0]+(parts[1]||""))),scale:(parts[1]||"").length};
}
function add(a,b){
 if(!a)return b;
 const s=Math.max(a.scale,b.scale);
 return {n:a.n*10n**BigInt(s-a.scale)+b.n*10n**BigInt(s-b.scale),scale:s};
}
function format(x){
 if(!x)return null;
 const neg=x.n<0n;
 let digits=(neg?-x.n:x.n).toString().padStart(x.scale+1,"0");
 if(x.scale)digits=digits.slice(0,-x.scale)+"."+digits.slice(-x.scale);
 digits=digits.replace(/\.?0+$/,""); // solo auxiliar, no usado en el contrato
 if(!digits||digits==="-")digits="0";
 return (neg?"-":"")+digits;
}
function decimalText(x){
 if(!x)return null;
 const negative=x.n<0n;let s=(negative?-x.n:x.n).toString().padStart(x.scale+1,"0");
 if(x.scale)s=s.slice(0,-x.scale)+"."+s.slice(-x.scale).replace(/0+$/,"");
 if(s.endsWith("."))s=s.slice(0,-1);
 return (negative?"-":"")+s;
}
function checkSource(meta,stock){
 const issues=[];
 if(!meta||!meta.verifiedByServer||!meta.authorized||!meta.stockComplete||!meta.positionsComplete||!meta.catalogComplete||!meta.locationsComplete||meta.truncated||meta.stale)issues.push("Origen sin certificación completa, autorizado y vigente");
 if(!txt(meta?.warehouse)||!txt(meta?.publishedBatchId)||!txt(meta?.snapshotId)||!txt(meta?.sourceFile)||!txt(meta?.importedAt)||!txt(meta?.publishedAt))issues.push("Faltan ámbito, lote, instantánea o procedencia");
 if(!meta?.positionsVersion)issues.push("Falta versión coherente de asociaciones fijas");
 for(const line of stock){
  if(txt(line.warehouse)!==txt(meta?.warehouse)||txt(line.importId)!==txt(meta?.publishedBatchId)||!txt(line.product_code)||!txt(line.location_code))issues.push("Línea BC sin ámbito, lote o artículo coherente");
  try{decimal(line.quantity)}catch{issues.push("Cantidad BC inválida");}
 }
 return [...new Set(issues)];
}
export function buildFixedStockReport({meta,products=[],locations=[],fixed=[],stock=[],filters={},generatedAt=new Date().toISOString()}={}){
 if(![products,locations,fixed,stock].every(Array.isArray))throw Error("Colecciones inválidas");
 const warehouse=txt(meta?.warehouse);
 const issues=checkSource(meta,stock);
 const catalog=new Map(products.map(p=>[txt(p.code),p]));
 const locationMap=new Map(locations.map(l=>[key(txt(l.warehouse),txt(l.code)),l]));
 const totals=new Map(),seen=new Set(),active=[];
 for(const line of stock){
  const code=txt(line.product_code);
  if(!code)continue;
  try{totals.set(code,add(totals.get(code),decimal(line.quantity)))}catch{/* issues globales ya comprobadas */}
 }
 for(const f of fixed){
  if(f.active!==true)continue;
  const code=txt(f.product_code),loc=txt(f.location_code),wh=txt(f.warehouse),pair=key(wh,code,loc);
  // Nunca devolver asociaciones de otro almacén, ni siquiera como NO FIABLE.
  // El origen es inconsistente: invalidar la fiabilidad del lote propio.
  if(wh!==warehouse){issues.push("Asociación fija activa de almacén ajeno a la instantánea");continue;}
  if(!code||!loc||seen.has(pair)||!txt(f.associationId))issues.push("Asociación fija activa ambigua, duplicada o sin identidad");
  seen.add(pair);active.push(f);
 }
 const consistency=[...new Set(issues)];
 const rows=active.map(f=>{
  const code=txt(f.product_code),location=txt(f.location_code);
  const product=catalog.get(code),loc=locationMap.get(key(warehouse,location));
  const value=totals.get(code);
  let state,quantity=null;
  if(consistency.length||!product||!loc)state=ESTADOS.NO_FIABLE;
  else if(!value&&!meta.absentStockIsZero)state=ESTADOS.SIN_DATOS;
  else{
   const n=value?.n??0n;
   state=n<0n?ESTADOS.NEGATIVO:n>0n?ESTADOS.POSITIVO:ESTADOS.CERO;
   quantity=value?decimalText(value):"0";
  }
  return {associationId:f.associationId,warehouse,aisle:txt(loc?.aisle),location,code,
   description:txt(product?.description),unit:txt(product?.unit),quantity,state,
   sourceFile:txt(meta?.sourceFile),sourceExportedAt:meta?.exportedAt||null,
   importedAt:meta?.importedAt||null,publishedAt:meta?.publishedAt||null,
   batchId:meta?.publishedBatchId||null,reason:consistency.join("; ")||(!product||!loc?"Maestro o ubicación sin correspondencia":"")};
 });
 const query=txt(filters.search).toLocaleLowerCase("es");
 const display=rows.filter(r=>{
  const states=filters.view==="all"?null:filters.view==="unreliable"?[ESTADOS.SIN_DATOS,ESTADOS.NO_FIABLE]:[ESTADOS.CERO,ESTADOS.NEGATIVO];
  if(states&&!states.includes(r.state))return false;
  if(txt(filters.aisle)&&r.aisle!==txt(filters.aisle))return false;
  if(txt(filters.location)&&r.location!==txt(filters.location))return false;
  if(txt(filters.code)&&r.code!==txt(filters.code))return false;
  if(txt(filters.state)&&r.state!==txt(filters.state))return false;
  if(query&&![r.code,r.description,r.location,r.aisle].some(v=>v.toLocaleLowerCase("es").includes(query)))return false;
  return true;
 }).sort((a,b)=>natural.compare(a.aisle,b.aisle)||natural.compare(a.location,b.location)||natural.compare(a.code,b.code));
 const unique=state=>new Set(display.filter(r=>r.state===state).map(r=>r.code)).size;
 return {warehouse,meta:{...meta,generatedAt},issues:consistency,rows:display,
  indicators:{zeroReferences:unique(ESTADOS.CERO),negativeReferences:unique(ESTADOS.NEGATIVO),
   affectedAssociations:display.filter(r=>[ESTADOS.CERO,ESTADOS.NEGATIVO].includes(r.state)).length,
   affectedPositions:new Set(display.filter(r=>[ESTADOS.CERO,ESTADOS.NEGATIVO].includes(r.state)).map(r=>r.location)).size,
   unreliableAssociations:rows.filter(r=>[ESTADOS.SIN_DATOS,ESTADOS.NO_FIABLE].includes(r.state)).length}};
}
