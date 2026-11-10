/* Run with node --test lab/tramos-k/read-only-adapter.test.cjs */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'read-only-adapter.js'),'utf8');
function harness({profile={user_id:'u1',role:'supervisor',enabled:true},locations=[{code:'K01-01',aisle:'K',enabled:true},{code:'K02',aisle:'K',enabled:true},{code:'J01',aisle:'J',enabled:true},{code:'K99X',aisle:'K',enabled:true}],expired=false,deny=false}={}){
 const calls=[],s={access_token:'test-token',user:{id:'u1'},expires_at:Math.floor(Date.now()/1000)+(expired?-10:3600)};
 const ctx={localStorage:{getItem:()=>JSON.stringify(s)},Date,JSON,Error,encodeURIComponent,fetch:async(url,options)=>{calls.push({url,options});if(deny)return{ok:false,status:403};return{ok:true,json:async()=>url.includes('/profiles?')?[profile]:locations};}};
 ctx.globalThis=ctx;vm.runInNewContext(source,ctx);
 return{api:ctx.VISURA_K_READONLY,calls};
}
test('K location regex accepts K01-01 and K02 but excludes other aisles',async()=>{const h=harness();const r=await h.api.readK();assert.deepEqual(Array.from(r.locations,x=>x.code),['K01-01','K02']);});
test('read requests use GET, authenticated bearer and no body',async()=>{const h=harness();await h.api.readK();assert.equal(h.calls.length,2);for(const c of h.calls){assert.equal(c.options.method,'GET');assert.equal(c.options.headers.Authorization,'Bearer test-token');assert.equal(c.options.body,undefined);}});
test('disabled profile cannot access locations',async()=>{const h=harness({profile:{user_id:'u1',role:'supervisor',enabled:false}});await assert.rejects(()=>h.api.readK(),/MANAGER_REQUIRED/);assert.equal(h.calls.length,1);});
test('operator role cannot access locations',async()=>{const h=harness({profile:{user_id:'u1',role:'operator',enabled:true}});await assert.rejects(()=>h.api.readK(),/MANAGER_REQUIRED/);assert.equal(h.calls.length,1);});
test('expired session makes no network requests',async()=>{const h=harness({expired:true});await assert.rejects(()=>h.api.readK(),/LOGIN_REQUIRED_OR_EXPIRED/);assert.equal(h.calls.length,0);});
test('RLS denial is not treated as empty result',async()=>{const h=harness({deny:true});await assert.rejects(()=>h.api.readK(),/READ_DENIED_403/);});
