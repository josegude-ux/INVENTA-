'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../inventory-ui/responsive.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../inventory-ui/preview.html'),'utf8');
test('isolated CSS does not alter published #app or main branding',()=>{
 assert.match(css,/\.vi07-shell/);
 assert.doesNotMatch(css,/(?:^|[,{]\s*)#app\b/m);
 assert.match(html,/PROTOTIPO VISUAL.*DATOS FICTICIOS.*NO OPERATIVO/);
 assert.doesNotMatch(html,/(?:service_role|sb_secret_|SUPABASE_URL)/i);
});
test('mobile, tablet, desktop, short landscape and print have separate layouts',()=>{
 assert.match(css,/@media\s*\(max-width:699px\)/);
 assert.match(css,/@media\s*\(min-width:700px\)/);
 assert.match(css,/@media\s*\(min-width:1180px\)/);
 assert.match(css,/@media\s*\(max-height:500px\)\s*and\s*\(orientation:landscape\)/);
 assert.match(css,/@media print/);
 assert.match(css,/grid-template-columns:288px minmax\(0,1fr\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.6fr\) minmax\(340px,1fr\)/);
 assert.match(css,/max-width:1720px/);
});
test('eight priority screens and hidden sections are present',()=>{
 const ids=['count','locations','assignments','admin','provisionals','incidents','reports','close'];
 for(const id of ids){assert.match(html,new RegExp('id="'+id+'" class="vi07-screen"'));assert.match(html,new RegExp('href="#'+id+'"'));}
 assert.match(css,/\.vi07-screen\[hidden\]\{display:none!important\}/);
 assert.match(html,/addEventListener\('hashchange',show\)/);
});
test('individual scanning and pallet button below loose units and boxes',()=>{
 const idxRef=html.indexOf('vi07-reference'),idxScan=html.indexOf('vi07-scan'),idxInputs=html.indexOf('vi07-count-fields'),idxPallet=html.indexOf('vi07-pallet-toggle');
 assert.ok(idxRef>0 && idxScan>idxRef && idxInputs>idxScan && idxPallet>idxInputs);
 assert.match(html,/Escanear referencia 00001234/);
 assert.match(html,/Escanear referencia 00007890/);
 assert.match(css,/\.vi07-reference\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/\.vi07-pallet-toggle/);
});
test('confirmed group closed by default and count shows no BC theoretical numbers',()=>{
 assert.match(html,/<details class="vi07-confirmed"><summary>Confirmadas \(2\)<\/summary>/);
 assert.doesNotMatch(html,/<details class="vi07-confirmed" open/);
 assert.match(html,/stock teórico no se muestra/);
 assert.doesNotMatch(html,/(?:stock BC\s*[:=]\s*\d+|stock teórico\s*[:=]\s*\d+)/i);
});
test('touch sizes, accessible focus, table overflow and dynamic heading',()=>{
 assert.match(css,/button\{min-height:44px/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/\.vi07-table-wrap\{max-width:100%;overflow-x:auto/);
 assert.match(css,/\.vi07-scan\{[^}]*width:48px;min-height:48px/);
 assert.match(css,/font-size:clamp\(18px,2vw,25px\)/);
});
