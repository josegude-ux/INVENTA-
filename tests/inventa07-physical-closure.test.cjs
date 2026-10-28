'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {physicalReview,baseLocation,reviewForClose,registerCountRevision,
 manualFinish,manualReopen,hierarchy}=require('../inventory-core/physical-closure.cjs');
const ref=(overrides={})=>({productCode:'SKU-001',lot:'LOT-7',status:'confirmed',
 quantity:'7',explicitZero:false,...overrides});
const prov=(overrides={})=>({barcode:'TEMP-ONE',status:'pending',
 physicalStatus:'confirmed',quantity:'2',explicitZero:false,...overrides});
const state=()=>baseLocation({campaignId:'C',locationCode:'K00',teamId:'T1'});
const counted=()=>registerCountRevision(state(),{event:'quantity-entered',expectedRevision:0});
const context=(s,other={})=>({campaignOpen:true,assignmentValid:true,teamLeaseValid:true,
 originalTeamId:'T1',authenticatedUserId:'A',sessionId:'session-A',
 mutationId:'operation-1',occurredAt:'2026-10-28T09:00:00Z',expectedRevision:s.revision,
 reviewRevision:s.revision,reviewCountRevision:s.countRevision,manualAccepted:true,...other});
const physical=()=>({references:[ref()],provisionals:[]});
test('blank inventory is NOT proof of zero or physical location completion',()=>{
 const r=physicalReview();
 assert.equal(r.ready,false);assert.equal(r.requiresEmptyLocationProcedure,true);
 assert.equal(r.confirmed,0);
});
test('opening or scanning without effective count does not trigger start or allow completion',()=>{
 const s=state();
 assert.equal(s.everStarted,false);assert.equal(s.status,'not_started');
 assert.throws(()=>manualFinish(s,physical(),context(s)),/sin inicio físico efectivo/);
});
test('effective physical count persists started flag and changes version',()=>{
 let s=counted();assert.equal(s.status,'in_progress');
 assert.equal(s.everStarted,true);assert.equal(s.countRevision,1);assert.equal(s.revision,1);
 s=registerCountRevision(s,{event:'draft-cleared',expectedRevision:1});
 assert.equal(s.everStarted,true);assert.equal(s.countRevision,2);
});
test('cleared last draft does not allow an empty physical review to finish',()=>{
 let s=counted();s=registerCountRevision(s,{event:'draft-cleared',expectedRevision:1});
 assert.throws(()=>manualFinish(s,{},context(s)),/sin confirmar/);
});
test('one confirmed official reference allows manual finish with explicit acceptance',()=>{
 const s=counted(),rev=reviewForClose(s,physical());
 assert.equal(rev.ready,true);assert.equal(rev.reviewCountRevision,1);
 const f=manualFinish(s,physical(),context(s));
 assert.equal(f.status,'finished');assert.equal(f.revision,2);
 assert.equal(f.events.length,1);assert.equal(f.events[0].physicalCountRevision,1);
 assert.equal(f.events[0].authenticatedUserId,'A');
 assert.equal(f.events[0].originalTeamId,'T1');
 assert.equal(s.status,'in_progress');assert.equal(s.events.length,0);
});
test('zero is only physical when confirmed explicitly, not blank or implicit zero',()=>{
 const yes=physicalReview({references:[ref({quantity:'0',explicitZero:true})]});
 assert.equal(yes.ready,true);assert.equal(yes.explicitZeros,1);
 const no=physicalReview({references:[ref({quantity:'0',explicitZero:false})]});
 assert.equal(no.ready,false);assert.equal(no.invalidQuantities,1);
 assert.equal(physicalReview({references:[ref({quantity:null})]}).ready,false);
});
test('bad precision or contradictory explicit zero fails review',()=>{
 assert.equal(physicalReview({references:[ref({quantity:'2.1234'})]}).ready,false);
 assert.equal(physicalReview({references:[ref({quantity:'2',explicitZero:true})]}).ready,false);
});
test('duplicate references are rejected using product + lot, but distinct lots may coexist',()=>{
 assert.throws(()=>physicalReview({references:[ref(),ref()]}),/duplicadas/);
 const x=physicalReview({references:[ref(),ref({lot:'LOT-8'})]});
 assert.equal(x.ready,true);assert.equal(x.confirmed,2);
});
test('provisional physically confirmed allows location completion while admin remains pending',()=>{
 const r=physicalReview({references:[ref()],provisionals:[prov()]});
 assert.equal(r.ready,true);assert.equal(r.confirmed,2);assert.equal(r.administrativePending,1);
 const s=counted();
 assert.equal(manualFinish(s,{references:[ref()],provisionals:[prov()]},context(s)).status,'finished');
});
test('physically unconfirmed provisional blocks even if other products are confirmed',()=>{
 const r=physicalReview({references:[ref()],provisionals:[prov({physicalStatus:'draft'})]});
 assert.equal(r.ready,false);assert.equal(r.pending,1);
});
test('a location containing only a physically confirmed provisional can be closed',()=>{
 const r=physicalReview({provisionals:[prov()]});
 assert.equal(r.ready,true);assert.equal(r.confirmed,1);assert.equal(r.administrativePending,1);
});
test('unresolved physical incident blocks physical closure but admin-only pending alone does not',()=>{
 assert.equal(physicalReview({...physical(),blockingPhysicalIncidents:1}).ready,false);
 assert.equal(physicalReview({...physical(),provisionals:[prov()]}).ready,true);
});
test('stale physical review cannot confirm after counts have changed',()=>{
 let s=counted();const stale=context(s);
 s=registerCountRevision(s,{event:'confirmed',expectedRevision:s.revision});
 assert.throws(()=>manualFinish(s,physical(),{...stale,expectedRevision:s.revision,
 reviewRevision:s.revision}),/caducado/);
});
test('stale location CAS, expired team lease and revoked assignment block close',()=>{
 const s=counted();
 assert.throws(()=>manualFinish(s,physical(),context(s,{expectedRevision:0})),/Conflicto/);
 assert.throws(()=>manualFinish(s,physical(),context(s,{teamLeaseValid:false})),/no autorizado/);
 assert.throws(()=>manualFinish(s,physical(),context(s,{assignmentValid:false})),/no autorizado/);
 assert.throws(()=>manualFinish(s,physical(),context(s,{campaignOpen:false})),/no autorizado/);
 assert.throws(()=>manualFinish(s,physical(),context(s,{originalTeamId:'T2'})),/no autorizado/);
});
test('manual finalization cannot be triggered automatically by ready state alone',()=>{
 const s=counted();
 assert.throws(()=>manualFinish(s,physical(),context(s,{manualAccepted:false})),/confirmación expresa/);
});
test('finished location disallows ordinary further count and duplicate finish',()=>{
 const s=counted(),f=manualFinish(s,physical(),context(s));
 assert.throws(()=>registerCountRevision(f,{event:'quantity-entered',expectedRevision:f.revision}),/cerrada/);
 assert.throws(()=>manualFinish(f,physical(),context(f,{mutationId:'operation-2'})),/sin inicio|No se puede finalizar/);
});
test('reopen is authorized and reasoned, preserves original events and same team',()=>{
 let s=counted();s=manualFinish(s,physical(),context(s));
 assert.throws(()=>manualReopen(s,context(s,{mutationId:'operation-2'})),/autorización expresa/);
 assert.throws(()=>manualReopen(s,context(s,{mutationId:'operation-2',reopenAuthorized:true,reason:''})),/obligatorio/);
 const reopened=manualReopen(s,context(s,{mutationId:'operation-2',
  reopenAuthorized:true,reason:'Confirmación de lectura adicional'}));
 assert.equal(reopened.status,'in_progress');assert.equal(reopened.originalTeamId,'T1');
 assert.equal(reopened.events.length,2);
 assert.equal(s.status,'finished');assert.equal(s.events.length,1);
 assert.equal(reopened.events[1].reason,'Confirmación de lectura adicional');
});
test('reopen remains unavailable when campaign is closed or team revoked',()=>{
 let s=counted();s=manualFinish(s,physical(),context(s));
 assert.throws(()=>manualReopen(s,context(s,{mutationId:'next',reopenAuthorized:true,reason:'R',campaignOpen:false})),/no autorizado/);
});
test('original event/mutation id cannot be reused for a different transition',()=>{
 let s=counted();s=manualFinish(s,physical(),context(s));
 assert.throws(()=>manualReopen(s,context(s,{reopenAuthorized:true,reason:'Motivo'})),/duplicado/);
});
test('range and aisle are automatically complete only after every location manually closes',()=>{
 const locations=['K00','K01','K02','K03'].map((locationCode,i)=>({
  ...state(),locationCode,originalTeamId:i<2?'A':'B',status:'finished'}));
 const x=hierarchy({orderedLocationCodes:['K00','K01','K02','K03'],
  segments:[{teamId:'A',from:'K00',to:'K01'},{teamId:'B',from:'K02',to:'K03'}],
  locations});
 assert.deepEqual(x.segments.map(z=>z.completed),[true,true]);
 assert.equal(x.aisle.completed,true);assert.equal(x.aisle.finished,4);
});
test('automatic range completion never closes a location: reopen invalidates only its range and aisle',()=>{
 const l=['K00','K01','K02'].map((locationCode,i)=>({
  ...state(),locationCode,originalTeamId:i<2?'A':'B',status:'finished'}));
 l[1].status='in_progress';
 const x=hierarchy({orderedLocationCodes:['K00','K01','K02'],
  segments:[{teamId:'A',from:'K00',to:'K01'},{teamId:'B',from:'K02',to:'K02'}],locations:l});
 assert.deepEqual(x.segments.map(z=>z.completed),[false,true]);assert.equal(x.aisle.completed,false);
 assert.equal(l[1].status,'in_progress');
});
test('unassigned location blocks aisle completion even if others are finished',()=>{
 const l=[{...state(),locationCode:'K00',originalTeamId:'A',status:'finished'}];
 const x=hierarchy({orderedLocationCodes:['K00','K01'],
  segments:[{teamId:'A',from:'K00',to:'K00'}],locations:l});
 assert.equal(x.aisle.completed,false);assert.deepEqual(x.aisle.missing,['K01']);
});
test('overlapping tramos, wrong team, bad location, or duplicate location are rejected',()=>{
 const orderedLocationCodes=['K00','K01','K02'];
 const a={...state(),locationCode:'K00',originalTeamId:'A',status:'finished'};
 assert.throws(()=>hierarchy({orderedLocationCodes,segments:[
  {teamId:'A',from:'K00',to:'K01'},{teamId:'B',from:'K01',to:'K02'}]}),/solapados/);
 assert.throws(()=>hierarchy({orderedLocationCodes,segments:[
  {teamId:'B',from:'K00',to:'K00'}],locations:[a]}),/no coincide/);
 assert.throws(()=>hierarchy({orderedLocationCodes,segments:[],
  locations:[a,a]}),/duplicada/);
 assert.throws(()=>hierarchy({orderedLocationCodes,segments:[
  {teamId:'A',from:'K02',to:'K00'}]}),/Tramo/);
});
test('empty pasillo never reports completed',()=>{
 assert.equal(hierarchy().aisle.completed,false);
});

test('pending correction in a confirmed row prevents a premature manual location close',()=>{
 const review=physicalReview({references:[ref({correctionPending:true}),ref({
  productCode:'SKU-002',lot:'',quantity:'1'})]});
 assert.equal(review.pending,1);assert.equal(review.confirmed,1);
 assert.equal(review.ready,false);
 const s=counted();
 assert.throws(()=>manualFinish(s,{references:[
  ref({correctionPending:true}),ref({productCode:'SKU-002',lot:'',quantity:'1'})
 ]},context(s)),/sin confirmar/);
});
test('zero decimal spellings are still explicit zeros, not blank or positive',()=>{
 const a=physicalReview({references:[ref({quantity:'0.000',explicitZero:true})]});
 assert.equal(a.ready,true);
 assert.equal(a.explicitZeros,1);
 const b=physicalReview({references:[ref({quantity:'0.00',explicitZero:false})]});
 assert.equal(b.ready,false);
});
test('overflow beyond numeric 16,3 cannot be accepted as confirmed physical',()=>{
 const a=physicalReview({references:[ref({quantity:'99999999999999.999'})]});
 assert.equal(a.ready,false);assert.equal(a.invalidQuantities,1);
});
