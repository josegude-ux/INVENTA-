'use strict';
// Pure guards only. All critical permissions/atomic changes MUST also be enforced by the backend.
const EFFECTIVE = new Set(['quantity-entered','zero-marked','provisional-added']);
function advanceLocation(current, event, opts={}) {
  const state={status:current?.status||'not_started',everStarted:!!current?.everStarted};
  const campaign=opts.campaignStatus||'open';
  if (!['not_started','in_progress','finished'].includes(state.status)) throw new Error('Estado de ubicación desconocido.');
  if (!['open','lookup','quantity-entered','zero-marked','provisional-added','clear-draft','finish','reopen'].includes(event)) throw new Error('Evento desconocido.');
  if (event==='open'||event==='lookup') return state; // opening/scanning is not counting
  if (campaign!=='open') throw new Error('No se puede modificar una ubicación fuera de campaña abierta.');
  if (event==='reopen') {
    if(state.status!=='finished')throw new Error('Solo se puede reabrir una ubicación finalizada.');
    return {status:'in_progress',everStarted:true};
  }
  if (state.status==='finished') throw new Error('La ubicación está finalizada; necesita reapertura autorizada.');
  if (event==='finish') {
    if (opts.ready!==true) throw new Error('No se puede finalizar: hay referencias sin confirmar o incidencias del recuento.');
    return {status:'finished',everStarted:state.everStarted};
  }
  if (EFFECTIVE.has(event))return {status:'in_progress',everStarted:true};
  // Clearing a draft does not revert a previously started location.
  return {status:state.everStarted?'in_progress':'not_started',everStarted:state.everStarted};
}
function reviewLocation({knownReferences=[],provisionals=[]}={}) {
  if (!Array.isArray(knownReferences)||!Array.isArray(provisionals)) throw new Error('Listas de recuento inválidas.');
  const pending=[...knownReferences,...provisionals].filter(x=>x?.status!=='confirmed');
  const confirmed=[...knownReferences,...provisionals].filter(x=>x?.status==='confirmed');
  const zeros=confirmed.filter(x=>x.explicitZero===true && String(x.quantity)==='0');
  return {ready:pending.length===0,confirmed:confirmed.length,zeros:zeros.length,pending:pending.length,provisionals:provisionals.length};
}
function validateContiguousAssignments({orderedLocationCodes,segments,authorizedByOperator={},originalOwners={},startedCodes=[]}) {
  if (!Array.isArray(orderedLocationCodes)||!Array.isArray(segments)) throw new Error('Ubicaciones o tramos incorrectos.');
  const codes=orderedLocationCodes.map(String);
  if(new Set(codes).size!==codes.length)throw new Error('El catálogo de ubicaciones tiene códigos repetidos.');
  const positions=new Map(codes.map((code,index)=>[code,index]));
  const owners=new Map();
  const started=new Set(startedCodes);
  for (const seg of segments){
    if(!seg || !seg.teamId || !positions.has(seg.from)||!positions.has(seg.to)) throw new Error('Tramo con equipo o límites inexistentes.');
    const first=positions.get(seg.from),last=positions.get(seg.to);
    if(last<first)throw new Error(`Tramo invertido: ${seg.from}–${seg.to}.`);
    if(!Array.isArray(seg.operators)||seg.operators.length<1||seg.operators.length>2||new Set(seg.operators).size!==seg.operators.length)throw new Error('El equipo debe tener uno o dos operarios distintos.');
    for(let index=first;index<=last;index++){
      const code=codes[index];
      if(owners.has(code))throw new Error(`Asignación solapada: ${code}.`);
      if(started.has(code)&&originalOwners[code]!==seg.teamId)throw new Error(`Ubicación iniciada: prohibido traspasar ${code}.`);
      for(const user of seg.operators){
        const allowed=authorizedByOperator[user];
        if(!Array.isArray(allowed)||!allowed.includes(code)) throw new Error(`El operario ${user} no tiene autorización para ${code}.`);
      }
      owners.set(code,seg.teamId);
    }
  }
  for(const code of started){
    if (!positions.has(code)) throw new Error(`Ubicación iniciada inexistente: ${code}.`);
    if (!owners.has(code) || owners.get(code)!==originalOwners[code]) throw new Error(`Ubicación iniciada: hay que conservar el equipo original en ${code}.`);
  }
  const missing=codes.filter(code=>!owners.has(code));
  return {assigned:owners.size,missing,allAssigned:missing.length===0,owners:Object.fromEntries(owners)};
}
function aisleProgress({locationCodes,assignmentOwners,finishedCodes}){
  if(!Array.isArray(locationCodes)||!Array.isArray(finishedCodes)||!assignmentOwners||typeof assignmentOwners!=='object')throw new Error('Datos de progreso incorrectos.');
  const missing=locationCodes.filter(code=>!assignmentOwners[code]);
  const finished=new Set(finishedCodes);
  const pending=locationCodes.filter(code=>!finished.has(code));
  return {missing,pending,completed:locationCodes.length>0&&missing.length===0&&pending.length===0};
}
module.exports={advanceLocation,reviewLocation,validateContiguousAssignments,aisleProgress};
