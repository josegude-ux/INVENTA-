/* INVENTA · Gestión de almacén conectada a Supabase.
   La app de recuentos DEMO permanece separada: jamás se envían datos TEST a Supabase.
   Nunca usar claves secretas ni service_role en el navegador. */
(function(){
'use strict';
var BASE='https://wlejxnpphysogrzcxjfh.supabase.co';
var KEY='sb_publishable_gPeof-fUW3yITvNXqsjHVw_-PjB1Fyd';
var STORE='inventa-real-auth-v1';
var session=null,profile=null,section='dashboard',pending=false,notice='';
var catalogView='aisles',catalogAisle='',catalogLocation='',renderSerial=0,refreshTask=null;
var permissionVersions={},fixedReportRows=[];
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
function authHeaders(){var headers={'apikey':KEY,'Content-Type':'application/json'};if(session&&session.access_token)headers.Authorization='Bearer '+session.access_token;return headers;}
async function request(url,options){var o=options||{};var headers=authHeaders();if(url.indexOf('/auth/v1/token')===0||url.indexOf('/auth/v1/signup')===0)delete headers.Authorization;o.headers=Object.assign(headers,o.headers||{});var res=await fetch(BASE+url,o);var data=await res.text(),obj;try{obj=JSON.parse(data);}catch(e){obj=data;}if(!res.ok){var msg=obj&&typeof obj==='object'?(obj.message||obj.msg||obj.error_description||obj.error||obj.hint||obj.code):obj;var err=Error(String(msg||'Error '+res.status));err.status=res.status;err.code=obj&&obj.code;throw err;}return obj;}
function saveSession(s){if(s&&!s.expires_at)s.expires_at=Math.floor(Date.now()/1000)+(s.expires_in||3600);session=s;localStorage.setItem(STORE,JSON.stringify(s));}
async function refresh(){
 if(!session||!session.refresh_token)return false;
 if(refreshTask)return refreshTask;
 refreshTask=(async function(){
  try{saveSession(await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})}));return true;}
  catch(e){if(e.status===400||e.status===401){session=null;profile=null;localStorage.removeItem(STORE);}throw e;}
 })();
 try{return await refreshTask;}finally{refreshTask=null;}
}
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
 if(!profile||!profile.enabled){if(error)error.textContent='Cuenta identificada. Pendiente de aprobación por un Administrador.';return;}
 notice='Sesión iniciada. Los permisos se verifican también en Supabase.';if(typeof managerUser!=='undefined')managerUser=profile.display_name||profile.role;go('home');
 }catch(e){if(error)error.textContent=e.message;}
}
async function register(){
 var error=document.getElementById('managerError');try{
 var email=val('managerEmail'),password=val('managerPassword');
 if(password.length<8)throw Error('La contraseña debe tener al menos ocho caracteres.');
 if(!email)throw Error('Introduce tu correo real.');
 var res=await request('/auth/v1/signup?redirect_to='+encodeURIComponent('https://josegude-ux.github.io/INVENTA-/'),{method:'POST',body:JSON.stringify({email:email,password:password,data:{display_name:val('managerName')}})});
 if(error)error.textContent='Cuenta solicitada. Confirma tu correo si Supabase te envía un enlace. Tu cuenta queda pendiente de aprobación; empieza como Operario sin acceso a datos.';
 return res;
 }catch(e){if(error)error.textContent=e.message;}
}
async function loadProfile(){var u=session&&session.user;if(!u)return;var arr=await api('profiles','user_id=eq.'+encodeURIComponent(u.id)+'&select=*');profile=arr&&arr[0]||null;}
async function restore(){try{session=JSON.parse(localStorage.getItem(STORE)||'null');if(!session)return;if(session.expires_at&&session.expires_at*1000<Date.now()+90000)await refresh();if(session)await loadProfile();if(isManager()&&typeof managerUser!=='undefined')managerUser=profile.display_name||profile.role;}catch(e){session=null;profile=null;}}
async function logout(){fixedReportRows=[];try{if(session)await request('/auth/v1/logout',{method:'POST'});}catch(e){}session=null;profile=null;localStorage.removeItem(STORE);if(typeof managerUser!=='undefined')managerUser='';if(typeof consultUser!=='undefined')consultUser='';notice='';go('home');}
function renderLogin(){
 show(heading('CUENTA PERSONAL','Acceso seguro','INVENTA usa cuentas personales y permisos de Supabase.')
  +card('Iniciar sesión',
  field('managerName','Nombre visible (para solicitar alta)','Tu nombre')
  +field('managerEmail','Correo electrónico','Tu correo real','email')
  +field('managerPassword','Contraseña','Contraseña','password')
  +'<button class="btn" onclick="INVENTA_MGMT.signIn()">Entrar →</button>'
  +'<p id="managerError" class="muted" role="status" style="margin-top:10px"></p>'
  +button('Solicitar alta (pendiente de aprobación)','register()')+(session?button('Cerrar esta sesión','logout()'):''))
  +'<div class="alert">El PIN 1234 solo pertenece a la demostración antigua. Las cuentas reales necesitan confirmar correo y aprobación; empiezan como Operario deshabilitado; el primer Administrador debe habilitarse de forma controlada en Supabase.</div>');
}
function tabs(){return [
 ['dashboard','Resumen'],
 ['campaigns','Campañas'],
 ['assignments','Asignaciones'],
 ['incidents','Incidencias'],
 ['catalog','Ubicaciones'],
 ['snapshot','Existencias BC'],
 ['movements','Movimientos'],
 ['history','Auditoría']
 ].concat(isAdmin()?[['fixed','Posiciones fijas'],['users','Usuarios y permisos']]:[]).map(function(pair){
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
// Solo supervisión puede leer existencias teóricas; respeta RLS del servidor.
async function allConsultRows(table,parameters){
 var out=[],size=1000;
 for(var offset=0;offset<100000;offset+=size){
  var rows=await api(table,parameters+'&limit='+size+'&offset='+offset);
  if(!Array.isArray(rows))throw Error('Respuesta de consulta no válida.');
  out.push.apply(out,rows);
  if(rows.length<size)return out;
 }
 throw Error('Consulta demasiado grande. Filtra o importa un inventario más pequeño.');
}
async function readConsultData(){
 if(!isManager())throw Error('Consulta BC reservada a Supervisor o Administrador.');
 var current=await api('bc_import_current','select=import_id,updated_at&limit=1');
 var active=current[0]||null,latest=[],campaignId=null;
 if(!active){latest=await api('stock_snapshot','select=campaign_id,imported_at&order=imported_at.desc&limit=1');campaignId=latest[0]&&latest[0].campaign_id;}
 var lists=await Promise.all([
  allConsultRows('products','select=code,description,unit,barcode&order=code'),
  allConsultRows('locations','select=code&order=code'),
  allConsultRows('fixed_positions','select=product_code,location_code,priority&order=product_code,location_code'),
  active?allConsultRows('bc_import_lines','select=location_code,product_code,lot,quantity,expiry_date&import_id=eq.'+encodeURIComponent(active.import_id)+'&quantity=neq.0&order=location_code,product_code,lot'):
   (campaignId?allConsultRows('stock_snapshot','select=location_code,product_code,lot,quantity&campaign_id=eq.'+encodeURIComponent(campaignId)+'&order=location_code,product_code,lot'):Promise.resolve([])),
  active?api('bc_import_batches','select=file_name&id=eq.'+encodeURIComponent(active.import_id)+'&limit=1'):
   (campaignId?api('campaigns','select=name,status&id=eq.'+encodeURIComponent(campaignId)+'&limit=1'):Promise.resolve([]))
 ]);
 return {products:lists[0],locations:lists[1],fixed:lists[2],stock:lists[3],
  source:active?((lists[4][0]&&lists[4][0].file_name)||'Excel BC'):(campaignId?((lists[4][0]&&lists[4][0].name)||'Campaña de BC'):'Sin importación BC'),
  importedAt:active?active.updated_at:(latest[0]&&latest[0].imported_at||null)};
}
function curr(a){return a.find(function(x){return x.status==='active';});}
// INVENTA ya almacena las líneas importadas. Al iniciar o recuperar la app
// se vuelve a leer el sello del último stock BC, sin reimportar ni modificarlo.
async function refreshBCStatus(){
 var el=typeof document==='undefined'?null:document.getElementById('bcLiveStatus');
 if(!el||!isManager())return;
 el.textContent='Consultando la última exportación BC en Supabase…';
 try{
  await loadProfile();
  if(!isManager())return;
  var active=await api('bc_import_current','select=import_id,updated_at&limit=1');
  if(!active||!active.length){if(el.isConnected)el.textContent='Sin exportación BC publicada todavía.';return;}
  var id=active[0].import_id;
  var rows=await api('bc_import_batches','select=warehouse,stock_rows,committed_at&id=eq.'+encodeURIComponent(id)+'&limit=1');
  if(!el.isConnected)return;
  var last=active[0].updated_at;
  var stale=Date.now()-new Date(last).getTime()>24*60*60*1000;
  el.textContent='Supabase conectado · Almacén '+(rows[0]&&rows[0].warehouse||'BC')
   +' · '+(rows[0]&&rows[0].stock_rows||0)+' líneas de stock · Actualización: '+ftime(last)
   +(stale?' · Exportación BC con más de 24 horas':'');
 }catch(e){if(el.isConnected)el.textContent='No se pudo comprobar la sincronización BC: '+e.message;}
}
async function dataFor(tab){
 if(tab==='dashboard'){
  var arr=await Promise.all([api('campaigns','select=*&order=created_at.desc&limit=10'),api('locations','select=code'),api('products','select=code'),api('incidents','select=*&status=neq.resolved&limit=10'),api('assignments','select=*&order=created_at.desc&limit=10')]);return {campaigns:arr[0],locations:arr[1],products:arr[2],incidents:arr[3],assignments:arr[4]};
 }
 if(tab==='fixed'){
  if(!isAdmin())throw Error('Informe exclusivo de Administración.');
  return {rows:await api('rpc/admin_fixed_positions_report','','POST',{})};
 }
 if(tab==='campaigns')return {campaigns:await api('campaigns','select=*&order=created_at.desc&limit=100')};
 if(tab==='users'){var people=await api('rpc/admin_user_directory','', 'POST',{});people.forEach(function(p){permissionVersions[p.user_id]=p.version;});return {profiles:people};}
 if(tab==='assignments'){var a=await Promise.all([api('assignments','select=*&order=created_at.desc&limit=200'),api('campaigns','select=*&order=created_at.desc&limit=100'),api('locations','select=*&order=code&limit=1500'),api('profiles','select=*&order=display_name&limit=500')]);return {assignments:a[0],campaigns:a[1],locations:a[2],profiles:a[3]};}
 if(tab==='incidents'){var a=await Promise.all([api('incidents','select=*&order=created_at.desc&limit=100'),api('campaigns','select=*&order=created_at.desc&limit=100'),api('locations','select=code&order=code&limit=1500')]);return {incidents:a[0],campaigns:a[1],locations:a[2]};}
 if(tab==='catalog'){
  var locations=await allConsultRows('locations','select=code,aisle,zone,description,enabled&order=code');
  if(catalogView!=='detail')return {locations:locations};
  var id=catalogLocation;
  var current=await api('bc_import_current','select=import_id&limit=1');
  var active=current[0]||null,latest=[],campaignId=null;
  if(!active){latest=await api('stock_snapshot','select=campaign_id,imported_at&order=imported_at.desc&limit=1');campaignId=latest[0]&&latest[0].campaign_id;}
  var records=await Promise.all([
   allConsultRows('fixed_positions','select=product_code,location_code,priority&location_code=eq.'+encodeURIComponent(id)+'&order=priority,product_code'),
   active?allConsultRows('bc_import_lines','select=product_code,location_code,lot,quantity,expiry_date&import_id=eq.'+encodeURIComponent(active.import_id)+'&quantity=neq.0&location_code=eq.'+encodeURIComponent(id)+'&order=product_code,lot'):
    (campaignId?allConsultRows('stock_snapshot','select=product_code,location_code,lot,quantity&campaign_id=eq.'+encodeURIComponent(campaignId)+'&location_code=eq.'+encodeURIComponent(id)+'&order=product_code,lot'):Promise.resolve([]))
  ]);
  var ids=[...new Set(records[0].concat(records[1]).map(function(r){return r.product_code;}))];
  var products=[];
  for(var start=0;start<ids.length;start+=70){
   var keyset=ids.slice(start,start+70).map(function(k){return '"'+String(k).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';});
   products.push.apply(products,await api('products','select=code,description,unit&code=in.'+encodeURIComponent('('+keyset.join(',')+')')));
  }
  return {locations:locations,fixed:records[0],stock:records[1],products:products,hasImport:!!(active||campaignId)};
 }
 if(tab==='snapshot'){var a=await Promise.all([api('bc_import_batches','select=*&order=created_at.desc&limit=20'),api('bc_import_current','select=import_id,updated_at&limit=1')]);return {history:a[0],current:a[1]};}
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
 if(tab==='fixed'){
  if(!isAdmin())return card('Sin permiso','Solo Administración puede consultar el informe.');
  var records=d.rows||[];fixedReportRows=records;
  var prodCount=new Set(records.map(function(r){return r.product_code;})).size;
  var locCount=new Set(records.map(function(r){return r.location_code;})).size;
  var body=heading('GESTIÓN ALMACÉN','Informe de posiciones fijas','Asignaciones registradas en Supabase y stock calculado de la última exportación de BC.')
   +card('Resumen',
      row('Asignaciones',records.length+' posiciones artículo/ubicación')
     +row('Artículos distintos',prodCount)
     +row('Ubicaciones distintas',locCount)
     +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
     +button('Descargar informe CSV · Excel','exportFixedReport()')
     +button('Imprimir / Guardar PDF','printFixedReport()')+'</div>')
   +'<div class="field"><label for="fixedReportSearch">Filtrar por artículo, descripción, ubicación o pasillo</label>'
   +'<input class="input" type="search" id="fixedReportSearch" placeholder="Buscar..." oninput="INVENTA_MGMT.filterFixedReport(this.value)"></div>'
   +'<p class="muted" id="fixedReportCount" role="status">'+records.length+' asignaciones</p>'
   +'<div id="fixedReportList">';
  body+=records.length?records.map(function(r){
   var txt=[r.product_code,r.product_description,r.location_code,r.aisle].join(' ').toLocaleLowerCase('es');
   var units=Number(r.stock_quantity||0).toLocaleString('es-ES',{maximumFractionDigits:3});
   return '<div class="card fixed-report-row" data-fixed-search="'+safe(txt)+'" style="margin-bottom:8px">'
    +'<div class="between"><div><b>'+safe(r.location_code)+'</b><small style="display:block;color:#678198">'+safe(r.aisle||'')+'</small></div>'
    +'<div style="text-align:right"><b>'+safe(units)+' '+safe(r.unit||'UD')+'</b><small style="display:block;color:#678198">Stock calculado BC</small></div></div>'
    +'<p style="margin:8px 0 0"><b>'+safe(r.product_code)+'</b> · '+safe(r.product_description)+'</p>'
    +'<small class="muted">Asignada: '+safe(ftime(r.assigned_at))+'</small></div>';
  }).join(''):'<div class="alert">No hay posiciones fijas marcadas todavía. Ve a Ubicaciones y marca los artículos que correspondan.</div>';
  return body+'</div>';
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
  +empty(d.profiles.map(function(u){return '<div style="border-top:1px solid #ddd;padding:10px 0"><b>'+safe(u.display_name||short(u.user_id))+'</b><div class="muted">'+safe(u.user_id)+'</div>'+small((u.email||'')+' · '+(u.email_confirmed?'Correo confirmado':'Correo pendiente de confirmar'))
   +'<select class="input" id="role_'+safe(u.user_id)+'"><option value="operator" '+(u.role==='operator'?'selected':'')+'>Operario</option><option value="supervisor" '+(u.role==='supervisor'?'selected':'')+'>Supervisor</option><option value="admin" '+(u.role==='admin'?'selected':'')+'>Administrador</option></select>'
   +'<label><input type="checkbox" id="enabled_'+safe(u.user_id)+'" '+(u.enabled?'checked':'')+'> Usuario habilitado</label>'
   +field('reason_'+u.user_id,'Motivo del cambio','Explica el alta o cambio de permisos')
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
 if(tab==='catalog')return catalogContent(d);
 if(tab==='snapshot'){
  return window.INVENTA_BC?window.INVENTA_BC.panel(d,isAdmin()):card('Importador Excel BC','No se ha cargado el módulo Excel. Recarga la aplicación.');
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
   +empty(d.history.map(function(x){return row(x.relation_name+' · '+x.operation+' · '+x.record_id,(x.actor_id?short(x.actor_id):'Sistema')+' · '+ftime(x.created_at)+(x.after_row&&x.after_row.permission_reason?' · Motivo: '+x.after_row.permission_reason:'')+(x.relation_name==='profiles'&&x.before_row?' · '+x.before_row.role+'/'+x.before_row.enabled+' → '+x.after_row.role+'/'+x.after_row.enabled:''));})));
 }
 return '';
}
// Gestión de ubicaciones: primero pasillos A-T, luego ubicaciones y finalmente su contenido.
function locationAisle(l){
 var aisle=String(l.aisle||'').trim().toUpperCase();
 return (aisle||String(l.code||'').trim().toUpperCase()).charAt(0);
}
function catalogCodeAction(fn,id,label,classes){
 return '<button type="button" class="'+(classes||'btn-outline')+'" onclick="INVENTA_MGMT.'+fn+'('+safe(JSON.stringify(id))+')">'+label+'</button>';
}
function catalogMaintenance(){
 return '<details class="catalog-maintenance"><summary>⚙ Opciones de mantenimiento</summary>'
  +'<div class="catalog-maintenance-body"><h3>Crear artículo</h3>'
  +field('prodCode','Código','PRD000123')+field('prodDesc','Descripción','Nombre')+field('prodUnit','Unidad','UD')
  +button('Guardar artículo','newProduct()')+'</div></details>';
}
function catalogContent(d){
 var locs=d.locations||[],letters='ABCDEFGHIJKLMNOPQRST'.split('');
 if(catalogView==='aisles'){
  var byAisle=new Map(letters.map(function(letter){return [letter,0];}));
  locs.forEach(function(l){var a=locationAisle(l);if(byAisle.has(a))byAisle.set(a,byAisle.get(a)+1);});
  var other=locs.filter(function(l){return !byAisle.has(locationAisle(l));});
  return heading('UBICACIONES','Selecciona un pasillo','De la A a la T. Después podrás consultar sus ubicaciones.')
   +'<div class="catalog-aisles">'+letters.map(function(letter){
    return '<button type="button" class="catalog-aisle" onclick="INVENTA_MGMT.openCatalogAisle(\''+letter+'\')">'
     +'<b>'+letter+'</b><small>'+byAisle.get(letter)+' ubic.</small></button>';
   }).join('')+'</div>'
   +(other.length?catalogCodeAction('openCatalogAisle','OTROS','Otras ubicaciones ('+other.length+')','btn-outline catalog-full'):'')
   +catalogMaintenance();
 }
 if(catalogView==='locations'){
  var inAisle=locs.filter(function(l){return catalogAisle==='OTROS'?!letters.includes(locationAisle(l)):locationAisle(l)===catalogAisle;});
  return heading('UBICACIONES','Pasillo '+catalogAisle,inAisle.length+' ubicaciones registradas')
   +button('← Todos los pasillos','backCatalog()')
   +'<div class="field" style="margin-top:14px"><label for="catalogSearch">Buscar ubicación</label>'
   +'<input id="catalogSearch" class="input" placeholder="Código o descripción" oninput="INVENTA_MGMT.filterCatalogLocations(this.value)"></div>'
   +'<div id="catalogLocationList">'+(inAisle.length?inAisle.map(function(l){
    return '<button type="button" class="item catalog-location" data-catalog-location="'+safe((l.code+' '+(l.description||'')).toLowerCase())+'" '
      +'onclick="INVENTA_MGMT.openCatalogLocation('+safe(JSON.stringify(l.code))+')"><span><strong>'+safe(l.code)+'</strong>'
      +'<small>'+safe(l.description||l.zone||'')+'</small></span><span class="chev">›</span></button>';
   }).join(''):'<div class="card"><p class="muted">Este pasillo aún no tiene ubicaciones registradas.</p></div>')+'</div>'
   +'<details class="catalog-maintenance"><summary>＋ Añadir ubicación</summary><div class="catalog-maintenance-body">'
   +field('locCode','Código','Ejemplo: '+(catalogAisle==='OTROS'?'K':'A')+'00-P01')
   +(catalogAisle==='OTROS'?field('locAisle','Pasillo','Por ejemplo U o Z')
    :'<input type="hidden" id="locAisle" value="'+safe(catalogAisle)+'">')
   +field('locZone','Zona','Opcional')+field('locDescription','Descripción','Opcional')
   +button('Guardar nueva ubicación','newLocation()')+'</div></details>';
 }
 var location=locs.find(function(l){return l.code===catalogLocation;});
 var fixed=d.fixed||[],stocks=d.stock||[],pmap=new Map((d.products||[]).map(function(p){return [p.code,p];}));
 var byProduct=new Map();
 function add(code){
  if(!byProduct.has(code))byProduct.set(code,{code:code,total:0,lots:[],fixed:false,priority:99});
  return byProduct.get(code);
 }
 fixed.forEach(function(f){var x=add(f.product_code);x.fixed=true;x.priority=Math.min(x.priority,f.priority||1);});
  stocks.forEach(function(s){
   var q=Number(s.quantity);
   if(!Number.isFinite(q)||q===0)return;
   var x=add(s.product_code);x.total+=q;if(s.lot)x.lots.push({code:s.lot,quantity:q});
  });
  var entries=[...byProduct.values()].sort(function(a,b){return (Number(b.fixed)-Number(a.fixed))||(a.priority-b.priority)||a.code.localeCompare(b.code,'es',{numeric:true});});
  var display=entries.length?entries.map(function(e){
  var p=pmap.get(e.code)||{},name=p.description||'Artículo sin descripción',unit=p.unit||'UD';
  return '<div class="catalog-product'+(e.fixed?' catalog-fixed-shade':'')+'"><div><b>'+safe(e.code)+'</b><small>'+safe(name)+'</small>'
   +(e.lots.length?'<small>Lotes: '+e.lots.map(function(l){return safe(l.code)+' ('+l.quantity.toLocaleString('es-ES')+')';}).join(', ')+'</small>':'')
   +'</div><div class="catalog-product-right"><b>'+e.total.toLocaleString('es-ES')+' '+safe(unit)+'</b>'
   +(e.total<0?'<span class="tag warn">STOCK NEGATIVO BC</span>':'')
   +(e.fixed&&e.total===0?'<span class="tag warn">'+(d.hasImport?'SIN STOCK':'SIN DATOS BC')+'</span>':'')
   +(isAdmin()?'<button type="button" class="tinybtn" style="margin-top:8px" onclick="INVENTA_MGMT.toggleCatalogFixed('+safe(JSON.stringify(e.code))+','+(e.fixed?'true':'false')+')">'+(e.fixed?'Desmarcar posición':'Marcar posición fija')+'</button>':'')
   +'</div></div>';
 }).join(''):'<p class="muted">No hay artículos ni posiciones fijas registrados aquí.</p>';
 return heading('PASILLO '+catalogAisle,'Ubicación '+catalogLocation,location?(location.description||location.zone||''):'')
  +button('← Volver al pasillo '+catalogAisle,'backCatalog()')
  +card('Artículos en esta ubicación',small(d.hasImport?'Existencias de la última importación BC.':'Todavía no hay existencias BC importadas.')
    +'<div class="catalog-product-list">'+display+'</div>')
  +(isAdmin()?'<details class="catalog-maintenance"><summary>＋ Marcar posición fija de otro artículo</summary><div class="catalog-maintenance-body">'
  +small('Permite fijar artículos sin existencias. La asignación persiste al actualizar el Excel BC.')
  +field('fixedProd','Código del artículo','PRD000123')
  +'<input type="hidden" id="fixedLoc" value="'+safe(catalogLocation)+'">'
  +'<input type="hidden" id="fixedPriority" value="1">'
  +button('Guardar posición fija','newFixed()')+'</div></details>':'');
}
function filterCatalogLocations(query){
 var term=String(query||'').trim().toLowerCase();
 if(typeof document==='undefined')return;
 document.querySelectorAll('[data-catalog-location]').forEach(function(node){
  node.hidden=!node.getAttribute('data-catalog-location').includes(term);
 });
}
function openCatalogAisle(aisle){
 if(section!=='catalog'||!check())return;
 if(aisle!=='OTROS'&&!/^[A-T]$/.test(aisle))return;
 catalogAisle=aisle;catalogLocation='';catalogView='locations';notice='';render();
}
function openCatalogLocation(code){
 if(section!=='catalog'||!check())return;
 catalogLocation=String(code);catalogView='detail';notice='';render();
}
function backCatalog(){
 if(section!=='catalog'||!check())return;
 if(catalogView==='detail'){catalogView='locations';catalogLocation='';}
 else{catalogView='aisles';catalogAisle='';}
 notice='';render();
}
async function render(){
 var serial=++renderSerial;
 try{await loadProfile();}catch(e){if(serial===renderSerial)show(card('Sin conexión verificada',small(e.message)));return;}
 if(serial!==renderSerial)return;
 if(!check())return;
 var s=section;
 show(shell(card('Cargando información…',small('Consultando datos autorizados.'))));
 try{
 var d=await dataFor(s);if(serial!==renderSerial||s!==section||!check())return;
 show(shell(contentFor(s,d)));
 }catch(e){if(serial===renderSerial)show(shell(card('No se pudo cargar',small(e.message)+button('Reintentar','render()'))));}
}
function open(s){if(!check())return;section=s;if(s==='catalog'){catalogView='aisles';catalogAisle='';catalogLocation='';}notice='';render();}
async function mutate(action,message){
 if(pending)return;pending=true;notice='';
 try{await loadProfile();if(!check())return;await action();notice=message||'Guardado correctamente.';await render();}
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
function newFixed(){
 if(!isAdmin())return;
 mutate(async function(){
  var product=required(val('fixedProd'),'artículo').toUpperCase(),location=required(val('fixedLoc'),'ubicación').toUpperCase();
  await api('fixed_positions','','POST',{product_code:product,location_code:location,priority:1});
 },'Posición fija registrada. Se mantiene aunque el stock BC sea cero.');
}
async function changeFixedPosition(product,location,alreadyFixed){
 if(pending)throw Error('Espera a que termine la operación anterior.');
 if(!isAdmin())throw Error('Solo Administración puede modificar posiciones fijas.');
 var sentence=alreadyFixed?'¿Desmarcar la posición fija de '+product+' en '+location+'?':'¿Marcar '+product+' como posición fija en '+location+'?';
 if(!confirm(sentence))return false;
 pending=true;
 try{
  await loadProfile();
  if(!isAdmin())throw Error('Se requiere una cuenta de Administrador activa.');
  var filter='product_code=eq.'+encodeURIComponent(product)+'&location_code=eq.'+encodeURIComponent(location);
  if(alreadyFixed){
   var deleted=await api('fixed_positions',filter,'DELETE');
   if(!Array.isArray(deleted)||!deleted.length)throw Error('La posición ya se había desmarcado. Recarga los datos.');
  }else{
   await api('fixed_positions','','POST',{product_code:product,location_code:location,priority:1});
  }
  return true;
 }finally{pending=false;}
}
function toggleCatalogFixed(product,alreadyFixed){
 if(!isAdmin()||section!=='catalog'||catalogView!=='detail')return;
 var location=catalogLocation;
 changeFixedPosition(product,location,alreadyFixed).then(function(changed){
  if(changed){notice='Posición '+(alreadyFixed?'desmarcada':'marcada')+' y sincronizada en Supabase.';render();}
 }).catch(function(e){notice='No se pudo cambiar la posición fija: '+e.message;render();});
}
function filterFixedReport(value){
 if(section!=='fixed'||!isAdmin())return;
 var term=String(value||'').trim().toLocaleLowerCase('es'),count=0;
 document.querySelectorAll('.fixed-report-row').forEach(function(node){
  node.hidden=!node.getAttribute('data-fixed-search').includes(term);
  if(!node.hidden)count++;
 });
 var info=document.getElementById('fixedReportCount');if(info)info.textContent=count+' asignaciones visibles';
}
function makeFixedCSV(rows){
 var cols=['Código artículo','Descripción','Ubicación','Pasillo','Prioridad','Stock calculado BC','Unidad','Fecha de asignación'];
 var values=rows.map(function(r){
  return [r.product_code,r.product_description,r.location_code,r.aisle,r.priority,r.stock_quantity,r.unit,ftime(r.assigned_at)];
 });
 return '\uFEFF'+[cols].concat(values).map(function(row){
  return row.map(function(v){return '"'+String(v===null||v===undefined?'':v).replace(/"/g,'""')+'"';}).join(';');
 }).join('\r\n');
}
function exportFixedReport(){
 if(!isAdmin()||section!=='fixed')return;
 var csv=makeFixedCSV(fixedReportRows);
 var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 var a=document.createElement('a');a.href=url;a.download='INVENTA_posiciones_fijas_'+new Date().toISOString().slice(0,10)+'.csv';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(url);},10000);
}
function printFixedReport(){
 if(!isAdmin()||section!=='fixed')return;
 var w=window.open('','_blank');
 if(!w){notice='Permite las ventanas emergentes para imprimir o utiliza Descargar CSV.';render();return;}
 var rows=fixedReportRows.map(function(r){return '<tr><td>'+safe(r.location_code)+'</td><td>'+safe(r.product_code)+'</td><td>'+safe(r.product_description)+'</td><td>'+safe(r.stock_quantity)+' '+safe(r.unit)+'</td></tr>';}).join('');
 w.document.open();w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>INVENTA · Posiciones fijas</title><style>body{font-family:Arial,sans-serif;margin:25px;color:#203047}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #d4dfe9;text-align:left}th{background:#edf3f9}tr{break-inside:avoid}small{color:#64748b}@media print{button{display:none}}</style></head><body><h1>INVENTA · Informe de posiciones fijas</h1><small>Generado: '+safe(ftime(new Date().toISOString()))+' · Total: '+fixedReportRows.length+' asignaciones</small><table><thead><tr><th>Ubicación</th><th>Artículo</th><th>Descripción</th><th>Stock BC</th></tr></thead><tbody>'+rows+'</tbody></table><button onclick="window.print()">Imprimir / Guardar PDF</button></body></html>');w.document.close();
}

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
function updateUser(id){if(!isAdmin())return;if(id===getId()&&(!document.getElementById('enabled_'+id).checked||val('role_'+id)!=='admin')){notice='Para evitar bloquear el único administrador, no puedes quitarte el rol ni desactivar tu propia cuenta desde esta pantalla.';render();return;}mutate(function(){var reason=val('reason_'+id);if(reason.length<5)throw Error('Explica el motivo con al menos cinco caracteres.');return api('profiles','user_id=eq.'+id+'&version=eq.'+permissionVersions[id],'PATCH',{role:val('role_'+id),enabled:document.getElementById('enabled_'+id).checked,permission_reason:reason}).then(function(rows){if(!rows.length)throw Error('El perfil cambió en otro dispositivo. Recarga y revisa los permisos.');});},'Permisos actualizados y registrados.');}
var apiObject={refreshBCStatus:refreshBCStatus,isSaving:function(){return pending;},changeFixedPosition:changeFixedPosition,toggleCatalogFixed:toggleCatalogFixed,filterFixedReport:filterFixedReport,exportFixedReport:exportFixedReport,printFixedReport:printFixedReport,cancelView:function(){renderSerial++;},isAuthenticated:function(){return !!(session&&profile&&profile.enabled);},openCounts:function(){window.INVENTA_REAL.open();},realApi:api,refreshProfile:loadProfile,getUserId:getId,openCatalogAisle:openCatalogAisle,openCatalogLocation:openCatalogLocation,backCatalog:backCatalog,filterCatalogLocations:filterCatalogLocations,readConsultData:readConsultData,isManager:isManager,isAdmin:isAdmin,signIn:signIn,register:register,logout:logout,renderLogin:renderLogin,render:render,open:open,newCampaign:newCampaign,setCampaign:setCampaign,newAssignment:newAssignment,updateAssignment:updateAssignment,newIncident:newIncident,resolveIncident:resolveIncident,newLocation:newLocation,newProduct:newProduct,newFixed:newFixed,newSnapshot:newSnapshot,importCSV:importCSV,newMovement:newMovement,updateUser:updateUser};
Object.defineProperty(apiObject,'profile',{get:function(){return profile;}});
window.INVENTA_MGMT=apiObject;
window.addEventListener('storage',function(e){if(e.key===STORE){session=null;profile=null;renderSerial++;restore().then(function(){if(typeof go==='function')go('home');});}});
window.addEventListener('DOMContentLoaded',function(){restore().then(function(){if(typeof screen!=='undefined'&&screen==='home'&&typeof render==='function')window.render&&window.render();}).catch(function(){});});
})();
