'use strict';
// Pure proposal/confirmation lifecycle. Integration must enforce authorization,
// assignment versions, campaign state and append-only events transactionally.
const {calculateCount}=require('./counting.cjs');
function required(value,label){if(typeof value!=='string'||!value.trim())throw Error(label+' obligatorio.');return value;}
function copy(value){return JSON.parse(JSON.stringify(value));}
function version(state,expected){if(!Number.isSafeInteger(expected)||state.revision!==expected)throw Error('Conflicto de versión: vuelve a cargar el recuento.');}
function guard(state,ctx){
 if(!state || !ctx)throw Error('Contexto insuficiente.');
 if(ctx.campaignOpen!==true || ctx.locationOpen!==true || ctx.assignmentValid!==true)throw Error('Campaña, ubicación o asignación no autorizada.');
 required(ctx.authenticatedUserId,'Usuario autenticado');required(ctx.sessionId,'Sesión');
 if(!Array.isArray(ctx.participants)||ctx.participants.length<1||ctx.participants.length>2||new Set(ctx.participants).size!==ctx.participants.length||!ctx.participants.every(x=>typeof x==='string'&&x.trim()))throw Error('Participantes de recuento inválidos.');
 if(!ctx.participants.includes(ctx.authenticatedUserId))throw Error('La cuenta autenticada debe participar activamente.');
}
function baseState({campaignId,locationCode,productCode,lot=''}){
 required(campaignId,'Campaña');required(locationCode,'Ubicación');required(productCode,'Referencia');
 return {campaignId,locationCode,productCode,lot,revision:0,status:'uncounted',everStarted:false,draft:null,confirmed:null,correction:null,events:[]};
}
function saveDraft(state,input,ctx){
 guard(state,ctx);version(state,ctx.expectedRevision);
 if(state.status==='confirmed')throw Error('Una referencia confirmada solo admite corrección justificada.');
 const calc=calculateCount(input);
 const next=copy(state);
 next.revision++;
 next.draft=calc.status==='empty'?null:{input:copy(input),calculation:calc};
 next.status=next.draft?'draft':'uncounted';
 if(next.draft)next.everStarted=true;
 return next;
}
function reviewDraft(state){
 if(state?.status!=='draft'||state.draft?.calculation?.status!=='ready')throw Error('No hay borrador válido para confirmar.');
 const c=state.draft.calculation;
 return {campaignId:state.campaignId,locationCode:state.locationCode,productCode:state.productCode,lot:state.lot,reviewRevision:state.revision,quantity:c.quantity,explicitZero:c.explicitZero,breakdown:copy(c.breakdown)};
}
function eventMeta(ctx){
 required(ctx.eventId,'Identificador de operación');required(ctx.occurredAt,'Fecha de operación');
 return {eventId:ctx.eventId,at:ctx.occurredAt,authenticatedUserId:ctx.authenticatedUserId,sessionId:ctx.sessionId,participants:[...ctx.participants]};
}
function confirmDraft(state,ctx){
 guard(state,ctx);version(state,ctx.expectedRevision);
 if(ctx.reviewRevision!==state.revision)throw Error('La revisión ha caducado; vuelve a comprobar cantidades.');
 const summary=reviewDraft(state),meta=eventMeta(ctx);
 if(state.events.some(e=>e.eventId===meta.eventId))throw Error('Identificador de operación repetido.');
 const next=copy(state);
 next.revision++;
 next.status='confirmed';next.draft=null;
 next.confirmed={quantity:summary.quantity,explicitZero:summary.explicitZero,breakdown:summary.breakdown,revision:next.revision};
 next.events.push({kind:'confirmed',...meta,newValue:copy(next.confirmed)});
 return next;
}
const REASONS=new Set(['initial_count_error','packaging_error','incomplete_box','double_count','other']);
function reasonFields({reason,explanation}){
 if(!REASONS.has(reason))throw Error('Motivo de corrección obligatorio.');
 if(reason==='other' && (typeof explanation!=='string'||!explanation.trim()))throw Error('Explica el motivo «Otros».');
 return {reason,explanation:reason==='other'?explanation.trim():null};
}
function stageCorrection(state,input,ctx){
 guard(state,ctx);version(state,ctx.expectedRevision);
 if(state.status!=='confirmed')throw Error('Solo se corrige una referencia confirmada.');
 if(state.correction)throw Error('Ya existe una corrección pendiente de revisión.');
 const cause=reasonFields(ctx);
 const author=required(ctx.declaredAuthorId,'Autor declarado');
 if(!ctx.participants.includes(author))throw Error('Autor no participante activo.');
 const calc=calculateCount(input);
 if(calc.status!=='ready')throw Error('La corrección requiere cantidad física explícita.');
 if(calc.quantity===state.confirmed.quantity && JSON.stringify(calc.breakdown)===JSON.stringify(state.confirmed.breakdown)&&calc.explicitZero===state.confirmed.explicitZero)throw Error('No existen cambios que corregir.');
 const next=copy(state);next.revision++;
 next.correction={input:copy(input),calculation:calc,declaredAuthorId:author,...cause,baseConfirmedRevision:state.confirmed.revision};
 return next;
}
function reviewCorrection(state){
 if(state?.status!=='confirmed'||!state.correction)throw Error('No hay corrección para revisar.');
 const c=state.correction;
 return {campaignId:state.campaignId,locationCode:state.locationCode,productCode:state.productCode,lot:state.lot,reviewRevision:state.revision,previous:copy(state.confirmed),proposed:{quantity:c.calculation.quantity,explicitZero:c.calculation.explicitZero,breakdown:copy(c.calculation.breakdown)},declaredAuthorId:c.declaredAuthorId,reason:c.reason,explanation:c.explanation};
}
function confirmCorrection(state,ctx){
 guard(state,ctx);version(state,ctx.expectedRevision);
 if(ctx.reviewRevision!==state.revision)throw Error('La revisión ha caducado; vuelve a comprobar cantidades.');
 const review=reviewCorrection(state),meta=eventMeta(ctx);
 if(state.events.some(e=>e.eventId===meta.eventId))throw Error('Identificador de operación repetido.');
 if(!ctx.participants.includes(review.declaredAuthorId))throw Error('El autor declarado ya no participa; se requiere nueva revisión.');
 const next=copy(state);
 next.revision++;next.correction=null;
 next.confirmed={...review.proposed,revision:next.revision};
 next.events.push({kind:'corrected',...meta,declaredAuthorId:review.declaredAuthorId,reason:review.reason,explanation:review.explanation,previous:review.previous,newValue:copy(next.confirmed)});
 return next;
}
module.exports={baseState,saveDraft,reviewDraft,confirmDraft,stageCorrection,reviewCorrection,confirmCorrection};
