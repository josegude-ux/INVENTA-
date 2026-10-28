import test from "node:test";
import assert from "node:assert/strict";
import {buildFixedStockReport,ESTADOS} from "../fixed-stock-08/report.mjs";
import {buildFixedStockXlsx} from "../fixed-stock-08/xlsx.mjs";
import {transitionFixedAssociation} from "../fixed-stock-08/associations.mjs";

const meta=()=>({verifiedByServer:true,authorized:true,stockComplete:true,
 positionsComplete:true,catalogComplete:true,locationsComplete:true,truncated:false,stale:false,
 warehouse:"COR_01_COR",publishedBatchId:"B-1",snapshotId:"S-1",positionsVersion:"P-1",
 sourceFile:"bc.xlsx",exportedAt:"2026-10-27T07:00:00Z",
 importedAt:"2026-10-27T08:00:00Z",publishedAt:"2026-10-27T09:00:00Z",absentStockIsZero:false});
const record=(code,location,quantity,warehouse="COR_01_COR",importId="B-1")=>({
 product_code:code,location_code:location,quantity,warehouse,importId});
function data(){
 return {meta:meta(),products:[
  {code:"00100",description:"Artículo 100",unit:"UD"},
  {code:"00200",description:"Artículo 200",unit:"UD"},
  {code:"00300",description:"Artículo 300",unit:"UD"}],
 locations:[{warehouse:"COR_01_COR",code:"K02",aisle:"K"},
 {warehouse:"COR_01_COR",code:"K10",aisle:"K"}],
 fixed:[{associationId:"F1",warehouse:"COR_01_COR",product_code:"00100",location_code:"K10",active:true},
 {associationId:"F2",warehouse:"COR_01_COR",product_code:"00100",location_code:"K02",active:true},
 {associationId:"F3",warehouse:"COR_01_COR",product_code:"00200",location_code:"K02",active:true},
 {associationId:"F4",warehouse:"COR_01_COR",product_code:"00300",location_code:"K10",active:true}],
 stock:[record("00100","L01","-8"),record("00100","L99","8"),
 record("00200","RESERVA","-12.125"),record("00300","L99","2")]};
}
test("cero por compensación en todas las ubicaciones, dos filas y una referencia",()=>{
 const r=buildFixedStockReport(data());
 assert.equal(r.indicators.zeroReferences,1);
 assert.equal(r.indicators.negativeReferences,1);
 assert.equal(r.indicators.affectedAssociations,3);
 assert.equal(r.indicators.affectedPositions,2);
 assert.deepEqual(r.rows.map(x=>x.location),["K02","K02","K10"]);
 assert.deepEqual(r.rows.filter(x=>x.code==="00100").map(x=>x.quantity),["0","0"]);
});
test("stock negativo total sin multiplicar por posiciones",()=>{
 const x=data();x.fixed.push({associationId:"F5",warehouse:"COR_01_COR",product_code:"00200",location_code:"K10",active:true});
 const r=buildFixedStockReport(x);
 assert.equal(r.indicators.negativeReferences,1);
 assert.equal(r.rows.filter(v=>v.code==="00200").length,2);
 assert.ok(r.rows.filter(v=>v.code==="00200").every(v=>v.quantity==="-12.125"));
});
test("positivo excluido por defecto; listado completo lo incluye",()=>{
 assert.ok(!buildFixedStockReport(data()).rows.some(r=>r.code==="00300"));
 const all=buildFixedStockReport({...data(),filters:{view:"all"}});
 assert.equal(all.rows.find(r=>r.code==="00300").state,ESTADOS.POSITIVO);
});
test("sin líneas de stock no es cero",()=>{
 const x=data();x.stock=x.stock.filter(v=>v.product_code!=="00200");
 const r=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.equal(r.rows[0].state,ESTADOS.SIN_DATOS);
 assert.equal(r.indicators.unreliableAssociations,1);
});
test("ausencia equivale a cero solo bajo certificación expresa",()=>{
 const x=data();x.stock=x.stock.filter(v=>v.product_code!=="00200");
 x.meta.absentStockIsZero=true;
 assert.equal(buildFixedStockReport(x).rows.find(r=>r.code==="00200").quantity,"0");
});
test("lote mezclado invalida el origen completo",()=>{
 const x=data();x.stock[0].importId="B-ANTERIOR";
 const r=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.equal(r.rows.length,4);
 assert.ok(r.rows.every(v=>v.state===ESTADOS.NO_FIABLE));
});
test("stock de otro almacén no se suma ni se publica como fiable",()=>{
 const x=data();x.stock.push(record("00200","K02","500","COR_02_NAR"));
 assert.equal(buildFixedStockReport({...x,filters:{view:"unreliable"}}).rows[0].state,ESTADOS.NO_FIABLE);
});
test("importación caducada y sin verificación de servidor no producen falsos ceros",()=>{
 for(const invalid of [{stale:true},{verifiedByServer:false},{stockComplete:false},{truncated:true}]){
  const x=data();Object.assign(x.meta,invalid);
  assert.equal(buildFixedStockReport({...x,filters:{view:"unreliable"}}).rows.length,4);
 }
});
test("asociación retirada nunca aparece en informe",()=>{
 const x=data();x.fixed[0].active=false;
 assert.equal(buildFixedStockReport(x).rows.filter(r=>r.code==="00100").length,1);
});
test("duplicado activo se rechaza como fuente ambigua",()=>{
 const x=data();x.fixed.push({...x.fixed[0],associationId:"otro"});
 assert.ok(buildFixedStockReport({...x,filters:{view:"unreliable"}}).issues.some(e=>e.includes("duplicada")));
});
test("filtros y orden natural conservan códigos con ceros",()=>{
 const x=data();
 const r=buildFixedStockReport({...x,filters:{view:"all",code:"00100"}});
 assert.deepEqual(r.rows.map(v=>v.location),["K02","K10"]);
 assert.ok(r.rows.every(v=>v.code==="00100"));
});
test("fecha BC, importación y publicación diferenciadas",()=>{
 const r=buildFixedStockReport(data());
 assert.equal(r.rows[0].sourceExportedAt,"2026-10-27T07:00:00Z");
 assert.equal(r.rows[0].importedAt,"2026-10-27T08:00:00Z");
 assert.equal(r.rows[0].publishedAt,"2026-10-27T09:00:00Z");
});
test("retirada y reactivación lógicas con usuario y motivo obligatorios",()=>{
 const x=data().fixed[0],association={...x,revision:1};
 const actor={serverAuthorized:true,userId:"ADMIN",warehouseGrants:["COR_01_COR"]};
 const a=transitionFixedAssociation({association,actor,action:"RETIRAR",reason:"REUBICACION",
  at:"2026-10-28T09:00:00Z",revision:2});
 assert.equal(a.association.active,false);
 assert.equal(a.event.previousState,"ACTIVA");
 const b=transitionFixedAssociation({association:a.association,actor,action:"REACTIVAR",
  reason:"OTROS",otherText:"Revisión aprobada",at:"2026-10-28T10:00:00Z",revision:3});
 assert.equal(b.association.active,true);
 assert.equal(b.event.reasonDetail,"Revisión aprobada");
 assert.equal(association.active,true);
 assert.throws(()=>transitionFixedAssociation({association,actor,action:"RETIRAR",reason:"OTROS",
  at:"2026-10-28T11:00:00Z",revision:4}),/explicación/);
 assert.throws(()=>transitionFixedAssociation({association,actor:{...actor,serverAuthorized:false},
  action:"RETIRAR",reason:"REUBICACION",at:"2026-10-28T11:00:00Z",revision:4}),/Acceso/);
});
function zipEntries(bytes){
 const b=Buffer.from(bytes),out=new Map();let i=0;
 while(i+30<=b.length&&b.readUInt32LE(i)===0x04034b50){
  const size=b.readUInt32LE(i+18),n=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28);
  const name=b.subarray(i+30,i+30+n).toString("utf8");
  const start=i+30+n+e;
  out.set(name,b.subarray(start,start+size).toString("utf8"));i=start+size;
 }
 return out;
}
test("XLSX una hoja; Excel sin fórmulas y sin ceros iniciales perdidos",()=>{
 const r=buildFixedStockReport({...data(),filters:{view:"all"}});
 r.rows[0].description="=HYPERLINK(\"bad\") & <script>";
 const z=zipEntries(buildFixedStockXlsx({report:r,generatedAt:"2026-10-28T12:00:00Z"}));
 assert.equal([...z.keys()].filter(x=>/xl\/worksheets\/sheet\d+.xml/.test(x)).length,1);
 assert.ok(z.get("xl/workbook.xml").includes("Posiciones fijas"));
 const xml=z.get("xl/worksheets/sheet1.xml");
 assert.ok(xml.includes("00100"));
 assert.ok(xml.includes("-12.125"));
 assert.ok(xml.includes("2026-10-27T07:00:00Z"));
 assert.ok(xml.includes("=HYPERLINK("));
 assert.ok(!xml.includes("<f>")&&!xml.includes("<script>"));
});
test("XLSX incluye todas las filas, no solo una página visual",()=>{
 const x=data();x.fixed=[];
 for(let i=0;i<1208;i++)x.fixed.push({associationId:"F"+i,warehouse:"COR_01_COR",
  product_code:"00100",location_code:"K"+String(i).padStart(4,"0"),active:true});
 x.locations=x.fixed.map(v=>({warehouse:"COR_01_COR",code:v.location_code,aisle:"K"}));
 const r=buildFixedStockReport(x),z=zipEntries(buildFixedStockXlsx({report:r}));
 const xml=z.get("xl/worksheets/sheet1.xml");
 assert.equal((xml.match(/<row r=/g)||[]).length,1209);
});
