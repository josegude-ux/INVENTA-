'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {startTeam,switchMode,attribution}=require('../inventory-core/team-session.cjs');
const {baseState,saveDraft,reviewDraft,confirmDraft,stageCorrection,reviewCorrection,confirmCorrection}=require('../inventory-core/count-lifecycle.cjs');
const {advanceLocation,reviewLocation}=require('../inventory-core/workflow.cjs');
const team=()=>startTeam({campaignId:'C',locationCode:'K00',teamId:'T01',originalOperators:['A','B'],authenticatedUserId:'A',sessionId:'sA',authorizedOperators:['A','B'],at:'t0',eventId:'team-1'});
const context=(state,t,extra={})=>({...attribution(t),campaignOpen:true,locationOpen:true,assignmentValid:true,expectedRevision:state.revision,...extra});
const reference=(code)=>baseState({campaignId:'C',locationCode:'K00',productCode:code});
const confirm=(s,t,eventId)=>confirmDraft(s,context(s,t,{reviewRevision:reviewDraft(s).reviewRevision,eventId,occurredAt:'t'}));
const mode=(t,value,by='A',session='sA')=>switchMode(t,{mode:value,authenticatedUserId:by,sessionId:session,authorizedOperators:['A','B'],expectedRevision:t.revision,at:'later',eventId:'mode-'+(t.revision+1)});
test('pair count is one reference result, and historical author cannot change after going solo',()=>{
 let t=team(),s=reference('P1');s=saveDraft(s,{looseUnits:5},context(s,t));s=confirm(s,t,'one');
 assert.equal(s.events.length,1);assert.deepEqual(s.events[0].participants,['A','B']);
 t=mode(t,'individual');let n=reference('P2');n=saveDraft(n,{looseUnits:3},context(n,t));n=confirm(n,t,'two');
 assert.deepEqual(n.events[0].participants,['A']);assert.deepEqual(s.events[0].participants,['A','B']);
});
test('authenticated replacement B can correct after individual handoff; earlier joint attribution survives',()=>{
 let t=team(),s=reference('P1');s=saveDraft(s,{looseUnits:2},context(s,t));s=confirm(s,t,'one');
 t=mode(t,'individual','B','sB');let a=attribution(t,{forCorrection:true});
 s=stageCorrection(s,{looseUnits:4},{...context(s,t),...a,reason:'initial_count_error',declaredAuthorId:a.declaredAuthorId});
 s=confirmCorrection(s,context(s,t,{reviewRevision:reviewCorrection(s).reviewRevision,eventId:'two',occurredAt:'later'}));
 assert.equal(s.confirmed.quantity,'4');assert.deepEqual(s.events[0].participants,['A','B']);
 assert.deepEqual(s.events[1].participants,['B']);assert.equal(s.events[1].authenticatedUserId,'B');
});
test('reopened team pair uses original companion only and does not alter prior solo entries',()=>{
 let t=mode(team(),'individual');let s=reference('P1');s=saveDraft(s,{looseUnits:'1'},context(s,t));s=confirm(s,t,'one');
 t=mode(t,'pair');let n=reference('P2');n=saveDraft(n,{looseUnits:'2'},context(n,t));n=confirm(n,t,'two');
 assert.deepEqual(s.events[0].participants,['A']);assert.deepEqual(n.events[0].participants,['A','B']);
});
test('draft submission starts the location, clearing does not revert started state',()=>{
 let t=team(),s=reference('P1'),loc=advanceLocation(null,'open');
 s=saveDraft(s,{looseUnits:'2'},context(s,t));loc=advanceLocation(loc,'quantity-entered');
 s=saveDraft(s,{},context(s,t));loc=advanceLocation(loc,'clear-draft');
 assert.equal(s.status,'uncounted');assert.equal(loc.everStarted,true);assert.equal(loc.status,'in_progress');
});
test('completion remains manual even if physical references are all confirmed',()=>{
 let t=team(),s=reference('P1'),loc=advanceLocation(null,'open');
 s=saveDraft(s,{markZero:true},context(s,t));loc=advanceLocation(loc,'zero-marked');s=confirm(s,t,'one');
 const state=reviewLocation({knownReferences:[{status:s.status,quantity:s.confirmed.quantity,explicitZero:s.confirmed.explicitZero}]});
 assert.equal(state.ready,true);assert.equal(loc.status,'in_progress');
 loc=advanceLocation(loc,'finish',{ready:state.ready});assert.equal(loc.status,'finished');
});
