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
const importer=require('../bc-excel-import.js');
const fixedImport=require('../fixed-positions-import.js');

test('archivos JavaScript válidos y versión de caché coherente',()=>{
 assert.doesNotThrow(()=>new Function(code));
 assert.match(index,/APP_VERSION='0\.30\.5'/);
 assert.match(worker,/inventa-demo-v0305-01/);
 assert.match(worker,/'\.\/warehouse-management\.js\?v=0\.30\.5'/);
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
 assert.match(el('consultResults').innerHTML,/consult-fixed/);
 assert.doesNotMatch(el('consultResults').innerHTML,/>FIJA</);
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
 assert.match(detail,/catalog-fixed-shade/);
 assert.doesNotMatch(detail,/>FIJA</);
 assert.match(detail,/SIN STOCK/);
 assert.doesNotMatch(detail,/Marcar posición fija de otro artículo/);
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
 assert.equal(scripts.length,6);
 scripts.forEach(src=>assert.ok(worker.includes("'"+src+"'")));
});


test('importador BC utiliza Stock calculado, conserva lotes y detecta negativos',()=>{
 const head=['Nombre sección','Cód. almacén','Nº documento almacén','Nº producto','Cód. ubicación','Descripción','Nº lote','Fecha caducidad','Stock calculado','Cant. (stock físico)','Cantidad','Cód. zona','Cód. unidad medida'];
 const r1=['A','COR_01_COR','H','PRD001','K17-P02','ARTÍCULO','L1',46916,12,999,0,'10-PAS-K','CAJA'];
 const r2=['A','COR_01_COR','H','PRD001','K17-P02','ARTÍCULO','L2',null,-2,0,0,'10-PAS-K','CAJA'];
 const result=importer.parseRows([head,r1,r2],'BC.xlsx');
 assert.equal(result.errors.length,0);
 assert.equal(result.rows.length,2);
 assert.equal(result.rows[0].quantity,12);
 assert.equal(result.rows[1].quantity,-2);
 assert.equal(result.negative,1);
 assert.equal(result.rows[0].expiry_date,'2028-06-12');
 assert.equal(result.rows[1].lot,'L2');
 assert.equal(result.warehouse,'COR_01_COR');
 assert.ok(result.warnings.some(x=>/stock físico/i.test(x)));
 assert.equal(result.rows[0].quantity!==999,true);
 const dup=importer.parseRows([head,r1,r1],'BC.xlsx');
 assert.ok(dup.errors.some(x=>x.includes('repite')));
 const mixed=importer.parseRows([head,r1,[...r2.slice(0,1),'OTRO_ALMACEN',...r2.slice(2)]],'BC.xlsx');
 assert.ok(mixed.errors.some(x=>x.includes('mezcla almacenes')));
});
test('importador ignora filas de título y nunca toma Cantidad física como stock',()=>{
 const title=['Diario de inventario físico de almacén'];
 const blank=[];
 const head=['Cód. almacén','Nº producto','Cód. ubicación','Descripción','Nº lote','Stock calculado','Cant. (stock físico)','Cantidad','Cód. unidad medida'];
 const r=['COR_01_COR','PRD9','A01-P01','DEMO','L1',7,1000,-993,'UD'];
 const result=importer.parseRows([title,blank,head,r],'titulo.xlsx');
 assert.equal(result.errors.length,0);
 assert.equal(result.headerRow,3);
 assert.equal(result.rows[0].quantity,7);
 assert.equal(result.rows.length,1);
});
test('migración BC publica de forma atómica y no borra maestros',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/005_bc_xlsx_atomic_import.sql'),'utf8');
 assert.match(sql,/bc_commit_import/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/Importación incompleta/);
 assert.match(sql,/bc_import_current/);
 assert.match(sql,/on conflict \(code\) do update/);
 assert.doesNotMatch(sql,/delete from public\.products/i);
 assert.doesNotMatch(sql,/delete from public\.locations/i);
 assert.doesNotMatch(sql,/delete from public\.fixed_positions/i);
 assert.doesNotMatch(sql,/delete from public\.counts/i);
 assert.match(sql,/internal\.is_admin\(\)/);
 assert.match(sql,/bc_batches_admin_insert/);
});
test('existe fixture XLSX ficticio del diario BC para pruebas manuales',()=>{
 const fixture=path.join(root,'tests/fixtures/diario-inventario-fisico-DEMO.xlsx');
 assert.ok(fs.existsSync(fixture));
 const buf=fs.readFileSync(fixture);
 assert.equal(buf[0],0x50);assert.equal(buf[1],0x4b); // ZIP/XLSX
 assert.ok(buf.length>1000);
});
test('Consulta solo lista pasillos con ubicaciones registradas',()=>{
 const rootWin={INVENTA_CONSULT:consult};
 const elements=new Map();
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{toggle(){}},placeholder:'',setAttribute(){}});
  return elements.get(id);
 };
 const sample={'K00-P01':[{id:'PRD1',name:'A',theoretical:1}],'L00-P01':[{id:'PRD2',name:'B',theoretical:2}]};
 const build=new Function('window','TEST','consultUser','consultBlocked','go','isManager','data','consultRole','place','esc','$','screen','normCode','barcodeKey',
  ui+';return window.INVENTA_CONSULT_UI;');
 const view=build(rootWin,sample,'Supervisor (demo)',()=>false,()=>{},()=>false,{demoInventoryOpen:false},()=>'supervisor',()=>{},
  x=>String(x),el,'consult',x=>String(x).toUpperCase(),x=>String(x).toUpperCase());
 view.render();
 view.setMode('location');
 const html=el('consultResults').innerHTML;
 assert.match(html,/Pasillo K/);
 assert.match(html,/Pasillo L/);
 assert.doesNotMatch(html,/Pasillo A</);
 assert.doesNotMatch(html,/Pasillo B</);
 assert.doesNotMatch(html,/Pasillo T</);
});
test('Consulta admite y etiqueta stock negativo oficial BC sin afectar posiciones fijas',()=>{
 const data=consult.aggregate({products:[{code:'PRD001',description:'ABC'}],locations:[{code:'K17-P02'}],
 stock:[{location_code:'K17-P02',product_code:'PRD001',lot:'L2',quantity:-2}],fixed:[]});
 assert.equal(data.locations[0].articles[0].amount,-2);
 assert.equal(data.locations[0].articles[0].lots[0].amount,-2);
 assert.match(ui,/STOCK NEGATIVO BC/);
 assert.match(code,/STOCK NEGATIVO BC/);
});


test('Consulta: Volver recorre artículo → ubicación → pasillo sin salir al menú',()=>{
 const root={INVENTA_CONSULT:consult};
 const elements=new Map(),routes=[],topNav={hidden:false};
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{toggle(){}},placeholder:'',setAttribute(){}});
  return elements.get(id);
 };
 const demo={'K00-P01':[{id:'PRD0003563',name:'PRODUCTO FIJO',theoretical:12}],
             'K00-P02':[{id:'PRD0001287',name:'PRODUCTO NO FIJO',theoretical:8}],
             'K00-P03':[]};
 const build=new Function('window','TEST','consultUser','consultBlocked','go','isManager','data','consultRole','place','esc','$','screen','normCode','barcodeKey','document',
  ui+';return window.INVENTA_CONSULT_UI;');
 const view=build(root,demo,'Supervisor (demo)',()=>false,s=>routes.push(s),()=>false,
  {demoInventoryOpen:false},()=>'supervisor',()=>{},
  x=>String(x),el,'consult',x=>String(x).toUpperCase(),x=>String(x).toUpperCase(),
  {getElementById:id=>id==='topNavigation'?topNav:null});
 view.render();
 assert.equal(topNav.hidden,true,'Volver no debe salir al menú desde la raíz de Consulta');
 assert.match(ui,/INVENTA_CONSULT_UI\.back\(\)/);
 view.navigate('aisle','K');
 assert.equal(topNav.hidden,false);
 view.navigate('location','K00-P01');
 assert.match(el('consultResults').innerHTML,/PRODUCTO FIJO/);
 assert.match(el('consultResults').innerHTML,/consult-fixed/);
 assert.doesNotMatch(el('consultResults').innerHTML,/>FIJA</);
 view.navigate('product','PRD0003563');
 assert.match(el('consultResults').innerHTML,/Cantidad total/);
 assert.match(el('consultResults').innerHTML,/card consult-fixed/);
 view.back();
 assert.match(el('consultResults').innerHTML,/PRODUCTO FIJO/);
 assert.doesNotMatch(el('consultResults').innerHTML,/Cantidad total:/);
 view.back();
 assert.match(el('consultResults').innerHTML,/Pasillo K/);
 view.back();
 assert.equal(topNav.hidden,true);
 assert.match(el('consultResults').innerHTML,/Selecciona el pasillo/);
 view.back();
 assert.deepEqual(routes,[],'Solo el logotipo debe regresar al inicio');
 assert.match(index,/onclick="navigateHome\(\)" aria-label="INVENTA: ir al menú principal"/);
});
test('Consulta: Volver recupera resultados filtrados y no marca artículos no fijos',()=>{
 const root={INVENTA_CONSULT:consult},elements=new Map();
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',placeholder:'',classList:{toggle(){}},setAttribute(){}});
  return elements.get(id);
 };
 const build=new Function('window','TEST','consultUser','consultBlocked','go','isManager','data','consultRole','place','esc','$','screen','normCode','barcodeKey',
  ui+';return window.INVENTA_CONSULT_UI;');
 const view=build(root,{'K00-P02':[{id:'PRD0001572',name:'ARTICULO SIN FIJO',theoretical:9}]},'Supervisor (demo)',()=>false,()=>{},()=>false,
   {demoInventoryOpen:false},()=>'supervisor',()=>{},x=>String(x),el,'consult',x=>String(x).toUpperCase(),x=>String(x).toUpperCase());
 view.render();el('consultSearch').value='K00-P02';view.filter('K00-P02');
 view.navigate('location','K00-P02');
 const html=el('consultResults').innerHTML;
 assert.match(html,/ARTICULO SIN FIJO/);
 assert.doesNotMatch(html,/consult-fixed/);
 view.back();
 assert.equal(el('consultSearch').value,'K00-P02');
 assert.match(el('consultResults').innerHTML,/K00-P02/);
 assert.match(index,/#topNavigation\[hidden\]\{display:none!important\}/);
});


test('Administrador puede marcar fijos desde catálogo sin cambiar existencias BC',async()=>{
 const h=harness('admin',{
  locations:[{code:'K00-P01',aisle:'K'}],
  products:[{code:'PRD1',description:'Artículo de muestra',unit:'CAJA'}],
  stock_snapshot:[{campaign_id:'old-camp',product_code:'PRD1',location_code:'K00-P01',lot:'',quantity:15}],
  latest:[{campaign_id:'old-camp',imported_at:'2026-10-24T06:00:00Z'}],
  fixed_positions:[]
 });
 await h.obj.signIn();
 h.obj.open('catalog');await h.obj.render();
 h.obj.openCatalogAisle('K');await h.obj.render();
 h.obj.openCatalogLocation('K00-P01');await h.obj.render();
 assert.match(h.seen.at(-1),/Marcar posición fija/);
 assert.match(h.seen.at(-1),/Marcar posición fija de otro artículo/);
 const ok=await h.obj.changeFixedPosition('PRD1','K00-P01',false);
 assert.equal(ok,true);
 assert.ok(h.queries.some(q=>q.method==='POST'&&q.url.includes('/rest/v1/fixed_positions')));
 assert.equal(h.queries.some(q=>q.method==='POST'&&q.url.includes('/rest/v1/bc_import_lines')),false);
});
test('Supervisión puede consultar sombreado fijo pero no asignarlo',async()=>{
 const h=harness('supervisor',{
  locations:[{code:'K00-P01',aisle:'K'}],
  fixed_positions:[{product_code:'PRD1',location_code:'K00-P01',priority:1}],
  products:[{code:'PRD1',description:'Artículo fijo',unit:'UD'}]
 });
 await h.obj.signIn();
 h.obj.open('catalog');await h.obj.render();
 h.obj.openCatalogAisle('K');await h.obj.render();
 h.obj.openCatalogLocation('K00-P01');await h.obj.render();
 assert.match(h.seen.at(-1),/catalog-fixed-shade/);
 assert.doesNotMatch(h.seen.at(-1),/Desmarcar posición/);
 assert.doesNotMatch(h.seen.at(-1),/>FIJA</);
 await assert.rejects(h.obj.changeFixedPosition('PRD1','K00-P01',true),/Solo Administración/);
});
test('Informe de fijos solo para Administración, con stock BC y botones CSV/PDF',async()=>{
 const fixture={product_code:'PRD1',product_description:'Artículo fijo',location_code:'K00-P01',aisle:'K',priority:1,stock_quantity:15,unit:'CAJA',assigned_at:'2026-10-24T12:00:00Z'};
 const h=harness('admin',{'rpc/admin_fixed_positions_report':[fixture]});
 await h.obj.signIn();h.obj.open('fixed');await h.obj.render();
 const page=h.seen.at(-1);
 assert.match(page,/Informe de posiciones fijas/);
 assert.match(page,/PRD1/);
 assert.match(page,/K00-P01/);
 assert.match(page,/15 CAJA/);
 assert.match(page,/Descargar informe CSV/);
 assert.match(page,/Guardar PDF/);
 assert.ok(h.queries.some(q=>q.url.includes('/rpc/admin_fixed_positions_report')));
 const supervisor=harness('supervisor',{'rpc/admin_fixed_positions_report':[fixture]});
 await supervisor.obj.signIn();
 supervisor.obj.open('dashboard');
 await assert.rejects(supervisor.obj.changeFixedPosition('PRD1','K00-P01',false),/Solo Administración/);
 assert.equal(supervisor.queries.some(q=>q.url.includes('/rpc/admin_fixed_positions_report')),false);
});
test('Aplicación lee el último snapshot BC al abrir sin reimportar Excel',()=>{
 assert.match(code,/function refreshBCStatus\(\)/);
 assert.match(index,/id="bcLiveStatus"/);
 assert.match(index,/INVENTA_MGMT\.refreshBCStatus\(\)/);
 assert.match(index,/visibilitychange/);
 assert.match(index,/catalog-product\.catalog-fixed-shade/);
 assert.doesNotMatch(index,/APP_VERSION='0\.30\.2'/);
});


test('Importación fijos: detecta Fijo=1, ignora blancos, consolida pares repetidos',()=>{
 const header=['Filtro almacén','Filtro zona','Nº producto','Cód. ubicación','Descripción','Fijo','Cantidad (base)','Cód. unidad medida'];
 const a=['COR_01_COR','10-PAS-K','PRD0003563','K00-P01','GIN SEAGRAM',1,1690,'BOTELLA'];
 const b=['COR_01_COR','10-PAS-K','PRD0003563','K00-P01','GIN SEAGRAM',1,1690,'UD'];
 const c=['COR_01_COR','10-PAS-K','PRD0099999','K00-P03','ART NO FIJO',null,100,'UD'];
 const result=fixedImport.parseRows([['Informe BC'],header,a,b,c],'Base unificada.xlsx');
 assert.deepEqual(result.errors,[]);
 assert.equal(result.sourceRows,3);
 assert.equal(result.fixedRows,2);
 assert.equal(result.uniquePositions,1);
 assert.equal(result.duplicates,1);
 assert.equal(result.warehouse,'COR_01_COR');
 assert.equal(result.items[0].product_code,'PRD0003563');
 assert.equal(result.items[0].location_code,'K00-P01');
 assert.equal(result.items[0].zone,'10-PAS-K');
 assert.equal(result.items[0].unit,'BOTELLA');
 assert.equal(result.items[1].unit,'UD');
 assert.ok(result.warnings.some(w=>w.includes('duplicado')||w.includes('repetido')));
});
test('Importación fijos: bloquea mezcla de almacenes y Fijo inválido',()=>{
 const headers=['Filtro almacén','Filtro zona','Nº producto','Cód. ubicación','Descripción','Fijo','Cantidad (base)','Cód. unidad medida'];
 const rows=[
  ['COR_01_COR','10-PAS-K','PRD1','K00-P01','Primero',1,12,'UD'],
  ['OTRO_ALMACEN','10-PAS-K','PRD2','K00-P02','Segundo',1,23,'UD']
 ];
 const mixed=fixedImport.parseRows([headers,...rows],'mezcla.xlsx');
 assert.ok(mixed.errors.some(x=>x.includes('único almacén')));
 const bad=fixedImport.parseRows([headers,[...rows[0].slice(0,5),'desconocido',...rows[0].slice(6)]],'mal.xlsx');
 assert.ok(bad.errors.some(x=>x.includes('Fijo no reconocido')));
});
test('Informe de fijos se pagina para mostrar el inventario completo, sin cargar 1944 tarjetas',()=>{
 assert.match(code,/rpc\/admin_fixed_positions_report','limit=1000&offset=/);
 assert.match(code,/records\.slice\(0,100\)/);
 assert.match(code,/fixedReportRows\.filter/);
 assert.match(code,/INVENTA_FIXED_IMPORT\.panel/);
 assert.match(index,/fixed-positions-import\.js\?v=0\.30\.5/);
 assert.match(worker,/fixed-positions-import\.js\?v=0\.30\.5/);
});

test('Ubicaciones especiales RET y CADCAP no se confunden con pasillos R/C',()=>{
 const root={INVENTA_CONSULT:consult},elements=new Map();
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{toggle(){}},placeholder:'',setAttribute(){}});
  return elements.get(id);
 };
 const source={
  'K00-P01':[{id:'PRD0003563',name:'GIN',theoretical:10}],
  'RET-09':[{id:'PRD0000465',name:'RETORNO',theoretical:3}],
  'CADCAP':[{id:'PRD0016059',name:'CADUCADOS',theoretical:5}]
 };
 const build=new Function('window','TEST','consultUser','consultBlocked','go','isManager','data','consultRole','place','esc','$','screen','normCode','barcodeKey',
  ui+';return window.INVENTA_CONSULT_UI;');
 const view=build(root,source,'Supervisor (demo)',()=>false,()=>{},()=>false,
  {demoInventoryOpen:false},()=>'supervisor',()=>{},x=>String(x),el,'consult',x=>String(x).toUpperCase(),x=>String(x).toUpperCase());
 view.render();view.setMode('location');
 let rootHtml=el('consultResults').innerHTML;
 assert.match(rootHtml,/Pasillo K/);
 assert.match(rootHtml,/Otras ubicaciones/);
 assert.doesNotMatch(rootHtml,/Pasillo R/);
 assert.doesNotMatch(rootHtml,/Pasillo C/);
 view.navigate('aisle','OTROS');
 assert.match(el('consultResults').innerHTML,/RET-09/);
 assert.match(el('consultResults').innerHTML,/CADCAP/);
 view.navigate('location','RET-09');
 assert.match(el('consultResults').innerHTML,/RETORNO/);
});


test('Importador de posiciones fijas presenta selección clara para iPhone y confirma fichero',()=>{
 const markup=fixedImport.panel([]);
 assert.match(markup,/id="fixedExcelFile"/);
 assert.match(markup,/type="file"/);
 assert.match(markup,/onchange="INVENTA_FIXED_IMPORT\.fileSelected\(this\)"/);
 assert.match(markup,/id="fixedExcelSelected"/);
 assert.match(markup,/2\. Analizar Excel seleccionado/);
 assert.match(markup,/INVENTA_FIXED_IMPORT\.analyse\(\)/);
 assert.match(markup,/Ningún archivo seleccionado todavía/);
 assert.equal(typeof fixedImport.fileSelected,'function');
});
test('Importador de posiciones fijas no depende de un CDN único y ofrece recuperación',()=>{
 const importerCode=fs.readFileSync(path.join(root,'fixed-positions-import.js'),'utf8');
 assert.match(importerCode,/cdn\.jsdelivr\.net/);
 assert.match(importerCode,/unpkg\.com/);
 assert.match(importerCode,/setTimeout\(function\(\)\{finish\(false\);\},15000\)/);
 assert.match(importerCode,/catch\(function\(e\)\{excelPromise=null;throw e;\}/);
});
