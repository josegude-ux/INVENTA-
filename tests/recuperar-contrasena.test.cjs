'use strict';
// 0.32.2 · «He olvidado mi contraseña»: Supabase Auth simulado, datos ficticios, sin red.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'warehouse-management.js'),'utf8');

const APP='https://josegude-ux.github.io/INVENTA-/';
const FUTURE=()=>Math.floor(Date.now()/1000)+3600;

function harness(opts={}){
 const values={managerEmail:'persona@example.invalid',...(opts.values||{})};
 const calls=[],seen=[],gone=[],replaced=[],listeners={};
 const auth=opts.auth||{};
 const fetch=async(url,o={})=>{
  const method=o.method||'GET';const body=o.body?JSON.parse(o.body):null;
  calls.push({url,method,body,headers:{...(o.headers||{})}});
  const reply=(status,data)=>({ok:status<400,status,text:async()=>JSON.stringify(data)});
  const path=url.replace(/^https:\/\/[^/]+/,'');
  if(path.startsWith('/auth/v1/recover'))return auth.recover?auth.recover(body):reply(200,{});
  if(path.startsWith('/auth/v1/verify'))return auth.verify?auth.verify(body):reply(200,{access_token:'rec-a',refresh_token:'rec-r',expires_in:3600,user:{id:'u-1'}});
  if(path.startsWith('/auth/v1/user')&&method==='PUT')return auth.user?auth.user(body,o.headers):reply(200,{id:'u-1',email:'persona@example.invalid'});
  if(path.startsWith('/auth/v1/token'))return auth.token?auth.token(body):reply(200,{access_token:'t',refresh_token:'r',expires_at:FUTURE(),user:{id:'u-1'}});
  if(path.startsWith('/auth/v1/logout'))return reply(204,{});
  if(path.includes('/rest/v1/profiles?'))return reply(200,[{user_id:'u-1',role:'admin',enabled:true,display_name:'Admin ficticio'}]);
  return reply(200,[]);
 };
 const doc={getElementById(id){
  if(id==='managerError'||id==='recoveryError'){doc.msg[id]=doc.msg[id]||{textContent:''};return doc.msg[id];}
  return {value:values[id]===undefined?'':values[id],textContent:''};
 },msg:{}};
 const win={
  location:{href:opts.href||APP},
  history:{replaceState:(s,t,u)=>{replaced.push(u);win.location.href='https://josegude-ux.github.io'+u;}},
  addEventListener:(k,f)=>{listeners[k]=f;}
 };
 const storage=new Map(Object.entries(opts.storage||{}));
 const factory=new Function('window','document','fetch','localStorage','crypto','place','go','managerUser','consultUser','screen','confirm','homeIcon',
  code+';\nreturn window.INVENTA_MGMT;');
 const obj=factory(win,doc,fetch,{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  {randomUUID:()=>'id'},html=>seen.push(html),k=>gone.push(k),'','','home',()=>true,()=>'');
 return {obj,calls,seen,gone,replaced,storage,values,doc,listeners,win,last:()=>seen.at(-1)||'',msg:id=>(doc.msg[id]||{}).textContent||''};
}
const tick=()=>new Promise(r=>setTimeout(r,0));

test('la pantalla de acceso ofrece «He olvidado mi contraseña»',()=>{
 const h=harness();h.obj.renderLogin();
 assert.match(h.last(),/He olvidado mi contraseña/);
 assert.match(h.last(),/INVENTA_MGMT\.forgotPassword\(\)/);
});

test('sin correo válido no se llama a Supabase',async()=>{
 const h=harness({values:{managerEmail:'sin-arroba'}});
 await h.obj.forgotPassword();
 assert.equal(h.calls.length,0);
 assert.match(h.msg('managerError'),/Escribe arriba tu correo/);
});

test('pide el correo a /auth/v1/recover con vuelta a INVENTA y sin sesión previa',async()=>{
 const stored=JSON.stringify({access_token:'viejo',refresh_token:'x',expires_at:FUTURE(),user:{id:'otro'}});
 const h=harness({storage:{'visura-inventa-auth-v2':stored}});
 await h.listeners.DOMContentLoaded();await tick();await tick();
 h.calls.length=0;
 await h.obj.forgotPassword();
 const c=h.calls.find(x=>x.url.includes('/auth/v1/recover'));
 assert.ok(c,'debe llamar a recover');
 assert.equal(c.method,'POST');
 assert.deepEqual(c.body,{email:'persona@example.invalid'});
 assert.equal(new URL(c.url).searchParams.get('redirect_to'),APP);
 assert.equal(c.headers.Authorization,undefined,'no debe mandar la sesión guardada');
 assert.match(h.msg('managerError'),/Si ese correo tiene cuenta/);
});

test('mensaje neutro: no revela si el correo existe',async()=>{
 const h=harness();await h.obj.forgotPassword();
 assert.doesNotMatch(h.msg('managerError'),/no existe|no encontrado|no registrado/i);
});

test('límite de correos (429) se explica sin culpar al usuario',async()=>{
 const h=harness({auth:{recover:()=>({ok:false,status:429,text:async()=>JSON.stringify({code:429,error_code:'over_email_send_rate_limit',msg:'email rate limit exceeded'})})}});
 await h.obj.forgotPassword();
 assert.match(h.msg('managerError'),/Espera unos minutos/);
});

test('un doble toque no envía dos correos',async()=>{
 const h=harness();
 await Promise.all([h.obj.forgotPassword(),h.obj.forgotPassword()]);
 assert.equal(h.calls.filter(x=>x.url.includes('/auth/v1/recover')).length,1);
});

test('lee el enlace de recuperación (fragmento con tokens) y lo borra de la barra',async()=>{
 const href=APP+'#access_token=rec-a&expires_at='+FUTURE()+'&expires_in=3600&refresh_token=rec-r&token_type=bearer&type=recovery';
 const h=harness({href});
 await h.listeners.DOMContentLoaded();await tick();await tick();
 assert.deepEqual(h.gone,['manager-login']);
 assert.equal(h.replaced.length,1);
 assert.doesNotMatch(h.replaced[0],/access_token|refresh_token|#/);
 h.obj.renderLogin();
 assert.match(h.last(),/Elige una contraseña nueva/);
 assert.match(h.last(),/autocomplete="new-password"/);
 assert.equal(h.storage.size,0,'la sesión de recuperación no se guarda antes de cambiar la contraseña');
});

test('enlace con token_hash: se verifica en /auth/v1/verify',async()=>{
 const h=harness({href:APP+'?token_hash=hash-ficticio&type=recovery'});
 assert.equal(await h.obj.startRecovery(),true);
 const v=h.calls.find(x=>x.url.includes('/auth/v1/verify'));
 assert.deepEqual(v.body,{type:'recovery',token_hash:'hash-ficticio'});
 assert.doesNotMatch(h.replaced[0],/token_hash|type=/);
 h.obj.renderLogin();assert.match(h.last(),/Elige una contraseña nueva/);
});

test('enlace caducado: se explica y se ofrece pedir otro',async()=>{
 const h=harness({href:APP+'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'});
 await h.obj.startRecovery();h.obj.renderLogin();
 assert.match(h.last(),/caducado o ya se usó/);
 assert.doesNotMatch(h.last(),/Elige una contraseña nueva/);
 assert.equal(h.replaced.length,1);
});

test('una dirección normal no activa la recuperación',async()=>{
 const h=harness({href:APP+'?v=1'});
 assert.equal(await h.obj.startRecovery(),false);
 assert.equal(h.replaced.length,0);
 assert.equal(h.obj.readRecoveryLink(APP+'#seccion'),null);
});

async function recovering(opts={}){
 const h=harness({href:APP+'#access_token=rec-a&expires_at='+FUTURE()+'&refresh_token=rec-r&type=recovery',...opts});
 await h.obj.startRecovery();h.obj.renderLogin();return h;
}

test('valida longitud y coincidencia antes de llamar a Supabase',async()=>{
 let h=await recovering({values:{newPassword:'corta',newPassword2:'corta'}});
 await h.obj.savePassword();
 assert.match(h.msg('recoveryError'),/ocho caracteres/);
 h=await recovering({values:{newPassword:'nueva-ficticia-1',newPassword2:'nueva-ficticia-2'}});
 await h.obj.savePassword();
 assert.match(h.msg('recoveryError'),/no coinciden/);
 assert.equal(h.calls.filter(x=>x.url.includes('/auth/v1/user')).length,0);
});

test('guarda la contraseña con la sesión de recuperación y entra',async()=>{
 const h=await recovering({values:{newPassword:'nueva-ficticia-1',newPassword2:'nueva-ficticia-1'}});
 await h.obj.savePassword();
 const put=h.calls.find(x=>x.url.includes('/auth/v1/user'));
 assert.equal(put.method,'PUT');
 assert.equal(put.headers.Authorization,'Bearer rec-a');
 assert.deepEqual(put.body,{password:'nueva-ficticia-1'});
 assert.deepEqual(h.gone,['home']);
 assert.ok(h.obj.isAdmin(),'queda dentro con su perfil');
 const saved=JSON.parse(h.storage.get('visura-inventa-auth-v2'));
 assert.equal(saved.access_token,'rec-a');
 assert.equal(JSON.stringify(saved).includes('nueva-ficticia-1'),false,'la contraseña nunca se guarda');
});

test('misma contraseña o débil: mensajes en castellano',async()=>{
 const fail=code=>()=>({ok:false,status:422,text:async()=>JSON.stringify({code:422,error_code:code,msg:'x'})});
 let h=await recovering({values:{newPassword:'nueva-ficticia-1',newPassword2:'nueva-ficticia-1'},auth:{user:fail('same_password')}});
 await h.obj.savePassword();assert.match(h.msg('recoveryError'),/distinta de la anterior/);
 h=await recovering({values:{newPassword:'nueva-ficticia-1',newPassword2:'nueva-ficticia-1'},auth:{user:fail('weak_password')}});
 await h.obj.savePassword();assert.match(h.msg('recoveryError'),/débil/);
});

test('sesión de recuperación rechazada (401): pasa a «enlace no válido»',async()=>{
 const h=await recovering({values:{newPassword:'nueva-ficticia-1',newPassword2:'nueva-ficticia-1'},
  auth:{user:()=>({ok:false,status:401,text:async()=>JSON.stringify({msg:'invalid JWT'})})}});
 await h.obj.savePassword();
 assert.match(h.last(),/caducado o ya se usó/);
 assert.equal(h.storage.size,0);
});

test('credenciales incorrectas al entrar: mensaje que lleva a la recuperación',async()=>{
 const h=harness({values:{managerPassword:'mala-ficticia'},auth:{token:()=>({ok:false,status:400,text:async()=>JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'})})}});
 await h.obj.signIn();
 assert.match(h.msg('managerError'),/Correo o contraseña incorrectos.*He olvidado mi contraseña/);
});

test('correo sin servidor propio (email_address_not_authorized): explica qué falta',async()=>{
 const h=harness({auth:{recover:()=>({ok:false,status:400,text:async()=>JSON.stringify({code:400,error_code:'email_address_not_authorized',msg:'Email address not authorized'})})}});
 await h.obj.forgotPassword();
 assert.match(h.msg('managerError'),/servidor de correo.*Administrador/);
});
