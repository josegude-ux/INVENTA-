/* INVENTA · Agrupación de consulta por artículo y ubicación.
   La posición fija es un dato maestro independiente del stock BC. */
(function(root){
 'use strict';
 function aggregate(input){
  var data=input||{}, articleMap=new Map(), locationMap=new Map();
  var productCatalog=new Map((data.products||[]).map(function(p){return [String(p.code),p];}));
  function article(code){
   code=String(code||'');
   if(!articleMap.has(code)){
    var p=productCatalog.get(code)||{};
    articleMap.set(code,{id:code,name:p.description||code,unit:p.unit||'UD',barcode:p.barcode||'',locations:[],total:0});
   }
   return articleMap.get(code);
  }
  function location(code){
   code=String(code||'');
   if(!locationMap.has(code))locationMap.set(code,{code:code,articles:[],total:0});
   return locationMap.get(code);
  }
  (data.locations||[]).forEach(function(l){if(l&&l.code)location(l.code);});
  var pairs=new Map();
  function pair(productCode,locationCode){
   var key=JSON.stringify([String(productCode),String(locationCode)]);
   if(!pairs.has(key)){
    var a=article(productCode),loc=location(locationCode);
    var entry={productCode:String(productCode),locationCode:String(locationCode),amount:0,fixed:false,priority:null,lots:[]};
    pairs.set(key,entry);a.locations.push(entry);loc.articles.push(entry);
   }
   return pairs.get(key);
  }
  (data.stock||[]).forEach(function(s){
   var qty=Number(s.quantity);
   if(!s.product_code||!s.location_code||!Number.isFinite(qty)||qty<=0)return;
   var entry=pair(s.product_code,s.location_code);
   entry.amount+=qty;
   var lot=String(s.lot||'').trim();
   if(lot){
    var existing=entry.lots.find(function(l){return l.code===lot;});
    if(existing)existing.amount+=qty;
    else entry.lots.push({code:lot,amount:qty});
   }
  });
  (data.fixed||[]).forEach(function(f){
   if(!f.product_code||!f.location_code)return;
   var entry=pair(f.product_code,f.location_code);
   var priority=Number(f.priority)||1;
   entry.fixed=true;
   entry.priority=entry.priority===null?priority:Math.min(entry.priority,priority);
  });
  function sortPositions(a,b){
   if(a.fixed!==b.fixed)return a.fixed?-1:1;
   if(a.fixed&&b.fixed&&a.priority!==b.priority)return a.priority-b.priority;
   return a.locationCode.localeCompare(b.locationCode,'es',{numeric:true});
  }
  function sortArticles(a,b){
   if(a.fixed!==b.fixed)return a.fixed?-1:1;
   return a.productCode.localeCompare(b.productCode,'es',{numeric:true});
  }
  var articles=[...articleMap.values()].map(function(a){
   a.locations.sort(sortPositions);
   a.total=a.locations.reduce(function(sum,pos){return sum+pos.amount;},0);
   return a;
  }).sort(function(a,b){return a.id.localeCompare(b.id,'es',{numeric:true});});
  var locations=[...locationMap.values()].map(function(l){
   l.articles.sort(sortArticles);
   l.total=l.articles.reduce(function(sum,pos){return sum+pos.amount;},0);
   return l;
  }).sort(function(a,b){return a.code.localeCompare(b.code,'es',{numeric:true});});
  return {articles:articles,locations:locations};
 }
 var api={aggregate:aggregate};
 root.INVENTA_CONSULT=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
