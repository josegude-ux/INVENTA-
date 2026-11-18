'use strict';
// Línea 100 · «Mi tramo» en el recuento real: pareja con un móvil y un único recuento (datos ficticios).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../real-counts.js'),'utf8');
const CAMP='camp-1';
const PAIR={id:'seg-1',campaign_id:CAMP,campaign_name:'Anual ficticia',from:'K00-P01',to:'K00-P03',cycle:1,me_name:'Operario Uno',partner_id:'op-2',partner_name:'Operario Dos',
 locations:[{code:'K00-P01',position:1,counted:true},{code:'K00-P02',position:2,counted:false},{code:'K00-P03',position:3,counted:false}]};
const ASSIGN=['K00-P03','K00-P01','K00-P02'].map((c,i)=>({id:'as-'+c,campaign_id:CAMP,location_code:c,campaigns:{name:'Anual ficticia',status:'active'}}));

function fixture(opts={}){
 const memory=new Map(),calls=[],posts=[],html=[];let loggedOut=0;let failPosts=!!opts.failPosts;
 const els=new Map([['realSyncStatus',{textContent:'',dataset:{}}],['realDiagStatus',{textContent:''}],['realAssignment',{value:''}]]);
 const values={realProduct:'ART-1',realLot:'',realQty:'4'};
 const management={profile:{display_name:'Operario Uno'},getUserId:()=>'op-1',isAuthenticated:()=>true,refreshProfile:async()=>{},
  logout:async()=>{loggedOut++;},
  realApi:async(table,params,method,body)=>{calls.push({table,params,method});
   if(method==='POST'){posts.push({table,body});if(failPosts){const e=Error('Sin conexión');e.status=0;throw e;}return [body];}
   if(table==='assignments')return ASSIGN;if(table==='rpc/my_segments'){if(opts.noRpc)throw Error('function inventa.my_segments() does not exist');return opts.segments||[PAIR];}return [];}};
 const w={INVENTA_MGMT:management,navigator:{},addEventListener(){}};
 vm.runInNewContext(src,{window:w,document:{getElementById:id=>{if(els.has(id))return els.get(id);if(id in values)return {value:values[id]};return null;}},
  localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},crypto:{randomUUID:()=>'mut-'+(calls.length)},
  place:h=>html.push(h),go(){},homeIcon:n=>'<svg data-icon="'+n+'"></svg>'});
 return {api:w.INVENTA_REAL,calls,posts,html,els,memory,last:()=>html.at(-1)||'',loggedOut:()=>loggedOut,setFail:v=>failPosts=v};
}

test('«Mi tramo» en pareja: tarjeta, nombres, avance y lectura sin POST',async()=>{
 const f=fixture();await f.api.open();
 const h=f.last();
 assert.match(h,/CUENTA REAL · RECUENTO EN PAREJA/);
 assert.match(h,/Mi tramo · K00-P01 → K00-P03/);
 assert.match(h,/Primer recuento · Anual ficticia · Pareja: Operario Uno \+ Operario Dos/);
 assert.match(h,/1 de 3 ubicaciones con recuento · siguiente: K00-P02/);
 assert.match(h,/Relevo: pasar a Operario Dos/);
 assert.doesNotMatch(h,/la pareja continúa en demostración/);
 const rpc=f.calls.find(c=>c.table==='rpc/my_segments');
 assert.equal(rpc.method,'GET','«Mi tramo» se lee sin escribir');
 assert.equal(f.posts.length,0);
});

test('las ubicaciones salen en orden de recorrido y se preselecciona la siguiente pendiente',async()=>{
 const f=fixture();await f.api.open();
 const h=f.last();
 assert.ok(h.indexOf('>K00-P01 ·')<h.indexOf('>K00-P02 ·')&&h.indexOf('>K00-P02 ·')<h.indexOf('>K00-P03 ·'),'orden K00-P01, P02, P03');
 assert.equal(f.els.get('realAssignment').value,'as-K00-P02');
 f.api.pick(CAMP,'K00-P03');
 assert.equal(f.els.get('realAssignment').value,'as-K00-P03');
});

test('el apunte no envía pareja: la fija el servidor desde el tramo',async()=>{
 const f=fixture();await f.api.open();
 await f.api.save();
 const p=f.posts.find(x=>x.table==='counts');
 assert.ok(p,'se envía el recuento');
 assert.equal(p.body.actor_id,'op-1');
 assert.equal(p.body.location_code,'K00-P02');
 assert.ok(!('partner_id' in p.body),'el navegador no decide la pareja');
});

test('relevo: con todo enviado cierra la sesión para que entre la pareja',async()=>{
 const f=fixture();await f.api.open();
 assert.equal(await f.api.handover(),true);
 assert.equal(f.loggedOut(),1);
});

test('relevo: con apuntes sin confirmar no cierra la sesión ni pierde datos',async()=>{
 const f=fixture();await f.api.open();
 f.setFail(true);
 await f.api.save();
 const queued=JSON.parse(f.memory.get('inventa-count-outbox-v1:op-1')||'[]');
 assert.equal(queued.length,1,'el apunte queda en la cola del móvil');
 assert.equal(await f.api.handover(),false);
 assert.equal(f.loggedOut(),0);
 assert.match(f.els.get('realSyncStatus').textContent,/Relevo no hecho/);
 assert.equal(JSON.parse(f.memory.get('inventa-count-outbox-v1:op-1')).length,1,'la cola se conserva');
});

test('tramo individual: sin botón de relevo y chip individual',async()=>{
 const f=fixture({segments:[{...PAIR,partner_id:null,partner_name:null}]});await f.api.open();
 const h=f.last();
 assert.match(h,/CUENTA REAL · RECUENTO INDIVIDUAL/);
 assert.match(h,/Individual: Operario Uno/);
 assert.doesNotMatch(h,/Relevo: pasar/);
});

test('segundo recuento: se indica que es ciego',async()=>{
 const f=fixture({segments:[{...PAIR,cycle:2,partner_id:null,partner_name:null}]});await f.api.open();
 assert.match(f.last(),/Segundo recuento \(ciego\)/);
});

test('sin la función de tramos en el servidor, la pantalla sigue como recuento individual',async()=>{
 const f=fixture({noRpc:true});await f.api.open();
 const h=f.last();
 assert.match(h,/Registrar recuento/);
 assert.match(h,/CUENTA REAL · RECUENTO INDIVIDUAL/);
 assert.doesNotMatch(h,/Mi tramo ·/);
});
