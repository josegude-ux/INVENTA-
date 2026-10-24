'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'warehouse-management.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const core=fs.readFileSync(path.join(root,'consultation-core.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'consultation-ui.js'),'utf8');
const consult=require('../consultation-core.js');

test('archivos JavaScript válidos y versión de caché coherente',()=>{
 assert.doesNotThrow(()=>new Function(code));
 assert.match(index,/APP_VERSION='0\.29\.1'/);
 assert.match(worker,/inventa-demo-v0291-01/);
 assert.match(worker,/'\.\/warehouse-management\.js\?v=0\.29\.1'/);
 assert.match(index,/warehouse-management\.js/);
 assert.match(index,/consultation-core\.js/);
 assert.match(index,/consultation-ui\.js/);
 assert.match(worker,/consultation-core\.js/);
 assert.match(worker,/consultation-ui\.js/);
 assert.doesNotThrow(()=>new Function(core));
 assert.doesNotThrow(()=>new Function(ui));
 const inline=index.slice(index.indexOf("<script>\n'use strict';")+8,index.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(inline));
});
test('no se publica service_role ni clave privada',()=>{
 assert.doesNotMatch(code,/sb_secret_[a-zA-Z0-9]/);
 assert.doesNotMatch(code,/service_role.*=.*eyJ/);
 assert.match(code,/sb_publishable_/);
});
function harness(role,fixtures={}){
 const values={managerEmail:'admin@example.invalid',managerPassword:'example-strong-pass'};
 const seen=[],routes=[],storage=new Map(),queries=[];
 const mockFetch=async(url,opts)=>{
  queries.push({url,method:opts?.method||'GET'});
  let data=[];
  if(url.includes('/auth/v1/token'))data={access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'user-id-test'}};
  else if(url.includes('/rest/v1/profiles'))data=[{user_id:'user-id-test',role,enabled:true,display_name:'Persona de prueba'}];
  else if(url.includes('/rest/v1/')){
   const table=url.split('/rest/v1/')[1].split('?')[0];
   data=fixtures[table]||[];
   if(table==='stock_snapshot'&&url.includes('order=imported_at.desc')){
    data=fixtures.latest||[];
   }else if(url.includes('location_code=eq.')){
    const loc=decodeURIComponent(url.split('location_code=eq.')[1].split('&')[0]);
    data=data.filter(row=>row.location_code===loc);
   }
  }
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
 };
 const mockWindow={addEventListener(){}};
 const factory=new Function('window','document','fetch','localStorage','crypto','place','go','managerUser','consultUser','screen','confirm',code+';\nreturn window.INVENTA_MGMT;');
 const obj=factory(mockWindow,{getElementById(id){return {value:values[id]||'',files:[],textContent:'',checked:true};}},
 mockFetch,{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 {randomUUID:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'},html=>seen.push(html),dest=>routes.push(dest),'','','home',()=>true);
 return {obj,seen,routes,queries,storage};
}
test('autenticación del Administrador y dashboard contra API',async()=>{
 const h=harness('admin');
 h.obj.renderLogin();
 assert.ok(h.seen.at(-1).includes('Acceso seguro'));
 await h.obj.signIn();
 assert.equal(h.obj.isAdmin(),true);
 assert.ok(h.routes.includes('home'));
 h.obj.open('dashboard');
 await h.obj.render();
 assert.ok(h.seen.some(x=>x.includes('Estado general')));
 assert.ok(h.queries.some(x=>x.url.includes('/rest/v1/campaigns')));
});
test('un Operario no puede abrir Gestión almacén',async()=>{
 const h=harness('operator');
 await h.obj.signIn();
 assert.equal(h.obj.isManager(),false);
 await h.obj.render();
 assert.ok(h.routes.includes('manager-login'));
 assert.ok(!h.seen.some(x=>x.includes('Estado general')));
});

test('Consulta agrupa ubicaciones y mantiene posiciones fijas vacías',()=>{
 const rows=consult.aggregate({
  products:[{code:'A',description:'Artículo A'},{code:'B',description:'Artículo B'}],
  locations:[{code:'P1'},{code:'P2'},{code:'P3'}],
  stock:[
   {product_code:'A',location_code:'P1',lot:'L1',quantity:12},
   {product_code:'A',location_code:'P2',lot:'L2',quantity:8},
   {product_code:'A',location_code:'P2',lot:'L2',quantity:2}
  ],
  fixed:[{product_code:'A',location_code:'P3',priority:1},{product_code:'B',location_code:'P3',priority:1}]
 });
 const a=rows.articles.find(x=>x.id==='A');
 assert.equal(a.total,22);
 assert.equal(a.locations.length,3);
 assert.equal(a.locations[0].locationCode,'P3');
 assert.equal(a.locations[0].fixed,true);
 assert.equal(a.locations[0].amount,0);
 assert.equal(a.locations.find(x=>x.locationCode==='P2').lots[0].amount,10);
 assert.equal(rows.articles.find(x=>x.id==='B').total,0);
 assert.equal(rows.locations.find(x=>x.code==='P3').articles.length,2);
 assert.ok(rows.locations.find(x=>x.code==='P3').articles.every(x=>x.amount===0&&x.fixed));
});

test('Consulta visible: ubicación fija a cero aparece por artículo y ubicación',()=>{
 const root={INVENTA_CONSULT:consult};
 const elements=new Map();
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{toggle(){}},placeholder:''});
  return elements.get(id);
 };
 const sample={
  'K00-P01':[{id:'PRD0003563',name:'ARTÍCULO CON STOCK',theoretical:200}],
  'K00-P02':[], 'K00-P03':[]
 };
 const build=new Function('window','TEST','consultUser','consultBlocked','go','isManager','data','consultRole','place','esc','$','screen','normCode','barcodeKey',
   ui+';return window.INVENTA_CONSULT_UI;');
 const view=build(root,sample,'Supervisor (demo)',()=>false,()=>{},()=>false,{demoInventoryOpen:false},()=>'supervisor',()=>{},
   x=>String(x),el,'consult',x=>String(x).toUpperCase(),x=>String(x).toUpperCase());
 view.render();
 view.setMode('article');
 assert.match(el('consultResults').innerHTML,/PRD0099000/);
 assert.match(el('consultResults').innerHTML,/SIN STOCK/);
 view.setMode('location');
 view.navigate('location','K00-P03');
 assert.match(el('consultResults').innerHTML,/PRD0099000/);
 assert.match(el('consultResults').innerHTML,/FIJA/);
 assert.deepEqual(view.lookup('K00-P03'),{value:'K00-P03',mode:'location'});
});

test('Catálogo guiado: primero pasillos A-T, después ubicaciones y finalmente detalle',async()=>{
 const h=harness('supervisor',{
  locations:[
   {code:'A00-P01',aisle:'A',description:'Primera ubicación'},
   {code:'A00-P02',aisle:'A'},
   {code:'K00-P01',aisle:'K'}
  ],
  fixed_positions:[{product_code:'PRD1',location_code:'A00-P01',priority:1}],
  products:[{code:'PRD1',description:'Producto fijo',unit:'UD'}],
  latest:[{campaign_id:'camp01',imported_at:'2026-10-24T06:00:00Z'}],
  stock_snapshot:[]
 });
 await h.obj.signIn();
 h.obj.open('catalog');
 await h.obj.render();
 const aisles=h.seen.at(-1);
 assert.match(aisles,/Selecciona un pasillo/);
 assert.match(aisles,/openCatalogAisle\('A'\)/);
 assert.match(aisles,/openCatalogAisle\('T'\)/);
 assert.doesNotMatch(aisles,/Crear ubicación/);
 h.obj.openCatalogAisle('A');
 await h.obj.render();
 const locs=h.seen.at(-1);
 assert.match(locs,/Pasillo A/);
 assert.match(locs,/A00-P01/);
 assert.match(locs,/A00-P02/);
 assert.doesNotMatch(locs,/K00-P01/);
 assert.match(locs,/Añadir ubicación/);
 h.obj.openCatalogLocation('A00-P01');
 await h.obj.render();
 const detail=h.seen.at(-1);
 assert.match(detail,/Ubicación A00-P01/);
 assert.match(detail,/Producto fijo/);
 assert.match(detail,/FIJA/);
 assert.match(detail,/SIN STOCK/);
 assert.match(detail,/Asignar posición fija/);
 h.obj.backCatalog();
 await h.obj.render();
 assert.match(h.seen.at(-1),/Pasillo A/);
 h.obj.backCatalog();
 await h.obj.render();
 assert.match(h.seen.at(-1),/Selecciona un pasillo/);
});
test('El Operario no puede entrar en el catálogo de gestión',async()=>{
 const h=harness('operator');
 await h.obj.signIn();
 h.obj.open('catalog');
 assert.ok(h.routes.includes('manager-login'));
 assert.equal(h.queries.some(q=>q.url.includes('/rest/v1/locations')),false);
});

test('cada script publicado tiene versión y está precargado en la misma caché',()=>{
 const scripts=[...index.matchAll(/src="(\.\/[^"]+\.js\?v=[^"]+)"/g)].map(x=>x[1]);
 assert.equal(scripts.length,4);
 scripts.forEach(src=>assert.ok(worker.includes("'"+src+"'")));
});

