'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {advanceLocation,reviewLocation}=require('../inventory-core/workflow.cjs');
test('opening or scanning without a physical count cannot finish an assigned location',()=>{
 let state=advanceLocation(null,'open');
 state=advanceLocation(state,'lookup');
 assert.equal(state.everStarted,false);
 assert.throws(()=>advanceLocation(state,'finish',{ready:true}),/sin recuento físico efectivo/);
});
test('an empty list of captured references is not enough evidence of physical completion',()=>{
 const review=reviewLocation({knownReferences:[],provisionals:[]});
 assert.deepEqual(review,{ready:false,confirmed:0,zeros:0,pending:0,provisionals:0});
});
test('after deleting all drafts, the location remains started but cannot be finished without confirmations',()=>{
 let s=advanceLocation(null,'quantity-entered');
 s=advanceLocation(s,'clear-draft');
 assert.equal(s.everStarted,true);
 assert.equal(s.status,'in_progress');
 assert.throws(()=>advanceLocation(s,'finish',{ready:reviewLocation().ready}),/sin confirmar/);
});
test('explicit zero remains a valid confirmed physical recuento, not a blank input',()=>{
 const review=reviewLocation({knownReferences:[{status:'confirmed',quantity:'0',explicitZero:true}]});
 assert.equal(review.ready,true);
 assert.equal(review.zeros,1);
 const s=advanceLocation(null,'zero-marked');
 assert.equal(advanceLocation(s,'finish',{ready:review.ready}).status,'finished');
});
test('a provisional pending physical confirmation blocks finish; administrative validation is separate',()=>{
 const review=reviewLocation({knownReferences:[{status:'confirmed',quantity:'7'}],provisionals:[{status:'pending',quantity:'3'}]});
 assert.equal(review.ready,false);
 assert.throws(()=>advanceLocation({status:'in_progress',everStarted:true},'finish',{ready:review.ready}),/sin confirmar/);
});
