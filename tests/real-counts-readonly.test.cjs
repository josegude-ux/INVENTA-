'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../real-counts.js'),'utf8');
function fixture(){
 const memory=new Map(),elements=new Map([['realSyncStatus',{textContent:''}],['realDiagStatus',{textContent:''}]]),calls=[];
 let uid='mock-user',enabled=true,assignmentCount=0,afterRefresh=null,posts=0;
 const management={profile:{display_name:'SIM'},getUserId:()=>uid,isAuthenticated:()=>enabled,refreshProfile:async()=>{if(afterRefresh)afterRefresh();},
  realApi:async(table,params,method)=>{calls.push({table,params,method});if(method==='POST'){posts++;throw Error('Prohibido en diagnóstico');}if(table==='assignments')return Array.from({length:assignmentCount},(_,i)=>({id:'A'+i}));return []; }};
 const w={INVENTA_MGMT:management,navigator:{},addEventListener(){}};
 vm.runInNewContext(src,{window:w,document:{getElementById:id=>elements.get(id)||null},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},crypto:{randomUUID:()=> 'mock-mutation'},place(){},go(){}});
 return {api:w.INVENTA_REAL,memory,elements,calls,posts:()=>posts,setAssignments:n=>assignmentCount=n,setEnabled:b=>enabled=b,setUser:u=>uid=u,onRefresh:f=>afterRefresh=f};
}
test('read-only diagnosis authenticates and never writes',async()=>{
 const f=fixture();await f.api.open();f.calls.length=0;
 assert.equal(await f.api.diagnose(),true);assert.deepEqual(f.calls.map(c=>c.table),['assignments','counts']);
 assert.equal(f.posts(),0);assert.match(f.elements.get('realDiagStatus').textContent,/0 asignación/);
});
test('diagnosis explains active assignments without exposing stock',async()=>{
 const f=fixture();f.setAssignments(2);await f.api.open();assert.equal(await f.api.diagnose(),true);
 assert.match(f.elements.get('realDiagStatus').textContent,/2 asignación/);
 assert.equal(f.calls.some(c=>c.table==='stock_snapshot'),false);
});
test('disabled user diagnosis rejects without reads or writes',async()=>{
 const f=fixture();await f.api.open();f.calls.length=0;f.setEnabled(false);
 assert.equal(await f.api.diagnose(),false);assert.equal(f.calls.length,0);assert.equal(f.posts(),0);
});
test('user change during refresh prevents requests',async()=>{
 const f=fixture();await f.api.open();f.calls.length=0;f.onRefresh(()=>f.setUser('another-user'));
 assert.equal(await f.api.diagnose(),false);assert.equal(f.calls.length,0);
});
test('damaged local outbox does not break the real screen or erase data',async()=>{
 const f=fixture();f.memory.set('inventa-count-outbox-v1:mock-user','{invalid');
 await f.api.open();assert.equal(await f.api.diagnose(),true);
 assert.equal(f.memory.get('inventa-count-outbox-v1:mock-user'),'{invalid');
 assert.match(f.elements.get('realSyncStatus').textContent,/Cola local inaccesible/);
});
