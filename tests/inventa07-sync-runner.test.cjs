'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {drainV2}=require('../inventory-core/sync-runner.cjs');
const {newV2Mutation,queueV2}=require('../inventory-core/outbox-compat.cjs');
const OWNER='operator-A';
const id='11111111-1111-4111-8111-111111111111',next='22222222-2222-4222-8222-222222222222';
const caps={protocol:'visura-count-v2',source:'authenticated-backend',
 authenticatedSessions:true,atomicVersions:true,idempotentMutations:true,
 lotPreserved:true,reviewBeforeConfirm:true,originalTeamEnforced:true,
 permissionEnforced:true};
const mutation=(mutationId=id)=>newV2Mutation({
 accountId:OWNER,mutationId,createdAt:'2026-10-28T00:00:00Z',
 campaignId:'camp',locationCode:'K00',productCode:'P01',lot:'000L',
 operation:'save-draft',expectedRevision:0,input:{markZero:true}});
function harness(options={}){
 let account=OWNER,authenticated=true;
 let saved=queueV2([],mutation());
 let old=options.old||[],written=0,submitted=0,lookups=0;
 let backend=options.backend||{};
 const validReceipt=job=>({protocol:'visura-count-v2',status:'committed',
  mutationId:job.mutationId,ownerUserId:job.ownerUserId,
  request:job.request,serverRevision:1});
 const deps={
  getAuthenticatedUserId:()=>account,
  isAuthenticated:()=>authenticated,
  refreshIdentity:async()=>{},
  loadLegacy:async()=>old,
  loadV2:async()=>structuredClone(saved),
  saveV2:async(_u,next)=>{written++;saved=structuredClone(next);},
  getCapabilities:async()=>options.capabilities??caps,
  withExclusiveLock:async(_key,fn)=>fn(),
  submitV2:async job=>{submitted++;if(backend.submit)return backend.submit(job,{validReceipt,replaceQueue:q=>saved=q,setAccount:u=>account=u,setAuthenticated:v=>authenticated});return validReceipt(job);},
  lookupV2Receipt:async job=>{lookups++;if(backend.lookup)return backend.lookup(job,{validReceipt});return null;}
 };
 return {deps,get queue(){return saved;},get written(){return written;},
 get submitted(){return submitted;},get lookups(){return lookups;},
 setAccount:v=>{account=v;},setAuthenticated:v=>{authenticated=v;},
 setOld:v=>{old=v;},append:v=>{saved=queueV2(saved,v);}};
}
test('successful transport removes exactly the committed mutation',async()=>{
 const h=harness();const result=await drainV2(h.deps);
 assert.deepEqual(result,{status:'done',reason:'empty',sent:1});
 assert.equal(h.queue.length,0);assert.equal(h.written,1);assert.equal(h.submitted,1);
});
test('legacy pending entries block new protocol without modifying either queue',async()=>{
 const old={body:{campaign_id:'camp',location_code:'K00',product_code:'P01',
  lot:'000L',quantity:1,actor_id:OWNER,client_mutation_id:next,entries:[]}};
 const h=harness({old:[old]});const r=await drainV2(h.deps);
 assert.equal(r.reason,'legacy-queue-not-drained');
 assert.equal(h.submitted,0);assert.equal(h.written,0);assert.equal(h.queue.length,1);
});
test('unknown capabilities must not fall back to legacy POST',async()=>{
 const h=harness({capabilities:{...caps,lotPreserved:false}});
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'server-capability-incomplete');
 assert.equal(h.submitted,0);assert.equal(h.queue.length,1);
});
test('lost HTTP response but committed server mutation is reconciled by its original ID',async()=>{
 let committed;const h=harness({backend:{
  submit:async(job,{validReceipt})=>{committed=validReceipt(job);throw Object.assign(Error('lost response'),{status:0});},
  lookup:async job=>{assert.equal(job.mutationId,id);return committed;}
 }});
 const r=await drainV2(h.deps);
 assert.equal(r.status,'done');assert.equal(h.lookups,1);
 assert.equal(h.submitted,1);assert.equal(h.written,1);assert.equal(h.queue.length,0);
});
test('network outage without verified receipt keeps same mutation for the next retry',async()=>{
 const h=harness({backend:{submit:async()=>{throw Object.assign(Error('offline'),{status:0});}}});
 const r=await drainV2(h.deps);
 assert.equal(r.action,undefined);
 assert.equal(r.status,'retry-later');
 assert.equal(r.reason,'unconfirmed-server-write');
 assert.equal(h.queue[0].mutationId,id);assert.equal(h.written,0);
});
test('409 conflict with mismatched server receipt keeps queued original',async()=>{
 const h=harness({backend:{
  submit:async()=>{throw Object.assign(Error('conflict'),{status:409});},
  lookup:async(job,{validReceipt})=>({ ...validReceipt({mutationId:job.mutationId,
    ownerUserId:job.ownerUserId,request:{quantity:'999'}})})
 }});
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'unverified-receipt-preserved');
 assert.equal(h.queue[0].mutationId,id);assert.equal(h.written,0);
});
test('switching account during network call never deletes pending data',async()=>{
 const h=harness({backend:{
  submit:async(job,{validReceipt,setAccount})=>{setAccount('operator-B');return validReceipt(job);}
 }});
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'account-or-session-changed');
 assert.equal(h.queue.length,1);assert.equal(h.written,0);
});
test('submitting after logout never removes queue even if server returned an ack',async()=>{
 const h=harness({backend:{
  submit:async(job,{validReceipt,setAuthenticated})=>{setAuthenticated(false);return validReceipt(job);}
 }});
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'account-or-session-changed');assert.equal(h.queue.length,1);
});
test('a job appended during network call remains queued after first ack',async()=>{
 const second=mutation(next);
 const h=harness({backend:{
  submit:async(job,{validReceipt,replaceQueue})=>{
   if(job.mutationId===id){replaceQueue(queueV2(queueV2([],mutation()),second));}
   return validReceipt(job);
  }
 }});
 const r=await drainV2({...h.deps,maxSteps:1});
 assert.deepEqual(r,{status:'paused',reason:'batch-limit',sent:1});
 assert.equal(h.queue.length,1);assert.equal(h.queue[0].mutationId,next);
});
test('stale first job replaced during network operation is never silently dropped',async()=>{
 const h=harness({backend:{
  submit:async(job,{validReceipt,replaceQueue})=>{
   replaceQueue(queueV2([],mutation(next)));
   return validReceipt(job);
  }
 }});
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'queue-changed-during-sync');
 assert.equal(h.queue[0].mutationId,next);assert.equal(h.written,0);
});
test('sync requires exclusive lock contract; it cannot transmit without a lock',async()=>{
 const h=harness();
 await assert.rejects(()=>drainV2({...h.deps,withExclusiveLock:null}),/Adaptador no configurado/);
 assert.equal(h.submitted,0);assert.equal(h.queue.length,1);
});
test('sync rechecks authentication on every item, not only once on open',async()=>{
 const h=harness();h.append(mutation(next));
 let calls=0;h.deps.refreshIdentity=async()=>{calls++;if(calls>=5)h.setAuthenticated(false);};
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'account-or-session-changed');
 assert.equal(h.queue.length,1);
 assert.equal(h.queue[0].mutationId,next);
 assert.equal(h.submitted,1);
});
test('sync never trusts an ACK missing exact request/actor or server revision',async()=>{
 const h=harness({backend:{submit:async job=>({
  protocol:'visura-count-v2',status:'committed',mutationId:job.mutationId,
  ownerUserId:job.ownerUserId,request:job.request,serverRevision:-1
 })}});
 const r=await drainV2(h.deps);
 assert.equal(r.reason,'unverified-receipt-preserved');
 assert.equal(h.written,0);assert.equal(h.queue.length,1);
});

test('new sync shares legacy browser lock name to prevent concurrent drainers',async()=>{
 const h=harness();
 let observed='';
 h.deps.withExclusiveLock=async(key,fn)=>{observed=key;return fn();};
 await drainV2(h.deps);
 assert.equal(observed,'inventa-count-sync:'+OWNER);
});
test('expired session must stop immediately without an extra receipt query',async()=>{
 const h=harness({backend:{
  submit:async()=>{throw Object.assign(Error('forbidden'),{status:403});},
  lookup:async()=>{throw Error('Do not call lookup after 403');}
 }});
 const result=await drainV2(h.deps);
 assert.equal(result.reason,'authentication-or-permission');
 assert.equal(h.lookups,0);assert.equal(h.written,0);
 assert.equal(h.queue.length,1);
});
test('a new legacy item created during transport prevents V2 queue deletion',async()=>{
 const h=harness({backend:{
  submit:async(job,{validReceipt})=>{
   h.setOld([{body:{campaign_id:'camp',location_code:'K00',
    product_code:'P01',lot:'000L',quantity:1,actor_id:OWNER,
    client_mutation_id:next,entries:[]}}]);
   return validReceipt(job);
  }
 }});
 const result=await drainV2(h.deps);
 assert.equal(result.reason,'legacy-queue-changed-during-sync');
 assert.equal(h.queue.length,1);assert.equal(h.written,0);
});
test('account changed while awaiting server capabilities does not submit',async()=>{
 const h=harness();
 h.deps.getCapabilities=async()=>{h.setAccount('operator-B');return caps;};
 const result=await drainV2(h.deps);
 assert.equal(result.reason,'account-or-session-changed');
 assert.equal(h.submitted,0);assert.equal(h.queue.length,1);
});
