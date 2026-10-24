'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'warehouse-management.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

test('archivos JavaScript válidos y versión de caché coherente',()=>{
 assert.doesNotThrow(()=>new Function(code));
 assert.match(index,/APP_VERSION='0\.25\.1'/);
 assert.match(worker,/inventa-demo-v0251-01/);
 assert.match(worker,/'\.\/warehouse-management\.js'/);
 assert.match(index,/warehouse-management\.js/);
 const inline=index.slice(index.indexOf("<script>\n'use strict';")+8,index.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(inline));
});
test('no se publica service_role ni clave privada',()=>{
 assert.doesNotMatch(code,/sb_secret_[a-zA-Z0-9]/);
 assert.doesNotMatch(code,/service_role.*=.*eyJ/);
 assert.match(code,/sb_publishable_/);
});
function harness(role){
 const values={managerEmail:'admin@example.invalid',managerPassword:'example-strong-pass'};
 const seen=[],routes=[],storage=new Map(),queries=[];
 const mockFetch=async(url,opts)=>{
  queries.push({url,method:opts?.method||'GET'});
  let data=[];
  if(url.includes('/auth/v1/token'))data={access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'user-id-test'}};
  else if(url.includes('/rest/v1/profiles'))data=[{user_id:'user-id-test',role,enabled:true,display_name:'Persona de prueba'}];
  else data=[];
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
