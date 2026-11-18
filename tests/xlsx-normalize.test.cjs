'use strict';
const test=require('node:test');
const assert=require('node:assert');
const fs=require('fs');
const path=require('path');
const X=require('../xlsx-normalize.js');
const dec=new TextDecoder();
const load=f=>{const b=fs.readFileSync(path.join(__dirname,'fixtures',f));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);};
const part=async(buf,n)=>dec.decode((await X.readZip(buf)).find(e=>e.name===n).data);

test('Excel de BC con prefijo x: y rutas absolutas se normaliza sin perder datos',async()=>{
 const r=await X.normalize(load('bc-prefijo-x-ficticio.xlsx'));
 assert.equal(r.changed,true);
 const wb=await part(r.buffer,'xl/workbook.xml');
 assert.match(wb,/<workbook [^>]*xmlns="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/);
 assert.match(wb,/<sheets><sheet name="Diario ficticio"/);
 assert.doesNotMatch(wb,/<x:|<\/x:/);
 assert.match(await part(r.buffer,'_rels/.rels'),/Target="xl\/workbook\.xml"/);
 assert.match(await part(r.buffer,'xl/_rels/workbook.xml.rels'),/Target="worksheets\/sheet1\.xml"/);
 const sheet=await part(r.buffer,'xl/worksheets/sheet1.xml');
 assert.match(sheet,/<t>PRUEBA-001<\/t>/);assert.match(sheet,/<t>Z99-P01<\/t>/);assert.match(sheet,/Nº producto/);
 assert.equal(sheet.charCodeAt(0)===0xFEFF,false);
});
test('Un Excel ya normal se devuelve intacto',async()=>{
 const first=await X.normalize(load('bc-prefijo-x-ficticio.xlsx'));
 const second=await X.normalize(first.buffer);
 assert.equal(second.changed,false);assert.strictEqual(second.buffer,first.buffer);
});
test('Rutas relativas desde cada carpeta de relaciones',()=>{
 assert.equal(X.relativeTarget('_rels/.rels','/xl/workbook.xml'),'xl/workbook.xml');
 assert.equal(X.relativeTarget('xl/_rels/workbook.xml.rels','/xl/styles.xml'),'styles.xml');
 assert.equal(X.relativeTarget('xl/worksheets/_rels/sheet1.xml.rels','/xl/tables/table1.xml'),'../tables/table1.xml');
 assert.equal(X.relativeTarget('xl/_rels/workbook.xml.rels','worksheets/sheet1.xml'),'worksheets/sheet1.xml');
});
test('CRC32 estándar',()=>{assert.equal(X.crc32(new TextEncoder().encode('123456789')),0xCBF43926);});
test('Un archivo que no es zip da un error comprensible',async()=>{
 await assert.rejects(X.normalize(new TextEncoder().encode('no es un excel').buffer),/no es un Excel/);
});
