'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculateCount}=require('../inventory-core/counting.cjs');
const {advanceLocation,reviewLocation,validateContiguousAssignments,aisleProgress}=require('../inventory-core/workflow.cjs');

test('empty remains uncounted; zero requires explicit marking',()=>{
 assert.deepEqual(calculateCount(),{status:'empty',quantity:null,explicitZero:false,breakdown:[]});
 assert.equal(calculateCount({markZero:true}).quantity,'0');
 assert.throws(()=>calculateCount({looseUnits:'0'}),/Marcar cero/);
 assert.throws(()=>calculateCount({markZero:true,looseUnits:'0'}),/vacíos/);
});
test('loose units, loose boxes and multiple equivalent pallets sum exactly',()=>{
 const x=calculateCount({looseUnits:'1,125',boxGroups:[{boxes:'2',unitsPerBox:'8'}],palletGroups:[{layers:'5',boxesPerBase:'4',unitsPerBox:'6'}]});
 assert.equal(x.quantity,'137.125');assert.equal(x.breakdown.length,3);
});
test('mixed pallet configurations use separate subtotals, not per-pallet fichas',()=>{
 const x=calculateCount({palletGroups:[{layers:3,boxesPerBase:4,unitsPerBox:10},{layers:2,boxesPerBase:5,unitsPerBox:12}]});
 assert.equal(x.quantity,'240');assert.deepEqual(x.breakdown.map(v=>v.subtotal),['120','120']);
});
test('reject invalid decimals, negative and incomplete packaging',()=>{
 for(const value of ['-1','1.2345','1e3','Infinity','3 foo'])assert.throws(()=>calculateCount({looseUnits:value}));
 assert.throws(()=>calculateCount({boxGroups:[{boxes:2}]}),/Unidades\/caja/);
 assert.throws(()=>calculateCount({palletGroups:[{layers:1,boxesPerBase:4,unitsPerBox:0}]}),/entero positivo/);
 assert.throws(()=>calculateCount({boxGroups:[{boxes:'9999999999999',unitsPerBox:2}]}),/fuera de rango/);
});
test('location only starts on actual count; started state survives draft clearing',()=>{
 let s=advanceLocation(null,'open');s=advanceLocation(s,'lookup');assert.equal(s.status,'not_started');
 s=advanceLocation(s,'zero-marked');assert.equal(s.status,'in_progress');
 s=advanceLocation(s,'clear-draft');assert.deepEqual(s,{status:'in_progress',everStarted:true});
});
test('finish is manual, requires all confirmed; reopen only in open campaign',()=>{
 const review=reviewLocation({knownReferences:[{status:'confirmed',quantity:'0',explicitZero:true},{status:'draft'}],provisionals:[{status:'confirmed',quantity:'4'}]});
 assert.deepEqual(review,{ready:false,confirmed:2,zeros:1,pending:1,provisionals:1});
 assert.throws(()=>advanceLocation({status:'in_progress',everStarted:true},'finish',{ready:review.ready}),/sin confirmar/);
 const finished=advanceLocation({status:'in_progress',everStarted:true},'finish',{ready:true});
 assert.equal(finished.status,'finished');
 assert.throws(()=>advanceLocation(finished,'quantity-entered'),/reapertura/);
 assert.throws(()=>advanceLocation(finished,'reopen',{campaignStatus:'closed'}),/campaña abierta/);
 assert.equal(advanceLocation(finished,'reopen').status,'in_progress');
});
test('inclusive K00–K25 K26–K50, zero-padded strings, and non-overlap',()=>{
 const codes=Array.from({length:51},(_,i)=>'K'+String(i).padStart(2,'0'));
 const auth={a:codes.slice(0,26),b:codes.slice(0,26),c:codes.slice(26),d:codes.slice(26)};
 const segments=[{teamId:'P1',from:'K00',to:'K25',operators:['a','b']},{teamId:'P2',from:'K26',to:'K50',operators:['c','d']}];
 const r=validateContiguousAssignments({orderedLocationCodes:codes,segments,authorizedByOperator:auth});
 assert.equal(r.assigned,51);assert.equal(r.owners.K25,'P1');assert.equal(r.owners.K26,'P2');assert.deepEqual(r.missing,[]);
 assert.throws(()=>validateContiguousAssignments({orderedLocationCodes:codes,segments:[...segments,{teamId:'P3',from:'K25',to:'K26',operators:['a']}],authorizedByOperator:auth}),/solapada/);
});
test('partial assignment permitted but aisle not completed',()=>{
 const r=validateContiguousAssignments({orderedLocationCodes:['K00','K01','K02'],segments:[{teamId:'solo',from:'K00',to:'K01',operators:['a']}],authorizedByOperator:{a:['K00','K01']}});
 assert.deepEqual(r.missing,['K02']);
 assert.equal(aisleProgress({locationCodes:['K00','K01','K02'],assignmentOwners:r.owners,finishedCodes:['K00','K01']}).completed,false);
});
test('started locations cannot change team; unauthorized companion is rejected',()=>{
 const base={orderedLocationCodes:['K00','K01'],segments:[{teamId:'new',from:'K00',to:'K01',operators:['a','b']}],authorizedByOperator:{a:['K00','K01'],b:['K01']}};
 assert.throws(()=>validateContiguousAssignments(base),/no tiene autorización/);
 assert.throws(()=>validateContiguousAssignments({...base,authorizedByOperator:{a:['K00','K01'],b:['K00','K01']},originalOwners:{K00:'old'},startedCodes:['K00']}),/prohibido traspasar/);
});
test('cannot silently unassign a started location',()=>{
 assert.throws(()=>validateContiguousAssignments({orderedLocationCodes:['K00','K01'],segments:[{teamId:'P2',from:'K01',to:'K01',operators:['a']}],authorizedByOperator:{a:['K01']},originalOwners:{K00:'P1'},startedCodes:['K00']}),/conservar el equipo original/);
});
test('physical aisle completion is independent of administrative incidents',()=>{
 const r=aisleProgress({locationCodes:['K00','K01'],assignmentOwners:{K00:'P1',K01:'P1'},finishedCodes:['K00','K01']});
 assert.equal(r.completed,true);
});
