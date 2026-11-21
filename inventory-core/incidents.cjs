'use strict';
// VISURA INVENTA 07 — pure incident domain model, no persistence or permissions.
// Back-end must independently verify admin identity and real correction records.
const {calculateCount}=require('./counting.cjs');
const TYPES=new Set(['illegible-code','used-alias-misattribution','other-physical-incident']);
function requiredText(value,label){
 if(typeof value!=='string'||!value.trim())throw Error(label+' obligatorio.');
 return value.trim();
}
function clone(value){return JSON.parse(JSON.stringify(value));}
function metadata(meta){
 if(!meta||typeof meta!=='object')throw Error('Datos de operación ausentes.');
 return {eventId:requiredText(meta.eventId,'Evento'),
  at:requiredText(meta.at,'Fecha'),
  authenticatedUserId:requiredText(meta.authenticatedUserId,'Operario autenticado')};
}
function createIncident(input,ctx){
 if(!input||typeof input!=='object')throw Error('Incidencia inválida.');
 const m=metadata(ctx);
 const type=requiredText(input.type,'Tipo de incidencia');
 if(!TYPES.has(type))throw Error('Tipo de incidencia desconocido.');
 const campaignId=requiredText(input.campaignId,'Campaña');
 const locationCode=requiredText(input.locationCode,'Ubicación');
 const id=requiredText(input.incidentId,'Identificador de incidencia');
 const description=requiredText(input.description,'Descripción de la incidencia');
 const photoKey=input.photoKey==null?null:requiredText(input.photoKey,'Foto');
 const affectedCountIds=input.affectedCountIds??[];
 if(!Array.isArray(affectedCountIds)||affectedCountIds.some(x=>typeof x!=='string'||!x.trim())
   ||new Set(affectedCountIds).size!==affectedCountIds.length)
   throw Error('Referencias de recuentos afectados incorrectas.');
 if(type==='used-alias-misattribution'&&affectedCountIds.length===0)
   throw Error('La incidencia de código alternativo requiere uso real comprobado.');
 if(type!=='used-alias-misattribution'&&affectedCountIds.length>0)
   throw Error('No se asocian recuentos históricos a este tipo de incidencia.');
 const evidence=input.physicalEvidence==null?null:calculateCount(input.physicalEvidence);
 if(type==='illegible-code' && (!evidence || evidence.status!=='ready'))
   throw Error('El código ilegible requiere conservar el recuento físico, incluso cero expreso.');
 if(evidence&&evidence.status!=='ready')throw Error('Cantidad de evidencia incompleta.');
 return {id,campaignId,locationCode,type,description,photoKey,affectedCountIds:[...affectedCountIds],
  physicalEvidence:evidence,status:'open',revision:0,
  events:[{kind:'opened',...m,description,photoKey,affectedCountIds:[...affectedCountIds],
    physicalEvidence:clone(evidence)}]};
}
function guardAdmin(state,ctx){
 if(!state||!ctx||ctx.isAdmin!==true)throw Error('Resolución reservada a Administración.');
 const m=metadata(ctx);
 if(!Number.isSafeInteger(ctx.expectedRevision)||ctx.expectedRevision!==state.revision)
   throw Error('Conflicto de versión de incidencia.');
 if(state.events.some(x=>x.eventId===m.eventId))throw Error('Evento duplicado.');
 return m;
}
function decideIncident(state,decision,ctx){
 const m=guardAdmin(state,ctx);
 if(state.status!=='open')throw Error('Solo se puede revisar una incidencia abierta.');
 const reason=requiredText(decision?.reason,'Motivo de la decisión');
 if(!['resolved','manual-correction-required'].includes(decision?.action))
   throw Error('Resolución de incidencia inválida.');
 const next=clone(state);next.revision++;
 next.status=decision.action==='resolved'?'resolved':'awaiting_correction';
 next.events.push({kind:'reviewed',...m,action:decision.action,reason});
 return next;
}
function completeCorrectedIncident(state,ctx){
 const m=guardAdmin(state,ctx);
 if(state.status!=='awaiting_correction')throw Error('No hay corrección administrativa pendiente.');
 const correctionEventId=requiredText(ctx.correctionEventId,'Corrección verificada');
 const next=clone(state);next.revision++;next.status='resolved';
 next.events.push({kind:'correction-verified',...m,correctionEventId});
 return next;
}
function summarizeIncidents(incidents){
 if(!Array.isArray(incidents))throw Error('Listado de incidencias inválido.');
 for(const item of incidents){
  if(!item||!['open','awaiting_correction','resolved'].includes(item.status))
    throw Error('Estado de incidencia inválido.');
 }
 return {blockingIncidents:incidents.filter(x=>x.status!=='resolved').length,
  open:incidents.filter(x=>x.status==='open').length,
  awaitingCorrection:incidents.filter(x=>x.status==='awaiting_correction').length,
  resolved:incidents.filter(x=>x.status==='resolved').length};
}
module.exports={createIncident,decideIncident,completeCorrectedIncident,summarizeIncidents};
