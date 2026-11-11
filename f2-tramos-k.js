/* VISURA INVENTA F2 · Tramos K. Integrated screen, server-side read permissions.
   Write actions deliberately unavailable until the F2 transactional RPC is installed
   and its RLS/idempotency acceptance tests pass. No client-side role spoofing. */
(function(root){
'use strict';
var seq=0,loading=false,notice='',data={campaigns:[],locations:[],assignments:[],profiles:[]};
function mg(){return root.INVENTA_MGMT;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function isK(code){return /^K[0-9]{2,}[-_]/i.test(String(code||''));}
function active(c){return c.status==='active';}
function rows(list){return list.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('');}
async function open(){
 var m=mg();if(!m||!m.isAuthenticated())throw Error('Inicia sesión para consultar F2.');
 if(!m.isManager())throw Error('F2 requiere una sesión autorizada.');
 var id=++seq;loading=true;notice='';draw();
 try{
  await m.refreshProfile();
  if(id!==seq)return;
  if(!m.isManager())throw Error('Permisos retirados. No se muestra información.');
  var results=await Promise.all([
   m.realApi('campaigns','select=id,name,status&order=created_at.desc&limit=100'),
   m.realApi('locations','select=code,aisle,enabled&order=code&limit=3000'),
   m.realApi('assignments','select=id,campaign_id,location_code,operator_id,status,created_at&order=created_at.desc&limit=3000'),
   m.realApi('profiles','select=user_id,display_name,role,enabled&limit=500')
  ]);
  if(id!==seq)return;
  if(!m.isManager())throw Error('Sesión no autorizada.');
  data={campaigns:results[0],locations:results[1].filter(function(l){return isK(l.code)&&l.enabled;}),assignments:results[2].filter(function(a){return isK(a.location_code);}),profiles:results[3]};
 }catch(e){if(id!==seq)return;data={campaigns:[],locations:[],assignments:[],profiles:[]};notice='No se ha podido cargar F2: '+e.message;}
 finally{if(id===seq){loading=false;draw();}}
}
function draw(){
 var target=document.getElementById('f2TramosPanel');if(!target)return;
 var m=mg();if(!m||!m.isManager()){target.textContent='Acceso no autorizado';return;}
 if(loading){target.textContent='Consultando ubicaciones y asignaciones K…';return;}
 var camps=data.campaigns.filter(active),camp=camps[0],as=data.assignments.filter(function(a){return camp&&a.campaign_id===camp.id;});
 var owners={};as.forEach(function(a){if(a.status==='pending'||a.status==='in_progress'){(owners[a.location_code]||(owners[a.location_code]=[])).push(a);}});
 var conflicts=Object.keys(owners).filter(function(k){return owners[k].length>1;});
 var me=m.getUserId(),mine=as.filter(function(a){return a.operator_id===me;});
 var userName=function(id){var p=data.profiles.find(function(x){return x.user_id===id;});return p?p.display_name:'Usuario '+String(id).slice(0,8);};
 var html='<div class="title"><div class="overline">VISURA INVENTA · F2</div><h1>Tramos K</h1><p class="muted">Campaña: '+esc(camp?camp.name:'Sin campaña activa')+' · Asignación exclusivamente manual por Administración.</p></div>';
 if(notice)html+='<div class="alert red" role="alert">'+esc(notice)+'</div>';
 html+='<div class="card"><h2>Estado de integración</h2><p class="muted">Lectura autenticada de Supabase INVENTA. Transferencias, retiradas y segundo recuento requieren el contrato transaccional del servidor; no se simulan ni se envían escrituras inseguras.</p></div>';
 if(conflicts.length)html+='<div class="alert red" role="alert">Conflicto de responsables activos en '+conflicts.length+' ubicaciones. Operaciones F2 bloqueadas hasta resolverlo en servidor.</div>';
 if(m.isAdmin()){
  html+='<div class="card"><h2>Administrador · ubicaciones K</h2><p class="muted">'+data.locations.length+' ubicaciones · '+as.length+' asignaciones registradas. Sin distribución automática.</p>';
  html+='<div style="max-height:48vh;overflow:auto">'+data.locations.map(function(l){var o=owners[l.code]||[];return '<div style="border-bottom:1px solid #e5eaf0;padding:9px 0"><b>'+esc(l.code)+'</b><div class="muted">'+(o.length?o.map(function(a){return esc(userName(a.operator_id))+' · '+esc(a.status);}).join(' / '):'Sin responsable activo')+'</div></div>';}).join('')+'</div></div>';
  html+='<div class="alert">Asignar, transferir en curso, retirar parcialmente y ordenar segundo recuento: pendientes de RPC transaccional con bloqueo por ubicación, auditoría e idempotencia. No se permite modificar la tabla directamente desde esta pantalla.</div>';
 }else{
  html+='<div class="card"><h2>Mis ubicaciones K</h2>'+ (mine.length?mine.map(function(a){return '<div style="border-bottom:1px solid #e5eaf0;padding:10px 0"><b>'+esc(a.location_code)+'</b> · '+esc(a.status)+'</div>';}).join(''):'<p class="muted">Sin ubicaciones K asignadas en la campaña activa.</p>')+'</div>';
 }
 html+='<button class="btn-outline" type="button" onclick="INVENTA_F2.open()">Actualizar F2</button>';
 target.innerHTML=html;
}
root.INVENTA_F2={open:open,invalidate:function(){seq++;data={campaigns:[],locations:[],assignments:[],profiles:[]};},isK:isK};
})(window);
