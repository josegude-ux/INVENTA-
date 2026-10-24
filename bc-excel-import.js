/* INVENTA · Importador autónomo de existencias Business Central.
   El archivo se analiza localmente: solo se suben las filas validadas al confirmar.
   Ninguna cantidad física ni diferencia del diario BC se usa como stock oficial. */
(function(root){
'use strict';
var state=null,busy=false,excelLoading=null;
var CHUNK=150,MAX_ROWS=50000,MAX_BYTES=20*1024*1024;
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
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function columns(headers){
 var h=headers.map(normal),f=function(options){return h.findIndex(function(x){return options.indexOf(x)!==-1;});};
 var obj={
  product:f(['nproducto','noproducto','narticulo','articulo','producto','productcode','itemno','codigoproducto']),
  location:f(['codubicacion','ubicacion','locationcode','bincode','codigoubicacion']),
  description:f(['descripcion','itemdescription','description']),
  lot:f(['nlote','nolote','lote','lot','lotno']),
  stock:f(['stockcalculado','calculatedstock','cantcalculado','qtycalculated','cantidadcalculada']),
  unit:f(['codunidadmedida','unidadmedida','unit','unitofmeasurecode','codigounidadmedida']),
  warehouse:f(['codalmacen','almacen','warehouse','warehousecode','codigodealmacen']),
  zone:f(['codzona','zona','zone','zonecode']),
  expiry:f(['fechacaducidad','caducidad','expirydate','expirationdate']),
  physical:f(['cantstockfisico','stockfisico','qtyphysinventory','cantidadfisica','qtyphysical','cantfisico']),
  difference:f(['cantidad','quantity','qty','diferencia'])
 };
 if(obj.stock<0)throw Error('Falta la columna obligatoria: Stock calculado');
 if(obj.physical>=0&&obj.physical===obj.stock)throw Error('La columna de stock físico no puede usarse como Stock calculado.');
 if(obj.difference>=0&&obj.difference===obj.stock)throw Error('La columna Cantidad/diferencia no puede usarse como Stock calculado.');
 ['product','location','description','lot','unit','warehouse'].forEach(function(k){
  if(obj[k]<0)throw Error('Falta la columna obligatoria: '+({product:'Nº producto',location:'Cód. ubicación',description:'Descripción',lot:'Nº lote',unit:'Cód. unidad medida',warehouse:'Cód. almacén'}[k]));
 });
 return obj;
}
function findHeaderRow(matrix){
 var limit=Math.min(matrix.length,40);
 for(var i=0;i<limit;i++){
  if(!Array.isArray(matrix[i])||!matrix[i].some(function(v){return !!str(v);}))continue;
  try{columns(matrix[i]);return i;}catch(e){}
 }
 throw Error('No se encontró la fila de cabeceras BC (Stock calculado, Nº producto, Cód. ubicación…).');
}
function parseRows(matrix,fileName){
 if(!Array.isArray(matrix)||!matrix.length)throw Error('El libro no contiene cabecera.');
 var headerAt=findHeaderRow(matrix),indices=columns(matrix[headerAt]);
 var result=[],errors=[],warnings=[],keys=new Set(),products=new Set(),locations=new Set(),warehouses=new Set(),negative=0,zero=0,example=[];
 function error(t){if(errors.length<30)errors.push(t);}
 function warning(t){if(warnings.length<30)warnings.push(t);}
 if(indices.physical>=0)warning('Se detectó «Cant. (stock físico)»: se ignora. Solo se importa Stock calculado.');
 if(indices.difference>=0&&indices.difference!==indices.stock)warning('Se detectó una columna de cantidad/diferencia distinta: se ignora.');
 for(var i=headerAt+1;i<matrix.length;i++){
  var row=matrix[i];if(!Array.isArray(row)||row.every(function(v){return !str(v);}))continue;
  if(result.length>=MAX_ROWS){error('El archivo supera el máximo de '+MAX_ROWS.toLocaleString('es-ES')+' líneas.');break;}
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
 return {fileName:fileName||'inventario.xlsx',headerRow:headerAt+1,rows:result,errors:errors,warnings:warnings,negative:negative,zero:zero,
  products:products.size,locations:locations.size,warehouse:Array.from(warehouses)[0]||'',example:example};
}
function sheetToMatrix(sheet){
 var maxCol=1,matrix=[];
 sheet.eachRow({includeEmpty:true},function(row){
  var n=row.cellCount||0;if(n>maxCol)maxCol=n;
 });
 if(sheet.columnCount&&sheet.columnCount>maxCol)maxCol=sheet.columnCount;
 maxCol=Math.max(maxCol,20);
 sheet.eachRow({includeEmpty:true},function(row){
  var a=[];for(var k=1;k<=maxCol;k++)a.push(row.getCell(k).value);matrix.push(a);
 });
 return matrix;
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
async function withRetry(fn,label){
 var last=null;
 for(var attempt=0;attempt<4;attempt++){
  try{return await fn();}
  catch(e){
   last=e;
   var http=e&&e.status,retryable=!http||http===408||http===429||http>=500;
   if(!retryable||attempt===3)throw e;
   status('Reintentando '+label+' (intento '+(attempt+2)+'/4)…');
   await sleep(400*Math.pow(2,attempt));
  }
 }
 throw last;
}
function status(msg,kind){var el=document.getElementById('bcExcelStatus');if(!el)return;el.innerHTML='<div class="'+(kind==='error'?'alert':'card')+'" role="status" style="margin-top:10px">'+esc(msg)+'</div>';}
function renderPreview(){
 var el=document.getElementById('bcExcelStatus');if(!el)return;
 if(!state){el.innerHTML='';return;}
 var s=state;
 var html='<div class="card" style="margin-top:12px"><h3>Vista previa · '+esc(s.fileName)+'</h3>'
 +'<p><b>'+s.rows.length.toLocaleString('es-ES')+'</b> líneas · <b>'+s.products+'</b> artículos · <b>'+s.locations+'</b> ubicaciones</p>'
 +'<p>Almacén: <b>'+esc(s.warehouse)+'</b> · Stock negativo: <b>'+s.negative+'</b> · Stock cero: '+s.zero+(s.headerRow>1?' · Cabecera en fila '+s.headerRow:'')+'</p>'
 +'<p class="muted">Se leerá exclusivamente <b>Stock calculado</b>. No se importará Cant. (stock físico) ni Cantidad.</p>'
 +'<p class="muted">La publicación es atómica: si se interrumpe la carga, el stock visible no cambia.</p>';
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
 var uploading=data.history.filter(function(h){return h.status==='uploading';});
 html+=(committed.length?committed.map(function(h){return '<div style="border-top:1px solid #e6ebef;padding:10px 0"><b>'+esc(h.file_name)+'</b> '+(current&&current.import_id===h.id?'<b>· ACTUAL</b>':'')+'<div class="muted">'+esc(h.warehouse)+' · '+esc(new Date(h.committed_at).toLocaleString('es-ES'))+' · '+h.stock_rows+' líneas de stock · '+h.product_count+' artículos · '+h.location_count+' ubicaciones · '+h.negative_count+' negativos</div></div>';}).join(''):'<p class="muted">Todavía no hay cargas completadas.</p>');
 if(uploading.length)html+='<div class="alert" style="margin-top:12px"><b>Intentos no publicados:</b> '+uploading.length+' lote(s) quedaron a medias. No afectan al stock visible.</div>';
 html+='</div>';
 return html;
}
async function analyse(){
 if(busy)return;
 var f=document.getElementById('bcExcelFile');f=f&&f.files&&f.files[0];
 if(!f){status('Selecciona primero el archivo Excel.','error');return;}
 if(!/\.xlsx$/i.test(f.name)){status('Selecciona un archivo .xlsx exportado de BC.','error');return;}
 if(f.size>MAX_BYTES){status('El archivo supera el límite de 20 MB.','error');return;}
 busy=true;state=null;status('Leyendo Excel y comprobando líneas…');
 try{
  var ExcelJS=await loadExcelJS(),book=new ExcelJS.Workbook();
  await book.xlsx.load(await f.arrayBuffer());
  var sheet=book.worksheets[0];if(!sheet)throw Error('No hay ninguna hoja en este Excel.');
  state=parseRows(sheetToMatrix(sheet),f.name);renderPreview();
 }catch(e){status('No se pudo analizar: '+e.message,'error');}
 finally{busy=false;}
}
async function commit(){
 if(busy||!state||state.errors.length)return;
 if(!root.INVENTA_MGMT||!root.INVENTA_MGMT.isAdmin()){status('Solo Administración puede publicar existencias.','error');return;}
 var c=document.getElementById('bcExcelConfirm');
 if(!c||!c.checked){status('Marca la confirmación de exportación completa.','error');return;}
 if(!root.confirm('Se reemplazará el stock BC visible en INVENTA por las '+state.rows.length+' líneas del Excel. ¿Confirmar?'))return;
 busy=true;var batchId=null,rows=state.rows,fileName=state.fileName,warehouse=state.warehouse;
 try{
  var api=root.INVENTA_MGMT.realApi;
  status('Preparando importación segura…');
  var created=await withRetry(function(){return api('bc_import_batches','','POST',{created_by:root.INVENTA_MGMT.getUserId(),file_name:fileName.slice(0,240),
   warehouse:warehouse,expected_rows:rows.length});},'apertura del lote');
  if(!Array.isArray(created)||!created[0]||!created[0].id)throw Error('No se pudo abrir el lote de importación.');
  batchId=created[0].id;
  for(var offset=0;offset<rows.length;offset+=CHUNK){
   var chunk=rows.slice(offset,offset+CHUNK).map(function(r){return Object.assign({import_id:batchId},r);});
   await withRetry(function(){return api('bc_import_lines','','POST',chunk);},'envío de líneas');
   status('Subiendo datos: '+Math.min(offset+chunk.length,rows.length).toLocaleString('es-ES')+' / '+rows.length.toLocaleString('es-ES')+' líneas. No cierres INVENTA.');
  }
  status('Verificando y publicando todas las existencias…');
  var result=await withRetry(function(){return api('rpc/bc_commit_import','','POST',{p_import_id:batchId});},'confirmación atómica');
  state=null;status('Importación finalizada: '+result.stock_rows+' líneas de stock, '+result.products+' artículos, '+result.locations+' ubicaciones. '+result.negative+' existencias negativas.');
  await root.INVENTA_MGMT.render();
 }catch(e){status('La importación NO se ha publicado: '+e.message+(batchId?' (identificador de intento: '+batchId+'). El stock visible no ha cambiado.':'') ,'error');}
 finally{busy=false;}
}
var obj={panel:panel,analyse:analyse,commit:commit,parseRows:parseRows,columns:columns,findHeaderRow:findHeaderRow,sheetToMatrix:sheetToMatrix};
root.INVENTA_BC=obj;
if(typeof module!=='undefined'&&module.exports)module.exports=obj;
})(typeof window!=='undefined'?window:globalThis);
