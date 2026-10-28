'use strict';
// Isolated adapter: orchestrates injected authenticated V2 transport. Does NOT
// interact with the live PWA, Supabase, browser storage or existing V1 queue.
const {auditLegacyQueue,sendPlan,acknowledgeV2,failurePolicy}=
  require('./outbox-compat.cjs');
function requireFn(value,name){
 if(typeof value!=='function')throw Error('Adaptador no configurado: '+name);
 return value;
}
function sameHead(a,b){
 return !!a&&!!b&&a.schema===b.schema&&a.mutationId===b.mutationId&&
  a.ownerUserId===b.ownerUserId&&JSON.stringify(a.request)===JSON.stringify(b.request);
}
async function drainV2({
 getAuthenticatedUserId,isAuthenticated,refreshIdentity,
 loadLegacy,loadV2,saveV2,getCapabilities,withExclusiveLock,submitV2,lookupV2Receipt,
 maxSteps=25
}){
 for(const [name,fn] of Object.entries({
  getAuthenticatedUserId,isAuthenticated,refreshIdentity,loadLegacy,
  loadV2,saveV2,getCapabilities,withExclusiveLock,submitV2,lookupV2Receipt
 }))requireFn(fn,name);
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>100)
  throw Error('Límite de sincronización inválido.');
 const initialUser=getAuthenticatedUserId();
 if(!initialUser||!isAuthenticated())return {status:'hold',reason:'session-unavailable',sent:0};
 const lockName='inventa-v2:'+initialUser;
 return withExclusiveLock(lockName,async()=>{
  let sent=0;
  for(let step=0;step<maxSteps;step++){
   // Only the authentication provider can refresh the actual account state.
   await refreshIdentity();
   if(!isAuthenticated()||getAuthenticatedUserId()!==initialUser)
    return {status:'hold',reason:'account-or-session-changed',sent};
   const legacy=await loadLegacy(initialUser);
   const audit=auditLegacyQueue({userId:initialUser,rows:legacy});
   if(audit.conflicts.length || audit.duplicates.length)
    return {status:'hold',reason:'legacy-queue-needs-review',sent};
   const queue=await loadV2(initialUser);
   const capabilities=await getCapabilities(initialUser);
   const plan=sendPlan({queue,authenticatedUserId:initialUser,
    authenticated:true,capabilities,legacyPending:audit.total});
   if(plan.action==='idle')return {status:'done',reason:'empty',sent};
   if(plan.action==='hold')return {status:'hold',reason:plan.reason,sent};
   const head=queue[0];
   let receipt;
   try{
    receipt=await submitV2({mutationId:plan.mutationId,request:plan.request,
      ownerUserId:initialUser});
   }catch(error){
    const policy=failurePolicy(error);
    // A revoked/expired identity must not trigger an additional lookup request.
    if(error?.status===401||error?.status===403)
      return {status:policy.action,reason:policy.reason,sent};
    // After lost response or a 409, the operation might already have committed.
    // Never create a new mutation ID; request a receipt by the SAME ID.
    try{receipt=await lookupV2Receipt({mutationId:head.mutationId,
       ownerUserId:initialUser});}
    catch(_lookupError){return {status:policy.action,reason:policy.reason,sent};}
    if(!receipt)return {status:policy.action,reason:policy.reason,sent};
   }
   // Reconfirm account after network calls: a user may log out in between.
   await refreshIdentity();
   if(!isAuthenticated()||getAuthenticatedUserId()!==initialUser)
    return {status:'hold',reason:'account-or-session-changed',sent};
   let next;
   try{next=acknowledgeV2(queue,receipt,{trustedAuthenticatedResponse:true});}
   catch(_e){return {status:'hold',reason:'unverified-receipt-preserved',sent};}
   const latest=await loadV2(initialUser);
   if(!Array.isArray(latest)||!sameHead(latest[0],head)
     ||latest.some(item=>item?.ownerUserId!==initialUser))
    return {status:'hold',reason:'queue-changed-during-sync',sent};
   // Preserve commands appended by another UI interaction while request was in flight.
   next=latest.slice(1);
   await saveV2(initialUser,next);
   sent++;
  }
  return {status:'paused',reason:'batch-limit',sent};
 });
}
module.exports={drainV2};
