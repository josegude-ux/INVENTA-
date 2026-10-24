'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const preview=path.join(root,'preview');
const html=fs.readFileSync(path.join(preview,'index.html'),'utf8');
const script=fs.readFileSync(path.join(preview,'preview.js'),'utf8');
const importer=require('../bc-excel-import.js');
const ExcelJS=require('../preview/vendor/exceljs.min.js');

test('vista previa aislada solo carga recursos locales y el importador real',()=>{
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/script-src 'self'/);
 assert.match(html,/\.\.\/bc-excel-import\.js/);
 assert.match(html,/\.\/vendor\/exceljs\.min\.js/);
 assert.match(html,/diario-inventario-fisico-DEMO\.xlsx/);
 assert.doesNotMatch(html+script,/wlejxnpphysogrzcxjfh|service[_-]?role|sb_publishable|sb_secret|https?:\/\//i);
 assert.doesNotMatch(html+script,/warehouse-management|service-worker|localStorage|sessionStorage|navigator\.serviceWorker/i);
 assert.doesNotMatch(html,/Confirmar y publicar|onclick=/i);
});

test('fixture XLSX ficticio se abre con ExcelJS y el parser real 0.30.6',async()=>{
 const workbook=new ExcelJS.Workbook();
 const fixture=fs.readFileSync(path.join(root,'tests/fixtures/diario-inventario-fisico-DEMO.xlsx'));
 await workbook.xlsx.load(fixture);
 assert.equal(workbook.creator,'Unknown');
 const values=[];
 workbook.worksheets[0].eachRow(row=>row.eachCell(cell=>values.push(String(cell.value||''))));
 assert.ok(values.includes('Empresa DEMO INVENTA · FICTICIO'));
 assert.equal(values.some(value=>/@|https?:\/\//i.test(value)),false);
 const result=importer.parseRows(importer.sheetToMatrix(workbook.worksheets[0]),'diario-inventario-fisico-DEMO.xlsx');
 assert.deepEqual(result.errors,[]);
 assert.equal(result.rows.length,5);
 assert.equal(result.products,4);
 assert.equal(result.locations,4);
 assert.equal(result.negative,1);
 assert.equal(result.zero,1);
 assert.ok(result.rows.every(row=>/^PRD\d+$/.test(row.product_code)&&/DEMO/.test(row.description)));
 assert.ok(result.warnings.some(message=>/stock físico/i.test(message)));
});

test('vista previa bloquea red y sustituye la publicación por una DEMO local',async()=>{
 function element(){
  return {children:[],firstChild:null,hidden:false,disabled:false,textContent:'',className:'',files:[],
   addEventListener(type,handler){this[type]=handler;},
   appendChild(child){this.children.push(child);return child;},
   removeChild(){this.children.shift();},
   setAttribute(){}};
 }
 const ids=['bcExcelFile','analyseButton','readerFailureButton','bcExcelStatus','results','summary','messages','rows'];
 const elements=Object.fromEntries(ids.map(id=>[id,element()]));
 let originalCommitCalled=false;
 const window={
  ExcelJS:{Workbook:function(){}},
  INVENTA_BC:{fileSelected(){},parseRows(){},sheetToMatrix(){},commit(){originalCommitCalled=true;}}
 };
 const document={getElementById:id=>elements[id]||null,createElement:()=>element()};
 const context={window,document,Promise,Error,console};
 vm.createContext(context);
 vm.runInContext(script,context);
 assert.equal(window.INVENTA_MGMT.isAdmin(),false);
 await assert.rejects(window.INVENTA_MGMT.realApi(),/deshabilitada/);
 await assert.rejects(window.fetch('/cualquier-destino'),/Red deshabilitada/);
 window.INVENTA_BC.commit();
 assert.equal(originalCommitCalled,false);
 assert.match(elements.bcExcelStatus.children.at(-1).textContent,/publicación está deshabilitada/);
});
