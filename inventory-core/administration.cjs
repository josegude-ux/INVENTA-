'use strict';
// Pure validation only; server must repeat all checks in a single authorized transaction.
function verifiedDoubleScan(reads) {
  if(!Array.isArray(reads)||reads.length!==2)throw Error('Se requieren exactamente dos lecturas.');
  const [a,b]=reads;
  if(!a||!b||a.source!=='scanner'||b.source!=='scanner'||typeof a.code!=='string'||typeof b.code!=='string')throw Error('Ambas lecturas deben proceder del escáner.');
  if(!a.eventId||!b.eventId||a.eventId===b.eventId)throw Error('Se requieren dos eventos independientes de lectura.');
  if(a.code===''||b.code===''||a.code!==b.code)throw Error('Los códigos no coinciden exactamente.');
  return {barcode:a.code,scanEvents:[a.eventId,b.eventId]};
}
function validateAlternateBarcode({barcode,productCode,official=[],activeAlternates=[]}){
  if(typeof barcode!=='string'||barcode.length===0||typeof productCode!=='string'||productCode.length===0)throw Error('Código y referencia oficial obligatorios.');
  for(const item of [...official,...activeAlternates]){
    if(item.barcode===barcode && item.productCode!==productCode)throw Error('Código ya asociado a otra referencia; requiere resolución administrativa.');
  }
  return {allowed:true,barcode,productCode};
}
function campaignClosureReview({locations=[],pendingProvisionals=0,blockingIncidents=0,differencesAccepted=false}={}){
  if(!Array.isArray(locations)||!Number.isSafeInteger(pendingProvisionals)||pendingProvisionals<0||!Number.isSafeInteger(blockingIncidents)||blockingIncidents<0)throw Error('Resumen de campaña inválido.');
  const errors=[];
  if(locations.length===0)errors.push('No constan ubicaciones de la campaña.');
  if(locations.some(x=>!x.assigned))errors.push('Existen ubicaciones sin asignar.');
  if(locations.some(x=>x.status!=='finished'))errors.push('Existen ubicaciones sin finalizar.');
  if(locations.some(x=>x.confirmedAll!==true))errors.push('Existen recuentos requeridos sin confirmar.');
  if(locations.some(x=>x.segmentComplete!==true))errors.push('Existen tramos sin completar.');
  if(locations.some(x=>x.aisleComplete!==true))errors.push('Existen pasillos sin completar.');
  if(pendingProvisionals>0)errors.push('Existen productos provisionales pendientes de validación.');
  if(blockingIncidents>0)errors.push('Existen incidencias administrativas bloqueantes.');
  if(differencesAccepted!==true)errors.push('Falta la aceptación expresa del resumen de diferencias.');
  return {eligible:errors.length===0,blockers:errors};
}
module.exports={verifiedDoubleScan,validateAlternateBarcode,campaignClosureReview};
