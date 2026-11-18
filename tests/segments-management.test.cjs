'use strict';
// Fase B · Tramos: interfaz de Gestión almacén con API simulada (datos ficticios).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'warehouse-management.js'),'utf8');
const realCounts=fs.readFileSync(path.join(root,'real-counts.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/visura-unificado-pendiente/20261118140000_inventa_tramos.sql'),'utf8');

const CAMP='00000000-0000-4000-8000-00000000ca01';
const SEG={id:'seg-1',campaign_id:CAMP,from_code:'K00-P01',to_code:'K09-P08',cycle:1,operator_id:'op-1',operator_name:'Operario Uno',
 partner_id:'op-2',partner_name:'Operario Dos',status:'active',version:3,total:79,counted:2,created_at:'2026-11-17T10:00:00Z',released_at:null,last_change_reason:null};
const PREVIEW={campaign_id:CAMP,cycle:1,from:'K00-P01',to:'K09-P08',total:79,first:'K00-P01',last:'K09-P08',
 sample:['K00-P01','K00-P02','K00-P03'],excluded_format:{count:2,codes:['K03-P03-A','K05']},disabled:1,
 without_first_count:{count:0,codes:[]},conflicts:{count:0,items:[]},fingerprint:'huella-1'};

function harness(role,opts={}){
 const values={managerEmail:'sup@example.invalid',managerPassword:'example-strong-pass',...(opts.values||{})};
 const seen=[],posts=[],queries=[];let uuid=0;const failures={...(opts.failOnce||{})};
 const rpc={'rpc/list_segments':[SEG],'rpc/preview_segment':PREVIEW,'rpc/assign_segment':'new-seg','rpc/reassign_segment':4,'rpc/release_segment':null,...(opts.rpc||{})};
 const fetch=async(url,o)=>{
  const method=o?.method||'GET';queries.push({url,method});
  let data=[];
  if(url.includes('/auth/v1/token'))data={access_token:'t',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'sup-id'}};
  else if(url.includes('/rest/v1/profiles?')&&url.includes('user_id=eq.'))data=[{user_id:'sup-id',role,enabled:true,display_name:'Supervisora'}];
  else if(url.includes('/rest/v1/')){
   const table=url.split('/rest/v1/')[1].split('?')[0];
   if(method==='POST')posts.push({table,body:JSON.parse(o.body||'null')});
   if(failures[table]){delete failures[table];return {ok:false,status:503,text:async()=>JSON.stringify({message:'Respuesta perdida'})};}
   if(table in rpc)data=rpc[table];
   else if(table==='campaigns')data=[{id:CAMP,name:'Anual ficticia',kind:'annual',status:'active'}];
   else if(table==='profiles')data=[{user_id:'op-1',display_name:'Operario Uno',role:'operator',enabled:true},{user_id:'op-2',display_name:'Operario Dos',role:'operator',enabled:true},{user_id:'sup-id',display_name:'Supervisora',role:'supervisor',enabled:true}];
   else if(table==='locations')data=[{code:'K00-P01'},{code:'K09-P08'}];
   else if(table==='assignments')data=opts.loose||[];
  }
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
 };
 const doc={getElementById(id){return {value:values[id]===undefined?'':values[id],files:[],textContent:'',checked:true};}};
 const factory=new Function('window','document','fetch','localStorage','crypto','place','go','managerUser','consultUser','screen','confirm',code+';\nreturn window.INVENTA_MGMT;');
 const storage=new Map();
 const obj=factory({addEventListener(){}},doc,fetch,{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  {randomUUID:()=>'orden-'+(++uuid)},html=>seen.push(html),()=>{},'','','home',()=>true);
 return {obj,seen,posts,queries,values,last:()=>seen.at(-1)||''};
}
async function openTramos(role='supervisor',opts){
 const h=harness(role,opts);await h.obj.signIn();h.obj.open('assignments');await h.obj.render();return h;
}
const tick=()=>new Promise(r=>setTimeout(r,0));

test('Tramos sustituye a la asignación ubicación a ubicación',async()=>{
 const h=await openTramos();
 const html=h.last();
 assert.match(html,/>Tramos</);
 assert.match(html,/Asignar un tramo/);
 assert.doesNotMatch(html,/Asignar ubicación|Nueva asignación/);
 assert.match(html,/K00-P01 → K09-P08/);
 assert.match(html,/Primer recuento · Operario Uno \+ Operario Dos/);
 assert.match(html,/Segundo recuento \(ciego, otras personas\)/);
 assert.match(html,/2 de 79 ubicaciones con algún recuento \(3 %\)/);
 assert.match(html,/<progress class="segment-progress" max="79" value="2"/);
 const list=h.posts.find(p=>p.table==='rpc/list_segments');
 assert.deepEqual(list.body,{p_campaign:CAMP});
 assert.ok(!h.queries.some(q=>/stock_snapshot|quantity/.test(q.url)),'Tramos no consulta el teórico');
});

test('vista previa muestra total, orden y avisos antes de asignar',async()=>{
 const h=await openTramos('supervisor',{values:{segCampaign:CAMP,segFrom:'k00-p01',segTo:'K09-P08',segOp:'op-1',segPartner:'op-2'}});
 await h.obj.previewSegment();
 const prev=h.posts.find(p=>p.table==='rpc/preview_segment');
 assert.deepEqual(prev.body,{p_campaign:CAMP,p_from:'k00-p01',p_to:'K09-P08',p_cycle:1});
 const html=h.last();
 assert.match(html,/Primer recuento · 79 ubicaciones/);
 assert.match(html,/De K00-P01 a K09-P08/);
 assert.match(html,/2 con otro formato quedan fuera: K03-P03-A, K05/);
 assert.match(html,/1 deshabilitada queda fuera/);
 assert.match(html,/Asignar tramo \(79 ubicaciones\)/);
 assert.ok(!h.posts.some(p=>p.table==='rpc/assign_segment'),'la vista previa no asigna nada');
});

test('con solapes no se ofrece asignar y se dice quién tiene las ubicaciones',async()=>{
 const conflicted={...PREVIEW,conflicts:{count:8,items:[{location_code:'K09-P01',people:'Operario Uno + Operario Dos'}]}};
 const h=await openTramos('supervisor',{rpc:{'rpc/preview_segment':conflicted},values:{segCampaign:CAMP,segFrom:'K09-P01',segTo:'K10-P08'}});
 await h.obj.previewSegment();
 const html=h.last();
 assert.match(html,/8 ubicaciones ya están asignadas en este recuento: K09-P01 \(Operario Uno \+ Operario Dos\)/);
 assert.doesNotMatch(html,/Asignar tramo \(/);
});

test('asignar en un paso envía pareja y huella de la vista previa',async()=>{
 const h=await openTramos('supervisor',{values:{segCampaign:CAMP,segFrom:'K00-P01',segTo:'K09-P08',segOp:'op-1',segPartner:'op-2'}});
 await h.obj.previewSegment();
 await h.obj.confirmSegment();
 const a=h.posts.find(p=>p.table==='rpc/assign_segment');
 assert.deepEqual(a.body,{p_mutation_id:a.body.p_mutation_id,p_campaign:CAMP,p_from:'K00-P01',p_to:'K09-P08',p_cycle:1,p_operator:'op-1',p_partner:'op-2',p_fingerprint:'huella-1'});
 assert.match(a.body.p_mutation_id,/^orden-\d+$/);
 assert.match(h.last(),/Tramo asignado: 79 ubicaciones de K00-P01 a K09-P08/);
});

test('un tramo individual envía la pareja como null',async()=>{
 const h=await openTramos('supervisor',{values:{segCampaign:CAMP,segFrom:'K00-P01',segTo:'K09-P08',segOp:'op-1',segPartner:''}});
 await h.obj.previewSegment();await h.obj.confirmSegment();
 assert.equal(h.posts.find(p=>p.table==='rpc/assign_segment').body.p_partner,null);
});

test('si el rango cambia tras la vista previa no se asigna',async()=>{
 const h=await openTramos('supervisor',{values:{segCampaign:CAMP,segFrom:'K00-P01',segTo:'K09-P08',segOp:'op-1'}});
 await h.obj.previewSegment();
 h.values.segTo='K10-P08';
 await h.obj.confirmSegment();
 assert.ok(!h.posts.some(p=>p.table==='rpc/assign_segment'));
 assert.match(h.last(),/el rango ha cambiado; vuelve a ver las ubicaciones del tramo/);
});

test('la pareja no puede ser la misma persona ni faltar la persona 1',async()=>{
 const h=await openTramos('supervisor',{values:{segCampaign:CAMP,segFrom:'K00-P01',segTo:'K09-P08',segOp:'op-1',segPartner:'op-1'}});
 await h.obj.previewSegment();await h.obj.confirmSegment();
 assert.match(h.last(),/la pareja debe ser otra persona/);
 h.values.segOp='';h.values.segPartner='';
 await h.obj.confirmSegment();
 assert.match(h.last(),/elige la persona 1/);
 assert.ok(!h.posts.some(p=>p.table==='rpc/assign_segment'));
});

test('reasignar y liberar exigen motivo y envían la versión del tramo',async()=>{
 const h=await openTramos('supervisor',{values:{segCampaign:CAMP,'segOp_seg-1':'op-1','segPartner_seg-1':'','segReason_seg-1':'no'}});
 await h.obj.segmentAction('seg-1','reassign');
 assert.match(h.last(),/Guardar reasignación/);
 await h.obj.reassignSegment('seg-1');
 assert.ok(!h.posts.some(p=>p.table==='rpc/reassign_segment'));
 assert.match(h.last(),/al menos cinco caracteres/);
 h.values['segReason_seg-1']='cambio de turno';
 await h.obj.reassignSegment('seg-1');
 const ra=h.posts.find(p=>p.table==='rpc/reassign_segment').body;
 assert.deepEqual(ra,{p_mutation_id:ra.p_mutation_id,p_segment:'seg-1',p_operator:'op-1',p_partner:null,p_reason:'cambio de turno',p_version:3});
 h.values['segReason_seg-1']='partir en dos tramos';
 await h.obj.releaseSegment('seg-1');
 const rl=h.posts.find(p=>p.table==='rpc/release_segment').body;
 assert.deepEqual(rl,{p_mutation_id:rl.p_mutation_id,p_segment:'seg-1',p_reason:'partir en dos tramos',p_version:3});
 assert.notEqual(rl.p_mutation_id,ra.p_mutation_id,'cada orden distinta lleva su propio identificador');
 assert.match(h.last(),/Lo ya contado se conserva/);
});

test('asignaciones antiguas sin tramo se muestran con estados en español',async()=>{
 const h=await openTramos('supervisor',{loose:[{id:'as-1',location_code:'A01-01',operator_id:'op-1',status:'in_progress',created_at:'2026-11-01T10:00:00Z'}]});
 const html=h.last();
 assert.match(html,/Asignaciones anteriores sin tramo \(1\)/);
 assert.match(html,/En curso/);
 assert.doesNotMatch(html,/>in_progress</);
});

test('un Operario no abre Tramos',async()=>{
 const h=harness('operator');await h.obj.signIn();h.obj.open('assignments');await tick();
 assert.ok(!h.posts.some(p=>p.table.startsWith('rpc/')));
});

test('el recuento real solo usa asignaciones activas y la migración no borra',()=>{
 assert.equal((realCounts.match(/active=eq\.true/g)||[]).length,2);
 assert.doesNotMatch(migration,/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
 assert.match(migration,/PENDIENTE\. NO aplicada en el proyecto unificado/);
});

test('si se pierde la respuesta, el reintento reutiliza el mismo identificador de orden',async()=>{
 const h=await openTramos('supervisor',{failOnce:{'rpc/assign_segment':true},values:{segCampaign:CAMP,segFrom:'K00-P01',segTo:'K09-P08',segOp:'op-1'}});
 await h.obj.previewSegment();
 await h.obj.confirmSegment();
 assert.match(h.last(),/No se ha podido guardar/);
 await h.obj.confirmSegment();
 const calls=h.posts.filter(p=>p.table==='rpc/assign_segment');
 assert.equal(calls.length,2);
 assert.equal(calls[0].body.p_mutation_id,calls[1].body.p_mutation_id);
 assert.match(h.last(),/Tramo asignado/);
});

test('segundo recuento: pide ciclo 2 y avisa de ubicaciones sin primer recuento',async()=>{
 const c2={...PREVIEW,cycle:2,total:2,first:'K00-P01',last:'K00-P02',sample:['K00-P01','K00-P02'],
  without_first_count:{count:6,codes:['K00-P03','K00-P04','K00-P05','K00-P06','K00-P07','K00-P08']},excluded_format:{count:0,codes:[]},disabled:0};
 const h=await openTramos('supervisor',{rpc:{'rpc/preview_segment':c2},values:{segCampaign:CAMP,segCycle:'2',segFrom:'K00-P01',segTo:'K00-P08',segOp:'op-2'}});
 await h.obj.previewSegment();
 assert.equal(h.posts.find(p=>p.table==='rpc/preview_segment').body.p_cycle,2);
 const html=h.last();
 assert.match(html,/Segundo recuento · 2 ubicaciones/);
 assert.match(html,/6 sin primer recuento quedan fuera: K00-P03/);
 assert.match(html,/Recuento ciego: no pueden hacerlo quienes participaron en el primero/);
 await h.obj.confirmSegment();
 assert.equal(h.posts.find(p=>p.table==='rpc/assign_segment').body.p_cycle,2);
});
