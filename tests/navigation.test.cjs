const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('let navigationBaseline='),html.indexOf('function place(html'));
function setup(){
 const events=[],field={isConnected:true,type:'text',value:'initial'};
 const ctx={document:{querySelectorAll:()=>[field]},window:{INVENTA_MGMT:{isSaving:()=>false,cancelView:()=>events.push('cancel')},INVENTA_REAL:{isBusy:()=>false,leave:()=>events.push('leave')}},screen:'management',data:{worker:'demo'},confirm:()=>true,alert:m=>events.push(m),saveDraft:()=>true,stopScanner:()=>events.push('stop'),go:s=>events.push(s)};
 vm.createContext(ctx);vm.runInContext(code+'navigationBaseline=navigationFields().map(el=>[el,el.value]);',ctx);
 return {ctx,events,field};
}
test('logo returns to home and invalidates outgoing views',()=>{const {ctx,events}=setup();ctx.navigateHome();assert.deepEqual(events,['stop','cancel','leave','home']);});
test('unsaved form can cancel navigation without losing values',()=>{const {ctx,events,field}=setup();field.value='new';ctx.confirm=()=>false;ctx.navigateHome();assert.deepEqual(events,[]);assert.equal(field.value,'new');});
test('saving and synchronizing block both navigation actions',()=>{for(const which of ['INVENTA_MGMT','INVENTA_REAL']){const {ctx,events}=setup();ctx.window[which][which==='INVENTA_MGMT'?'isSaving':'isBusy']=()=>true;ctx.safeNavigation(()=>events.push('back'));ctx.navigateHome();assert.equal(events.length,2);assert.ok(events.every(x=>x.includes('curso')));}});
test('failed draft persistence never leaves count screen even with existing draft',()=>{const {ctx,events}=setup();ctx.screen='count';ctx.saveDraft=()=>false;ctx.navigateHome();assert.equal(events.length,1);assert.match(events[0],/borrador/);});
test('confirmed demo draft is persisted before home navigation',()=>{const {ctx,events}=setup();ctx.screen='count';ctx.saveDraft=()=>{events.push('draft');return true;};ctx.navigateHome();assert.equal(events[0],'draft');assert.equal(events.at(-1),'home');});
test('home shows operations only for enabled roles',()=>{
 const code=html.slice(html.indexOf('function homePermissions(){'),html.indexOf('function renderHome(){'));
 for(const role of ['operator','supervisor','admin'])for(const enabled of [true,false]){
  const ctx={window:{INVENTA_MGMT:{profile:{role},isAuthenticated:()=>enabled,isManager:()=>role!=='operator',isAdmin:()=>role==='admin'}}};vm.createContext(ctx);vm.runInContext(code,ctx);
  const permissions=ctx.homePermissions();assert.equal(permissions.inventory,enabled);assert.equal(permissions.consultation,enabled&&role!=='operator');assert.equal(permissions.management,enabled&&role!=='operator');assert.equal(permissions.demo,enabled&&role==='admin');
 }
});
