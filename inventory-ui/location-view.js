/* VISURA INVENTA 07 — location display adapter (isolated, no network or persistence).
 * This module deliberately enumerates safe physical fields; it must never expose
 * theoretical Business Central data to operators. It grants NO permissions. */
(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VISURA_INVENTA07_LOCATION=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function required(v,label){
  if(typeof v!=='string'||!v.trim())throw Error(label+' obligatorio.');
  return v.trim();
 }
 function countQuantity(item,confirmed){
  var value=item.quantity;
  if(value===null||value===undefined||String(value).trim()===''){
   if(confirmed)throw Error('Un recuento confirmado necesita cantidad física.');
   return null;
  }
  var q=String(value).trim().replace(',','.');
  if(!/^[0-9]+(?:\.[0-9]{1,3})?$/.test(q))
   throw Error('Cantidad física inválida.');
  if(Number(q)===0 && item.explicitZero!==true)
   throw Error('Cero sin confirmación explícita.');
  if(Number(q)>0 && item.explicitZero===true)
   throw Error('Cero explícito contradice cantidad física.');
  return q;
 }
 function buildLocationView(input){
  if(!input||!Array.isArray(input.references)||!Array.isArray(input.provisionals))
   throw Error('Listas físicas de ubicación inválidas.');
  var locationCode=required(input.locationCode,'Ubicación');
  var status=input.locationStatus||'not_started';
  if(!['not_started','in_progress','finished'].includes(status))
   throw Error('Estado de ubicación desconocido.');
  var seen=new Set();
  var seenProvisionals=new Set();
  var rows=[];
  input.references.forEach(function(x){
   if(!x || typeof x!=='object')throw Error('Referencia física inválida.');
   var product=required(x.productCode,'Referencia');
   var lot=typeof x.lot==='string'?x.lot:'';
   var key=JSON.stringify([product,lot]);
   if(seen.has(key))throw Error('Referencia/lote duplicados en la ubicación.');
   seen.add(key);
   var physicalStatus=x.status;
   if(!['uncounted','draft','confirmed'].includes(physicalStatus))
    throw Error('Estado físico de referencia no reconocido.');
   var correctionPending=physicalStatus==='confirmed' && x.correctionPending===true;
   var confirmed=physicalStatus==='confirmed'&&!correctionPending;
   var quantity=countQuantity(x,confirmed);
   rows.push({
    id:'reference:'+key,
    kind:'official',code:product,lot:lot,
    title:typeof x.description==='string'?x.description:'',
    physicalStatus:correctionPending?'correction-pending':physicalStatus,
    physicalStatusLabel:correctionPending?'Corrección pendiente de revisión':
      physicalStatus==='confirmed'?'Confirmado':
      physicalStatus==='draft'?'Borrador':'Sin contar',
    quantity:quantity,explicitZero:x.explicitZero===true,
    canEdit:status!=='finished'&&physicalStatus!=='confirmed',
    canCorrect:status!=='finished'&&physicalStatus==='confirmed'&&!correctionPending,
    administrativePending:false
   });
  });
  input.provisionals.forEach(function(x){
   if(!x || typeof x!=='object')throw Error('Provisional inválido.');
   var code=required(x.barcode,'Código provisional');
   if(seenProvisionals.has(code))throw Error('Provisional duplicado en la ubicación.');
   seenProvisionals.add(code);
   var physicalStatus=x.physicalStatus===undefined?x.status:x.physicalStatus;
   if(!['uncounted','draft','confirmed','pending'].includes(physicalStatus))
    throw Error('Estado físico provisional no reconocido.');
   // Admin status may remain 'pending' while its *physical* count is confirmed.
   var confirmed=physicalStatus==='confirmed';
   var quantity=countQuantity(x,confirmed);
   rows.push({
    id:'provisional:'+code,kind:'provisional',code:code,lot:'',
    title:typeof x.description==='string'?x.description:'',
    physicalStatus:confirmed?'confirmed':physicalStatus==='pending'?'draft':physicalStatus,
    physicalStatusLabel:confirmed?'Confirmado físicamente':
      physicalStatus==='uncounted'?'Sin contar':'Pendiente de confirmar',
    quantity:quantity,explicitZero:x.explicitZero===true,
    canEdit:status!=='finished'&&!confirmed,canCorrect:false,
    administrativePending:x.status!=='resolved_duplicate'&&x.status!=='resolved'
   });
  });
  var pending=rows.filter(function(r){return r.physicalStatus!=='confirmed';});
  var confirmed=rows.filter(function(r){return r.physicalStatus==='confirmed';});
  // This is a presentation-only candidate: NOT permission to finalize.
  var physicallyReadyCandidate=confirmed.length>0&&pending.length===0;
  return {
   locationCode:locationCode,locationStatus:status,
   pending:pending,confirmed:confirmed,
   summary:{total:rows.length,pending:pending.length,confirmed:confirmed.length,
    provisional:rows.filter(function(r){return r.kind==='provisional';}).length,
    administrativePending:rows.filter(function(r){return r.administrativePending;}).length,
    explicitZeros:confirmed.filter(function(r){return r.explicitZero&&Number(r.quantity)===0;}).length},
   physicallyReadyCandidate:physicallyReadyCandidate,
   requiresServerAuthorization:true,
   confirmedAtEnd:true
  };
 }
 function make(tag,cls,value){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(value!==undefined)e.textContent=String(value);
  return e;
 }
 function renderLocationView(container,view){
  if(!container||typeof container.replaceChildren!=='function')
   throw Error('Contenedor de vista inválido.');
  if(!view||!Array.isArray(view.pending)||!Array.isArray(view.confirmed))
   throw Error('Modelo de ubicación inválido.');
  var root=make('div','vi07-location-layout');
  var head=make('section','vi07-location-head');
  head.append(make('h2',null,'Ubicación '+view.locationCode));
  head.append(make('p','vi07-secondary','Vista de recuento físico · sin stock teórico'));
  var totals=make('p','vi07-secondary',view.summary.pending+' pendientes · '+
   view.summary.confirmed+' confirmadas · '+view.summary.administrativePending+
   ' provisionales pendientes de Administración');
  head.append(totals);root.append(head);
  function listFor(label,rows,confirmed){
   var section=make('section',confirmed?'vi07-location-final':'vi07-location-pending');
   var title=make('h3',null,label+' ('+rows.length+')');
   section.append(title);
   if(!rows.length)section.append(make('p','vi07-secondary',
    confirmed?'Aún no hay referencias confirmadas.':'No hay cantidades físicas pendientes.'));
   rows.forEach(function(r){
    var item=make('article','vi07-location-item');
    item.append(make('strong',null,r.code+(r.lot?' · Lote '+r.lot:'')));
    if(r.title)item.append(make('p','vi07-secondary',r.title));
    item.append(make('p',null,r.physicalStatusLabel+
     (r.quantity===null?' · cantidad en blanco':' · '+r.quantity+' unidades'+
      (r.explicitZero?' (cero expreso)':''))));
    if(r.administrativePending)item.append(make('p','vi07-secondary',
     'Identificación pendiente de Administración; cantidad física independiente.'));
    section.append(item);
   });
   return section;
  }
  root.append(listFor('Pendientes de recuento o revisión',view.pending,false));
  // Confirmed references are ALWAYS last, never mixed back with editable rows.
  var finished=make('details','vi07-location-confirmed');
  var summary=make('summary',null,'Confirmadas ('+view.confirmed.length+')');
  finished.append(summary);
  finished.append(listFor('Historial físico confirmado',view.confirmed,true));
  root.append(finished);
  root.append(make('p','vi07-secondary',
   'La finalización de ubicación requiere revisión y confirmación manual verificadas por servidor.'));
  container.replaceChildren(root);
  return root;
 }
 return {buildLocationView:buildLocationView,renderLocationView:renderLocationView};
});
