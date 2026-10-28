/* VISURA INVENTA 08 — motor PURO: solo datos certificados por backend.
 * Sin red, credenciales, tablas, recuentos físicos ni escrituras. */
export const ESTADOS=Object.freeze({CERO:"CERO",NEGATIVO:"NEGATIVO",POSITIVO:"POSITIVO",SIN_DATOS:"SIN DATOS",NO_FIABLE:"NO FIABLE"});
const natural=new Intl.Collator("es",{numeric:true,sensitivity:"base"});
const key=(...v)=>JSON.stringify(v);
const txt=v=>String(v??"").trim();
function decimal(v){
 const s=txt(v);
 if(s.length>100)throw Error("Cantidad BC fuera de límites de seguridad");
 if(!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s))throw Error("Cantidad BC decimal inválida");
 const negative=s[0]==="-",unsigned=s.replace(/^[+-]/,""),parts=unsigned.split(".");
 return {n:BigInt((negative?"-":"")+(parts[0]+(parts[1]||""))),scale:(parts[1]||"").length};
}
function add(a,b){
 if(!a)return b;
 const s=Math.max(a.scale,b.scale);
 return {n:a.n*10n**BigInt(s-a.scale)+b.n*10n**BigInt(s-b.scale),scale:s};
}
function decimalText(x){
 if(!x)return null;
 const negative=x.n<0n;let s=(negative?-x.n:x.n).toString().padStart(x.scale+1,"0");
 if(x.scale)s=s.slice(0,-x.scale)+"."+s.slice(-x.scale).replace(/0+$/,"");
 if(s.endsWith("."))s=s.slice(0,-1);
 return (negative?"-":"")+s;
}
function checkSource(meta,products,locations,fixed,stock){
 const issues=[];
 const wh=txt(meta?.warehouse),batch=txt(meta?.publishedBatchId);
 if(!meta||!meta.verifiedByServer||!meta.authorized||!meta.stockComplete||
    !meta.positionsComplete||!meta.catalogComplete||!meta.locationsComplete||
    meta.truncated||meta.stale)
  issues.push("Origen sin certificación completa, autorizado y vigente");
 if(!wh||!batch||!txt(meta?.snapshotId)||!txt(meta?.sourceFile)||
    !txt(meta?.importedAt)||!txt(meta?.publishedAt))
  issues.push("Faltan ámbito, lote, instantánea o procedencia");
 if(!meta?.positionsVersion)issues.push("Falta versión coherente de asociaciones fijas");
 // Las cifras de control solo son válidas si el servidor las certificó.
 // Un reporte truncado o paginado no debe aparentar una suma total válida.
 for(const [field,length] of [["expectedStockRows",stock.length],
                               ["expectedProducts",products.length],
                               ["expectedLocations",locations.length]]){
  if(meta&&Object.prototype.hasOwnProperty.call(meta,field)&&
     (!Number.isSafeInteger(meta[field])||meta[field]<0||meta[field]!==length))
   issues.push("Control de integridad "+field+" no coincide con los registros recibidos");
 }
 const productUnits=new Map();
 for(const p of products){
  const code=txt(p?.code),unit=txt(p?.unit);
  if(!code||!unit||productUnits.has(code))
   issues.push("Maestro de artículos incompleto, duplicado o sin unidad");
  if(code)productUnits.set(code,unit);
 }
 const bins=new Set();
 for(const l of locations){
  const code=txt(l?.code),warehouse=txt(l?.warehouse),identity=key(warehouse,code);
  if(!code||!warehouse||warehouse!==wh||bins.has(identity))
   issues.push("Ubicación duplicada, sin identidad o ajena al almacén");
  bins.add(identity);
 }
 const activeFixed=fixed.filter(f=>f?.active===true&&txt(f?.warehouse)===wh);
 const fixedCount=activeFixed.length;
 for(const f of activeFixed){
  if(!productUnits.has(txt(f.product_code))||
     !bins.has(key(wh,txt(f.location_code))))
   issues.push("Posición fija sin artículo o ubicación del catálogo certificado");
 }
 if(meta&&Object.prototype.hasOwnProperty.call(meta,"expectedFixedRows")&&
    (!Number.isSafeInteger(meta.expectedFixedRows)||meta.expectedFixedRows<0||
      meta.expectedFixedRows!==fixedCount))
  issues.push("Control de integridad de posiciones activas incompleto");
 const stockKeys=new Set();
 for(const line of stock){
  const code=txt(line?.product_code);
  const stockKey=key(txt(line?.warehouse),txt(line?.importId),code,
                     txt(line?.location_code),txt(line?.lot));
  if(stockKeys.has(stockKey))
   issues.push("Línea BC duplicada por artículo, ubicación y lote");
  stockKeys.add(stockKey);
  if(txt(line?.warehouse)!==wh||txt(line?.importId)!==batch||
     !code||!txt(line?.location_code))
   issues.push("Línea BC sin ámbito, lote o artículo coherente");
  // Las cantidades tienen que recibirse como cadenas decimales canónicas:
  // convertir primero a Number puede perder precisión antes de acumular.
  if(typeof line?.quantity!=="string")
   issues.push("Cantidad BC no es texto decimal exacto");
  try{decimal(line?.quantity)}catch{issues.push("Cantidad BC inválida")}
  if(!productUnits.has(code))
   issues.push("Línea BC de artículo ausente del catálogo certificado");
  if(line?.unit!=null&&txt(line.unit)!==productUnits.get(code))
   issues.push("Unidad de stock distinta del artículo sin conversión certificada");
 }
 return [...new Set(issues)];
}
export function buildFixedStockReport({meta,products=[],locations=[],fixed=[],stock=[],filters={},generatedAt=new Date().toISOString()}={}){
 if(![products,locations,fixed,stock].every(Array.isArray))throw Error("Colecciones inválidas");
 const warehouse=txt(meta?.warehouse);
 const issues=checkSource(meta,products,locations,fixed,stock);
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
  if(txt(filters.code)&&!r.code.toLocaleLowerCase("es").includes(txt(filters.code).toLocaleLowerCase("es")))return false;
  if(txt(filters.description)&&!r.description.toLocaleLowerCase("es").includes(txt(filters.description).toLocaleLowerCase("es")))return false;
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
