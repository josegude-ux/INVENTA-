'use strict';
// VISURA INVENTA 07 - isolated pure physical closure model.
// Real permissions, count completeness, versions and idempotency need backend checks.
function check(x,what){if(typeof x!=='string'||!x.trim())throw Error(what+' obligatorio.');return x.trim();}
function copy(x){return JSON.parse(JSON.stringify(x));}
function version(n,what){if(!Number.isSafeInteger(n)||n<0)throw Error(what+' inválida.');return n;}
function physicalReview({references=[],provisionals=[],blockingPhysicalIncidents=0}={}){
 if(!Array.isArray(references)||!Array.isArray(provisionals)
  ||!Number.isSafeInteger(blockingPhysicalIncidents)||blockingPhysicalIncidents<0)
  throw Error('Inventario físico de ubicación incorrecto.');
 const all=[...references.map(x=>({...x,kind:'official'})),
  ...provisionals.map(x=>({...x,kind:'provisional'}))];
 const confirmed=all.filter(x=>{
  const status=x.kind==='official'?x.status:(x.physicalStatus??x.status);
  return status==='confirmed';
 });
 const pending=all.filter(x=>!confirmed.includes(x));
 const bad=confirmed.filter(x=>{
  const q=String(x.quantity??'');
  if(!/^[0-9]+(?:\.[0-9]{1,3})?$/.test(q))return true;
  if(Number(q)===0)return x.explicitZero!==true;
  return x.explicitZero===true;
 });
 const keys=new Set();
 for(const x of references){
  const key=JSON.stringify([x.productCode,x.lot??'']);
  if(!x.productCode||keys.has(key))throw Error('Referencias físicas duplicadas o sin código.');
  keys.add(key);
 }
 const provisionalKeys=new Set();
 for(const x of provisionals){
  if(!x.barcode||provisionalKeys.has(x.barcode))
   throw Error('Provisionales repetidos o sin código.');
  provisionalKeys.add(x.barcode);
 }
 const administrativePending=provisionals.filter(x=>x.status!=='resolved_duplicate'&&x.status!=='resolved').length;
 return {ready:confirmed.length>0&&pending.length===0&&bad.length===0&&blockingPhysicalIncidents===0,
  confirmed:confirmed.length,pending:pending.length,invalidQuantities:bad.length,
  blockingPhysicalIncidents,administrativePending,
  explicitZeros:confirmed.filter(x=>String(x.quantity)==='0'&&x.explicitZero===true).length,
  requiresEmptyLocationProcedure:all.length===0};
}
function baseLocation({campaignId,locationCode,teamId,countRevision=0}){
 check(campaignId,'Campaña');check(locationCode,'Ubicación');check(teamId,'Equipo');
 return {campaignId,locationCode,originalTeamId:teamId,status:'not_started',
  everStarted:false,revision:0,countRevision:version(countRevision,'Revisión física'),
  events:[]};
}
function reviewForClose(location,physical){
 if(!location||!['not_started','in_progress','finished'].includes(location.status))
  throw Error('Ubicación inválida.');
 return {...physicalReview(physical),
  campaignId:location.campaignId,locationCode:location.locationCode,
  originalTeamId:location.originalTeamId,
  reviewRevision:version(location.revision,'Revisión de ubicación'),
  reviewCountRevision:version(location.countRevision,'Revisión física')};
}
function registerCountRevision(location,{event,expectedRevision}){
 if(!location||location.status==='finished')throw Error('Ubicación cerrada; necesita reapertura autorizada.');
 if(!['quantity-entered','zero-marked','provisional-added','draft-cleared','confirmed'].includes(event))
  throw Error('Evento de recuento desconocido.');
 if(location.revision!==version(expectedRevision,'Revisión esperada'))
  throw Error('Conflicto de versión de ubicación.');
 const next=copy(location);next.revision++;next.countRevision++;
 if(event!=='draft-cleared'){
  next.everStarted=true;next.status='in_progress';
 }else if(next.everStarted)next.status='in_progress';
 return next;
}
function guard(location,ctx,action){
 if(!ctx||ctx.campaignOpen!==true||ctx.assignmentValid!==true
  ||ctx.teamLeaseValid!==true||ctx.originalTeamId!==location.originalTeamId)
  throw Error('Campaña, asignación o terminal no autorizado.');
 check(ctx.authenticatedUserId,'Cuenta autenticada');check(ctx.sessionId,'Sesión');
 check(ctx.mutationId,'Mutación');check(ctx.occurredAt,'Fecha de auditoría');
 if(version(ctx.expectedRevision,'Revisión esperada')!==location.revision)
  throw Error('Conflicto de versión de ubicación.');
 if(location.events.some(x=>x.mutationId===ctx.mutationId))
  throw Error('Identificador de operación duplicado.');
 if(action==='reopen'&&ctx.reopenAuthorized!==true)
  throw Error('Reapertura necesita autorización expresa.');
}
function manualFinish(location,physical,ctx){
 guard(location,ctx,'finish');
 if(location.status!=='in_progress'||!location.everStarted)
  throw Error('No se puede finalizar una ubicación sin inicio físico efectivo.');
 const review=reviewForClose(location,physical);
 if(ctx.reviewRevision!==review.reviewRevision
  ||ctx.reviewCountRevision!==review.reviewCountRevision)
  throw Error('La revisión física ha caducado.');
 if(!review.ready)throw Error('No se puede finalizar: hay recuentos físicos sin confirmar.');
 if(ctx.manualAccepted!==true)throw Error('La finalización manual requiere confirmación expresa.');
 const next=copy(location);next.revision++;next.status='finished';
 next.events.push({kind:'location-finished',mutationId:ctx.mutationId,at:ctx.occurredAt,
  authenticatedUserId:ctx.authenticatedUserId,sessionId:ctx.sessionId,
  originalTeamId:location.originalTeamId,
  physicalCountRevision:review.reviewCountRevision,
  confirmed:review.confirmed,explicitZeros:review.explicitZeros});
 return next;
}
function manualReopen(location,ctx){
 guard(location,ctx,'reopen');
 if(location.status!=='finished')throw Error('Solo se puede reabrir una ubicación finalizada.');
 const reason=check(ctx.reason,'Motivo de reapertura');
 const next=copy(location);next.revision++;next.status='in_progress';
 next.everStarted=true;
 next.events.push({kind:'location-reopened',mutationId:ctx.mutationId,at:ctx.occurredAt,
  authenticatedUserId:ctx.authenticatedUserId,sessionId:ctx.sessionId,
  reason,originalTeamId:location.originalTeamId});
 return next;
}
function hierarchy({orderedLocationCodes=[],segments=[],locations=[]}={}){
 if(!Array.isArray(orderedLocationCodes)||!Array.isArray(segments)||!Array.isArray(locations))
  throw Error('Datos de pasillo, tramos y ubicaciones inválidos.');
 const codes=orderedLocationCodes.map(x=>check(x,'Código de ubicación'));
 if(new Set(codes).size!==codes.length)throw Error('Catálogo de ubicaciones duplicado.');
 const states=new Map();
 for(const x of locations){
  if(!x||!codes.includes(x.locationCode)||states.has(x.locationCode))
   throw Error('Ubicación inexistente o duplicada.');
  states.set(x.locationCode,x);
 }
 const covered=new Map();const summaries=[];
 for(const segment of segments){
  const team=check(segment.teamId,'Equipo del tramo');
  const a=codes.indexOf(segment.from),b=codes.indexOf(segment.to);
  if(a<0||b<0||a>b)throw Error('Tramo no contiguo o límites inexistentes.');
  const members=codes.slice(a,b+1);
  for(const code of members){
   if(covered.has(code))throw Error('Tramos solapados.');
   covered.set(code,team);
   const x=states.get(code);
   if(x&&x.originalTeamId!==team)throw Error('Equipo original de ubicación no coincide.');
  }
  const finished=members.filter(code=>states.get(code)?.status==='finished');
  summaries.push({teamId:team,from:segment.from,to:segment.to,
   total:members.length,finished:finished.length,
   completed:finished.length===members.length});
 }
 const missing=codes.filter(code=>!covered.has(code)||!states.has(code));
 const completed=codes.length>0&&missing.length===0&&summaries.length>0
  &&summaries.every(x=>x.completed);
 return {segments:summaries,aisle:{total:codes.length,
  finished:codes.filter(code=>states.get(code)?.status==='finished').length,
  missing,completed}};
}
module.exports={physicalReview,baseLocation,reviewForClose,registerCountRevision,
 manualFinish,manualReopen,hierarchy};
