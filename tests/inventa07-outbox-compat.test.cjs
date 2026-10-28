'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditLegacyQueue,newV2Mutation,queueV2,sendPlan,acknowledgeV2,failurePolicy}=
 require('../inventory-core/outbox-compat.cjs');
const ID='11111111-1111-4111-8111-111111111111';
const NEXT='22222222-2222-4222-8222-222222222222';
const user='operator-A';
const legacy=(id=ID,quantity=7,actor=user)=>({
 queued_at:'2026-10-27T15:00:00Z',
 body:{campaign_id:'campaign-1',location_code:'K00',product_code:'SKU-01',
 lot:'L0003',quantity,actor_id:actor,entries:[{type:'units',quantity}],
 client_mutation_id:id,previous_id:null,correction_reason:null}
});
const common={accountId:user,mutationId:ID,createdAt:'2026-10-28T00:00:00Z',
 campaignId:'campaign-1',locationCode:'K00',productCode:'SKU-01',lot:'L0003',
 expectedRevision:0};
const draft=()=>newV2Mutation({...common,operation:'save-draft',
 input:{looseUnits:'1,125',boxGroups:[{boxes:2,unitsPerBox:8}],
 palletGroups:[{layers:5,boxesPerBase:4,unitsPerBox:6}]}});
const caps={protocol:'visura-count-v2',source:'authenticated-backend',
 authenticatedSessions:true,atomicVersions:true,idempotentMutations:true,
 lotPreserved:true,reviewBeforeConfirm:true,originalTeamEnforced:true,
 permissionEnforced:true};
const receipt=(job,extra={})=>({
 protocol:'visura-count-v2',status:'committed',mutationId:job.mutationId,
 ownerUserId:job.ownerUserId,request:job.request,serverRevision:1,...extra
});
test('legacy queue records remain in exactly their original form, with their storage key',()=>{
 const rows=[legacy()];const before=JSON.stringify(rows);
 const report=auditLegacyQueue({userId:user,rows});
 assert.equal(JSON.stringify(rows),before);
 assert.equal(report.storageKey,'inventa-count-outbox-v1:'+user);
 assert.equal(report.action,'preserve-in-place');
 assert.equal(report.mayAutoConvert,false);
 assert.equal(report.mayAutoDiscard,false);
 assert.equal(report.total,1);
});
test('same legacy mutation repeated is reported but never removed from the queue',()=>{
 const rows=[legacy(),legacy()];
 const result=auditLegacyQueue({userId:user,rows});
 assert.equal(rows.length,2);assert.equal(result.total,2);
 assert.deepEqual(result.duplicates,[{first:0,second:1}]);
});
test('legacy mutation identity reused with different payload is a conflict, not a silent overwrite',()=>{
 const rows=[legacy(),legacy(ID,8)];
 const result=auditLegacyQueue({userId:user,rows});
 assert.deepEqual(result.conflicts,[{first:0,second:1}]);
 assert.equal(rows[0].body.quantity,7);assert.equal(rows[1].body.quantity,8);
});
test('legacy queue damaged or mixed accounts causes error, not destructive repair',()=>{
 assert.throws(()=>auditLegacyQueue({userId:user,rows:'bad'}),/dañada/);
 assert.throws(()=>auditLegacyQueue({userId:user,rows:[legacy(ID,7,'other')]}),/No modificar ni descartar/);
});
test('new draft retains lot and uses exact new counting formula without pallet-count factor',()=>{
 const v=draft();
 assert.equal(v.storageKey,'inventa-reference-outbox-v2:'+user);
 assert.equal(v.request.lot,'L0003');
 assert.equal(v.request.quantity,'137.125');
 assert.equal(v.request.breakdown.length,3);
 assert.deepEqual(v.request.breakdown.map(x=>x.type),['loose','boxes','pallet-group']);
 assert.equal(v.request.explicitZero,false);
 assert.equal(v.request.operation,'save-draft');
});
test('new workflow requires an express zero and refuses blank drafts',()=>{
 const zero=newV2Mutation({...common,operation:'save-draft',input:{markZero:true}});
 assert.equal(zero.request.quantity,'0');assert.equal(zero.request.explicitZero,true);
 assert.throws(()=>newV2Mutation({...common,operation:'save-draft',input:{}}),/cantidad física explícita/);
 assert.throws(()=>newV2Mutation({...common,operation:'save-draft',input:{looseUnits:'0'}}),/Marcar cero/);
});
test('lot is not lost and bad revisions or mutation IDs are rejected',()=>{
 assert.throws(()=>newV2Mutation({...common,mutationId:'not-uuid',operation:'save-draft',input:{looseUnits:1}}),/UUID/);
 assert.throws(()=>newV2Mutation({...common,expectedRevision:-1,operation:'save-draft',input:{looseUnits:1}}),/Versión/);
 assert.throws(()=>newV2Mutation({...common,lot:42,operation:'save-draft',input:{looseUnits:1}}),/Lote/);
});
test('confirm cannot include new quantities or a stale review version',()=>{
 const yes=newV2Mutation({...common,operation:'confirm-draft',
 mutationId:NEXT,expectedRevision:2,reviewRevision:2});
 assert.equal(yes.request.operation,'confirm-draft');
 assert.equal(Object.hasOwn(yes.request,'quantity'),false);
 assert.throws(()=>newV2Mutation({...common,operation:'confirm-draft',reviewRevision:1}),/caducado/);
 assert.throws(()=>newV2Mutation({...common,operation:'confirm-draft',reviewRevision:0,input:{looseUnits:3}}),/No se permite/);
});
test('correction staging requires reason, author and exact physical quantity',()=>{
 const fixed=newV2Mutation({...common,operation:'stage-correction',
 reason:'other',explanation:'Caja incompleta',
 declaredAuthorId:'original-member-B',input:{looseUnits:'3.125'}});
 assert.equal(fixed.request.reason,'other');
 assert.equal(fixed.request.declaredAuthorId,'original-member-B');
 assert.equal(fixed.request.quantity,'3.125');
 assert.throws(()=>newV2Mutation({...common,operation:'stage-correction',
 input:{looseUnits:4},reason:'other',declaredAuthorId:'A'}),/Explicación/);
});
test('queue V2 is append-only and same job replay does not duplicate entries',()=>{
 const v=draft();const q=queueV2([],v);
 assert.equal(q.length,1);assert.equal(queueV2(q,v).length,1);
 assert.notEqual(q[0],v);
 assert.equal(q[0].request.lot,'L0003');
});
test('same V2 id with different physical amounts is rejected with original queue intact',()=>{
 const q=queueV2([],draft());
 const other=newV2Mutation({...common,operation:'save-draft',input:{looseUnits:'9'}});
 assert.throws(()=>queueV2(q,other),/Conflicto/);assert.equal(q.length,1);
 assert.equal(q[0].request.quantity,'137.125');
});
test('queue mixing accounts is blocked',()=>{
 const q=queueV2([],draft());
 const other=newV2Mutation({...common,mutationId:NEXT,accountId:'operator-B',
 operation:'save-draft',input:{looseUnits:3}});
 assert.throws(()=>queueV2(q,other),/Cuentas distintas/);
});
test('new sync waits for real authenticated session and server capability handshake',()=>{
 const q=queueV2([],draft());
 assert.equal(sendPlan({queue:q,authenticated:false,authenticatedUserId:user,capabilities:caps}).reason,'session-unavailable');
 assert.equal(sendPlan({queue:q,authenticated:true,authenticatedUserId:'other',capabilities:caps}).reason,'account-mismatch');
 assert.equal(sendPlan({queue:q,authenticated:true,authenticatedUserId:user,capabilities:{...caps,lotPreserved:false}}).reason,'server-capability-incomplete');
 assert.equal(sendPlan({queue:q,authenticated:true,authenticatedUserId:user,capabilities:{...caps,source:'local-guess'}}).reason,'server-protocol-unverified');
});
test('legacy items block V2 dispatch, never silently send to the old counts endpoint',()=>{
 const q=queueV2([],draft());
 assert.equal(sendPlan({queue:q,authenticated:true,authenticatedUserId:user,capabilities:caps,legacyPending:1}).reason,'legacy-queue-not-drained');
 assert.equal(sendPlan({queue:q,authenticated:true,authenticatedUserId:user,capabilities:caps,legacyPending:-1}).reason,'legacy-queue-unchecked');
 const ready=sendPlan({queue:q,authenticated:true,authenticatedUserId:user,capabilities:caps,legacyPending:0});
 assert.equal(ready.action,'submit-v2-only');
 assert.equal(ready.request.lot,'L0003');
 assert.equal(ready.mutationId,ID);
 assert.equal(ready.request.quantity,'137.125');
});
test('receipt must match trusted server, user, exact request and idempotency key',()=>{
 const v=draft(),q=queueV2([],v);
 for(const bad of [
  receipt(v),receipt(v,{mutationId:NEXT}),receipt(v,{ownerUserId:'other'}),
  receipt(v,{request:{...v.request,quantity:'7'}}),
  receipt(v,{status:'accepted'}),receipt(v,{serverRevision:-1})
 ]){
  assert.throws(()=>acknowledgeV2(q,bad,{trustedAuthenticatedResponse:false}),/Acuse/);
 }
 assert.throws(()=>acknowledgeV2(q,receipt(v,{request:{...v.request,quantity:'7'}}),{trustedAuthenticatedResponse:true}),/Acuse/);
 assert.equal(q.length,1);
 const after=acknowledgeV2(q,receipt(v),{trustedAuthenticatedResponse:true});
 assert.deepEqual(after,[]);
 assert.equal(q.length,1);
});
test('received receipt removes only the head; never reorders later physical operations',()=>{
 const first=draft();
 const later=newV2Mutation({...common,mutationId:NEXT,operation:'confirm-draft',
 expectedRevision:1,reviewRevision:1});
 const q=queueV2(queueV2([],first),later);
 const after=acknowledgeV2(q,receipt(first),{trustedAuthenticatedResponse:true});
 assert.equal(after.length,1);assert.equal(after[0].mutationId,NEXT);
 assert.equal(q.length,2);
});
test('network loss retries same mutation id; conflicts and authentication failures preserve it',()=>{
 assert.deepEqual(failurePolicy({status:409}),{action:'hold',reason:'conflict-preserve',retrySameMutationId:false});
 assert.deepEqual(failurePolicy({status:401}),{action:'hold',reason:'authentication-or-permission',retrySameMutationId:false});
 assert.deepEqual(failurePolicy({status:503}),{action:'retry-later',reason:'unconfirmed-server-write',retrySameMutationId:true});
});
