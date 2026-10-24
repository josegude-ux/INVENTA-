/* INVENTA · Gestión de almacén conectada a Supabase.
   La app de recuentos DEMO permanece separada: jamás se envían datos TEST a Supabase.
   Nunca usar claves secretas ni service_role en el navegador. */
(function(){
'use strict';
var BASE='https://wlejxnpphysogrzcxjfh.supabase.co';
var KEY='sb_publishable_gPeof-fUW3yITvNXqsjHVw_-PjB1Fyd';
var STORE='inventa-real-auth-v1';
var session=null,profile=null,section='dashboard',pending=false,notice='';
function safe(s){return String(s===null||s===undefined?'':s).replace(/[&<>"']/g,function(k){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k];});}
function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function show(html,footer){if(typeof place==='function')place(html,footer||'<button class="back" onclick="go(\'home\')">← Menú principal</button>');}
function field(id,label,placeholder,type){return '<div class="field"><label for="'+id+'">'+safe(label)+'</label><input class="input" id="'+id+'" type="'+(type||'text')+'" placeholder="'+safe(placeholder||'')+'"></div>';}
function select(id,label,rows,valueField,labelField){return '<div class="field"><label for="'+id+'">'+safe(label)+'</label><select class="input" id="'+id+'">'+rows.map(function(x){return '<option value="'+safe(x[valueField])+'">'+safe(x[labelField])+'</option>';}).join('')+'</select></div>';}
function button(label,fn){return '<button class="btn-outline" style="width:100%;margin-top:8px" onclick="INVENTA_MGMT.'+fn+'">'+safe(label)+'</button>';}
function card(title,body){return '<div class="card"><h2>'+safe(title)+'</h2><div style="margin-top:10px">'+body+'</div></div>';}
function alertBox(){return notice?'<div class="alert" role="status">'+safe(notice)+'</div>':'';}
function heading(k,t,sub){return '<div class="title"><div class="overline">'+safe(k)+'</div><h1>'+safe(t)+'</h1><p class="muted">'+safe(sub||'')+'</p></div>';}
function activity(k){notice=k;return k;}
function authHeaders(){return {'apikey':KEY,'Authorization':'Bearer '+(session&&session.access_token||KEY),'Content-Type':'application/json'};}
async function request(url,options){var o=options||{};o.headers=Object.assign(authHeaders(),o.headers||{});var res=await fetch(BASE+url,o);var data=await res.text(),obj;try{obj=JSON.parse(data);}catch(e){obj=data;}if(!res.ok){var msg=obj&&typeof obj==='object'?(obj.message||obj.msg||obj.error_description||obj.error||obj.hint||obj.code):obj;throw Error(String(msg||'Error '+res.status));}return obj;}
async function refresh(){if(!session||!session.refresh_token)return false;try{var s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});session=s;localStorage.setItem(STORE,JSON.stringify(s));return true;}catch(e){session=null;profile=null;localStorage.removeItem(STORE);return false;}}
async function api(table,params,method,body){if(session&&session.expires_at&&session.expires_at*1000<Date.now()+90000)await refresh();var opts={method:method||'GET',headers:method&&method!=='GET'?{'Prefer':'return=representation'}:{}};if(body!==undefined)opts.body=JSON.stringify(body);return request('/rest/v1/'+table+(params?'?'+params:''),opts);}
function isManager(){return !!(session&&profile&&profile.enabled&&['supervisor','admin'].includes(profile.role));}
function isAdmin(){return isManager()&&profile.role==='admin';}
function check(){if(!isManager()){if(typeof go==='function')go('manager-login');return false;}return true;}
async function signIn(){
 var error=document.getElementById('managerError');if(error)error.textContent='Conectando…';
 try{var email=val('managerEmail'),password=val('managerPassword');if(!email||!password)throw Error('Introduce correo electrónico y contraseña.');
 var s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email,password:password})});
 session=s;localStorage.setItem(STORE,JSON.stringify(s));
 await loadProfile();
 if(!isManager()){if(error)error.textContent='Cuenta identificada, pero todavía sin permisos de Supervisor o Administrador. Un administrador debe asignarte el rol.';return;}
 notice='Sesión iniciada. Los permisos se verifican también en Supabase.';if(typeof managerUser!=='undefined')managerUser=profile.display_name||profile.role;go('home');
 }catch(e){if(error)error.textContent=e.message;}
}
async function register(){
 var error=document.getElementById('managerError');try{
 var email=val('managerEmail'),password=val('managerPassword');
 if(password.length<8)throw Error('La contraseña debe tener al menos ocho caracteres.');
 var res=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:email,password:password})});
 if(error)error.textContent='Cuenta solicitada. Confirma tu correo si Supabase te envía un enlace. El rol inicial será Operario hasta que un Administrador lo cambie.';
 return res;
 }catch(e){if(error)error.textContent=e.message;}
}
async function loadProfile(){var u=session&&session.user;if(!u)return;var arr=await api('profiles','user_id=eq.'+encodeURIComponent(u.id)+'&select=*');profile=arr&&arr[0]||null;}
async function restore(){try{session=JSON.parse(localStorage.getItem(STORE)||'null');if(!session)return;if(session.expires_at&&session.expires_at*1000<Date.now()+90000)await refresh();if(session)await loadProfile();if(isManager()&&typeof managerUser!=='undefined')managerUser=profile.display_name||profile.role;}catch(e){session=null;profile=null;}}
async function logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}catch(e){}session=null;profile=null;localStorage.removeItem(STORE);if(typeof managerUser!=='undefined')managerUser='';if(typeof consultUser!=='undefined')consultUser='';notice='';go('home');}
function renderLogin(){
 show(heading('SUPERVISOR / ADMINISTRADOR','Acceso seguro','INVENTA usa cuentas personales y permisos de Supabase.')
  +card('Iniciar sesión',
  field('managerEmail','Correo electrónico','usuario@empresa.es','email')
  +field('managerPassword','Contraseña','Contraseña','password')
  +'<button class="btn" onclick="INVENTA_MGMT.signIn()">Entrar →</button>'
  +'<p id="managerError" class="muted" role="status" style="margin-top:10px"></p>'
  +button('Crear cuenta (acceso inicial: Operario)','register()'))
  +'<div class="alert">El PIN 1234 solo pertenece a la demostración antigua. Las cuentas reales empiezan como Operario; el primer Administrador debe habilitarse de forma controlada en Supabase.</div>');
}
function tabs(){return [
 ['dashboard','Resumen'],
 ['campaigns','Campañas'],
 ['assignments','Asignaciones'],
 ['incidents','Incidencias'],
 ['catalog','Artículos y ubicaciones'],
 ['snapshot','Existencias BC'],
 ['movements','Movimientos'],
 ['history','Auditoría']
 ].concat(isAdmin()?[['users','Usuarios y permisos']]:[]).map(function(pair){
  return '<button class="tinybtn" style="margin:3px 3px 3px 0;'+(section===pair[0]?'font-weight:800;border:2px solid currentColor;':'')+'" onclick="INVENTA_MGMT.open(\''+pair[0]+'\')">'+pair[1]+'</button>';
 }).join('');}
function shell(body){
 return heading('GESTIÓN ALMACÉN · '+(isAdmin()?'ADMINISTRADOR':'SUPERVISOR'),'Gestión almacén',profile.display_name+' · '+(isAdmin()?'Administración completa':'Supervisión'))
  +'<div class="card"><div class="between"><small>Conectado a INVENTA · Supabase</small><button class="tinybtn" onclick="INVENTA_MGMT.logout()">Salir</button></div><div style="margin-top:9px">'+tabs()+'</div></div>'
  +alertBox()+body
  +'<div class="alert">No se modifica Business Central automáticamente. Los datos locales de la demo no se envían al servidor.</div>';
}
function row(label,detail){return '<div class="between" style="gap:8px;border-top:1px solid #e5eaf0;padding:9px 0"><div><b>'+safe(label)+'</b><div class="muted" style="font-size:12px">'+safe(detail)+'</div></div></div>';}
function small(text){return '<p class="muted">'+safe(text)+'</p>';}
function empty(rows,text){return rows.length?rows.map(function(x){return x;}).join(''):small(text||'Todavía no hay datos.');}
function short(id){return String(id||'').slice(0,8);}
function ftime(s){return s?new Date(s).toLocaleString('es-ES'):'—';}
function options(items,k,t){return (items||[]).map(function(o){return '<option value="'+safe(o[k])+'">'+safe(o[t])+'</option>';}).join('');}
function getId(){return session&&session.user&&session.user.id;}
function curr(a){return a.find(function(x){return x.status==='active';});}
async function dataFor(tab){
 if(tab==='dashboard'){
  var arr=await Promise.all([api('campaigns','select=*&order=created_at.desc&limit=10'),api('locations','select=code'),api('products','select=code'),api('incidents','select=*&status=neq.resolved&limit=10'),api('assignments','select=*&order=created_at.desc&limit=10')]);return {campaigns:arr[0],locations:arr[1],products:arr[2],incidents:arr[3],assignments:arr[4]};
 }
 if(tab==='campaigns')return {campaigns:await api('campaigns','select=*&order=created_at.desc&limit=100')};
 if(tab==='users')return {profiles:await api('profiles','select=*&order=created_at.desc&limit=300')};
 if(tab==='assignments'){var a=await Promise.all([api('assignments','select=*&order=created_at.desc&limit=200'),api('campaigns','select=*&order=created_at.desc&limit=100'),api('locations','select=*&order=code&limit=1500'),api('profiles','select=*&order=display_name&limit=500')]);return {assignments:a[0],campaigns:a[1],locations:a[2],profiles:a[3]};}
 if(tab==='incidents'){var a=await Promise.all([api('incidents','select=*&order=created_at.desc&limit=100'),api('campaigns','select=*&order=created_at.desc&limit=100'),api('locations','select=code&order=code&limit=1500')]);return {incidents:a[0],campaigns:a[1],locations:a[2]};}
 if(tab==='catalog'){var a=await Promise.all([api('locations','select=*&order=code&limit=500'),api('products','select=*&order=code&limit=500'),api('fixed_positions','select=*&order=priority&limit=500')]);return {locations:a[0],products:a[1],fixed:a[2]};}
 if(tab==='snapshot'){var a=await Promise.all([api('campaigns','select=*&order=created_at.desc&limit=100'),api('locations','select=code&limit=1500'),api('products','select=code&limit=1500'),api('stock_snapshot','select=*&limit=100')]);return {campaigns:a[0],locations:a[1],products:a[2],snapshot:a[3]};}
 if(tab==='movements'){var a=await Promise.all([api('campaigns','select=*&status=eq.active&limit=1'),api('locations','select=code&limit=1500'),api('products','select=code&limit=1500'),api('movements','select=*&order=created_at.desc&limit=100')]);return {campaigns:a[0],locations:a[1],products:a[2],movements:a[3]};}
 if(tab==='history')return {history:await api('audit_events','select=*&order=created_at.desc&limit=100')};
 return {};
}
function contentFor(tab,d){
 if(tab==='dashboard'){
  return card('Estado general',
  row('Campañas',d.campaigns.length+' registradas · '+(curr(d.campaigns)?'1 activa':'Ninguna activa'))
  +row('Ubicaciones',d.locations.length+' registradas')
  +row('Artículos',d.products.length+' registrados')
  +row('Incidencias pendientes',d.incidents.length+' entre las diez últimas')
  +row('Asignaciones recientes',d.assignments.length+' entre las diez últimas'))
  +card('Campañas recientes',empty(d.campaigns.map(function(x){return row(x.name,x.kind+' · '+x.status+' · '+ftime(x.created_at));}),'Crea una campaña desde la pestaña Campañas.'));
 }
 if(tab==='campaigns'){
  return card('Nueva campaña · Solo Administrador',
   isAdmin()?field('campName','Nombre','Inventario anual 2026')
   +'<div class="field"><label>Tipo</label><select class="input" id="campKind"><option value="micro">Microrecuento</option><option value="annual">Inventario anual</option></select></div>'
   +button('Crear campaña en borrador','newCampaign()'):small('Solo el administrador abre o cierra campañas.'))
   +card('Campañas existentes',empty(d.campaigns.map(function(x){return row(x.name,x.kind+' · '+x.status+' · '+ftime(x.created_at))
    +(isAdmin()&&x.status!=='closed'?button(x.status==='draft'?'Abrir campaña: '+x.name:'Cerrar campaña: '+x.name,'setCampaign(\''+x.id+'\',\''+(x.status==='draft'?'active':'closed')+'\')'):'');})));
 }
 if(tab==='users'){
  return card('Usuarios y permisos',
  small('Todos empiezan como Operario. Solo un Administrador puede cambiar roles o activar/desactivar usuarios.')
  +empty(d.profiles.map(function(u){return '<div style="border-top:1px solid #ddd;padding:10px 0"><b>'+safe(u.display_name||short(u.user_id))+'</b><div class="muted">'+safe(u.user_id)+'</div>'
   +'<select class="input" id="role_'+safe(u.user_id)+'"><option value="operator" '+(u.role==='operator'?'selected':'')+'>Operario</option><option value="supervisor" '+(u.role==='supervisor'?'selected':'')+'>Supervisor</option><option value="admin" '+(u.role==='admin'?'selected':'')+'>Administrador</option></select>'
   +'<label><input type="checkbox" id="enabled_'+safe(u.user_id)+'" '+(u.enabled?'checked':'')+'> Usuario habilitado</label>'
   +button('Guardar permisos','updateUser(\''+u.user_id+'\')')+'</div>'; })));
 }
 if(tab==='assignments'){
  return card('Nueva asignación',select('assCamp','Campaña',d.campaigns,'id','name')
  +select('assLoc','Ubicación',d.locations,'code','code')
  +select('assUser','Operario',d.profiles.filter(function(p){return p.enabled;}),'user_id','display_name')
  +button('Asignar ubicación','newAssignment()'))
  +card('Asignaciones recientes',empty(d.assignments.map(function(a){var user=d.profiles.find(function(p){return p.user_id===a.operator_id;});return row(a.location_code+' · '+(user?user.display_name:short(a.operator_id)),a.status+' · '+ftime(a.created_at)) +'<select class="input" id="assStatus_'+a.id+'"><option>pending</option><option>in_progress</option><option>completed</option><option>review</option></select>'+button('Actualizar estado','updateAssignment(\''+a.id+'\')');})));
 }
 if(tab==='incidents'){
  return card('Registrar incidencia',select('incCamp','Campaña',d.campaigns,'id','name')
   +select('incLoc','Ubicación',d.locations,'code','code')
   +'<div class="field"><label>Tipo</label><select class="input" id="incType"><option value="difference">Diferencia</option><option value="missing">No encontrado</option><option value="movement">Movimiento</option><option value="barcode">Código</option><option value="location">Ubicación</option><option value="other">Otro</option></select></div>'
   +field('incDesc','Descripción','Explica el problema')
   +button('Guardar incidencia','newIncident()'))
  +card('Incidencias',empty(d.incidents.map(function(x){
    return '<div style="padding:10px 0;border-bottom:1px solid #ddd"><b>'+safe(x.category+' · '+x.status)+'</b>'+small(x.location_code+' · '+x.description+' · '+ftime(x.created_at))
    +(x.status!=='resolved'?field('incResolution_'+x.id,'Solución','Motivo de resolución')+button('Resolver incidencia','resolveIncident(\''+x.id+'\')'):'')+'</div>'; })));
 }
 if(tab==='catalog'){
  return card('Crear ubicación',field('locCode','Código','K00-P01')+field('locAisle','Pasillo','K')+field('locZone','Zona','Zona A')+field('locDescription','Descripción','Opcional')+button('Guardar ubicación','newLocation()'))
   +card('Crear artículo',field('prodCode','Código artículo','PRD000123')+field('prodDesc','Descripción','Nombre')+field('prodUnit','Unidad','UD')+button('Guardar artículo','newProduct()'))
   +card('Ubicación fija preferente',select('fixedProd','Artículo',d.products,'code','description')+select('fixedLoc','Ubicación',d.locations,'code','code')+field('fixedPriority','Prioridad (1 = primera)','1','number')+button('Añadir ubicación fija','newFixed()'))
   +card('Maestros registrados',row('Ubicaciones',d.locations.length+' (mostrando hasta 500)')+row('Artículos',d.products.length+' (mostrando hasta 500)')+row('Preferencias fijas',d.fixed.length+' (hasta 500)'));
 }
 if(tab==='snapshot'){
  return card('Existencias BC · Lectura restringida',small('Las cantidades teóricas solo se consultan desde perfiles de gestión. Nunca se envían a la interfaz de recuento ciego.')
   +row('Líneas de stock visibles',d.snapshot.length+' (hasta 100)'))
   +card('Cargar línea de existencias',select('snapCamp','Campaña',d.campaigns,'id','name')+select('snapLoc','Ubicación',d.locations,'code','code')
    +select('snapProd','Artículo',d.products,'code','description')+field('snapLot','Lote','Sin lote')+field('snapQty','Unidades','0','number')+button('Guardar línea BC','newSnapshot()'))
   +card('Importación CSV (lotes)',small('CSV separado por punto y coma, columnas: ubicacion;articulo;lote;cantidad. Se carga en la campaña seleccionada; deben existir ubicaciones y artículos.')
    +'<input type="file" class="input" accept=".csv,text/csv" id="snapFile">'+button('Importar CSV a campaña seleccionada','importCSV()'));
 }
 if(tab==='movements'){
  return card('Movimiento interno · No escribe en BC',select('moveCamp','Campaña abierta',d.campaigns,'id','name')
   +select('moveSource','Origen',d.locations,'code','code')+select('moveDestination','Destino',d.locations,'code','code')
   +select('moveProduct','Artículo',d.products,'code','description')+field('moveLot','Lote','Si corresponde')
   +field('moveQty','Cantidad','1','number')+field('moveReason','Motivo','Reubicación')+button('Registrar movimiento','newMovement()'))
   +card('Movimientos registrados',empty(d.movements.map(function(m){return row(m.source_location+' → '+m.destination_location,m.product_code+' · '+m.quantity+' · '+m.reason+' · '+ftime(m.created_at));})));
 }
 if(tab==='history'){
  return card('Historial de operaciones',small('Auditoría de cambios; no editable desde la aplicación.')
   +empty(d.history.map(function(x){return row(x.relation_name+' · '+x.operation,(x.actor_id?short(x.actor_id):'Sistema')+' · '+ftime(x.created_at));})));
 }
 return '';
}
async function render(){
 if(!check())return;
 var s=section;
 show(shell(card('Cargando información…',small('Consultando datos autorizados.'))));
 try{
 var d=await dataFor(s);if(s!==section||!check())return;
 show(shell(contentFor(s,d)));
 }catch(e){show(shell(card('No se pudo cargar',small(e.message)+button('Reintentar','render()'))));}
}
function open(s){if(!check())return;section=s;notice='';render();}
async function mutate(action,message){
 if(pending)return;pending=true;notice='';
 try{await action();notice=message||'Guardado correctamente.';await render();}
 catch(e){notice='No se ha podido guardar: '+e.message;await render();}
 finally{pending=false;}
}
function required(v,what){if(!v)throw Error('Falta '+what);return v;}
function qty(v){var n=Number(String(v).replace(',','.'));if(!Number.isFinite(n)||n<0)throw Error('Cantidad incorrecta');return n;}
function uuid(){return crypto.randomUUID();}
function newCampaign(){if(!isAdmin())return;mutate(function(){return api('campaigns','', 'POST',{name:required(val('campName'),'nombre'),kind:val('campKind'),status:'draft',created_by:getId()});},'Campaña creada en borrador.');}
function setCampaign(id,status){if(!isAdmin())return;if(!confirm('¿Confirmar cambio de campaña a '+status+'?'))return;mutate(function(){var body={status:status};if(status==='active')body.starts_at=new Date().toISOString();if(status==='closed')body.closed_at=new Date().toISOString();return api('campaigns','id=eq.'+id,'PATCH',body);},'Estado de campaña actualizado.');}
function newAssignment(){mutate(function(){return api('assignments','', 'POST',{campaign_id:required(val('assCamp'),'campaña'),location_code:required(val('assLoc'),'ubicación'),operator_id:required(val('assUser'),'operario'),assigned_by:getId()});},'Asignación registrada.');}
function updateAssignment(id){mutate(function(){return api('assignments','id=eq.'+id,'PATCH',{status:val('assStatus_'+id)});},'Estado de asignación actualizado.');}
function newIncident(){mutate(function(){return api('incidents','', 'POST',{campaign_id:val('incCamp')||null,location_code:val('incLoc')||null,category:val('incType'),description:required(val('incDesc'),'descripción'),reported_by:getId()});},'Incidencia registrada.');}
function resolveIncident(id){var resolution=val('incResolution_'+id);if(resolution.length<5){notice='Explica la solución con al menos cinco caracteres.';render();return;}mutate(function(){return api('incidents','id=eq.'+id,'PATCH',{status:'resolved',resolution:resolution,resolved_by:getId(),resolved_at:new Date().toISOString()});},'Incidencia resuelta con historial.');}
function newLocation(){mutate(function(){return api('locations','', 'POST',{code:required(val('locCode'),'código').toUpperCase(),aisle:required(val('locAisle'),'pasillo').toUpperCase(),zone:val('locZone'),description:val('locDescription')});},'Ubicación creada.');}
function newProduct(){mutate(function(){return api('products','', 'POST',{code:required(val('prodCode'),'código').toUpperCase(),description:required(val('prodDesc'),'descripción'),unit:val('prodUnit')||'UD'});},'Artículo creado.');}
function newFixed(){mutate(function(){return api('fixed_positions','', 'POST',{product_code:required(val('fixedProd'),'artículo'),location_code:required(val('fixedLoc'),'ubicación'),priority:Math.max(1,Math.trunc(qty(val('fixedPriority')||'1')))});},'Ubicación fija guardada.');}
function newSnapshot(){mutate(function(){return api('stock_snapshot','', 'POST',{campaign_id:required(val('snapCamp'),'campaña'),location_code:required(val('snapLoc'),'ubicación'),product_code:required(val('snapProd'),'artículo'),lot:val('snapLot'),quantity:qty(val('snapQty')),source:'BC'});},'Existencias importadas sin modificar BC.');}
function parseCSV(text){var rows=[],row=[],part='',quote=false;for(var i=0;i<text.length;i++){var c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){part+='"';i++;}else quote=!quote;}else if(c===';'&&!quote){row.push(part.trim());part='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(part.trim());part='';if(row.some(Boolean))rows.push(row);row=[];}else part+=c;}if(quote)throw Error('Comillas sin cerrar en CSV');row.push(part.trim());if(row.some(Boolean))rows.push(row);return rows;}
async function importCSV(){
 if(!isManager())return;var input=document.getElementById('snapFile'),file=input&&input.files&&input.files[0];
 var campaign=val('snapCamp');if(!file||!campaign){notice='Selecciona campaña y archivo CSV.';render();return;}
 try{var raw=await file.text(),rows=parseCSV(raw);if(!rows.length)throw Error('Archivo sin filas.');
 var normalize=function(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'');};
 var keys=rows.shift().map(normalize),find=function(names){var i=keys.findIndex(function(k){return names.includes(k);});if(i<0)throw Error('Falta columna: '+names[0]);return i;};
 var iLoc=find(['ubicacion','location','locationcode']),iProd=find(['articulo','producto','productcode']),iLot=find(['lote','lot']),iQty=find(['cantidad','quantity','stock']);
 if(rows.length>10000)throw Error('Máximo 10.000 líneas por archivo.');
 var values=rows.map(function(r){return {campaign_id:campaign,location_code:required(r[iLoc],'ubicación'),product_code:required(r[iProd],'artículo'),lot:r[iLot]||'',quantity:qty(r[iQty]),source:'BC'};});
 var uniqueness=new Set(values.map(function(v){return [v.location_code,v.product_code,v.lot].join('|');}));
 if(uniqueness.size!==values.length)throw Error('El CSV contiene duplicados de ubicación, artículo y lote.');
 if(!confirm('Importar '+values.length+' líneas de stock teórico. No modifica BC. ¿Continuar?'))return;
 await mutate(async function(){for(var start=0;start<values.length;start+=100)await api('stock_snapshot','', 'POST',values.slice(start,start+100));},'Importadas '+values.length+' líneas a la campaña.');
 }catch(e){notice='Error CSV: '+e.message;render();}
}
function newMovement(){mutate(function(){return api('movements','', 'POST',{campaign_id:required(val('moveCamp'),'campaña abierta'),source_location:required(val('moveSource'),'origen'),destination_location:required(val('moveDestination'),'destino'),product_code:required(val('moveProduct'),'artículo'),lot:val('moveLot'),quantity:qty(val('moveQty')),reason:required(val('moveReason'),'motivo'),actor_id:getId(),client_mutation_id:uuid()});},'Movimiento interno registrado sin escribir en BC.');}
function updateUser(id){if(!isAdmin())return;if(id===getId()&&(!document.getElementById('enabled_'+id).checked||val('role_'+id)!=='admin')){notice='Para evitar bloquear el único administrador, no puedes quitarte el rol ni desactivar tu propia cuenta desde esta pantalla.';render();return;}mutate(function(){return api('profiles','user_id=eq.'+id,'PATCH',{role:val('role_'+id),enabled:document.getElementById('enabled_'+id).checked});},'Permisos actualizados y registrados.');}
var apiObject={isManager:isManager,isAdmin:isAdmin,signIn:signIn,register:register,logout:logout,renderLogin:renderLogin,render:render,open:open,newCampaign:newCampaign,setCampaign:setCampaign,newAssignment:newAssignment,updateAssignment:updateAssignment,newIncident:newIncident,resolveIncident:resolveIncident,newLocation:newLocation,newProduct:newProduct,newFixed:newFixed,newSnapshot:newSnapshot,importCSV:importCSV,newMovement:newMovement,updateUser:updateUser};
Object.defineProperty(apiObject,'profile',{get:function(){return profile;}});
window.INVENTA_MGMT=apiObject;
window.addEventListener('DOMContentLoaded',function(){restore().then(function(){if(typeof screen!=='undefined'&&screen==='home'&&typeof render==='function')window.render&&window.render();}).catch(function(){});});
})();
