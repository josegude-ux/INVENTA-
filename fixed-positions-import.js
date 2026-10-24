/* INVENTA · Importar posiciones fijas desde "Base unificada ubicaciones almacén" de BC.
   El Excel se analiza localmente; solo filas Fijo=1 pasan a Supabase por RPC de Administración. */
(function(root){
'use strict';
var selected=null,busy=false,excelPromise=null,lastResult='';
function raw(v){if(v&&typeof v==='object'){if(v instanceof Date)return v;if('result' in v)return v.result;if('text' in v)return v.text;if(Array.isArray(v.richText))return v.richText.map(function(t){return t.text||'';}).join('');}return v;}
function str(v){v=raw(v);return v===null||v===undefined?'':String(v).trim();}
function norm(v){return str(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function esc(v){return str(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function columns(row){
 var names=row.map(norm),find=function(variants){return names.findIndex(function(v){return variants.indexOf(v)!==-1;});};
 var col={
  warehouse:find(['filtroalmacen','codalmacen','almacen','warehousecode']),
  zone:find(['filtrozona','codzona','zona','zonecode']),
  product:find(['nproducto','noproducto','codigoproducto','productcode','itemno']),
  location:find(['codubicacion','ubicacion','locationcode','bincode']),
  description:find(['descripcion','description','itemdescription']),
  fixed:find(['fijo','fixed','fixedlocation','posicionfija']),
  unit:find(['codunidadmedida','unidadmedida','unitofmeasurecode','unit'])
 };
 var labels={warehouse:'Filtro almacén',product:'Nº producto',location:'Cód. ubicación',description:'Descripción',fixed:'Fijo',unit:'Cód. unidad medida'};
 Object.keys(labels).forEach(function(k){if(col[k]<0)throw Error('Falta la columna '+labels[k]);});
 return col;
}
function parseRows(matrix,fileName){
 if(!Array.isArray(matrix)||!matrix.length)throw Error('Excel vacío.');
 var headerAt=-1,col=null;
 for(var i=0;i<Math.min(matrix.length,45);i++){
  if(!Array.isArray(matrix[i]))continue;
  try{col=columns(matrix[i]);headerAt=i;break;}catch(e){}
 }
 if(headerAt<0)throw Error('No se encontraron las columnas BC: Filtro almacén, Nº producto, Cód. ubicación, Descripción, Fijo y unidad.');
 var rows=[],errors=[],warnings=[],seen=new Map(),warehouses=new Set(),sourceRows=0,fixedRows=0,duplicates=0;
 var prods=new Set(),locs=new Set(),zones=new Set();
 function err(msg){if(errors.length<35)errors.push(msg);}
 function warn(msg){if(warnings.length<15)warnings.push(msg);}
 for(var n=headerAt+1;n<matrix.length;n++){
  var r=matrix[n];if(!Array.isArray(r)||r.every(function(v){return !str(v);}))continue;
  sourceRows++;
  if(sourceRows>20000){err('El archivo supera 20.000 líneas.');break;}
  var warehouse=str(r[col.warehouse]).toUpperCase(),flag=norm(r[col.fixed]);
  if(warehouse)warehouses.add(warehouse);
  if(flag===''||flag==='0'||flag==='false'||flag==='no')continue;
  if(!['1','true','si'].includes(flag)){err('Fila '+(n+1)+': indicador Fijo no reconocido ('+str(r[col.fixed])+').');continue;}
  fixedRows++;
  var code=str(r[col.product]).toUpperCase(),location=str(r[col.location]).toUpperCase();
  var desc=str(r[col.description]),unit=str(r[col.unit]),zone=col.zone<0?'':str(r[col.zone]);
  if(!warehouse||!code||!location||!desc||!unit){err('Fila '+(n+1)+': faltan almacén, artículo, ubicación, descripción o unidad.');continue;}
  if(code.length>120||location.length>120||desc.length>500||unit.length>50||zone.length>100){
   err('Fila '+(n+1)+': un campo supera el tamaño permitido.');continue;
  }
  var item={product_code:code,location_code:location,description:desc,unit:unit,zone:zone};
  var key=JSON.stringify([code,location]);
  if(seen.has(key)){
   duplicates++;
   var prev=seen.get(key);
   if(prev.unit!==unit||prev.description!==desc)warn('Fila '+(n+1)+': '+code+' en '+location+' repetido con datos distintos; se guardará una sola posición.');
  }else seen.set(key,item);
  rows.push(item);prods.add(code);locs.add(location);if(zone)zones.add(zone);
 }
 if(!sourceRows)err('No hay líneas de datos.');
 if(!fixedRows)err('No hay ninguna línea con Fijo = 1.');
 if(fixedRows!==rows.length)err('Algunas posiciones fijas no tienen datos válidos.');
 if(warehouses.size!==1)err('El archivo debe contener un único almacén. Detectados: '+Array.from(warehouses).join(', '));
 if(duplicates)warn(duplicates+' registros duplicados de artículo + ubicación; se consolidarán.');
 return {items:rows,fileName:fileName||'posiciones-fijas.xlsx',sourceRows:sourceRows,fixedRows:fixedRows,
  uniquePositions:seen.size,duplicates:duplicates,products:prods.size,locations:locs.size,zones:zones.size,
  warehouse:Array.from(warehouses)[0]||'',errors:errors,warnings:warnings,
  sample:Array.from(seen.values()).slice(0,7)};
}
function loadExcel(){
 if(root.ExcelJS)return Promise.resolve(root.ExcelJS);
 if(excelPromise)return excelPromise;
 excelPromise=new Promise(function(resolve,reject){
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  s.crossOrigin='anonymous';
  s.onload=function(){root.ExcelJS?resolve(root.ExcelJS):reject(Error('No se pudo inicializar el lector Excel.'));};
  s.onerror=function(){reject(Error('No se pudo descargar el lector Excel. Comprueba la conexión.'));};
  document.head.appendChild(s);
 }).catch(function(e){excelPromise=null;throw e;});
 return excelPromise;
}
function status(message,err){
 var el=document.getElementById('fixedExcelStatus');
 if(el)el.innerHTML='<div class="'+(err?'alert red':'alert')+'" role="status" style="margin-top:10px">'+esc(message)+'</div>';
}
function preview(){
 if(!selected)return '';
 var x=selected;
 var html='<div class="card" style="margin-top:12px"><h3>Vista previa · '+esc(x.fileName)+'</h3>'
  +'<p><b>'+x.sourceRows+'</b> líneas analizadas · <b>'+x.fixedRows+'</b> con Fijo = 1 · <b>'+x.uniquePositions+'</b> posiciones únicas.</p>'
  +'<p>'+x.products+' artículos · '+x.locations+' ubicaciones · '+x.zones+' zonas · Almacén <b>'+esc(x.warehouse)+'</b>.</p>'
  +'<p class="muted">Los artículos y ubicaciones que falten se añadirán como datos maestros. <b>Las existencias calculadas y los recuentos no cambiarán.</b></p>';
 if(x.errors.length)html+='<div class="alert red"><b>Errores: no se puede importar</b><ul>'+x.errors.map(function(v){return '<li>'+esc(v)+'</li>';}).join('')+'</ul></div>';
 if(x.warnings.length)html+='<div class="alert"><b>Advertencias</b><ul>'+x.warnings.map(function(v){return '<li>'+esc(v)+'</li>';}).join('')+'</ul></div>';
 html+='<div style="overflow-x:auto"><table style="width:100%;font-size:12px;text-align:left"><thead><tr><th>Artículo</th><th>Ubicación</th><th>Descripción</th></tr></thead><tbody>'
  +x.sample.map(function(v){return '<tr><td>'+esc(v.product_code)+'</td><td>'+esc(v.location_code)+'</td><td>'+esc(v.description)+'</td></tr>';}).join('')
  +'</tbody></table></div>';
 if(!x.errors.length){
  html+='<label style="display:flex;gap:9px;align-items:start;margin:15px 0"><input id="fixedImportConfirm" type="checkbox" style="width:22px;height:22px;flex:none">'
   +'<span>Confirmo que he revisado las posiciones Fijo = 1 y que quiero importarlas en INVENTA.</span></label>';
  html+='<label style="display:flex;gap:9px;align-items:start;margin:15px 0"><input id="fixedImportReplace" type="checkbox" style="width:22px;height:22px;flex:none">'
   +'<span><b>Solo si es una exportación completa:</b> eliminar asignaciones BC anteriores que ya no aparezcan. Las marcadas manualmente se conservarán.</span></label>';
  html+='<button class="btn" style="width:100%" onclick="INVENTA_FIXED_IMPORT.commit()">Importar posiciones fijas en Supabase</button>';
 }
 return html+'</div>';
}
function panel(imports){
 imports=Array.isArray(imports)?imports:[];
 var html='<div class="card"><h2>Importar posiciones fijas desde Excel BC</h2>'
 +'<p class="muted">Archivo recomendado: <b>Base unificada ubicaciones almacén.xlsx</b>. Solo se importan las filas con <b>Fijo = 1</b>. No se usa Cantidad (base) como stock.</p>'
 +'<input id="fixedExcelFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="input" style="margin:10px 0;font-size:14px">'
 +'<button class="btn-outline" style="width:100%" onclick="INVENTA_FIXED_IMPORT.analyse()">Analizar Excel y previsualizar</button>'
 +'<div id="fixedExcelStatus" aria-live="polite">'+(lastResult?'<div class="alert">'+esc(lastResult)+'</div>':'')+'</div>'
 +'<div id="fixedExcelPreview">'+preview()+'</div></div>';
 html+='<div class="card"><h2>Historial de importación de posiciones fijas</h2>';
 html+=imports.length?imports.map(function(v){
  return '<div style="border-top:1px solid #e5eaf0;padding:10px 0">'
    +'<b>'+esc(v.file_name)+'</b><div class="muted">'
    +esc(new Date(v.imported_at).toLocaleString('es-ES'))+' · '+v.unique_positions+' posiciones · '
    +'+'+v.new_products+' artículos · +'+v.new_locations+' ubicaciones'
    +(v.removed_fixed?' · -'+v.removed_fixed+' posiciones BC anteriores':'')+'</div></div>';
 }).join(''):'<p class="muted">Todavía no hay importaciones de posiciones fijas.</p>';
 return html+'</div>';
}
async function analyse(){
 if(busy)return;
 var input=document.getElementById('fixedExcelFile'),file=input&&input.files&&input.files[0];
 if(!file){status('Selecciona primero el Excel de ubicaciones. ',true);return;}
 if(!/\.xlsx$/i.test(file.name)){status('Se necesita un Excel .xlsx de Business Central.',true);return;}
 if(file.size>20*1024*1024){status('El archivo supera 20 MB.',true);return;}
 busy=true;selected=null;
 try{
  status('Leyendo el archivo y comprobando Fijo = 1…');
  var Excel=await loadExcel(),workbook=new Excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  var sheet=workbook.worksheets[0];if(!sheet)throw Error('Excel sin hojas.');
  var matrix=[],width=Math.min(sheet.columnCount||28,85);
  sheet.eachRow({includeEmpty:true},function(row){
   var cols=[];for(var i=1;i<=width;i++)cols.push(row.getCell(i).value);
   matrix.push(cols);
  });
  selected=parseRows(matrix,file.name);
  document.getElementById('fixedExcelPreview').innerHTML=preview();
  status(selected.errors.length?'Hay errores que impiden esta importación.':'Archivo analizado; revisa la vista previa antes de publicar.',!!selected.errors.length);
 }catch(e){status('No se pudo leer el Excel: '+e.message,true);}
 finally{busy=false;}
}
async function commit(){
 if(busy||!selected||selected.errors.length)return;
 var manager=root.INVENTA_MGMT;
 if(!manager||!manager.isAdmin()){status('Solo Administración puede importar posiciones fijas.',true);return;}
 var tick=document.getElementById('fixedImportConfirm');
 if(!tick||!tick.checked){status('Marca la casilla de confirmación antes de publicar.',true);return;}
 var full=document.getElementById('fixedImportReplace'),replace=!!(full&&full.checked);
 var message='¿Importar '+selected.uniquePositions+' posiciones fijas de '+selected.warehouse+'?'
  +(replace?' Has indicado que es un fichero COMPLETO: se eliminarán las asignaciones BC anteriores que no estén en él.':' Las posiciones existentes que no figuren en el fichero se conservarán.');
 if(!root.confirm(message))return;
 busy=true;
 try{
  status('Importando y comprobando posiciones fijas en Supabase… No cierres la aplicación.');
  var output=await manager.realApi('rpc/admin_import_fixed_positions','','POST',{
   p_warehouse:selected.warehouse,p_filename:selected.fileName.slice(0,240),
   p_items:selected.items,p_source_rows:selected.sourceRows,p_replace:replace
  });
  if(!output||!Number.isFinite(Number(output.unique_positions)))throw Error('La base de datos no ha confirmado la importación.');
  lastResult='Importación completada: '+output.unique_positions+' posiciones únicas, '+output.new_products
   +' artículos nuevos, '+output.new_locations+' ubicaciones nuevas, '+output.new_fixed+' posiciones incorporadas'
   +(output.removed_fixed?', '+output.removed_fixed+' antiguas eliminadas':'')+'.';
  selected=null;
  manager.open('fixed');
 }catch(e){status('NO se publicó la importación: '+e.message,true);}
 finally{busy=false;}
}
root.INVENTA_FIXED_IMPORT={parseRows:parseRows,columns:columns,panel:panel,analyse:analyse,commit:commit};
if(typeof module!=='undefined'&&module.exports)module.exports=root.INVENTA_FIXED_IMPORT;
})(typeof window!=='undefined'?window:globalThis);
