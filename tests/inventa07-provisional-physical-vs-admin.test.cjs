'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {advanceLocation,reviewLocation}=require('../inventory-core/workflow.cjs');
const {campaignClosureReview}=require('../inventory-core/administration.cjs');
const location={assigned:true,status:'finished',confirmedAll:true,segmentComplete:true,aisleComplete:true};
test('administratively unresolved provisional can be physically confirmed and finish the location',()=>{
 const review=reviewLocation({
  knownReferences:[{status:'confirmed',quantity:'4'}],
  provisionals:[{status:'pending',physicalStatus:'confirmed',quantity:'3'}]
 });
 assert.equal(review.ready,true);
 assert.equal(review.confirmed,2);
 assert.equal(review.pending,0);
 assert.equal(review.provisionals,1);
 const started=advanceLocation(null,'provisional-added');
 assert.equal(advanceLocation(started,'finish',{ready:review.ready}).status,'finished');
});
test('a provisional with administrative pending and physical draft still blocks location completion',()=>{
 const review=reviewLocation({
  knownReferences:[{status:'confirmed',quantity:'4'}],
  provisionals:[{status:'pending',physicalStatus:'draft',quantity:'3'}]
 });
 assert.equal(review.ready,false);
 assert.equal(review.pending,1);
});
test('legacy confirmed provisional without an independent physicalStatus remains accepted',()=>{
 const review=reviewLocation({provisionals:[{status:'confirmed',quantity:'0',explicitZero:true}]});
 assert.equal(review.ready,true);assert.equal(review.zeros,1);
});
test('physical completion does not authorize campaign closure while provisional awaits Administration',()=>{
 const review=campaignClosureReview({locations:[location],pendingProvisionals:1,blockingIncidents:0,differencesAccepted:true});
 assert.equal(review.eligible,false);
 assert.ok(review.blockers.some(x=>/provisionales/.test(x)));
});
test('completed physical location and resolved provisionals allow later administrative review, not automatic closure',()=>{
 const review=campaignClosureReview({locations:[location],pendingProvisionals:0,blockingIncidents:0,differencesAccepted:false});
 assert.equal(review.eligible,false);
 assert.ok(review.blockers.some(x=>/aceptación expresa/.test(x)));
});
