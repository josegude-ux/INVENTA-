'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createIncident,decideIncident,completeCorrectedIncident,summarizeIncidents}=require('../inventory-core/incidents.cjs');
const auth={eventId:'event-open',at:'2026-10-28T00:00:00Z',authenticatedUserId:'operator-A'};
const base=(overrides={})=>({
 campaignId:'C01',locationCode:'K00-P01',incidentId:'INC-001',
 type:'illegible-code',description:'Etiqueta ilegible, producto sin código fiable',
 physicalEvidence:{looseUnits:'2',boxGroups:[{boxes:3,unitsPerBox:4}]},...overrides
});
const admin=(s,extras={})=>({isAdmin:true,expectedRevision:s.revision,
 eventId:'admin-'+(s.revision+1),at:'2026-10-28T00:30:00Z',
 authenticatedUserId:'admin-1',...extras});
test('illegible code retains 14 physical units while reference identity remains unknown',()=>{
 const s=createIncident(base(),auth);
 assert.equal(s.status,'open');assert.equal(s.physicalEvidence.quantity,'14');
 assert.equal(s.locationCode,'K00-P01');assert.equal(s.events[0].physicalEvidence.quantity,'14');
 assert.equal(s.events.length,1);
});
test('illegible code with a blank count is rejected, explicit zero is acceptable',()=>{
 assert.throws(()=>createIncident(base({physicalEvidence:{}}),auth),/conservar el recuento físico/);
 const s=createIncident(base({physicalEvidence:{markZero:true}}),auth);
 assert.equal(s.physicalEvidence.explicitZero,true);
 assert.equal(s.physicalEvidence.quantity,'0');
});
test('misattributed alternate only creates incident when there are actual affected count events',()=>{
 assert.throws(()=>createIncident(base({type:'used-alias-misattribution',physicalEvidence:null}),auth),/uso real comprobado/);
 const s=createIncident(base({type:'used-alias-misattribution',physicalEvidence:null,affectedCountIds:['count-101','count-102']}),auth);
 assert.deepEqual(s.affectedCountIds,['count-101','count-102']);
 assert.equal(s.status,'open');
});
test('invalid incident details and duplicated historical evidence are rejected',()=>{
 assert.throws(()=>createIncident(base({description:''}),auth),/Descripción/);
 assert.throws(()=>createIncident(base({type:'used-alias-misattribution',affectedCountIds:['X','X']}),auth),/incorrectas/);
 assert.throws(()=>createIncident(base({type:'other-physical-incident',affectedCountIds:['X']}),auth),/No se asocian/);
});
test('incident review requires admin authorization and nonempty reason',()=>{
 const s=createIncident(base(),auth);
 assert.throws(()=>decideIncident(s,{action:'resolved',reason:'Comprobada'},admin(s,{isAdmin:false})),/Administración/);
 assert.throws(()=>decideIncident(s,{action:'resolved',reason:''},admin(s)),/Motivo/);
 assert.throws(()=>decideIncident(s,{action:'invalid',reason:'x'},admin(s)),/inválida/);
});
test('resolving incident retains original evidence, with a separate event',()=>{
 const s=createIncident(base(),auth);
 const n=decideIncident(s,{action:'resolved',reason:'Identificación administrativa documentada'},admin(s));
 assert.equal(s.status,'open');assert.equal(n.status,'resolved');
 assert.equal(n.physicalEvidence.quantity,'14');assert.deepEqual(n.events[0],s.events[0]);
 assert.equal(n.events[1].authenticatedUserId,'admin-1');
 assert.equal(n.events[1].reason,'Identificación administrativa documentada');
});
test('incident requiring physical correction remains a campaign blocker',()=>{
 let s=createIncident(base({type:'used-alias-misattribution',physicalEvidence:null,affectedCountIds:['count-101']}),auth);
 s=decideIncident(s,{action:'manual-correction-required',reason:'Se usó un código incorrecto'},admin(s));
 assert.equal(s.status,'awaiting_correction');
 assert.deepEqual(summarizeIncidents([s]),{blockingIncidents:1,open:0,awaitingCorrection:1,resolved:0});
});
test('corrected incident closes only with explicit correction evidence and preserves historic event',()=>{
 let s=createIncident(base({type:'used-alias-misattribution',physicalEvidence:null,affectedCountIds:['count-101']}),auth);
 s=decideIncident(s,{action:'manual-correction-required',reason:'Requiere rectificación parcial'},admin(s));
 assert.throws(()=>completeCorrectedIncident(s,admin(s)),/Corrección verificada/);
 const n=completeCorrectedIncident(s,admin(s,{correctionEventId:'correction-202'}));
 assert.equal(n.status,'resolved');assert.equal(n.events.length,3);
 assert.equal(n.events[2].correctionEventId,'correction-202');
 assert.equal(n.affectedCountIds[0],'count-101');
});
test('cannot resolve a reviewed incident twice or skip a pending correction',()=>{
 let s=createIncident(base(),auth);
 assert.throws(()=>completeCorrectedIncident(s,admin(s,{correctionEventId:'x'})),/No hay corrección/);
 s=decideIncident(s,{action:'resolved',reason:'Inspección final'},admin(s));
 assert.throws(()=>decideIncident(s,{action:'resolved',reason:'Otra'},admin(s)),/Solo se puede revisar/);
});
test('optimistic revision and duplicate identifiers reject conflicting admin actions',()=>{
 const s=createIncident(base(),auth);
 assert.throws(()=>decideIncident(s,{action:'resolved',reason:'Revisado'},admin(s,{expectedRevision:99})),/Conflicto/);
 assert.throws(()=>decideIncident(s,{action:'resolved',reason:'Revisado'},admin(s,{eventId:'event-open'})),/duplicado/);
});
test('ordinary differences do not automatically block closure; unresolved incidents do',()=>{
 let i=createIncident(base(),auth);
 assert.equal(summarizeIncidents([i]).blockingIncidents,1);
 i=decideIncident(i,{action:'resolved',reason:'Validación manual'},admin(i));
 assert.equal(summarizeIncidents([i]).blockingIncidents,0);
});
