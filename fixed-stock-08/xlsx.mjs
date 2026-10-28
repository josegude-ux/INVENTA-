/* VISURA INVENTA 08 — adaptado del escritor OOXML de PREPARA PR #76.
 * Una sola hoja; no extraer stock por posición ni ejecutar fórmulas externas. */
const enc=new TextEncoder();
const utf=value=>enc.encode(String(value));
const MAX_EXCEL_CELL=32767;
const text=value=>{
  const str=String(value??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,"");
  return str.length>MAX_EXCEL_CELL?str.slice(0,MAX_EXCEL_CELL):str;
};
const xml=value=>text(value).replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"
}[c]));
const col=n=>{let out="";while(n){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out;};
const crcTable=Array.from({length:256},(_,n)=>{
  let v=n;for(let i=0;i<8;i++)v=v&1?(v>>>1)^0xedb88320:v>>>1;
  return v>>>0;
});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=(c>>>8)^crcTable[(c^b)&255];return (c^0xffffffff)>>>0;}
function short(v){const x=new Uint8Array(2);new DataView(x.buffer).setUint16(0,v,true);return x;}
function long(v){const x=new Uint8Array(4);new DataView(x.buffer).setUint32(0,v,true);return x;}
function join(parts){
  const length=parts.reduce((n,p)=>n+p.length,0),buffer=new Uint8Array(length);
  let offset=0;for(const part of parts){buffer.set(part,offset);offset+=part.length;}
  return buffer;
}
function zipStore(items){
  if(items.length>65535)throw Error("Demasiados archivos XLSX.");
  const chunks=[],central=[];let offset=0;
  for(const [path,body] of items){
    const filename=utf(path),bytes=utf(body),sum=crc32(bytes);
    if(bytes.length>0xffffffff||offset>0xffffffff)throw Error("Informe XLSX demasiado grande.");
    const common=[short(0x0800),short(0),short(0),short(0),long(sum),
      long(bytes.length),long(bytes.length),short(filename.length)];
    const local=join([long(0x04034b50),short(20),...common,short(0),filename,bytes]);
    const directory=join([long(0x02014b50),short(20),short(20),...common,
      short(0),short(0),short(0),short(0),long(0),long(offset),filename]);
    chunks.push(local);central.push(directory);offset+=local.length;
  }
  const centralBody=join(central);
  const footer=join([long(0x06054b50),short(0),short(0),short(items.length),short(items.length),
    long(centralBody.length),long(offset),short(0)]);
  return join([...chunks,centralBody,footer]);
}
function excelDecimal(value){
  const s=String(value??"");
  if(!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(s))return null;
  // Excel representa aproximadamente 15 dígitos significativos. Fuera
  // de este límite conservamos exactamente el stock como texto.
  const significant=s.replace(/^-|\.|^0+/g,"").replace(/^0+/,"");
  return significant.length<=15?s:null;
}
function worksheet(records,numericColumns=new Set()){
  if(records.length>1048576)throw Error("La hoja supera el límite Excel de 1.048.576 filas.");
  let rows="";
  for(let index=0;index<records.length;index++){
    const r=index+1;
    const cells=records[index].map((value,j)=>{
      const ref=col(j+1)+r;
      const n=numericColumns.has(j)&&index>0?excelDecimal(value):null;
      return n!==null?'<c r="'+ref+'"><v>'+n+'</v></c>':
        '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
    }).join("");
    rows+='<row r="'+r+'">'+cells+'</row>';
  }
  const last=col(records.reduce((m,r)=>Math.max(m,r.length),1));
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<dimension ref="A1:'+last+records.length+'"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="15"/><sheetData>'+rows+'</sheetData></worksheet>';
}

export function buildFixedStockXlsx({report,generatedAt=report?.meta?.generatedAt||new Date().toISOString()}={}){
 if(!report||!report.meta||!report.warehouse||!Array.isArray(report.rows))
  throw Error("Informe sin procedencia certificada");
 if(report.rows.length>1048575)throw Error("Máximo 1.048.575 asociaciones por archivo");
 const header=["Pasillo","Posición fija","Referencia","Descripción","Stock total teórico",
  "Estado","Unidad","Almacén/ámbito","Archivo BC","Fecha exportación BC",
  "Fecha importación","Fecha publicación","Fecha generación"];
 const records=[header,...report.rows.map(r=>[r.aisle,r.location,r.code,r.description,
  r.quantity??"SIN DATOS",r.state,r.unit,r.warehouse,r.sourceFile,
  r.sourceExportedAt||"No acreditada",r.importedAt||"No acreditada",
  r.publishedAt||"No acreditada",generatedAt])];
 const contentTypes='<?xml version="1.0" encoding="UTF-8"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
  '</Types>';
 const rels='<?xml version="1.0" encoding="UTF-8"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
  '</Relationships>';
 const book='<?xml version="1.0" encoding="UTF-8"?>'+
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
  '<sheets><sheet name="Posiciones fijas" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const bookRels='<?xml version="1.0" encoding="UTF-8"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
  '</Relationships>';
 return zipStore([
  ["[Content_Types].xml",contentTypes],["_rels/.rels",rels],
  ["xl/workbook.xml",book],["xl/_rels/workbook.xml.rels",bookRels],
  ["xl/worksheets/sheet1.xml",worksheet(records,new Set([4]))]
 ]);
}
