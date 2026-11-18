/* INVENTA: authenticated counts, individual or in pair («Mi tramo»). Demo data never enters this queue.
   Pair rule: one phone, one count. The author of each entry is whoever has the session open;
   the server fills in the partner from the active tramo. Relevo = send pending, the other person signs in. */
(function(root){
'use strict';
var visible=false,busy=false,serial=0,assignments=[],counts=[],segments=[],message='',lastRead='',diagnostic='',diagnosticBusy=false,diagnosticSerial=0;
function m(){return root.INVENTA_MGMT;}
function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function value(id){var el=document.getElementById(id);return el?el.value.trim():'';}
function key(uid){return 'inventa-count-outbox-v1:'+uid;}
function read(uid){var rows=JSON.parse(localStorage.getItem(key(uid))||'[]');if(!Array.isArray(rows))throw Error('Cola local dañada; conserva los datos y contacta con Administración.');return rows;}
function write(uid,rows){localStorage.setItem(key(uid),JSON.stringify(rows));}
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object'){var out={};Object.keys(x).sort().forEach(function(k){out[k]=canonical(x[k]);});return out;}return x;}
function payloadEqual(a,b){
 return ['campaign_id','location_code','product_code','lot','quantity','actor_id','previous_id','correction_reason','client_mutation_id'].every(function(k){return (a[k]??null)===(b[k]??null);})&&JSON.stringify(canonical(a.entries))===JSON.stringify(canonical(b.entries));
}
function number(v){if(String(v).trim()==='')throw Error('Introduce la cantidad, incluido cero si no hay unidades.');var n=Number(String(v).replace(',','.'));if(!Number.isFinite(n)||n<0)throw Error('Cantidad no válida.');return n;}
async function flush(){
 var uid=m().getUserId();if(!uid)throw Error('Inicia sesión para sincronizar.');
 var run=async function(){
  if(busy)return;busy=true;
  try{
   await m().refreshProfile();
   if(!m().isAuthenticated()||m().getUserId()!==uid)throw Error('Cuenta no habilitada. La cola se conserva en este dispositivo.');
   var batch=read(uid);
   for(var item of batch){
    if(m().getUserId()!==uid)throw Error('La sesión cambió; envío detenido.');
    var body=item.body;
    try{await m().realApi('counts','', 'POST',body);}
    catch(e){
     // A lost response can mean the server already committed. Confirm exact identity and payload.
     if(e.status!==409)throw e;
     var saved=await m().realApi('counts','select=*&client_mutation_id=eq.'+encodeURIComponent(body.client_mutation_id));
     if(saved.length!==1||!payloadEqual(saved[0],body))throw Error('Conflicto: otro recuento corrigió el original o la clave ya tiene otros datos. Conservado para revisión.');
    }
    write(uid,read(uid).filter(function(x){return x.body.client_mutation_id!==body.client_mutation_id;}));
   }
   message='Envíos confirmados por el servidor.';
  }finally{busy=false;}
 };
 if(root.navigator&&root.navigator.locks)return root.navigator.locks.request('inventa-count-sync:'+uid,run);
 return run();
}
function status(){
 if(!visible)return;
 var e=document.getElementById('realSyncStatus'),d=document.getElementById('realDiagStatus'),uid=m().getUserId(),pending=0;
 try{pending=uid?read(uid).length:0;}
 catch(error){pending='?';message='Cola local inaccesible. No se ha borrado ningún registro.';}
 if(e){e.textContent=pending+' pendientes · '+message;e.title=pending+' pendientes en este dispositivo · '+message;if(e.dataset)e.dataset.tone=pending===0&&(message==='Lectura actualizada.'||message==='Envíos confirmados por el servidor.')?'ok':'warn';}
 if(d)d.textContent=diagnostic||'Comprobación de acceso pendiente.';
}
function option(v,t){return '<option value="'+esc(v)+'">'+esc(t)+'</option>';}
function isPair(){return segments.some(function(s){return !!s.partner_id;});}
function cycleName(c){return Number(c)===2?'Segundo recuento (ciego)':'Primer recuento';}
/* Orden de recorrido: posición dentro de su tramo; lo que no es de un tramo va al final. */
function order(){var pos={};segments.forEach(function(s,si){(s.locations||[]).forEach(function(l){pos[s.campaign_id+'|'+l.code]=si*100000+l.position;});});return pos;}
function sortedAssignments(){var pos=order();return assignments.slice().sort(function(a,b){var x=pos[a.campaign_id+'|'+a.location_code],y=pos[b.campaign_id+'|'+b.location_code];x=x==null?1e9:x;y=y==null?1e9:y;return x-y||String(a.location_code).localeCompare(String(b.location_code));});}
function nextPending(s){return (s.locations||[]).filter(function(l){return !l.counted;});}
function tramoCard(s){
 var done=(s.locations||[]).filter(function(l){return l.counted;}).length,total=(s.locations||[]).length,next=nextPending(s);
 var people=s.partner_id?'Pareja: '+(s.me_name||'Tú')+' + '+(s.partner_name||'Sin nombre'):'Individual: '+(s.me_name||'Tú');
 return '<section class="real-counts-card real-tramo vis-card" aria-label="'+esc('Mi tramo '+s.from+' a '+s.to)+'"><h2>Mi tramo · '+esc(s.from+' → '+s.to)+'</h2>'
  +'<p class="real-counts-help vis-help">'+esc(cycleName(s.cycle)+' · '+(s.campaign_name||'')+' · '+people)+'</p>'
  +'<progress class="segment-progress" max="'+esc(total)+'" value="'+esc(done)+'" aria-label="'+esc('Avance de '+s.from+' a '+s.to)+'"></progress>'
  +'<p class="real-counts-help vis-help">'+esc(done+' de '+total+' ubicaciones con recuento'+(next.length?' · siguiente: '+next[0].code:' · tramo completo'))+'</p>'
  +(next.length?'<div class="real-tramo-next">'+next.slice(0,6).map(function(l){return '<button type="button" class="vis-button-secondary" onclick="INVENTA_REAL.pick(\''+esc(s.campaign_id)+'\',\''+esc(l.code)+'\')">'+esc(l.code)+'</button>';}).join('')+'</div>':'')
  +(s.partner_id?'<p class="real-counts-help vis-help">Cada apunte queda a nombre de quien tiene la sesión abierta. Para el relevo, envía lo pendiente y que '+esc(s.partner_name||'tu pareja')+' inicie sesión en este móvil.</p><button type="button" class="vis-button-secondary" onclick="INVENTA_REAL.handover()">'+esc('Relevo: pasar a '+(s.partner_name||'la pareja'))+'</button>':'')
  +'</section>';
}
function draw(){
 if(!visible)return;
 var uid=m().getUserId(),latest=counts.filter(function(c){return !counts.some(function(n){return n.previous_id===c.id;});});
 var chevron=homeIcon('chevron-down');
 var refresh=homeIcon('refresh-cw');
 var scan=homeIcon('scan-barcode');
 var html='<div class="real-counts-view vis-stack"><div class="real-counts-intro vis-title"><h1>Mis recuentos</h1><p>'+esc(m().profile.display_name)+' · Stock teórico oculto</p><span class="real-counts-chip vis-chip">'+(isPair()?'CUENTA REAL · RECUENTO EN PAREJA':'CUENTA REAL · RECUENTO INDIVIDUAL')+'</span></div>'+segments.map(tramoCard).join('')
 +'<section class="real-counts-card real-sync-card vis-card" aria-label="Sincronización"><div class="real-sync-line"><p id="realSyncStatus" role="status" aria-live="polite"></p><button type="button" class="real-counts-icon vis-icon-button vis-icon-button--outline" onclick="INVENTA_REAL.reload()" aria-label="Actualizar lecturas" title="Actualizar lecturas">'+refresh+'</button></div><button type="button" class="real-counts-primary vis-button-primary" onclick="INVENTA_REAL.sync()">Sincronizar y comprobar servidor</button><details class="real-counts-details real-diagnostic vis-accordion"><summary>Diagnóstico'+chevron+'</summary><button type="button" class="real-counts-secondary vis-button-secondary" onclick="INVENTA_REAL.diagnose()">Comprobar acceso REAL · solo lectura</button><p id="realDiagStatus" role="status" aria-live="polite"></p><p class="real-counts-help vis-help">Esta comprobación no guarda recuentos ni modifica la base de datos.</p></details></section>'
 +'<section class="real-counts-card real-counts-form vis-card vis-card--form"><h2>Registrar recuento</h2><p class="real-counts-help vis-help">'+(segments.length?'Elige la ubicación (por defecto, la siguiente de tu tramo).':'Selecciona una asignación activa.')+(isPair()?' Recuento en pareja: un móvil y un único recuento.':'')+'</p>'
 +'<div class="real-field vis-field"><label for="realAssignment">Ubicación asignada</label><div class="real-control-wrap vis-control-wrap"><select class="real-field-control vis-control" id="realAssignment">'+option('','Seleccionar…')+sortedAssignments().map(function(a){return option(a.id,a.location_code+' · '+a.campaigns.name);}).join('')+'</select>'+chevron+'</div></div>'
 +'<div class="real-field vis-field"><label for="realProduct">Código del artículo del catálogo</label><div class="real-control-wrap vis-control-wrap"><input id="realProduct" class="real-field-control vis-control" autocomplete="off">'+scan+'</div></div>'
 +'<div class="real-field vis-field"><label for="realLot">Lote (si corresponde)</label><input id="realLot" class="real-field-control vis-control" autocomplete="off"></div>'
 +'<div class="real-field vis-field"><label for="realQty">Unidades sueltas</label><input id="realQty" class="real-field-control vis-control" inputmode="decimal" type="text"></div>'
 +'<details class="real-counts-details real-pallet vis-accordion"><summary>Desglose de palés (opcional)'+chevron+'</summary><p class="real-counts-help vis-help">Se suma a unidades sueltas: palés × cajas/base × alturas × unidades/caja.</p>'
 +['Palés','Cajas/base','Alturas','Unidades/caja'].map(function(t,i){return '<div class="real-field vis-field"><label for="realFactor'+i+'">'+t+'</label><input id="realFactor'+i+'" class="real-field-control vis-control" inputmode="decimal"></div>';}).join('')+'</details>'
 +'<div class="real-field vis-field"><label for="realPrevious">Corregir recuento propio (opcional)</label><div class="real-control-wrap vis-control-wrap"><select id="realPrevious" class="real-field-control vis-control">'+option('','Nuevo recuento')+latest.filter(function(c){return c.actor_id===uid;}).map(function(c){return option(c.id,c.location_code+' · '+c.product_code+' · '+c.quantity+' · '+new Date(c.created_at).toLocaleString('es-ES'));}).join('')+'</select>'+chevron+'</div></div>'
 +'<div class="real-field vis-field"><label for="realReason">Motivo obligatorio para correcciones</label><input id="realReason" class="real-field-control vis-control"></div></section>'
 +'<section class="real-counts-card vis-card"><h2>Últimos registros del servidor</h2><p class="real-counts-help vis-help">Leídos: '+esc(lastRead||'Sin lectura confirmada')+'. Hasta 100 registros; pulsa Actualizar en el otro dispositivo.</p>'
 +counts.map(function(c){return '<div class="real-count-row vis-list-copy"><strong>'+esc(c.location_code+' · '+c.product_code)+'</strong><p>'+esc(c.quantity)+' unidades · '+esc(new Date(c.created_at).toLocaleString('es-ES'))+'</p><small>'+esc(c.actor_id)+' · '+esc(c.client_mutation_id)+'</small>'+(c.previous_id?'<p>Corrección: '+esc(c.correction_reason)+'</p>':'')+'</div>';}).join('')+'</section></div>';
 place(html,'<button class="back" onclick="INVENTA_REAL.close()"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-arrow-left"/></svg> Menú principal</button><button type="button" class="real-counts-save real-counts-primary vis-button-primary" onclick="INVENTA_REAL.save()">Guardar en cola y enviar</button>','Mis recuentos');status();
}
async function diagnose(){
 if(diagnosticBusy)return false;
 var uid=m().getUserId(),ticket=++diagnosticSerial;
 if(!uid||!m().isAuthenticated()){diagnostic='Acceso no disponible: inicia sesión con una cuenta habilitada.';status();return false;}
 diagnosticBusy=true;diagnostic='Comprobando la conexión de solo lectura…';status();
 try{
  await m().refreshProfile();
  if(ticket!==diagnosticSerial||uid!==m().getUserId()||!m().isAuthenticated())throw Error('La sesión cambió o fue revocada.');
  var active=await m().realApi('assignments','select=id,campaigns!inner(status)&campaigns.status=eq.active&active=eq.true&operator_id=eq.'+encodeURIComponent(uid)+'&limit=500');
  if(ticket!==diagnosticSerial||uid!==m().getUserId()||!m().isAuthenticated())return false;
  var history=await m().realApi('counts','select=id&limit=1');
  if(ticket!==diagnosticSerial||uid!==m().getUserId()||!m().isAuthenticated())return false;
  if(!Array.isArray(active)||!Array.isArray(history))throw Error('Respuesta del servidor no reconocida.');
  diagnostic='INVENTA real: sesión y lecturas autorizadas. '+active.length+' asignación(es) activas visibles.'+(active.length?' Ya puedes elegir una ubicación asignada.':' No hay asignaciones activas para esta cuenta. Solicita al supervisor activar campaña y asignar ubicación.');
  status();return true;
 }catch(error){
  if(ticket!==diagnosticSerial||uid!==m().getUserId())return false;
  diagnostic='No se pudo verificar el acceso: '+String(error&&error.message||'error de conexión').slice(0,160);
  status();return false;
 }finally{diagnosticBusy=false;}
}
async function reload(){
 var ticket=++serial,uid=m().getUserId();
 try{
  await m().refreshProfile();
  if(!m().isAuthenticated())throw Error('Cuenta pendiente o deshabilitada.');
  var data=await Promise.all([
   m().realApi('assignments','select=*,campaigns!inner(name,status)&campaigns.status=eq.active&active=eq.true&operator_id=eq.'+encodeURIComponent(uid)+'&order=created_at.desc&limit=500'),
   m().realApi('counts','select=*&order=created_at.desc,id.desc&limit=100'),
   m().realApi('rpc/my_segments','','GET').catch(function(){return [];})
  ]);
  if(ticket!==serial||uid!==m().getUserId())return;
  assignments=data[0];counts=data[1];segments=Array.isArray(data[2])?data[2]:[];lastRead=new Date().toLocaleString('es-ES');message='Lectura actualizada.';draw();preselect();
 }catch(e){message=e.message;status();if(!lastRead)draw();}
}
function selectAssignment(campaign,code){var a=assignments.find(function(x){return x.campaign_id===campaign&&x.location_code===code;});var el=document.getElementById('realAssignment');if(a&&el){el.value=a.id;return true;}return false;}
function preselect(){for(var s of segments){var n=nextPending(s);if(n.length&&selectAssignment(s.campaign_id,n[0].code))return;}}
function pick(campaign,code){if(!selectAssignment(campaign,code)){message='Esa ubicación ya no está asignada a esta cuenta. Pulsa Actualizar.';status();}}
async function handover(){
 try{
  var uid=m().getUserId();if(!uid)throw Error('No hay sesión abierta.');
  var pair=segments.find(function(s){return s.partner_id;});if(!pair)throw Error('Este tramo no es en pareja.');
  await flush();
  if(read(uid).length)throw Error('Quedan apuntes sin confirmar; el relevo se hace cuando todo esté enviado.');
  message='Relevo: '+(pair.partner_name||'tu pareja')+' debe iniciar sesión en este móvil.';
  visible=false;serial++;segments=[];assignments=[];counts=[];
  await m().logout();
  return true;
 }catch(e){message='Relevo no hecho: '+e.message;status();return false;}
}
async function sync(){try{await flush();await reload();}catch(e){message='Pendiente: '+e.message;status();}}
async function save(){
 try{
  if(busy)return;
  var uid=m().getUserId();if(!m().isAuthenticated())throw Error('Inicia sesión con una cuenta habilitada.');
  var assignment=assignments.find(function(a){return a.id===value('realAssignment');});
  if(!assignment)throw Error('Selecciona una ubicación asignada.');
  var entries=[],quantity=number(value('realQty')||'0'),factors=[0,1,2,3].map(function(i){return value('realFactor'+i);});
  if(quantity)entries.push({type:'units',quantity:quantity});
  if(factors.some(Boolean)){var nums=factors.map(number);var amount=nums.reduce(function(a,b){return a*b;},1);quantity+=amount;entries.push({type:'pallet',factors:nums,quantity:amount});}
  if(!value('realQty')&&!factors.some(Boolean))throw Error('Introduce una cantidad; cero es válido.');
  if(!Number.isFinite(quantity)||quantity>1000000000||Math.abs(quantity*1000-Math.round(quantity*1000))>0.00001)throw Error('Cantidad fuera de rango o con más de tres decimales.');quantity=Math.round(quantity*1000)/1000;
  var previous=value('realPrevious'),reason=value('realReason'),product=value('realProduct'),lot=value('realLot');
  if(!product)throw Error('Introduce un artículo real del catálogo.');
  if(previous){
   var prior=counts.find(function(c){return c.id===previous;});
   if(!prior||prior.actor_id!==uid||prior.campaign_id!==assignment.campaign_id||prior.location_code!==assignment.location_code||prior.product_code!==product||prior.lot!==lot)throw Error('La corrección debe mantener campaña, ubicación, artículo y lote del original.');
   if(reason.length<5)throw Error('Explica el motivo de la corrección.');
  }
  var body={campaign_id:assignment.campaign_id,location_code:assignment.location_code,product_code:product,lot:lot,quantity:quantity,actor_id:uid,entries:entries,client_mutation_id:crypto.randomUUID(),previous_id:previous||null,correction_reason:previous?reason:null};
  var queue=read(uid);queue.push({body:body,queued_at:new Date().toISOString()});write(uid,queue);
  message='Guardado en este dispositivo; pendiente de confirmación.';draw();await sync();
 }catch(e){message=e.message;status();}
}
root.INVENTA_REAL={pick:pick,handover:handover,isBusy:function(){return busy;},leave:function(){visible=false;serial++;diagnosticSerial++;diagnostic='';},open:function(){visible=true;assignments=[];counts=[];segments=[];lastRead='';diagnostic='';draw();return reload();},close:function(){visible=false;serial++;diagnosticSerial++;diagnostic='';go('home');},reload:reload,sync:sync,diagnose:diagnose,save:save,flush:flush,payloadEqual:payloadEqual};
root.addEventListener('online',function(){if(m().isAuthenticated())sync();});
root.addEventListener('storage',function(e){if(e.key==='visura-inventa-auth-v2'){visible=false;serial++;diagnosticSerial++;diagnostic='';assignments=[];counts=[];segments=[];}else status();});
})(window);

