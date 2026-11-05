/* PREVISUALIZACIÓN INVENTA 08: datos exclusivamente sintéticos, sin acceso remoto. */
import {buildFixedStockReport} from "./report.mjs";
import {buildFixedStockXlsx} from "./xlsx.mjs";
const $=id=>document.getElementById(id);
const warehouse="COR_01_COR",batchId="SYNTHETIC";
const meta={warehouse,verifiedByServer:true,authorized:true,stockComplete:true,
 positionsComplete:true,catalogComplete:true,locationsComplete:true,truncated:false,stale:false,
 publishedBatchId:batchId,snapshotId:"SYNTHETIC-S1",positionsVersion:"SYNTHETIC-P1",
 contractVersion:"visura-inventa08-fixed-stock-v1",
 sourceFile:"EJEMPLO_FICTICIO.xlsx",exportedAt:"2026-10-27T08:00:00Z",
 importedAt:"2026-10-27T09:00:00Z",publishedAt:"2026-10-27T10:00:00Z",absentStockIsZero:false};
const products=[
 {code:"00100",description:"Artículo demostración A",unit:"UD"},
 {code:"00200",description:"Artículo demostración B",unit:"UD"},
 {code:"00300",description:"Artículo demostración C",unit:"UD"},
 {code:"00400",description:"Artículo sin líneas BC",unit:"UD"}];
const positions=["K02","K10","A01","A10","B03"];
const locations=[...positions,...["OTRA-1","OTRA-2","RESERVA","OTRA-3"]].map(code=>({warehouse,code,aisle:code[0]}));
const fixed=[
 ["00100","K02"],["00100","K10"],["00200","K02"],
 ["00300","A10"],["00400","A01"],["00200","B03"]
].map(([product_code,location_code],n)=>({associationId:"F"+(n+1),warehouse,product_code,location_code,active:true,revision:1}));
const stock=[
 ["00100","OTRA-1","-8"],["00100","OTRA-2","8"],
 ["00200","RESERVA","-12.25"],["00300","OTRA-3","19"]
].map(([product_code,location_code,quantity])=>({warehouse,importId:batchId,product_code,location_code,quantity}));
const snapshot={meta,products,locations,fixed,stock};
const controls=["search","code","description","aisle","location","state","view"];
let currentReport=null;
const mk=(tag,text,classname)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text??"");if(classname)n.className=classname;return n;};
function addButton(container,row){
 const button=mk("button","Abrir ficha","secondary");button.type="button";
 button.addEventListener("click",()=>openDetail(row));container.append(button);
}
function openDetail(row){
 $("listing").classList.add("hidden");$("detail").classList.remove("hidden");
 const body=$("detailText");body.replaceChildren();
 for(const [label,value] of [["Artículo",row.code],["Descripción",row.description],
  ["Almacén",row.warehouse],["Posición fija",row.location],["Pasillo",row.aisle],
  ["Stock teórico total",row.quantity??"Sin datos"],["Estado",row.state],
  ["Origen Excel",row.sourceFile],["Fecha exportación BC",row.sourceExportedAt??"No acreditada"]]){
  const p=mk("p");p.append(mk("strong",label+": "),document.createTextNode(String(value)));
  body.append(p);
 }
 $("back").focus();
}
function render(){
 const filters={search:$("search").value,code:$("code").value,description:$("description").value,
  aisle:$("aisle").value.trim().toUpperCase(),
  location:$("location").value.trim().toUpperCase(),state:$("state").value,view:$("view").value};
 const report=buildFixedStockReport({...snapshot,filters});currentReport=report;
 const m=report.indicators;
 $("mZero").textContent=m.zeroReferences;
 $("mNegative").textContent=m.negativeReferences;
 $("mAssociations").textContent=m.affectedAssociations;
 $("mPositions").textContent=m.affectedPositions;
 $("mUnreliable").textContent=m.unreliableAssociations;
 $("resultCount").textContent=report.rows.length+" asociaciones filtradas · stock total por artículo en "+warehouse;
 $("reportRows").replaceChildren();$("reportCards").replaceChildren();
 for(const row of report.rows){
  const tr=mk("tr");
  for(const val of [row.aisle,row.location,row.code,row.description,row.quantity??"SIN DATOS",row.state]){
   const td=mk("td",val, val===row.quantity?"num "+(row.state==="NEGATIVO"?"negative":"zero"):"");
   tr.append(td);
  }
  const td=mk("td");addButton(td,row);tr.append(td);$("reportRows").append(tr);
  const card=mk("article",undefined,"card");
  const top=mk("div",undefined,"cardHead");
  top.append(mk("span",row.location+" · "+row.code),mk("span",row.state,"pill"));card.append(top);
  card.append(mk("p",row.description));
  const detail=mk("div",undefined,"cardLine");
  detail.append(mk("span","Stock total · "+row.unit),mk("strong",row.quantity??"SIN DATOS",row.state==="NEGATIVO"?"negative":"num"));
  card.append(detail);addButton(card,row);$("reportCards").append(card);
 }
}
for(const id of controls)$(id).addEventListener(id==="search"||id==="code"||id==="description"||id==="aisle"||id==="location"?"input":"change",render);
$("back").addEventListener("click",()=>{
 $("detail").classList.add("hidden");$("listing").classList.remove("hidden");
 $("search").focus();
});
$("export").addEventListener("click",()=>{
 if(!currentReport)return;
 const bytes=buildFixedStockXlsx({report:currentReport});
 const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="VISURA_INVENTA_08_DEMO_SINTETICA.xlsx";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
