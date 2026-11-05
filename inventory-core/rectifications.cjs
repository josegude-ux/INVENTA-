'use strict';
// Pure immutable campaign results / rectification reports. Not connected to Supabase or BC.
function required(v,label){if(typeof v!=='string'||!v.trim())throw Error(label+' obligatorio.');return v;}
function clone(v){return JSON.parse(JSON.stringify(v));}
function quantity(v){
 const s=String(v).trim();if(!/^[0-9]+(?:[.,][0-9]{1,3})?$/.test(s))throw Error('Cantidad inválida; máximo tres decimales.');
 const [w,f='']=s.replace(',','.').split('.');const n=BigInt(w)*1000n+BigInt((f+'000').slice(0,3));
 if(n>9999999999999999n)throw Error('Cantidad fuera de rango.');
 const decimal=String(n%1000n).padStart(3,'0').replace(/0+$/,'');return String(n/1000n)+(decimal?'.'+decimal:'');
}
function key(row){return JSON.stringify([required(row.locationCode,'Ubicación'),required(row.productCode,'Referencia'),row.lot||'']);}
function closeOriginal({campaignId,closureId,closedAt,closedBy,physicalComplete,administrativeReviewed,rows}){
 required(campaignId,'Campaña');required(closureId,'Identificador de cierre');required(closedAt,'Fecha');required(closedBy,'Administrador');
 if(physicalComplete!==true||administrativeReviewed!==true)throw Error('No se ha validado el cierre físico y administrativo.');
 if(!Array.isArray(rows)||!rows.length)throw Error('El cierre necesita líneas de inventario.');
 const used=new Set(),out=rows.map(row=>{
  const k=key(row);if(used.has(k))throw Error('Referencia duplicada en la misma ubicación y lote.');used.add(k);
  if(row.confirmed!==true)throw Error('Existe una referencia sin confirmar.');
  return {locationCode:row.locationCode,productCode:row.productCode,lot:row.lot||'',quantity:quantity(row.quantity)};
 });
 return {campaignId,closureId,closedAt,closedBy,rows:out};
}
function createCase({caseId,original,locationCode,productCode,lot='',expectedQuantity,newQuantity,reason,evidence=null,openedBy,openedAt}){
 required(caseId,'Expediente');required(openedBy,'Responsable');required(openedAt,'Fecha');required(reason,'Motivo');
 if(!original||!original.closureId)throw Error('Se requiere cierre original válido.');
 const k=key({locationCode,productCode,lot});const row=original.rows.find(x=>key(x)===k);
 if(!row)throw Error('La referencia no existe en el inventario original.');
 const before=quantity(expectedQuantity),after=quantity(newQuantity);
 if(before===after)throw Error('La propuesta no modifica la cantidad.');
 return {caseId,campaignId:original.campaignId,closureId:original.closureId,locationCode,productCode,lot,expectedQuantity:before,newQuantity:after,reason,evidence,status:'pending',history:[{action:'opened',by:openedBy,at:openedAt}]};
}
function decideCase(record,{decision,administratorId,at,decisionId,comment=null}){
 if(!record||record.status!=='pending')throw Error('El expediente no está pendiente.');
 if(!['approved','rejected'].includes(decision))throw Error('Decisión inválida.');
 required(administratorId,'Administrador');required(at,'Fecha');required(decisionId,'Identificador de decisión');
 const next=clone(record);next.status=decision;
 next.history.push({action:decision,by:administratorId,at,decisionId,comment});
 return next;
}
function publishReport({original,cases,previousReports=[],reportId,publishedBy,publishedAt}){
 required(reportId,'Informe');required(publishedBy,'Administrador');required(publishedAt,'Fecha');
 if(!original||!Array.isArray(cases)||!Array.isArray(previousReports))throw Error('Datos de informe incorrectos.');
 const latest=previousReports.at(-1);
 const version=(latest?.version||0)+1;
 if(previousReports.some((r,i)=>r.version!==i+1||r.closureId!==original.closureId))throw Error('Historial de versiones no correlativo.');
 if(previousReports.some(r=>r.reportId===reportId))throw Error('Informe ya emitido.');
 const previouslyIncluded=new Set(latest?.includedCaseIds||[]);
 const alreadyApproved=cases.filter(c=>c.status==='approved');
 const newCases=alreadyApproved.filter(c=>!previouslyIncluded.has(c.caseId))
  .sort((a,b)=>a.history.at(-1).at.localeCompare(b.history.at(-1).at)||a.caseId.localeCompare(b.caseId));
 if(!newCases.length)throw Error('No hay rectificaciones nuevas aprobadas para publicar.');
 const base=clone(latest?.rows||original.rows),positions=new Map(base.map((r,i)=>[key(r),i]));
 const caseIds=new Set(previouslyIncluded);
 for(const c of newCases){
  if(c.closureId!==original.closureId||c.campaignId!==original.campaignId)throw Error('Expediente de otra campaña.');
  if(caseIds.has(c.caseId))throw Error('Expediente duplicado.');
  const pos=positions.get(key(c));if(pos===undefined)throw Error('Referencia original no encontrada.');
  if(base[pos].quantity!==quantity(c.expectedQuantity))throw Error('Conflicto: cantidad de partida del expediente ya no es la vigente.');
  base[pos].quantity=quantity(c.newQuantity);caseIds.add(c.caseId);
 }
 return {reportId,campaignId:original.campaignId,closureId:original.closureId,version,publishedAt,publishedBy,rows:base,includedCaseIds:[...caseIds],newCaseIds:newCases.map(c=>c.caseId)};
}
module.exports={closeOriginal,createCase,decideCase,publishReport};
