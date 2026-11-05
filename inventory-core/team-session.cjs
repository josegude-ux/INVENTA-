'use strict';
// Team identities and attribution. A user selection is NOT authentication.
// Backend must verify real JWT/session, live assignment and single-device lease.
function required(x,name){if(typeof x!=='string'||!x.trim())throw Error(name+' obligatorio.');return x;}
function copy(x){return JSON.parse(JSON.stringify(x));}
function membersValid(members){return Array.isArray(members)&&members.length>=1&&members.length<=2&&members.every(x=>typeof x==='string'&&x.trim())&&new Set(members).size===members.length;}
function startTeam({campaignId,locationCode,teamId,originalOperators,authenticatedUserId,sessionId,authorizedOperators,at,eventId}){
 required(campaignId,'Campaña');required(locationCode,'Ubicación');required(teamId,'Equipo');required(authenticatedUserId,'Cuenta autenticada');required(sessionId,'Sesión');required(at,'Fecha');required(eventId,'Evento');
 if(!membersValid(originalOperators))throw Error('Equipo original inválido; máximo dos personas distintas.');
 if(!originalOperators.includes(authenticatedUserId))throw Error('El usuario autenticado debe pertenecer al equipo original.');
 if(!Array.isArray(authorizedOperators)||!originalOperators.every(x=>authorizedOperators.includes(x)))throw Error('Ambos participantes deben estar asignados al tramo.');
 const members=[...originalOperators],mode=members.length===2?'pair':'individual';
 return {campaignId,locationCode,teamId,originalOperators:members,mode,activeParticipants:mode==='pair'?members:[authenticatedUserId],authenticatedUserId,sessionId,revision:0,events:[{eventId,at,type:'team-started',mode,authenticatedUserId,sessionId,participants:mode==='pair'?members:[authenticatedUserId]}]};
}
function switchMode(team,{mode,authenticatedUserId,sessionId,authorizedOperators,expectedRevision,at,eventId}){
 if(!team||!['pair','individual'].includes(mode))throw Error('Modalidad inválida.');
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==team.revision)throw Error('Conflicto de versión del equipo.');
 required(authenticatedUserId,'Cuenta autenticada');required(sessionId,'Sesión');required(at,'Fecha');required(eventId,'Evento');
 if(team.events.some(x=>x.eventId===eventId))throw Error('Evento de modalidad duplicado.');
 if(!team.originalOperators.includes(authenticatedUserId))throw Error('No se puede incorporar un tercer operario.');
 if(mode==='pair'&&team.originalOperators.length!==2)throw Error('No existe pareja original.');
 const participants=mode==='pair'?[...team.originalOperators]:[authenticatedUserId];
 if(!Array.isArray(authorizedOperators)||!participants.every(x=>authorizedOperators.includes(x)))throw Error('Un participante no tiene asignación vigente.');
 if(team.authenticatedUserId!==authenticatedUserId && team.sessionId===sessionId)throw Error('El relevo exige una sesión propia del compañero.');
 if(team.mode===mode&&team.authenticatedUserId===authenticatedUserId&&team.sessionId===sessionId)return copy(team);
 const next=copy(team);next.revision++;
 next.mode=mode;next.activeParticipants=participants;next.authenticatedUserId=authenticatedUserId;next.sessionId=sessionId;
 next.events.push({eventId,at,type:team.mode===mode?'session-changed':'mode-changed',previousMode:team.mode,mode,authenticatedUserId,sessionId,participants});
 return next;
}
function attribution(team,{declaredCorrectionAuthorId=null,forCorrection=false}={}){
 if(!team||!membersValid(team.activeParticipants)||!team.activeParticipants.includes(team.authenticatedUserId))throw Error('Equipo activo inválido.');
 if(forCorrection){
  if(team.mode==='pair'&&!declaredCorrectionAuthorId)throw Error('Selecciona cuál de los dos operarios corrigió la referencia.');
  const author=team.mode==='pair'?declaredCorrectionAuthorId:team.authenticatedUserId;
  if(!team.activeParticipants.includes(author))throw Error('Autor declarado fuera del equipo activo.');
  return {authenticatedUserId:team.authenticatedUserId,sessionId:team.sessionId,participants:[...team.activeParticipants],declaredAuthorId:author};
 }
 return {authenticatedUserId:team.authenticatedUserId,sessionId:team.sessionId,participants:[...team.activeParticipants]};
}
module.exports={startTeam,switchMode,attribution};
