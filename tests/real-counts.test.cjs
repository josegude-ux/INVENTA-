'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../real-counts.js'),'utf8');
function setup(){
 let uid='qa-user-a',posts=0,mode='ok',stored=null,active=true;
 const memory=new Map(),elements=new Map(),queries=[];
 const body={campaign_id:'qa-campaign',location_code:'qa-location',product_code:'qa-product',lot:'',quantity:2,actor_id:uid,entries:[{type:'units',quantity:2}],client_mutation_id:'qa-mutation',previous_id:null,correction_reason:null};
 const mgmt={getUserId:()=>uid,isAuthenticated:()=>active,refreshProfile:async()=>{},profile:{display_name:'QA'},realApi:async(table,params,method,payload)=>{
  queries.push(table);if(table==='counts'&&method==='POST'){posts++;if(mode==='denied')throw Object.assign(Error('Denied'),{status:403});if(mode==='offline')throw TypeError('Network lost');
   if(stored)throw Object.assign(Error('Duplicate'),{status:409});
   stored=JSON.parse(JSON.stringify(payload));if(mode==='lost-response')throw TypeError('Response lost');return [stored];}
  if(table==='counts')return stored?[stored]:[];
  return [];
 }};
 const window={INVENTA_MGMT:mgmt,addEventListener(){},navigator:{}};
 vm.runInNewContext(source,{window,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{getElementById:id=>elements.get(id)||null},crypto:{randomUUID:()=> 'qa-new-mutation'},place(){},go(){}});
 return {api:window.INVENTA_REAL,body,memory,elements,queries,seed(){memory.set('inventa-count-outbox-v1:qa-user-a',JSON.stringify([{body}]))},queue:()=>JSON.parse(memory.get('inventa-count-outbox-v1:qa-user-a')||'[]'),posts:()=>posts,mode:v=>mode=v,user:v=>uid=v,active:v=>active=v,stored:()=>stored};
}
test('offline retry retains one mutation and confirms it once',async()=>{
 const h=setup();h.seed();h.mode('offline');await assert.rejects(h.api.flush());assert.equal(h.queue().length,1);
 h.mode('ok');await h.api.flush();assert.equal(h.queue().length,0);assert.equal(h.stored().client_mutation_id,h.body.client_mutation_id);
});
test('lost server response is reconciled without duplicate count',async()=>{
 const h=setup();h.seed();h.mode('lost-response');await assert.rejects(h.api.flush());assert.equal(h.queue().length,1);
 h.mode('ok');await h.api.flush();assert.equal(h.queue().length,0);assert.equal(h.posts(),2);
});
test('conflicting payload remains pending for review',async()=>{
 const h=setup();h.seed();h.mode('lost-response');await assert.rejects(h.api.flush());
 h.stored().quantity=99;h.mode('ok');await assert.rejects(h.api.flush(),/Conflicto/);assert.equal(h.queue().length,1);
});
test('user switch does not submit another user queue',async()=>{
 const h=setup();h.seed();h.user('qa-user-b');await h.api.flush();assert.equal(h.posts(),0);assert.equal(h.queue().length,1);
});
test('disabled account and forbidden requests preserve the queue',async()=>{
 const h=setup();h.seed();h.active(false);await assert.rejects(h.api.flush());assert.equal(h.posts(),0);
 h.active(true);h.mode('denied');await assert.rejects(h.api.flush());assert.equal(h.queue().length,1);
});
test('JSONB object ordering does not create a false conflict',()=>{
 const h=setup(),a=h.body,b=JSON.parse(JSON.stringify(a));b.entries=[{quantity:2,type:'units'}];
 assert.equal(h.api.payloadEqual(a,b),true);b.actor_id='other';assert.equal(h.api.payloadEqual(a,b),false);
});
test('operator view never requests BC stock and reads shared server counts',async()=>{
 const h=setup();await h.api.open();assert.equal(h.posts(),0);assert.ok(h.queries.includes('assignments'));assert.ok(h.queries.includes('counts'));assert.ok(!h.queries.includes('stock_snapshot'));
});
