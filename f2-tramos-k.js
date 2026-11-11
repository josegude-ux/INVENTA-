/* VISURA INVENTA F2 · Tramos K. Integrated screen, server-side read permissions.
   Write actions deliberately unavailable until the F2 transactional RPC is installed
   and its RLS/idempotency acceptance tests pass. No client-side role spoofing. */
(function(root){
'use strict';
var seq=0,loading=false,notice='',data={campaigns:[],locations:[],assignments:[],profiles:[],slots:[],entries:[]};
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
   m.realApi('profiles','select=user_id,display_name,role,enabled&limit=500'),
   m.realApi('f2_k_slots','select=*&order=created_at.desc&limit=3000'),
   m.realApi('f2_k_entries','select=*&order=created_at.desc&limit=3000')
  ]);
  if(id!==seq)return;
  if(!m.isManager())throw Error('Sesión no autorizada.');
  data={campaigns:results[0],locations:results[1].filter(function(l){return isK(l.code)&&l.enabled;}),assignments:results[2].filter(function(a){return isK(a.location_code);}),profiles:results[3],slots:results[4],entries:results[5]};
 }catch(e){if(id!==seq)return;data={campaigns:[],locations:[],assignments:[],profiles:[],slots:[],entries:[]};notice='No se ha podido cargar F2: '+e.message;}
 finally{if(id===seq){loading=false;draw();}}
}
function draw(){
 var target=document.getElementById('f2TramosPanel');if(!target)return;
 var m=mg();if(!m||!m.isManager()){target.textContent='Acceso no autorizado';return;}
 if(loading){target.textContent='Consultando ubicaciones y asignaciones K…';return;}
 var camps=data.campaigns.filter(active),camp=camps[0],as=data.slots.filter(function(a){return camp&&a.campaign_id===camp.id;});
 var owners={};as.forEach(function(a){if(a.state==='pending'||a.state==='in_progress'){(owners[a.location_code]||(owners[a.location_code]=[])).push(a);}});
 var conflicts=Object.keys(owners).filter(function(k){return owners[k].length>1;});
 var me=m.getUserId(),mine=as.filter(function(a){return a.operator_id===me;});
 var userName=function(id){var p=data.profiles.find(function(x){return x.user_id===id;});return p?p.display_name:'Usuario '+String(id).slice(0,8);};
 var html='<div class="title"><div class="overline">VISURA INVENTA · F2</div><h1>Tramos K</h1><p class="muted">Campaña: '+esc(camp?camp.name:'Sin campaña activa')+' · Asignación exclusivamente manual por Administración.</p></div>';
 if(notice)html+='<div class="alert red" role="alert">'+esc(notice)+'</div>';
 html+='<div class="card"><h2>Contrato F2</h2><p class="muted">Operaciones transaccionales en Supabase INVENTA. Los cambios requieren confirmación y clave de idempotencia. La asignación nunca es automática.</p></div>';
 if(conflicts.length)html+='<div class="alert red" role="alert">Conflicto de responsables activos en '+conflicts.length+' ubicaciones. Operaciones F2 bloqueadas hasta resolverlo en servidor.</div>';
 if(m.isAdmin()){
  html+='<div class="card"><h2>Administrador · ubicaciones K</h2><p class="muted">'+data.locations.length+' ubicaciones · '+as.length+' asignaciones registradas. Sin distribución automática.</p>';
  html+='<div style="max-height:48vh;overflow:auto">'+data.locations.map(function(l){var o=owners[l.code]||[];return '<div style="border-bottom:1px solid #e5eaf0;padding:9px 0"><b>'+esc(l.code)+'</b><div class="muted">'+(o.length?o.map(function(a){return esc(userName(a.operator_id))+' · '+esc(a.state);}).join(' / '):'Sin responsable activo')+'</div></div>';}).join('')+'</div></div>';
  html+='<div class="card"><h2>Acción manual</h2><label>Ubicación K</label><select class="input" id="f2Loc">'+data.locations.map(function(l){return '<option value="'+esc(l.code)+'">'+esc(l.code)+'</option>';}).join('')+'</select><label>Ciclo</label><select class="input" id="f2Cycle"><option value="1">Primero</option><option value="2">Segundo</option></select><label>Operario</label><select class="input" id="f2Operator">'+data.profiles.filter(function(p){return p.enabled&&p.role==='operator';}).map(function(p){return '<option value="'+esc(p.user_id)+'">'+esc(p.display_name)+'</option>';}).join('')+'</select><label>Acción</label><select class="input" id="f2Action"><option value="assign">Asignar</option><option value="start">Iniciar</option><option value="complete">Completar</option><option value="transfer">Transferir</option><option value="withdraw">Retirar ubicación</option><option value="second_count">Ordenar segundo recuento</option></select><label>Motivo de transferencia o retirada</label><input class="input" id="f2Reason" placeholder="Motivo (mínimo 5 caracteres)"><button class="btn" onclick="INVENTA_F2.submit()">Confirmar acción F2</button></div>';
 }else{
  html+='<div class="card"><h2>Mis ubicaciones K</h2>'+ (mine.length?mine.map(function(a){return '<div style="border-bottom:1px solid #e5eaf0;padding:10px 0"><b>'+esc(a.location_code)+'</b> · '+esc(a.state)+'</div>';}).join(''):'<p class="muted">Sin ubicaciones K asignadas en la campaña activa.</p>')+'</div>';
 }
 if(!m.isAdmin()){var current=mine.filter(function(a){return a.state==='in_progress';});if(current.length){html+='<div class="card"><h2>Registrar recuento F2</h2><select class="input" id="f2MySlot">'+current.map(function(a){return '<option value="'+esc(a.id)+'">'+esc(a.location_code)+' · ciclo '+a.cycle+'</option>';}).join('')+'</select><label>Artículo</label><input class="input" id="f2Product" placeholder="Código artículo"><label>Lote</label><input class="input" id="f2Lot" placeholder="Lote"><label>Cantidad</label><input class="input" id="f2Quantity" inputmode="decimal" placeholder="0"><button class="btn" onclick="INVENTA_F2.count()">Guardar recuento F2</button></div>';}}
 if(localStorage.getItem('inventa-f2-pending:'+m.getUserId()))html+='<div class="alert">Hay una operación pendiente de confirmación. Reintenta con la misma clave; no crees una operación nueva.</div><button class="btn-outline" onclick="INVENTA_F2.retry().catch(function(e){alert(e.message)})">Reintentar operación pendiente</button>';
 html+='<button class="btn-outline" type="button" onclick="INVENTA_F2.open()">Actualizar F2</button>';
 target.innerHTML=html;
}
function value(id){var el=document.getElementById(id);return el?el.value.trim():'';}
var sending=false;
async function command(body){
 if(sending)throw Error('Operación en curso');
 var m=mg(),uid=m&&m.getUserId();
 if(!uid||!m.isAuthenticated())throw Error('Sesión no válida');
 if(!root.crypto||!root.crypto.randomUUID)throw Error('Este dispositivo no permite claves seguras');
 sending=true;
 var key=root.crypto.randomUUID();
 var payload=Object.assign({p_mutation_id:key},body);
 var storageKey='inventa-f2-pending:'+uid;
 try{
  if(localStorage.getItem(storageKey))throw Error('Existe una operación pendiente: revisar antes de crear otra.');
  localStorage.setItem(storageKey,JSON.stringify(payload));
  var result=await m.realApi('rpc/f2_k_command','', 'POST',payload);
  localStorage.removeItem(storageKey);
  notice='Operación confirmada · '+key.slice(0,8);
  await open();return result;
 }catch(e){notice='Envío no confirmado: '+e.message+'. Clave conservada para recuperación.';draw();throw e;}
 finally{sending=false;}
}
async function retry(){
 var uid=mg().getUserId(),key='inventa-f2-pending:'+uid;
 var pending=JSON.parse(localStorage.getItem(key)||'null');if(!pending)throw Error('Sin operación pendiente');
 if(sending)throw Error('Envío en curso');sending=true;
 try{await mg().realApi('rpc/f2_k_command','','POST',pending);localStorage.removeItem(key);notice='Operación recuperada';await open();}
 finally{sending=false;}
}
async function submit(){
 if(!mg().isAdmin())throw Error('Solo Administración');
 var campaign=data.campaigns.find(active);if(!campaign)throw Error('No hay campaña activa');
 var location=value('f2Loc'),cycle=Number(value('f2Cycle')),action=value('f2Action');
 var slot=data.slots.find(function(s){return s.campaign_id===campaign.id&&s.location_code===location&&s.cycle===cycle&&['pending','in_progress'].includes(s.state);});
 if(!confirm('Confirmar '+action+' para '+location+' (ciclo '+cycle+')?'))return;
 try{await command({p_action:action,p_campaign_id:campaign.id,p_location_code:location,p_cycle:cycle,p_operator_id:['assign','transfer','second_count'].includes(action)?value('f2Operator'):null,p_reason:value('f2Reason')||null,p_expected_version:slot?slot.version:null});}
 catch(e){alert(e.message);}
}
async function count(){
 var slot=data.slots.find(function(s){return s.id===value('f2MySlot');});
 if(!slot||slot.operator_id!==mg().getUserId()||slot.state!=='in_progress')throw Error('Asignación no disponible');
 var q=Number(value('f2Quantity').replace(',','.'));
 if(!Number.isFinite(q)||q<0||!value('f2Product'))throw Error('Artículo o cantidad incorrecta');
 try{await command({p_action:'count',p_campaign_id:slot.campaign_id,p_location_code:slot.location_code,p_cycle:slot.cycle,p_product_code:value('f2Product'),p_lot:value('f2Lot'),p_quantity:q});}
 catch(e){alert(e.message);}
}
root.INVENTA_F2={open:open,submit:submit,count:count,retry:retry,invalidate:function(){seq++;data={campaigns:[],locations:[],assignments:[],profiles:[],slots:[],entries:[]};},isK:isK};
})(window);
