'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifiedDoubleScan,validateAlternateBarcode,campaignClosureReview}=require('../inventory-core/administration.cjs');
test('provisional requires two distinct scan events, exact code with leading zeros',()=>{
 const r=verifiedDoubleScan([{source:'scanner',eventId:'1',code:'00012-A'},{source:'scanner',eventId:'2',code:'00012-A'}]);
 assert.equal(r.barcode,'00012-A');
 assert.throws(()=>verifiedDoubleScan([{source:'scanner',eventId:'1',code:'00012-A'}]),/dos lecturas/);
 assert.throws(()=>verifiedDoubleScan([{source:'scanner',eventId:'1',code:'00012-A'},{source:'scanner',eventId:'1',code:'00012-A'}]),/independientes/);
 assert.throws(()=>verifiedDoubleScan([{source:'scanner',eventId:'1',code:'00012-A'},{source:'scanner',eventId:'2',code:'12-A'}]),/no coinciden/);
 assert.throws(()=>verifiedDoubleScan([{source:'manual',eventId:'1',code:'12-A'},{source:'scanner',eventId:'2',code:'12-A'}]),/escáner/);
});
test('barcode conflict checks official and active alternates; no auto overwrite',()=>{
 const official=[{barcode:'0001',productCode:'P-A'}];
 const activeAlternates=[{barcode:'BAR-02',productCode:'P-B'}];
 assert.throws(()=>validateAlternateBarcode({barcode:'0001',productCode:'P-X',official,activeAlternates}),/otra referencia/);
 assert.throws(()=>validateAlternateBarcode({barcode:'BAR-02',productCode:'P-A',official,activeAlternates}),/otra referencia/);
 assert.equal(validateAlternateBarcode({barcode:'0001',productCode:'P-A',official,activeAlternates}).allowed,true);
});
test('campaign closure demands complete physical and administrative state',()=>{
 const input={locations:[{assigned:true,status:'finished',confirmedAll:true,segmentComplete:true,aisleComplete:true}],pendingProvisionals:0,blockingIncidents:0,differencesAccepted:true};
 assert.deepEqual(campaignClosureReview(input),{eligible:true,blockers:[]});
 assert.equal(campaignClosureReview({...input,pendingProvisionals:1}).eligible,false);
 assert.equal(campaignClosureReview({...input,blockingIncidents:1}).eligible,false);
 assert.equal(campaignClosureReview({...input,differencesAccepted:false}).eligible,false);
 assert.equal(campaignClosureReview({...input,locations:[{...input.locations[0],assigned:false}]}).eligible,false);
 assert.equal(campaignClosureReview({...input,locations:[{...input.locations[0],confirmedAll:false}]}).eligible,false);
});
test('physical differences alone do not block closure if general review accepted',()=>{
 const review=campaignClosureReview({locations:[{assigned:true,status:'finished',confirmedAll:true,segmentComplete:true,aisleComplete:true,difference:100}],differencesAccepted:true});
 assert.equal(review.eligible,true);
});
