/* INVENTA · Consulta por artículo y por ubicación, incluidas posiciones fijas a cero. */
(function(root){
 'use strict';
 var model=null,mode='location',loadError='',loadId=0,selectedAisle='',selectedLocation='',selectedProduct='',history=[],fixedActionBusy=false;
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
  return (pos.amount===0?'<span class="vis-chip consult-warning-chip">SIN STOCK</span>':'')
   +(pos.amount<0?'<span class="vis-chip consult-warning-chip">STOCK NEGATIVO BC</span>':'');
 }
 function lots(pos){
  return pos.lots.length?'<small>Lotes: '+pos.lots.map(function(l){return esc(l.code)+' ('+number(l.amount)+')'+(l.expiryDate?' · Cad. '+esc(l.expiryDate.split('-').reverse().join('/')):'');}).join(', ')+'</small>':'';
 }
 function articleCard(a){
  return '<div class="vis-card"><h2>'+esc(a.name)+'</h2><p class="vis-help">'+esc(a.id)+'</p>'
   +'<div class="consult-total"><span>Total de existencias</span><strong>'+number(a.total)+' '+esc(a.unit)+'</strong></div>'
   +a.locations.map(function(pos){return '<div class="consult-line'+(pos.fixed?' consult-fixed':'')+'"><div><b>'+esc(pos.locationCode)+'</b>'+lots(pos)+'</div><div><span class="consult-qty">'+number(pos.amount)+' '+esc(a.unit)+'</span><div class="consult-tags">'+tags(pos)+'</div></div></div>';}).join('')
   +'</div>';
 }
 function locationCard(l,byProduct){
  var cards=l.articles.map(function(pos){
   var a=byProduct.get(pos.productCode),name=a?a.name:pos.productCode,unit=a?a.unit:'UD';
   return '<div class="consult-line'+(pos.fixed?' consult-fixed':'')+'"><div><b>'+esc(pos.productCode)+'</b><small>'+esc(name)+'</small>'+lots(pos)+'</div>'
   +'<div><span class="consult-qty">'+number(pos.amount)+' '+esc(unit)+'</span><div class="consult-tags">'+tags(pos)+'</div></div></div>';
  });
  return '<div class="vis-card"><h2><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-map-pin"/></svg> '+esc(l.code)+'</h2><p class="vis-help">'+l.articles.length+' artículos con stock o posición fija</p>'
   +(cards.length?cards.join(''):'<div class="vis-empty">Sin stock ni artículos asignados como fijos.</div>')+'</div>';
 }
 function render(){
  selectedAisle='';selectedLocation='';selectedProduct='';history=[];
  if(!consultUser){go('consult-login');return;}
  if(consultBlocked()){consultUser='';go('consult-login');return;}
  var real=isManager()&&!root.INVENTA_CONSULT_DEMO,token=++loadId;
  model=null;loadError='';
  var subtitle=real?'Existencias importadas de BC · Solo lectura':'Datos ficticios para pruebas';
  place('<section class="consult-view vis-stack"><div class="vis-title"><h1>Artículos y ubicaciones</h1><p>'+esc(consultUser)+' · '+subtitle+'</p></div>'
   +(data.demoInventoryOpen?'<div class="vis-notice">Inventario de prueba en curso. Consulta reservada para supervisión y administración.</div>':'')
   +'<button class="vis-button-primary consult-scan" onclick="openScanner(\'consult\')"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-scan-barcode"/></svg> Escanear para consultar</button>'
   +'<div class="vis-segment"><button id="consultModeArticle" type="button" aria-pressed="false" onclick="INVENTA_CONSULT_UI.setMode(\'article\')"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-search"/></svg> Por artículo</button><button id="consultModeLocation" type="button" aria-pressed="false" onclick="INVENTA_CONSULT_UI.setMode(\'location\')"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-map-pin"/></svg> Por ubicación</button></div>'
   +'<div class="vis-field"><label id="consultSearchLabel" for="consultSearch">Buscar</label><input id="consultSearch" class="vis-control" autocomplete="off" oninput="filterConsult(this.value)"></div>'
   +'<p id="consultSource" class="vis-help" role="status"></p><div id="consultResults" class="vis-stack consult-results" aria-live="polite"></div>'
   +(consultRole()==='admin'&&data.demoInventoryOpen?'<button class="vis-button-secondary" onclick="closeDemoCampaign()">Finalizar campaña de prueba</button>':'')+'</section>',
   '<button class="back" onclick="INVENTA_CONSULT_UI.back()"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-arrow-left"/></svg> Volver</button>');
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
   $('consultResults').innerHTML='<div class="vis-card consult-error">'+esc(e.message)+'</div><button class="vis-button-secondary" onclick="renderConsult()">Reintentar</button>';
  });
 }
 function updateBackButton(){
  // El logotipo vuelve al inicio; el botón superior vuelve solo dentro de Consulta.
  // En la raíz de Consulta no existe una pantalla interior anterior.
  var nav=typeof document==='undefined'?null:document.getElementById('topNavigation');
  if(nav)nav.hidden=history.length===0;
 }
 function currentView(){
  var input=$('consultSearch');
  return {aisle:selectedAisle,location:selectedLocation,product:selectedProduct,term:input?input.value:''};
 }
 function setMode(next){
  if(next!=='article'&&next!=='location')return;
  mode=next;selectedAisle='';selectedLocation='';selectedProduct='';history=[];
  var a=$('consultModeArticle'),l=$('consultModeLocation'),input=$('consultSearch');
  if(!a||!l||!input)return;
  a.classList.toggle('active',mode==='article');l.classList.toggle('active',mode==='location');
  if(a.setAttribute)a.setAttribute('aria-pressed',String(mode==='article'));if(l.setAttribute)l.setAttribute('aria-pressed',String(mode==='location'));
  $('consultSearchLabel').textContent=mode==='article'?'Buscar artículo':'Buscar ubicación';
  input.placeholder=mode==='article'?'Código, descripción o ubicación':'Código de ubicación o artículo';
  input.value='';
  updateBackButton();
  filter('');
 }
 function aisle(code){var c=String(code||'').trim().toUpperCase();return /^[A-T][0-9]{2,}[-_]/.test(c)?c.charAt(0):'OTROS';}
 function navigate(level,value){
  if(!['aisle','location','product'].includes(level))return;
  if(level==='product'&&!selectedLocation)return;
  history.push(currentView());
  if(level==='aisle'){selectedAisle=value;selectedLocation='';selectedProduct='';}
  if(level==='location'){
   selectedLocation=value;
   var letter=aisle(value);
   selectedAisle='ABCDEFGHIJKLMNOPQRST'.includes(letter)?letter:'OTROS';
   selectedProduct='';
  }
  if(level==='product')selectedProduct=value;
  var input=$('consultSearch');if(input)input.value='';
  updateBackButton();
  filter('');
 }
 function back(){
  if(!history.length){updateBackButton();return;}
  var prev=history.pop();
  selectedAisle=prev.aisle;selectedLocation=prev.location;selectedProduct=prev.product;
  var input=$('consultSearch');if(input)input.value=prev.term||'';
  updateBackButton();
  filter(prev.term||'');
 }
 function filter(q){
  var box=$('consultResults');if(!box)return;
  if(!model){box.innerHTML=loadError?'<div class="vis-card consult-error">'+esc(loadError)+'</div><button class="vis-button-secondary" onclick="INVENTA_CONSULT_UI.render()">Reintentar consulta</button>':'<div class="vis-card"><p class="vis-help">Cargando '+(mode==='location'?'ubicaciones':'artículos')+'…</p></div>';return;}
  var term=String(q||'').trim().toLocaleLowerCase('es');
  var byProduct=new Map(model.articles.map(function(a){return [a.id,a];}));
  if(mode==='article'){
   var matches=model.articles.filter(function(a){return [a.id,a.name].concat(a.locations.map(function(p){return p.locationCode;})).some(function(v){return String(v).toLocaleLowerCase('es').includes(term);});});
   box.innerHTML=matches.slice(0,100).map(articleCard).join('')||'<div class="vis-empty">Sin coincidencias.</div>';return;
  }
  var all=model.locations;
  if(selectedProduct){
   var product=byProduct.get(selectedProduct),loc=all.find(function(l){return l.code===selectedLocation;});
   var pos=loc&&loc.articles.find(function(p){return p.productCode===selectedProduct;});
   box.innerHTML='<button class="vis-button-secondary" onclick="INVENTA_CONSULT_UI.back()"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-arrow-left"/></svg> Artículos de '+esc(selectedLocation)+'</button>'
    +'<div class="vis-card'+(pos&&pos.fixed?' consult-fixed':'')+'"><h2>'+esc(product?product.name:selectedProduct)+'</h2><p class="vis-help">'+esc(selectedProduct)+'</p>'
    +'<p class="consult-total">Cantidad total: <b>'+number(pos?pos.amount:0)+' '+esc(product?product.unit:'UD')+'</b> '+(pos?tags(pos):'')+'</p>'
    +'<h3>Cantidades por lote</h3>'
    +(pos&&pos.lots.length?pos.lots.map(function(l){return '<div class="consult-line"><span><b>'+esc(l.code||'SIN LOTE')+'</b>'+(l.expiryDate?'<small>Cad. '+esc(l.expiryDate.split('-').reverse().join('/'))+'</small>':'')+'</span><strong>'+number(l.amount)+' '+esc(product?product.unit:'UD')+'</strong></div>';}).join(''):'<p class="vis-help">Sin lotes con existencias.</p>')
    +(root.INVENTA_MGMT&&root.INVENTA_MGMT.isAdmin()&&!root.INVENTA_CONSULT_DEMO?
      '<button class="vis-button-secondary" onclick="INVENTA_CONSULT_UI.toggleFixed()">'+(pos&&pos.fixed?'Desmarcar posición fija':'Marcar posición fija en esta ubicación')+'</button>':'')
    +'</div>';return;
  }
  if(selectedLocation){
   var loc=all.find(function(l){return l.code===selectedLocation;});
   box.innerHTML='<button class="vis-button-secondary" onclick="INVENTA_CONSULT_UI.back()"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-arrow-left"/></svg> Volver a las ubicaciones</button>'
    +'<div class="vis-card"><h2><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-map-pin"/></svg> '+esc(selectedLocation)+'</h2><p class="vis-help">Artículos con stock o posición fija asignada</p></div>'
    +(loc&&loc.articles.length?loc.articles.filter(function(p){var a=byProduct.get(p.productCode);return !term||[p.productCode,a&&a.name].some(function(v){return String(v||'').toLocaleLowerCase('es').includes(term);});}).map(function(p){var a=byProduct.get(p.productCode);return '<button class="vis-list-item'+(p.fixed?' consult-fixed':'')+'" onclick="INVENTA_CONSULT_UI.navigate(\'product\',\''+esc(p.productCode)+'\')"><span class="vis-list-icon"><svg class="vis-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-package"/></svg></span><span class="vis-list-copy"><strong>'+esc(a?a.name:p.productCode)+'</strong><small>'+esc(p.productCode)+' · '+number(p.amount)+' '+esc(a?a.unit:'UD')+'</small>'+tags(p)+'</span><span class="vis-list-chevron"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-chevron-right"/></svg></span></button>';}).join(''):'<div class="vis-empty">Ubicación vacía.</div>');return;
  }
  if(selectedAisle){
   var locs=all.filter(function(l){return (selectedAisle==='OTROS'?!'ABCDEFGHIJKLMNOPQRST'.includes(aisle(l.code)):aisle(l.code)===selectedAisle)&&(!term||l.code.toLocaleLowerCase('es').includes(term));});
   box.innerHTML='<button class="vis-button-secondary" onclick="INVENTA_CONSULT_UI.back()"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-arrow-left"/></svg> Todos los pasillos</button><h2>Pasillo '+esc(selectedAisle)+'</h2>'
    +(locs.map(function(l){return '<button class="vis-list-item" onclick="INVENTA_CONSULT_UI.navigate(\'location\',\''+esc(l.code)+'\')"><span class="vis-list-icon"><svg class="vis-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-map-pin"/></svg></span><span class="vis-list-copy"><strong>'+esc(l.code)+'</strong><small>'+l.articles.length+' artículos con stock o fija · '+(l.articles.some(function(p){return p.amount>0;})?'Con existencias':'Sin existencias')+'</small></span><span class="vis-list-chevron"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-chevron-right"/></svg></span></button>';}).join('')||'<div class="vis-empty">No hay ubicaciones registradas en este pasillo.</div>');return;
  }
  if(term){
   var matches=all.filter(function(l){return l.code.toLocaleLowerCase('es').includes(term)||l.articles.some(function(p){var a=byProduct.get(p.productCode);return [p.productCode,a&&a.name].some(function(v){return String(v||'').toLocaleLowerCase('es').includes(term);});});});
   box.innerHTML=matches.length?matches.map(function(l){return '<button class="vis-list-item" onclick="INVENTA_CONSULT_UI.navigate(\'location\','+esc(JSON.stringify(l.code))+')"><span class="vis-list-icon"><svg class="vis-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-map-pin"/></svg></span><span class="vis-list-copy"><strong>'+esc(l.code)+'</strong><small>'+l.articles.length+' artículos con stock o fija</small></span><span class="vis-list-chevron"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-chevron-right"/></svg></span></button>';}).join(''):'<div class="vis-empty">No se han encontrado ubicaciones para esta búsqueda.</div>';
   return;
  }
  var letters='ABCDEFGHIJKLMNOPQRST'.split('');
  var present=[...new Set(all.map(function(l){return aisle(l.code);}))]
   .filter(function(a){return letters.includes(a);}).sort();
  var other=all.filter(function(l){return !letters.includes(aisle(l.code));});
  box.innerHTML='<p class="vis-help">Selecciona el pasillo que quieres consultar.</p>'
   +(present.length?present.map(function(a){
    var locs=all.filter(function(l){return aisle(l.code)===a;});
    return '<button class="vis-list-item" onclick="INVENTA_CONSULT_UI.navigate(\'aisle\',\''+a+'\')">'
     +'<span class="vis-list-icon">'+a+'</span><span class="vis-list-copy"><strong>Pasillo '+a+'</strong>'
     +'<small>'+locs.length+' ubicaciones registradas</small></span><span class="vis-list-chevron"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-chevron-right"/></svg></span></button>';
   }).join(''):'<div class="vis-empty">No hay pasillos registrados todavía.</div>')
   +(other.length?'<button class="vis-list-item" onclick="INVENTA_CONSULT_UI.navigate(\'aisle\',\'OTROS\')"><span class="vis-list-icon"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-plus"/></svg></span><span class="vis-list-copy"><strong>Otras ubicaciones</strong><small>'+other.length+' ubicaciones registradas</small></span><span class="vis-list-chevron"><svg class="vis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#vis-icon-chevron-right"/></svg></span></button>':'');
 }
 function toggleFixed(){
  if(fixedActionBusy||!model||!selectedLocation||!selectedProduct)return;
  var mgr=root.INVENTA_MGMT;
  if(!mgr||!mgr.isAdmin()||root.INVENTA_CONSULT_DEMO)return;
  var location=selectedLocation,product=selectedProduct;
  var loc=model.locations.find(function(l){return l.code===location;});
  var pos=loc&&loc.articles.find(function(p){return p.productCode===product;});
  var alreadyFixed=!!(pos&&pos.fixed);
  fixedActionBusy=true;
  mgr.changeFixedPosition(product,location,alreadyFixed).then(function(changed){
   if(!changed)return;
   return mgr.readConsultData().then(function(payload){
    if(screen!=='consult'||selectedLocation!==location||selectedProduct!==product)return;
    model=root.INVENTA_CONSULT.aggregate(payload);
    filter($('consultSearch')?$('consultSearch').value:'');
    var status=$('consultSource');
    if(status)status.textContent='Posición '+(alreadyFixed?'desmarcada':'marcada')+' y guardada en Supabase.';
   });
  }).catch(function(e){
   var status=$('consultSource');if(status)status.textContent='No se pudo guardar la posición fija: '+e.message;
  }).finally(function(){fixedActionBusy=false;});
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
 root.INVENTA_CONSULT_UI={render:render,filter:filter,setMode:setMode,navigate:navigate,back:back,toggleFixed:toggleFixed,lookup:lookup,applyScan:applyScan};
})(window);
