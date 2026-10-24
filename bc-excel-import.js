/* INVENTA · Importador autónomo de existencias Business Central.
   El archivo se analiza localmente: solo se suben las filas validadas al confirmar.
   Ninguna cantidad física ni diferencia del diario BC se usa como stock oficial. */
(function(root){
'use strict';
var state=null,busy=false,excelLoading=null;
function esc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function normal(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function raw(v){if(v&&typeof v==='object'){if(v instanceof Date)return v;if('result' in v)return v.result;if('text' in v)return v.text;if(Array.isArray(v.richText))return v.richText.map(function(t){return t.text||'';}).join('');}return v;}
function str(v){v=raw(v);return v===null||v===undefined?'':String(v).trim();}
function quantity(v){v=raw(v);if(typeof v==='number')return Number.isFinite(v)?v:NaN;var s=str(v).replace(/\s/g,'');if(!s)return NaN;if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else s=s.replace(',','.');var n=Number(s);return Number.isFinite(n)?n:NaN;}
function date(v){
 v=raw(v);if(v===null||v===undefined||v==='')return null;
 if(v instanceof Date){if(!Number.isFinite(v.valueOf()))return null;return v.toISOString().slice(0,10);}
 if(typeof v==='number'){var d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);return Number.isFinite(d.valueOf())?d.toISOString().slice(0,10):null;}
 var s=str(v),m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
 if(m){var yy=Number(m[3]),mm=Number(m[2]),dd=Number(m[1]);var iso=yy+'-'+String(mm).padStart(2,'0')+'-'+String(dd).padStart(2,'0');var check=new Date(iso+'T00:00:00Z');return check.getUTCFullYear()===yy&&check.getUTCMonth()+1===mm&&check.getUTCDate()===dd?iso:null;}
 if(/^\d{4}-\d\d-\d\d$/.test(s)){var d2=new Date(s+'T00:00:00Z');return Number.isFinite(d2.valueOf())&&d2.toISOString().slice(0,10)===s?s:null;}
 return null;
}
function columns(headers){
 var h=headers.map(normal),f=function(options){return h.findIndex(function(x){return options.indexOf(x)!==-1;});};
 var obj={
  product:f(['nproducto','noproducto','narticulo','articulo','producto','productcode']),
  location:f(['codubicacion','ubicacion','locationcode']),
  description:f(['descripcion','itemdescription']),
  lot:f(['nlote','nolote','lote','lot']),
  stock:f(['stockcalculado','calculatedstock']),
  unit:f(['codunidadmedida','unidadmedida','unit']),
  warehouse:f(['codalmacen','almacen','warehouse']),
  zone:f(['codzona','zona','zone']),
  expiry:f(['fechacaducidad','caducidad','expirydate'])
 };
 ['product','location','description','lot','stock','unit','warehouse'].forEach(function(k){if(obj[k]<0)throw Error('Falta la columna obligatoria: '+({product:'Nº producto',location:'Cód. ubicación',description:'Descripción',lot:'Nº lote',stock:'Stock calculado',unit:'Cód. unidad medida',warehouse:'Cód. almacén'}[k]));});
 return obj;
}
function parseRows(matrix,fileName){
 if(!Array.isArray(matrix)||!matrix.length)throw Error('El libro no contiene cabecera.');
 var indices=columns(matrix[0]),result=[],errors=[],warnings=[],keys=new Set(),products=new Set(),locations=new Set(),warehouses=new Set(),negative=0,zero=0,example=[];
 function error(t){if(errors.length<30)errors.push(t);}
 function warning(t){if(warnings.length<30)warnings.push(t);}
 for(var i=1;i<matrix.length;i++){
  var row=matrix[i];if(!Array.isArray(row)||row.every(function(v){return !str(v);}))continue;
  if(result.length>=50000){error('El archivo supera el máximo de 50.000 líneas.');break;}
  var code=str(row[indices.product]).toUpperCase(),location=str(row[indices.location]).toUpperCase(),
   desc=str(row[indices.description]),lot=str(row[indices.lot]),unit=str(row[indices.unit]),
   warehouse=str(row[indices.warehouse]),zone=indices.zone>=0?str(row[indices.zone]):'',
   q=quantity(row[indices.stock]),exp=indices.expiry>=0?date(row[indices.expiry]):null,sourceRow=i+1;
  if(!code||!location||!desc||!unit||!warehouse||!Number.isFinite(q)){error('Fila '+sourceRow+': artículo, ubicación, descripción, unidad, almacén o stock calculado inválidos.');continue;}
  var key=JSON.stringify([code,location,lot]);if(keys.has(key)){error('Fila '+sourceRow+': se repite artículo + ubicación + lote ('+code+' · '+location+' · '+lot+').');continue;}keys.add(key);
  if(Math.abs(q)>=1e12){error('Fila '+sourceRow+': stock fuera de rango.');continue;}
  if(indices.expiry>=0&&str(row[indices.expiry])&&!exp)warning('Fila '+sourceRow+': fecha de caducidad no reconocida.');
  if(q<0){negative++;if(negative<=5)warning('Fila '+sourceRow+': stock calculado negativo ('+q+') en '+location+'.');}
  if(q===0)zero++;
  warehouses.add(warehouse);products.add(code);locations.add(location);
  var item={row_number:result.length+1,product_code:code,description:desc,unit:unit,location_code:location,zone:zone,lot:lot,expiry_date:exp,quantity:q};
  if(example.length<6)example.push(item);
  result.push(item);
 }
 if(result.length===0)error('El archivo no contiene líneas válidas.');
 if(warehouses.size>1)error('La exportación mezcla almacenes: '+Array.from(warehouses).join(', ')+'. Sube un almacén completo cada vez.');
 return {fileName:fileName||'inventario.xlsx',rows:result,errors:errors,warnings:warnings,negative:negative,zero:zero,
  products:products.size,locations:locations.size,warehouse:Array.from(warehouses)[0]||'',example:example};
}
function loadExcelJS(){
 if(root.ExcelJS)return Promise.resolve(root.ExcelJS);
 if(excelLoading)return excelLoading;
 excelLoading=new Promise(function(resolve,reject){
  var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  s.crossOrigin='anonymous';s.onload=function(){if(root.ExcelJS)resolve(root.ExcelJS);else reject(Error('No se ha podido inicializar ExcelJS.'));};
  s.onerror=function(){reject(Error('No se pudo descargar el lector Excel. Comprueba la conexión a Internet.'));};
  document.head.appendChild(s);
 }).catch(function(e){excelLoading=null;throw e;});
 return excelLoading;
}
function status(msg,kind){var el=document.getElementById('bcExcelStatus');if(!el)return;el.innerHTML='<div class="'+(kind==='error'?'alert':'card')+'" role="status" style="margin-top:10px">'+esc(msg)+'</div>';}
function renderPreview(){
 var el=document.getElementById('bcExcelStatus');if(!el)return;
 if(!state){el.innerHTML='';return;}
 var s=state;
 var html='<div class="card" style="margin-top:12px"><h3>Vista previa · '+esc(s.fileName)+'</h3>'
 +'<p><b>'+s.rows.length+'</b> líneas · <b>'+s.products+'</b> artículos · <b>'+s.locations+'</b> ubicaciones</p>'
 +'<p>Almacén: <b>'+esc(s.warehouse)+'</b> · Stock negativo: <b>'+s.negative+'</b> · Stock cero: '+s.zero+'</p>'
 +'<p class="muted">Se leerá exclusivamente <b>Stock calculado</b>. No se importará Cant. (stock físico) ni Cantidad.</p>';
 if(s.errors.length)html+='<div class="alert"><b>Errores que impiden la carga ('+s.errors.length+')</b><ul>'+s.errors.map(function(v){return '<li>'+esc(v)+'</li>';}).join('')+'</ul></div>';
 if(s.warnings.length)html+='<div class="alert"><b>Advertencias</b><ul>'+s.warnings.map(function(v){return '<li>'+esc(v)+'</li>';}).join('')+'</ul></div>';
 html+='<div style="overflow-x:auto"><table style="width:100%;font-size:12px;text-align:left"><thead><tr><th>Ubicación</th><th>Artículo</th><th>Lote</th><th>Stock BC</th></tr></thead><tbody>'
 +s.example.map(function(v){return '<tr><td>'+esc(v.location_code)+'</td><td>'+esc(v.product_code)+'</td><td>'+esc(v.lot)+'</td><td>'+v.quantity+'</td></tr>';}).join('')
 +'</tbody></table></div>';
 if(!s.errors.length)html+='<label style="display:flex;align-items:flex-start;gap:9px;margin:14px 0"><input id="bcExcelConfirm" type="checkbox" style="width:22px;height:22px;flex:none"> <span>Confirmo que este Excel es una <b>exportación completa</b> del almacén y debe sustituir las existencias BC anteriores.</span></label>'
 +'<button class="btn" style="width:100%" onclick="INVENTA_BC.commit()">Confirmar y publicar stock BC</button>';
 el.innerHTML=html+'</div>';
}
function panel(data,isAdmin){
 var current=data.current&&data.current[0],active=current&&data.history.find(function(b){return b.id===current.import_id;});
 var stale=current&&(Date.now()-new Date(current.updated_at).getTime()>86400000);
 var html='<div class="card"><h2>Importación Excel de Business Central</h2>'
 +'<p class="muted">Actualiza las existencias oficiales sin tocar recuentos físicos ni posiciones fijas. La carga completa se publica al finalizar; no se muestra stock parcial.</p>'
 +(current?'<div class="alert">Última importación: <b>'+esc(active&&active.file_name||'BC')+'</b> · '+esc(new Date(current.updated_at).toLocaleString('es-ES'))+(stale?' · <b>Datos con más de 24 horas</b>':'')+'</div>':'<div class="alert">Todavía no hay una exportación BC publicada.</div>');
 if(isAdmin)html+='<label for="bcExcelFile"><b>Selecciona el Excel (.xlsx)</b></label>'
 +'<input class="input" style="font-size:14px;padding:11px;margin:10px 0" type="file" id="bcExcelFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">'
 +'<button class="btn-outline" style="width:100%" onclick="INVENTA_BC.analyse()">1. Analizar archivo y previsualizar</button>'
 +'<p class="muted" style="font-size:12px">2. Revisa las líneas y confirma la sustitución. Necesitas conexión a Internet hasta terminar.</p><div id="bcExcelStatus" aria-live="polite"></div>';
 else html+='<p class="muted">Solo Administración puede subir una nueva exportación BC.</p>';
 html+='</div><div class="card"><h2>Historial de importaciones</h2>';
 var committed=data.history.filter(function(h){return h.status==='committed';});
 html+=(committed.length?committed.map(function(h){return '<div style="border-top:1px solid #e6ebef;padding:10px 0"><b>'+esc(h.file_name)+'</b> '+(current&&current.import_id===h.id?'<b>· ACTUAL</b>':'')+'<div class="muted">'+esc(h.warehouse)+' · '+esc(new Date(h.committed_at).toLocaleString('es-ES'))+' · '+h.stock_rows+' líneas de stock · '+h.product_count+' artículos · '+h.location_count+' ubicaciones · '+h.negative_count+' negativos</div></div>';}).join(''):'<p class="muted">Todavía no hay cargas completadas.</p>')+'</div>';
 return html;
}
async function analyse(){
 if(busy)return;
 var f=document.getElementById('bcExcelFile');f=f&&f.files&&f.files[0];
 if(!f){status('Selecciona primero el archivo Excel.','error');return;}
 if(!/\.xlsx$/i.test(f.name)){status('Selecciona un archivo .xlsx exportado de BC.','error');return;}
 if(f.size>20*1024*1024){status('El archivo supera el límite de 20 MB.','error');return;}
 busy=true;state=null;status('Leyendo Excel y comprobando líneas…');
 try{
  var ExcelJS=await loadExcelJS(),book=new ExcelJS.Workbook();
  await book.xlsx.load(await f.arrayBuffer());
  var sheet=book.worksheets[0];if(!sheet)throw Error('No hay ninguna hoja en este Excel.');
  var matrix=[];sheet.eachRow({includeEmpty:true},function(row){
   var a=[];for(var k=1;k<=16;k++)a.push(row.getCell(k).value);matrix.push(a);
  });
  state=parseRows(matrix,f.name);renderPreview();
 }catch(e){status('No se pudo analizar: '+e.message,'error');}
 finally{busy=false;}
}
async function commit(){
 if(busy||!state||state.errors.length)return;
 if(!root.INVENTA_MGMT||!root.INVENTA_MGMT.isAdmin()){status('Solo Administración puede publicar existencias.','error');return;}
 var c=document.getElementById('bcExcelConfirm');
 if(!c||!c.checked){status('Marca la confirmación de exportación completa.','error');return;}
 if(!root.confirm('Se reemplazará el stock BC visible en INVENTA por las '+state.rows.length+' líneas del Excel. ¿Confirmar?'))return;
 busy=true;var batchId=null;
 try{
  var api=root.INVENTA_MGMT.realApi;
  status('Preparando importación segura…');
  var created=await api('bc_import_batches','','POST',{created_by:root.INVENTA_MGMT.getUserId(),file_name:state.fileName.slice(0,240),
   warehouse:state.warehouse,expected_rows:state.rows.length});
  if(!Array.isArray(created)||!created[0]||!created[0].id)throw Error('No se pudo abrir el lote de importación.');
  batchId=created[0].id;
  for(var offset=0;offset<state.rows.length;offset+=150){
   var chunk=state.rows.slice(offset,offset+150).map(function(r){return Object.assign({import_id:batchId},r);});
   await api('bc_import_lines','','POST',chunk);
   status('Subiendo datos: '+Math.min(offset+chunk.length,state.rows.length)+' / '+state.rows.length+' líneas. No cierres INVENTA.');
  }
  status('Verificando y publicando todas las existencias…');
  var result=await api('rpc/bc_commit_import','','POST',{p_import_id:batchId});
  state=null;status('Importación finalizada: '+result.stock_rows+' líneas de stock, '+result.products+' artículos, '+result.locations+' ubicaciones. '+result.negative+' existencias negativas.');
  await root.INVENTA_MGMT.render();
 }catch(e){status('La importación NO se ha publicado: '+e.message+(batchId?' (identificador de intento: '+batchId+')':''),'error');}
 finally{busy=false;}
}
var obj={panel:panel,analyse:analyse,commit:commit,parseRows:parseRows,columns:columns};
root.INVENTA_BC=obj;
if(typeof module!=='undefined'&&module.exports)module.exports=obj;
})(typeof window!=='undefined'?window:globalThis);
