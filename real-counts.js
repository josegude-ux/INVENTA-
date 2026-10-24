/* INVENTA: authenticated individual counts. Demo data never enters this queue. */
(function(root){
'use strict';
var visible=false,busy=false,serial=0,assignments=[],counts=[],message='',lastRead='';
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
 var e=document.getElementById('realSyncStatus'),uid=m().getUserId();
 if(e)e.textContent=(uid?read(uid).length:0)+' pendientes en este dispositivo · '+message;
}
function option(v,t){return '<option value="'+esc(v)+'">'+esc(t)+'</option>';}
function draw(){
 if(!visible)return;
 var uid=m().getUserId(),latest=counts.filter(function(c){return !counts.some(function(n){return n.previous_id===c.id;});});
 var html='<div class="title"><div class="overline">CUENTA REAL · RECUENTO INDIVIDUAL</div><h1>Mis recuentos</h1><p class="muted">'+esc(m().profile.display_name)+' · Stock teórico oculto</p></div>'
 +'<div class="card"><p id="realSyncStatus" role="status" aria-live="polite"></p><button class="btn-outline" onclick="INVENTA_REAL.sync()">Sincronizar y comprobar servidor</button><button class="btn-outline" onclick="INVENTA_REAL.reload()">Actualizar lecturas</button></div>'
 +'<div class="card"><h2>Registrar recuento</h2><p class="muted">Selecciona una asignación activa. El registro es individual; la pareja continúa en demostración.</p>'
 +'<label for="realAssignment">Ubicación asignada</label><select class="input" id="realAssignment">'+option('','Seleccionar…')+assignments.map(function(a){return option(a.id,a.location_code+' · '+a.campaigns.name);}).join('')+'</select>'
 +'<label for="realProduct">Código del artículo del catálogo</label><input id="realProduct" class="input" autocomplete="off">'
 +'<label for="realLot">Lote (si corresponde)</label><input id="realLot" class="input" autocomplete="off">'
 +'<label for="realQty">Unidades sueltas</label><input id="realQty" class="input" inputmode="decimal" type="text">'
 +'<details><summary>Desglose de palés (opcional)</summary><p class="muted">Se suma a unidades sueltas: palés × cajas/base × alturas × unidades/caja.</p>'
 +['Palés','Cajas/base','Alturas','Unidades/caja'].map(function(t,i){return '<label for="realFactor'+i+'">'+t+'</label><input id="realFactor'+i+'" class="input" inputmode="decimal">';}).join('')+'</details>'
 +'<label for="realPrevious">Corregir recuento propio (opcional)</label><select id="realPrevious" class="input">'+option('','Nuevo recuento')+latest.filter(function(c){return c.actor_id===uid;}).map(function(c){return option(c.id,c.location_code+' · '+c.product_code+' · '+c.quantity+' · '+new Date(c.created_at).toLocaleString('es-ES'));}).join('')+'</select>'
 +'<label for="realReason">Motivo obligatorio para correcciones</label><input id="realReason" class="input">'
 +'<button class="btn" onclick="INVENTA_REAL.save()">Guardar en cola y enviar</button></div>'
 +'<div class="card"><h2>Últimos registros del servidor</h2><p class="muted">Leídos: '+esc(lastRead||'Sin lectura confirmada')+'. Hasta 100 registros; pulsa Actualizar en el otro dispositivo.</p>'
 +counts.map(function(c){return '<div class="real-count-row"><b>'+esc(c.location_code+' · '+c.product_code)+'</b><p>'+esc(c.quantity)+' unidades · '+esc(new Date(c.created_at).toLocaleString('es-ES'))+'</p><small>'+esc(c.actor_id)+' · '+esc(c.client_mutation_id)+'</small>'+(c.previous_id?'<p>Corrección: '+esc(c.correction_reason)+'</p>':'')+'</div>';}).join('')+'</div>';
 place(html,'<button class="back" onclick="INVENTA_REAL.close()">← Menú principal</button>');status();
}
async function reload(){
 var ticket=++serial,uid=m().getUserId();
 try{
  await m().refreshProfile();
  if(!m().isAuthenticated())throw Error('Cuenta pendiente o deshabilitada.');
  var data=await Promise.all([
   m().realApi('assignments','select=*,campaigns!inner(name,status)&campaigns.status=eq.active&operator_id=eq.'+encodeURIComponent(uid)+'&order=created_at.desc&limit=500'),
   m().realApi('counts','select=*&order=created_at.desc,id.desc&limit=100')
  ]);
  if(ticket!==serial||uid!==m().getUserId())return;
  assignments=data[0];counts=data[1];lastRead=new Date().toLocaleString('es-ES');message='Lectura actualizada.';draw();
 }catch(e){message=e.message;status();if(!lastRead)draw();}
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
root.INVENTA_REAL={isBusy:function(){return busy;},leave:function(){visible=false;serial++;},open:function(){visible=true;assignments=[];counts=[];lastRead='';draw();return reload();},close:function(){visible=false;serial++;go('home');},reload:reload,sync:sync,save:save,flush:flush,payloadEqual:payloadEqual};
root.addEventListener('online',function(){if(m().isAuthenticated())sync();});
root.addEventListener('storage',function(e){if(e.key==='inventa-real-auth-v1'){visible=false;serial++;assignments=[];counts=[];}else status();});
})(window);

