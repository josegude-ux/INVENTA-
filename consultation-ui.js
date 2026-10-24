/* INVENTA · Consulta por artículo y por ubicación, incluidas posiciones fijas a cero. */
(function(root){
 'use strict';
 var model=null,mode='location',loadError='',loadId=0,selectedAisle='',selectedLocation='',selectedProduct='';
 function demoData(){
  var products=new Map(),stock=[];
  for(var pair of Object.entries(TEST)){
   var loc=pair[0],items=pair[1];
   items.forEach(function(p){
    if(!products.has(p.id))products.set(p.id,{code:p.id,description:p.name,unit:'UD'});
    stock.push({location_code:loc,product_code:p.id,lot:'',quantity:p.theoretical});
   });
  }
  // Ejemplos exclusivos de Consulta; NO afectan a los recuentos DEMO.
  stock.push({location_code:'K00-P02',product_code:'PRD0003563',lot:'',quantity:18});
  products.set('PRD0099000',{code:'PRD0099000',description:'ARTÍCULO DE PRUEBA SIN EXISTENCIAS',unit:'UD'});
  return {products:[...products.values()],locations:Object.keys(TEST).map(function(code){return {code:code};}),stock:stock,
   fixed:[
    {product_code:'PRD0003563',location_code:'K00-P01',priority:1},
    {product_code:'PRD0001287',location_code:'K00-P03',priority:1},
    {product_code:'PRD0099000',location_code:'K00-P03',priority:1}
   ]};
 }
 function number(n){return Number(n).toLocaleString('es-ES',{maximumFractionDigits:3});}
 function tags(pos){
  return (pos.fixed?'<span class="tag ok">FIJA'+(pos.priority>1?' · prioridad '+pos.priority:'')+'</span>':'')
   +(pos.amount===0?'<span class="tag warn">SIN STOCK</span>':'')
   +(pos.amount<0?'<span class="tag warn">STOCK NEGATIVO BC</span>':'');
 }
 function lots(pos){
  return pos.lots.length?'<small>Lotes: '+pos.lots.map(function(l){return esc(l.code)+' ('+number(l.amount)+')';}).join(', ')+'</small>':'';
 }
 function articleCard(a){
  return '<div class="card"><h2>'+esc(a.name)+'</h2><p class="muted">'+esc(a.id)+'</p>'
   +'<div class="between" style="margin:12px 0"><span>Total de existencias</span><strong>'+number(a.total)+' '+esc(a.unit)+'</strong></div>'
   +a.locations.map(function(pos){return '<div class="consult-line"><div><b>'+esc(pos.locationCode)+'</b>'+lots(pos)+'</div><div><span class="consult-qty">'+number(pos.amount)+' '+esc(a.unit)+'</span><div class="consult-tags">'+tags(pos)+'</div></div></div>';}).join('')
   +'</div>';
 }
 function locationCard(l,byProduct){
  var cards=l.articles.map(function(pos){
   var a=byProduct.get(pos.productCode),name=a?a.name:pos.productCode,unit=a?a.unit:'UD';
   return '<div class="consult-line"><div><b>'+esc(pos.productCode)+'</b><small>'+esc(name)+'</small>'+lots(pos)+'</div>'
   +'<div><span class="consult-qty">'+number(pos.amount)+' '+esc(unit)+'</span><div class="consult-tags">'+tags(pos)+'</div></div></div>';
  });
  return '<div class="card"><h2>📍 '+esc(l.code)+'</h2><p class="muted">'+l.articles.length+' artículos con stock o posición fija</p>'
   +(cards.length?cards.join(''):'<div class="consult-empty">Sin stock ni artículos asignados como fijos.</div>')+'</div>';
 }
 function render(){
  selectedAisle='';selectedLocation='';selectedProduct='';
  if(!consultUser){go('consult-login');return;}
  if(consultBlocked()){consultUser='';go('consult-login');return;}
  var real=isManager()&&!root.INVENTA_CONSULT_DEMO,token=++loadId;
  model=null;loadError='';
  var subtitle=real?'Existencias importadas de BC · Solo lectura':'Datos ficticios para pruebas';
  place('<div class="title"><div class="overline">CONSULTA DE ALMACÉN</div><h1>Artículos y ubicaciones</h1><p class="muted">'+esc(consultUser)+' · '+subtitle+'</p></div>'
   +(data.demoInventoryOpen?'<div class="alert">Inventario de prueba en curso. Consulta reservada para supervisión y administración.</div>':'')
   +'<button class="scan-open" onclick="openScanner(\'consult\')">▣ Escanear para consultar</button>'
   +'<div class="consult-tabs"><button id="consultModeArticle" type="button" aria-pressed="false" onclick="INVENTA_CONSULT_UI.setMode(\'article\')">🔎 Por artículo</button><button id="consultModeLocation" type="button" aria-pressed="false" onclick="INVENTA_CONSULT_UI.setMode(\'location\')">📍 Por ubicación</button></div>'
   +'<div class="field"><label id="consultSearchLabel" for="consultSearch">Buscar</label><input id="consultSearch" class="input" autocomplete="off" oninput="filterConsult(this.value)"></div>'
   +'<p id="consultSource" class="muted" style="margin-bottom:10px" role="status"></p><div id="consultResults" aria-live="polite"></div>'
   +(consultRole()==='admin'&&data.demoInventoryOpen?'<button class="btn-outline" style="width:100%;margin-top:12px" onclick="closeDemoCampaign()">Finalizar campaña de prueba</button>':''),
   '<button class="back" onclick="consultUser=\'\';go(\'home\')">← Menú principal</button>');
  setMode(mode);
  if(!real){
   model=root.INVENTA_CONSULT.aggregate(demoData());
   $('consultSource').textContent='Ejemplos con varias ubicaciones y posiciones fijas sin stock.';
   filter('');
   return;
  }
  $('consultSource').textContent='Cargando última importación BC y ubicaciones fijas…';
  root.INVENTA_MGMT.readConsultData().then(function(payload){
   if(token!==loadId||screen!=='consult'||!isManager())return;
   model=root.INVENTA_CONSULT.aggregate(payload);
   $('consultSource').textContent=payload.stock.length
    ?'Fuente: '+payload.source+' · Importada '+new Date(payload.importedAt).toLocaleString('es-ES')
    :'No hay existencias BC importadas; se muestran las posiciones fijas, incluso a cero.';
   filter($('consultSearch').value);
  }).catch(function(e){
   if(token!==loadId||screen!=='consult')return;
   loadError=e.message;
   $('consultSource').textContent='No se han podido obtener las existencias BC.';
   $('consultResults').innerHTML='<div class="alert red">'+esc(e.message)+'</div><button class="btn-outline" onclick="renderConsult()">Reintentar</button>';
  });
 }
 function setMode(next){
  if(next!=='article'&&next!=='location')return;
  mode=next;selectedAisle='';selectedLocation='';selectedProduct='';
  var a=$('consultModeArticle'),l=$('consultModeLocation'),input=$('consultSearch');
  if(!a||!l||!input)return;
  a.classList.toggle('active',mode==='article');l.classList.toggle('active',mode==='location');
  if(a.setAttribute)a.setAttribute('aria-pressed',String(mode==='article'));if(l.setAttribute)l.setAttribute('aria-pressed',String(mode==='location'));
  $('consultSearchLabel').textContent=mode==='article'?'Buscar artículo':'Buscar ubicación';
  input.placeholder=mode==='article'?'Código, descripción o ubicación':'Código de ubicación o artículo';
  input.value='';
  filter('');
 }
 function aisle(code){return String(code||'').trim().toUpperCase().charAt(0);}
 function navigate(level,value){
  if(level==='aisle'){selectedAisle=value;selectedLocation='';selectedProduct='';}
  if(level==='location'){selectedLocation=value;selectedAisle=aisle(value);selectedProduct='';}
  if(level==='product')selectedProduct=value;
  filter('');
 }
 function filter(q){
  var box=$('consultResults');if(!box)return;
  if(!model){box.innerHTML=loadError?'<div class="alert red">'+esc(loadError)+'</div><button class="btn-outline" onclick="INVENTA_CONSULT_UI.render()">Reintentar consulta</button>':'<div class="card"><p class="muted">Cargando '+(mode==='location'?'ubicaciones':'artículos')+'…</p></div>';return;}
  var term=String(q||'').trim().toLocaleLowerCase('es');
  var byProduct=new Map(model.articles.map(function(a){return [a.id,a];}));
  if(mode==='article'){
   var matches=model.articles.filter(function(a){return [a.id,a.name].concat(a.locations.map(function(p){return p.locationCode;})).some(function(v){return String(v).toLocaleLowerCase('es').includes(term);});});
   box.innerHTML=matches.slice(0,100).map(articleCard).join('')||'<div class="alert">Sin coincidencias.</div>';return;
  }
  var all=model.locations;
  if(selectedProduct){
   var product=byProduct.get(selectedProduct),loc=all.find(function(l){return l.code===selectedLocation;});
   var pos=loc&&loc.articles.find(function(p){return p.productCode===selectedProduct;});
   box.innerHTML='<button class="back" onclick="INVENTA_CONSULT_UI.navigate(\'location\',\''+esc(selectedLocation)+'\')">← Artículos de '+esc(selectedLocation)+'</button>'
    +'<div class="card"><h2>'+esc(product?product.name:selectedProduct)+'</h2><p class="muted">'+esc(selectedProduct)+'</p>'
    +'<p style="margin:12px 0">Cantidad total: <b>'+number(pos?pos.amount:0)+' '+esc(product?product.unit:'UD')+'</b> '+(pos?tags(pos):'')+'</p>'
    +'<h3>Cantidades por lote</h3>'
    +(pos&&pos.lots.length?pos.lots.map(function(l){return '<div class="consult-line"><b>'+esc(l.code||'SIN LOTE')+'</b><strong>'+number(l.amount)+' '+esc(product?product.unit:'UD')+'</strong></div>';}).join(''):'<p class="muted">Sin lotes con existencias.</p>')+'</div>';return;
  }
  if(selectedLocation){
   var loc=all.find(function(l){return l.code===selectedLocation;});
   box.innerHTML='<button class="back" onclick="INVENTA_CONSULT_UI.navigate(\'aisle\',\''+esc(selectedAisle)+'\')">← Ubicaciones del pasillo '+esc(selectedAisle)+'</button>'
    +'<div class="card"><h2>📍 '+esc(selectedLocation)+'</h2><p class="muted">Artículos con stock o posición fija asignada</p></div>'
    +(loc&&loc.articles.length?loc.articles.filter(function(p){var a=byProduct.get(p.productCode);return !term||[p.productCode,a&&a.name].some(function(v){return String(v||'').toLocaleLowerCase('es').includes(term);});}).map(function(p){var a=byProduct.get(p.productCode);return '<button class="item" style="width:100%;text-align:left" onclick="INVENTA_CONSULT_UI.navigate(\'product\',\''+esc(p.productCode)+'\')"><span><strong>'+esc(a?a.name:p.productCode)+'</strong><small>'+esc(p.productCode)+' · '+number(p.amount)+' '+esc(a?a.unit:'UD')+'</small>'+tags(p)+'</span><span class="chev">›</span></button>';}).join(''):'<div class="alert">Ubicación vacía.</div>');return;
  }
  if(selectedAisle){
   var locs=all.filter(function(l){return (selectedAisle==='OTROS'?!'ABCDEFGHIJKLMNOPQRST'.includes(aisle(l.code)):aisle(l.code)===selectedAisle)&&(!term||l.code.toLocaleLowerCase('es').includes(term));});
   box.innerHTML='<button class="back" onclick="INVENTA_CONSULT_UI.navigate(\'aisle\',\'\')">← Todos los pasillos</button><h2 style="margin:12px 0">Pasillo '+esc(selectedAisle)+'</h2>'
    +(locs.map(function(l){return '<button class="item" style="width:100%;text-align:left" onclick="INVENTA_CONSULT_UI.navigate(\'location\',\''+esc(l.code)+'\')"><span><strong>'+esc(l.code)+'</strong><small>'+l.articles.length+' artículos con stock o fija · '+(l.articles.some(function(p){return p.amount>0;})?'Con existencias':'Sin existencias')+'</small></span><span class="chev">›</span></button>';}).join('')||'<div class="alert">No hay ubicaciones registradas en este pasillo.</div>');return;
  }
  if(term){
   var matches=all.filter(function(l){return l.code.toLocaleLowerCase('es').includes(term)||l.articles.some(function(p){var a=byProduct.get(p.productCode);return [p.productCode,a&&a.name].some(function(v){return String(v||'').toLocaleLowerCase('es').includes(term);});});});
   box.innerHTML=matches.length?matches.map(function(l){return '<button class="item" onclick="INVENTA_CONSULT_UI.navigate(\'location\','+esc(JSON.stringify(l.code))+')"><span><strong>'+esc(l.code)+'</strong><small>'+l.articles.length+' artículos con stock o fija</small></span><span class="chev">›</span></button>';}).join(''):'<div class="alert">No se han encontrado ubicaciones para esta búsqueda.</div>';
   return;
  }
  var letters='ABCDEFGHIJKLMNOPQRST'.split('');
  var present=letters;
  var other=all.filter(function(l){return !letters.includes(aisle(l.code));});
  box.innerHTML='<p class="muted" style="margin-bottom:12px">Selecciona el pasillo que quieres consultar.</p>'
   +(present.length?present.map(function(a){
    var locs=all.filter(function(l){return aisle(l.code)===a;});
    return '<button class="item aisle-item" onclick="INVENTA_CONSULT_UI.navigate(\'aisle\',\''+a+'\')">'
     +'<span class="aisle-letter">'+a+'</span><span class="aisle-details"><strong>Pasillo '+a+'</strong>'
     +'<small>'+locs.length+' ubicaciones registradas</small></span><span class="chev">›</span></button>';
   }).join(''):'<div class="alert">No hay pasillos registrados todavía.</div>')
   +(other.length?'<button class="item aisle-item" onclick="INVENTA_CONSULT_UI.navigate(\'aisle\',\'OTROS\')"><span class="aisle-letter">+</span><span class="aisle-details"><strong>Otras ubicaciones</strong><small>'+other.length+' ubicaciones registradas</small></span><span class="chev">›</span></button>':'');
 }
 function lookup(code){
  if(!model)return null;
  var normalized=normCode(code),barcode=barcodeKey(code);
  var article=model.articles.find(function(p){return normCode(p.id)===normalized||(p.barcode&&barcodeKey(p.barcode)===barcode);});
  if(article)return {value:article.id,mode:'article'};
  var location=model.locations.find(function(l){return normCode(l.code)===normalized;});
  if(location)return {value:location.code,mode:'location'};
  return null;
 }
 function applyScan(match){if(match&&['article','location'].includes(match.mode))mode=match.mode;}
 root.INVENTA_CONSULT_UI={render:render,filter:filter,setMode:setMode,navigate:navigate,lookup:lookup,applyScan:applyScan};
})(window);
