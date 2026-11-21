'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../inventory-ui/preview.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../inventory-ui/responsive.css'),'utf8');
test('pallet detail starts hidden and is bound to its own accessible toggle',()=>{
 assert.match(html,/class="vi07-pallet-toggle" type="button" aria-expanded="false" aria-controls="vi07-pallet-detail"/);
 assert.match(html,/class="vi07-pallet-detail" id="vi07-pallet-detail" hidden/);
 assert.match(css,/\.vi07-pallet-detail\[hidden\]\{display:none!important\}/);
 assert.match(html,/palletButton\.addEventListener\('click',/);
 assert.match(html,/palletPanel\.hidden=!expanded/);
 assert.match(html,/palletButton\.setAttribute\('aria-expanded',String\(expanded\)\)/);
});
test('tablet vertical avoids two tiny columns while desktop uses simultaneous panels',()=>{
 assert.match(css,/@media \(min-width:700px\) and \(max-width:959px\)/);
 assert.match(css,/\.vi07-screen\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/@media \(min-width:1180px\)/);
 assert.match(css,/\.vi07-screen\{grid-template-columns:minmax\(0,1\.6fr\) minmax\(340px,1fr\)/);
 assert.match(css,/\.vi07-shell \.vi07-scan\{[^}]*min-height:48px/);
});
