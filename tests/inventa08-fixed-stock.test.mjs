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
 x.meta.zeroOmissionRuleId="BC-CERTIFICADA-EXCLUYE-CEROS";
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


test("fail closed: nunca se muestra asociación fija de otro almacén, ni como NO FIABLE",()=>{
 const x=data();
 x.fixed.push({associationId:"EXTERNA",warehouse:"COR_02_NAR",
  product_code:"CODIGO_RESERVADO",location_code:"Z99",active:true});
 x.products.push({code:"CODIGO_RESERVADO",description:"Solo otro almacén",unit:"UD"});
 const r=buildFixedStockReport({...x,filters:{view:"all"}});
 assert.equal(r.rows.length,4);
 assert.equal(r.rows.some(row=>row.code==="CODIGO_RESERVADO"),false);
 assert.ok(r.issues.some(issue=>issue.includes("almacén ajeno")));
 assert.ok(r.rows.every(row=>row.state===ESTADOS.NO_FIABLE));
});

test("control de filas BC detecta lote truncado y jamás declara cero acreditado",()=>{
 const x=data();x.meta.expectedStockRows=x.stock.length+1;
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.equal(report.rows.length,4);
 assert.ok(report.rows.every(r=>r.state===ESTADOS.NO_FIABLE&&r.quantity===null));
 assert.ok(report.issues.some(e=>e.includes("expectedStockRows")));
});
test("control de posiciones activas detecta importación parcial",()=>{
 const x=data();x.meta.expectedFixedRows=5;
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(e=>e.includes("posiciones activas")));
 assert.equal(report.indicators.unreliableAssociations,4);
});
test("cantidades convertidas por cliente a Number no pueden acreditarse",()=>{
 const x=data();x.stock[1].quantity=0.1;
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(e=>e.includes("texto decimal exacto")));
 assert.ok(report.rows.every(r=>r.state===ESTADOS.NO_FIABLE));
});
test("unidad de stock diferente de la del artículo requiere conversión certificada",()=>{
 const x=data();x.stock[0].unit="CJ";
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(e=>e.includes("Unidad de stock distinta")));
 assert.ok(report.rows.every(r=>r.quantity===null));
});
test("maestro duplicado no reemplaza silenciosamente unidades o descripciones",()=>{
 const x=data();x.products.push({...x.products[0],unit:"CAJA"});
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(e=>e.includes("duplicado")));
 assert.equal(report.rows.length,4);
});
test("ubicaciones ambiguas en el mismo almacén hacen no fiable la fuente",()=>{
 const x=data();x.locations.push({...x.locations[0],aisle:"Z"});
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(e=>e.includes("Ubicación duplicada")));
});
test("stock exacto con 24 decimales se compensa sin redondeos",()=>{
 const x=data();
 x.stock[0].quantity="-0.000000000000123456789012";
 x.stock[1].quantity="0.000000000000123456789012";
 assert.equal(buildFixedStockReport(x).rows.find(r=>r.code==="00100").quantity,"0");
});
test("no se crean ceros si falta la unidad de catálogo",()=>{
 const x=data();x.products[0].unit="";
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.equal(report.rows.length,4);
 assert.ok(report.issues.some(e=>e.includes("sin unidad")));
});

test("referencia fija huérfana no permite publicar otras filas como fiables",()=>{
 const x=data();x.products=x.products.filter(p=>p.code!=="00200");
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(v=>v.includes("Posición fija sin artículo")));
 assert.ok(report.rows.every(r=>r.state===ESTADOS.NO_FIABLE));
});
test("posición fija sin ubicación certificada invalida instantánea completa",()=>{
 const x=data();x.locations=x.locations.filter(v=>v.code!=="K10");
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.equal(report.rows.length,4);
 assert.ok(report.issues.some(v=>v.includes("Posición fija sin artículo o ubicación")));
});

test("doble línea BC del mismo artículo, ubicación y lote bloquea un total inflado",()=>{
 const x=data();
 x.stock.push({...x.stock[0],quantity:"200",lot:""});
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(v=>v.includes("duplicada por artículo")));
 assert.ok(report.rows.every(r=>r.quantity===null&&r.state===ESTADOS.NO_FIABLE));
});
test("dos lotes distintos de una ubicación sí se acumulan con exactitud",()=>{
 const x=data();
 x.stock=x.stock.filter(v=>v.product_code!=="00200");
 x.stock.push({...record("00200","RESERVA","-7.5"),lot:"L1"});
 x.stock.push({...record("00200","RESERVA","-4.625"),lot:"L2"});
 const report=buildFixedStockReport(x);
 assert.equal(report.rows.find(r=>r.code==="00200").quantity,"-12.125");
});

test("XLSX conserva decimal de más de 15 cifras como texto exacto",()=>{
 const x=data();
 const precision="0.000000123456789012345678901";
 x.stock[0].quantity=precision;
 x.stock[1].quantity="0";
 const report=buildFixedStockReport({...x,filters:{view:"all"}});
 assert.equal(report.rows.find(v=>v.code==="00100").quantity,precision);
 const xml=zipEntries(buildFixedStockXlsx({report})).get("xl/worksheets/sheet1.xml");
 assert.ok(xml.includes(precision));
 assert.match(xml,/<c r="E\d+" t="inlineStr"><is><t xml:space="preserve">0\.000000123456789012345678901<\/t>/);
 assert.ok(!xml.includes("<f>"));
});

test("referencia parcial y descripción independiente respetan el resultado y XLSX",()=>{
 const report=buildFixedStockReport({...data(),filters:{code:"001",description:"100",view:"all"}});
 assert.equal(report.rows.length,2);
 assert.ok(report.rows.every(r=>r.code==="00100"));
 const empty=buildFixedStockReport({...data(),filters:{code:"001",description:"200",view:"all"}});
 assert.equal(empty.rows.length,0);
 const xml=zipEntries(buildFixedStockXlsx({report})).get("xl/worksheets/sheet1.xml");
 assert.equal((xml.match(/<row r=/g)||[]).length,3);
});

test("ausencia sin regla documentada no puede acreditarse como cero",()=>{
 const x=data();x.stock=x.stock.filter(v=>v.product_code!=="00200");
 x.meta.absentStockIsZero=true;
 const report=buildFixedStockReport({...x,filters:{view:"unreliable"}});
 assert.ok(report.issues.some(v=>v.includes("regla BC")));
 assert.ok(report.rows.every(r=>r.quantity===null&&r.state===ESTADOS.NO_FIABLE));
});

test("transiciones rechazadas si se salta la revisión o la hora UTC es inválida",()=>{
 const association={...data().fixed[0],revision:1};
 const actor={serverAuthorized:true,userId:"ADMIN",warehouseGrants:["COR_01_COR"]};
 const args={association,actor,action:"RETIRAR",reason:"REUBICACION",at:"2026-10-28T12:00:00Z",revision:2};
 assert.throws(()=>transitionFixedAssociation({...args,revision:100}),/revisión consecutiva/);
 assert.throws(()=>transitionFixedAssociation({...args,at:"2026-02-30T12:00:00Z"}),/Fecha UTC/);
 assert.throws(()=>transitionFixedAssociation({...args,at:"2026-10-28T12:00:00+02:00"}),/Fecha UTC/);
 const valid=transitionFixedAssociation(args);
 assert.equal(valid.event.revision,2);
 assert.equal(association.revision,1);
});
