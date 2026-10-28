'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const folder=path.join(__dirname,'../inventory-ui');
const html=fs.readFileSync(path.join(folder,'location-layout.html'),'utf8');
const css=fs.readFileSync(path.join(folder,'location-layout.css'),'utf8');
test('location demo is explicitly not operational and never contacts production',()=>{
 assert.match(html,/PROTOTIPO VISUAL · DATOS FICTICIOS · NO OPERATIVO/);
 assert.match(html,/no guarda, sincroniza ni confirma recuentos/i);
 assert.doesNotMatch(html,/SUPABASE_URL|service_role|fetch\(|XMLHttpRequest|localStorage/);
 assert.match(html,/script src="location-view\.js"/);
});
test('demo reuses isolated responsive layout and displays pending/confirmed counters',()=>{
 assert.match(html,/href="responsive\.css"/);
 assert.match(html,/href="location-layout\.css"/);
 for(const id of ['vi07-total','vi07-pending','vi07-confirmed','vi07-location-content'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/renderLocationView\(/);
});
test('group of confirmed entries stays collapsed, last and accessible',()=>{
 assert.match(css,/\.vi07-location-confirmed summary\{min-height:48px/);
 assert.match(css,/\.vi07-location-confirmed>.\s*vi07-location-final/);
 assert.match(css,/@media \(max-width:699px\)/);
 assert.match(css,/@media \(min-width:1180px\)/);
 assert.doesNotMatch(css,/(?:^|[,{]\s*)#app\b/m);
 assert.doesNotMatch(html,/<details[^>]+open(?:\s|>)/);
});
test('sample includes uncounted, draft, confirmed zero and pending admin provisional',()=>{
 assert.match(html,/status:'uncounted',quantity:null/);
 assert.match(html,/status:'draft',quantity:'4'/);
 assert.match(html,/status:'confirmed',quantity:'0',explicitZero:true/);
 assert.match(html,/status:'pending',physicalStatus:'confirmed'/);
});
