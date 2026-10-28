'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildLocationView,renderLocationView}=require('../inventory-ui/location-view.js');
const official=(x={})=>({productCode:'00001234',lot:'L0007',description:'Tornillería',
 status:'uncounted',quantity:null,...x});
const provisional=(x={})=>({barcode:'TEMP-8',description:'Pendiente de identificar',
 status:'pending',physicalStatus:'confirmed',quantity:'2',
 explicitZero:false,...x});
const input=(r=[],p=[],more={})=>({locationCode:'K00-P01',
 locationStatus:'in_progress',references:r,provisionals:p,...more});
test('unconfirmed physical references always appear before the confirmed group',()=>{
 const m=buildLocationView(input([
  official({productCode:'C',status:'confirmed',quantity:'9'}),
  official({productCode:'A'}),
  official({productCode:'D',status:'confirmed',quantity:'4'}),
  official({productCode:'B',status:'draft',quantity:'3'})
 ]));
 assert.deepEqual(m.pending.map(x=>x.code),['A','B']);
 assert.deepEqual(m.confirmed.map(x=>x.code),['C','D']);
 assert.equal(m.confirmedAtEnd,true);
 assert.deepEqual(m.summary,{total:4,pending:2,confirmed:2,provisional:0,
  administrativePending:0,explicitZeros:0});
});
test('leading zeros in barcode and lot are preserved exactly',()=>{
 const m=buildLocationView(input([official({status:'confirmed',quantity:'1'})]));
 assert.equal(m.confirmed[0].code,'00001234');
 assert.equal(m.confirmed[0].lot,'L0007');
 assert.match(m.confirmed[0].id,/00001234/);
});
test('exact fractional physical amount and explicit zero are distinct',()=>{
 const m=buildLocationView(input([
  official({productCode:'X',status:'confirmed',quantity:'0',explicitZero:true}),
  official({productCode:'Y',status:'confirmed',quantity:'1,125'})
 ]));
 assert.equal(m.summary.explicitZeros,1);
 assert.equal(m.confirmed[0].quantity,'0');
 assert.equal(m.confirmed[1].quantity,'1.125');
});
test('empty quantity stays blank and pending rather than becoming zero',()=>{
 const m=buildLocationView(input([official()]));
 assert.equal(m.pending[0].quantity,null);
 assert.equal(m.pending[0].physicalStatusLabel,'Sin contar');
 assert.equal(m.summary.explicitZeros,0);
 assert.equal(m.physicallyReadyCandidate,false);
});
test('physically confirmed provisional stays in confirmed group even while admin pending',()=>{
 const m=buildLocationView(input([official()], [provisional()]));
 assert.equal(m.confirmed.length,1);assert.equal(m.pending.length,1);
 assert.equal(m.confirmed[0].kind,'provisional');
 assert.equal(m.confirmed[0].administrativePending,true);
 assert.equal(m.summary.administrativePending,1);
});
test('physically completed solely provisional is only a candidate and never grants closure',()=>{
 const m=buildLocationView(input([], [provisional()]));
 assert.equal(m.physicallyReadyCandidate,true);
 assert.equal(m.requiresServerAuthorization,true);
 assert.equal(Object.hasOwn(m,'canFinish'),false);
});
test('unconfirmed provisional remains pending even if catalog status is resolved',()=>{
 const m=buildLocationView(input([], [
  provisional({status:'resolved_duplicate',physicalStatus:'draft',quantity:'1'})
 ]));
 assert.equal(m.pending.length,1);
 assert.equal(m.confirmed.length,0);
 assert.equal(m.summary.administrativePending,0);
});
test('legacy provisional without physical status does not assume physical confirmation',()=>{
 const m=buildLocationView(input([], [
  {barcode:'LEGACY',status:'pending',quantity:'3',explicitZero:false}
 ]));
 assert.equal(m.pending.length,1);assert.equal(m.physicallyReadyCandidate,false);
});
test('provisional physical confirmation may be distinct from admin status pending',()=>{
 const m=buildLocationView(input([], [
  {barcode:'LEGACY2',status:'pending',physicalStatus:'confirmed',quantity:'3'}
 ]));
 assert.equal(m.confirmed.length,1);assert.equal(m.summary.administrativePending,1);
});
test('confirmed reference awaiting justified correction moves back to pending group',()=>{
 const m=buildLocationView(input([
  official({productCode:'X',status:'confirmed',quantity:'7',correctionPending:true}),
  official({productCode:'Y',status:'confirmed',quantity:'8'})
 ]));
 assert.equal(m.pending[0].physicalStatus,'correction-pending');
 assert.equal(m.pending[0].canCorrect,false);
 assert.equal(m.confirmed[0].code,'Y');
});
test('finished location never offers edits or corrections in presentation model',()=>{
 const m=buildLocationView(input([
  official({productCode:'X',status:'draft',quantity:'1'}),
  official({productCode:'Y',status:'confirmed',quantity:'2'})
 ],[],{locationStatus:'finished'}));
 assert.equal(m.pending[0].canEdit,false);
 assert.equal(m.confirmed[0].canCorrect,false);
});
test('operator view is strictly allowlisted with no stock theoretical, BC differences or credentials',()=>{
 const m=buildLocationView(input([official({status:'confirmed',quantity:'2',
  theoreticalStock:999,bcDifference:997,internalCost:123,
  service_role:'secret',assignedOperators:['A','B']})],
  [provisional({adminDecision:'confidential',theoreticalQuantity:200})],
  {allBCStock:{SKU:9999},bearerToken:'private'}));
 const text=JSON.stringify(m);
 for(const forbidden of ['theoreticalStock','bcDifference','internalCost',
  'service_role','allBCStock','bearerToken','adminDecision','theoreticalQuantity',
  'confidential','secret'])assert.equal(text.includes(forbidden),false,forbidden);
});
test('distinct official lots are separate while duplicate product+lot is rejected',()=>{
 assert.equal(buildLocationView(input([
  official({lot:'A'}),official({lot:'B'})
 ])).summary.total,2);
 assert.throws(()=>buildLocationView(input([official(),official()])),/duplicados/);
});
test('duplicate provisional barcode is never silently combined',()=>{
 assert.throws(()=>buildLocationView(input([], [provisional(),provisional()])),/duplicado/);
});
test('confirmed zero without explicit mark and malformed quantities rejected',()=>{
 assert.throws(()=>buildLocationView(input([
  official({status:'confirmed',quantity:'0'})])),/Cero/);
 assert.throws(()=>buildLocationView(input([
  official({status:'confirmed',quantity:null})])),/cantidad física/);
 assert.throws(()=>buildLocationView(input([
  official({status:'draft',quantity:'-1'})])),/Cantidad física/);
 assert.throws(()=>buildLocationView(input([
  official({status:'draft',quantity:'2.1234'})])),/Cantidad física/);
});
test('a screen with no physical entries is not a closed or zero-counted location',()=>{
 const m=buildLocationView(input());
 assert.equal(m.summary.total,0);
 assert.equal(m.physicallyReadyCandidate,false);
});
test('unknown statuses and missing keys are denied rather than guessing a state',()=>{
 assert.throws(()=>buildLocationView(input([official({status:'unknown'})])),/Estado físico/);
 assert.throws(()=>buildLocationView(input([official({productCode:''})])),/obligatorio/);
 assert.throws(()=>buildLocationView(input([],[],{locationStatus:'unrecognized'})),/Estado de ubicación/);
});
test('render creates text nodes, leaves confirmed section last and collapsed by default',()=>{
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.className='';this.textContent='';}
  append(...c){this.children.push(...c);}
  replaceChildren(...c){this.children=c;}
 }
 const previous=global.document;
 global.document={createElement:tag=>new Element(tag)};
 try{
  const v=buildLocationView(input([
   official({productCode:'<img src=x onerror=evil()>',status:'confirmed',quantity:'1'}),
   official({productCode:'B',description:'<script>evil()</script>'})
  ]));
  const target=new Element('div');const rendered=renderLocationView(target,v);
  assert.equal(target.children[0],rendered);
  const details=rendered.children.find(x=>x.tagName==='details');
  assert.equal(details.className,'vi07-location-confirmed');
  assert.equal(details.open,undefined);
  const articles=details.children[1].children.filter(x=>x.tagName==='article');
  assert.equal(articles[0].children[0].textContent,'<img src=x onerror=evil()>');
  assert.equal(rendered.children.indexOf(details),rendered.children.length-2);
 }finally{global.document=previous;}
});
test('render source never uses innerHTML or makes active network calls',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../inventory-ui/location-view.js'),'utf8');
 assert.doesNotMatch(source,/innerHTML|fetch\(|XMLHttpRequest|supabase|localStorage|sessionStorage/);
 assert.match(source,/textContent=String\(value\)/);
 assert.match(source,/requiresServerAuthorization:true/);
});
