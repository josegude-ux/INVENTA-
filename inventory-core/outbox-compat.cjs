'use strict';
// VISURA INVENTA 07 — pure compatibility protocol. NO HTTP, storage or Supabase side effects.
// The existing inventa-count-outbox-v1:<uid> must NEVER be automatically rewritten.
const {calculateCount}=require('./counting.cjs');
const OPERATIONS=new Set(['save-draft','confirm-draft','stage-correction','confirm-correction']);
const REASONS=new Set(['initial_count_error','packaging_error','incomplete_box','double_count','other']);
const REQUIRED_CAPABILITIES=['authenticatedSessions','atomicVersions','idempotentMutations',
  'lotPreserved','reviewBeforeConfirm','originalTeamEnforced','permissionEnforced'];
function required(value,label){
 if(typeof value!=='string'||!value.trim())throw Error(label+' obligatorio.');
 return value.trim();
}
function nonnegativeVersion(value,label){
 if(!Number.isSafeInteger(value)||value<0)throw Error(label+' inválida.');
 return value;
}
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  const out={};for(const k of Object.keys(value).sort())out[k]=canonical(value[k]);return out;
 }
 return value;
}
function clone(value){return JSON.parse(JSON.stringify(value));}
function same(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function auditLegacyQueue({userId,rows}){
 const owner=required(userId,'Propietario de cola');
 if(!Array.isArray(rows))throw Error('La cola heredada está dañada; conservar sus bytes y avisar a Administración.');
 const ids=new Map();const duplicates=[];const conflicts=[];
 for(let i=0;i<rows.length;i++){
  const item=rows[i],body=item&&item.body;
  if(!body||typeof body!=='object'||Array.isArray(body)
   ||body.actor_id!==owner
   ||typeof body.client_mutation_id!=='string'||!body.client_mutation_id
   ||!body.campaign_id||!body.location_code||!body.product_code
   ||!Number.isFinite(Number(body.quantity))||Number(body.quantity)<0){
    throw Error('Cola heredada: propietario o registro no verificable. No modificar ni descartar entradas.');
  }
  const key=body.client_mutation_id;
  if(ids.has(key)){
   const first=ids.get(key);
   if(same(first.body,body))duplicates.push({first:first.index,second:i});
   else conflicts.push({first:first.index,second:i});
  }else ids.set(key,{index:i,body});
 }
 return {storageKey:'inventa-count-outbox-v1:'+owner,action:'preserve-in-place',
  total:rows.length,uniqueMutationIds:ids.size,duplicates,conflicts,
  mayAutoConvert:false,mayAutoDiscard:false};
}
function newV2Mutation({accountId,mutationId,createdAt,campaignId,locationCode,
 productCode,lot='',operation,expectedRevision,input,reviewRevision,
 reason,explanation,declaredAuthorId}){
 const actor=required(accountId,'Cuenta propietaria');
 const id=required(mutationId,'Clave de mutación');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  throw Error('Clave de mutación UUID inválida.');
 const date=required(createdAt,'Fecha de creación');
 if(!Number.isFinite(Date.parse(date)))throw Error('Fecha de creación inválida.');
 const op=required(operation,'Operación');
 if(!OPERATIONS.has(op))throw Error('Operación del nuevo protocolo desconocida.');
 const req={campaignId:required(campaignId,'Campaña'),
  locationCode:required(locationCode,'Ubicación'),
  productCode:required(productCode,'Referencia'),
  lot:typeof lot==='string'?lot:required(lot,'Lote'),
  operation:op,expectedRevision:nonnegativeVersion(expectedRevision,'Versión esperada')};
 if(op==='save-draft'||op==='stage-correction'){
  const count=calculateCount(input);
  if(count.status!=='ready')throw Error('Se exige cantidad física explícita antes de enviar.');
  req.quantity=count.quantity;
  req.explicitZero=count.explicitZero;
  req.breakdown=clone(count.breakdown);
  if(op==='stage-correction'){
   if(!REASONS.has(reason))throw Error('Motivo de corrección obligatorio.');
   if(reason==='other'&&!String(explanation||'').trim())throw Error('Explicación obligatoria para «Otros».');
   req.reason=reason;
   req.explanation=reason==='other'?explanation.trim():null;
   req.declaredAuthorId=required(declaredAuthorId,'Autor declarado');
  }
 }else{
  req.reviewRevision=nonnegativeVersion(reviewRevision,'Versión revisada');
  if(req.reviewRevision!==req.expectedRevision)throw Error('La revisión ha caducado.');
  if(input!==undefined)throw Error('No se permite reemplazar cantidades al confirmar la revisión.');
 }
 return {schema:'visura-count-v2-outbox',storageKey:'inventa-reference-outbox-v2:'+actor,
  ownerUserId:actor,mutationId:id,createdAt:date,request:req};
}
function queueV2(existing,item){
 if(!Array.isArray(existing))throw Error('Cola V2 dañada; conservar y revisar.');
 if(!item||item.schema!=='visura-count-v2-outbox'||!item.mutationId)
  throw Error('Mutación V2 inválida.');
 const next=clone(existing);
 for(const older of next){
  if(older.mutationId===item.mutationId){
   if(!same(older,item))throw Error('Conflicto de clave idempotente; la cola se conserva.');
   return next;
  }
  if(older.ownerUserId!==item.ownerUserId)
   throw Error('Cuentas distintas mezcladas en la cola. Envío bloqueado.');
 }
 next.push(clone(item));
 return next;
}
function sendPlan({queue,authenticatedUserId,authenticated,capabilities,legacyPending=0}){
 if(!Array.isArray(queue))throw Error('Cola V2 dañada; no sincronizar.');
 if(!queue.length)return {action:'idle'};
 if(authenticated!==true || !authenticatedUserId)return {action:'hold',reason:'session-unavailable'};
 const job=queue[0];
 if(job?.schema!=='visura-count-v2-outbox'||job.ownerUserId!==authenticatedUserId)
  return {action:'hold',reason:'account-mismatch'};
 if(!Number.isSafeInteger(legacyPending)||legacyPending<0)
  return {action:'hold',reason:'legacy-queue-unchecked'};
 // Do not reorder outstanding historic operations during a migration.
 if(legacyPending>0)return {action:'hold',reason:'legacy-queue-not-drained'};
 if(capabilities?.protocol!=='visura-count-v2'||capabilities.source!=='authenticated-backend')
  return {action:'hold',reason:'server-protocol-unverified'};
 if(REQUIRED_CAPABILITIES.some(x=>capabilities[x]!==true))
  return {action:'hold',reason:'server-capability-incomplete'};
 // This plan is NOT authorization: each actual RPC must recheck JWT, session,
 // role, team, assignment, campaign and CAS inside the PostgreSQL transaction.
 return {action:'submit-v2-only',mutationId:job.mutationId,ownerUserId:job.ownerUserId,
  request:clone(job.request)};
}
function acknowledgeV2(queue,receipt,{trustedAuthenticatedResponse=false}={}){
 if(!Array.isArray(queue)||!queue.length)throw Error('No existe mutación pendiente.');
 const first=queue[0];
 if(trustedAuthenticatedResponse!==true
  ||receipt?.protocol!=='visura-count-v2'
  ||receipt?.status!=='committed'
  ||receipt?.mutationId!==first.mutationId
  ||receipt?.ownerUserId!==first.ownerUserId
  ||!same(receipt?.request,first.request)
  ||!Number.isSafeInteger(receipt?.serverRevision)||receipt.serverRevision<0){
  throw Error('Acuse no verificado: conservar mutación local, no eliminar.');
 }
 return clone(queue.slice(1));
}
function failurePolicy(error){
 if(error?.status===409)return {action:'hold',reason:'conflict-preserve',retrySameMutationId:false};
 if(error?.status===401||error?.status===403)return {action:'hold',reason:'authentication-or-permission',retrySameMutationId:false};
 return {action:'retry-later',reason:'unconfirmed-server-write',retrySameMutationId:true};
}
module.exports={auditLegacyQueue,newV2Mutation,queueV2,sendPlan,acknowledgeV2,failurePolicy};
