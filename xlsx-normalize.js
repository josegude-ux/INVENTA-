/* INVENTA · Normalización de Excel exportados por Business Central.
   BC genera .xlsx válidos pero con el espacio de nombres principal prefijado (<x:workbook>, <x:sheets>)
   y rutas absolutas en las relaciones (Target="/xl/..."). ExcelJS no reconoce esa forma y falla con
   "undefined is not an object (evaluating 'e.sheets')". Este módulo reescribe solo esos detalles, sin
   tocar valores, y devuelve el archivo original intacto si no lo necesita. */
(function(root){
'use strict';
var MAIN_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
var CRC_TABLE=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes){var c=0xFFFFFFFF;for(var i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
async function inflateRaw(bytes){
 if(typeof DecompressionStream==='undefined')throw Error('Este navegador no puede descomprimir el Excel. Actualiza el sistema o usa otro navegador.');
 var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZip(buffer){
 var u8=new Uint8Array(buffer),dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),eocd=-1;
 for(var i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
 if(eocd<0)throw Error('El archivo no es un Excel .xlsx válido.');
 var count=dv.getUint16(eocd+10,true),p=dv.getUint32(eocd+16,true),entries=[],dec=new TextDecoder();
 for(var n=0;n<count;n++){
  if(dv.getUint32(p,true)!==0x02014b50)throw Error('Directorio del Excel dañado.');
  var method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),
   elen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),loff=dv.getUint32(p+42,true);
  var name=dec.decode(u8.subarray(p+46,p+46+nlen));
  var start=loff+30+dv.getUint16(loff+26,true)+dv.getUint16(loff+28,true),raw=u8.subarray(start,start+csize),data;
  if(method===0)data=raw.slice();else if(method===8)data=await inflateRaw(raw);
  else throw Error('Compresión no admitida en el Excel ('+method+').');
  entries.push({name:name,data:data});p+=46+nlen+elen+clen;
 }
 return entries;
}
function writeZip(entries){
 var enc=new TextEncoder(),locals=[],centrals=[],offset=0;
 entries.forEach(function(e){
  var name=enc.encode(e.name),crc=crc32(e.data),size=e.data.length;
  var lh=new DataView(new ArrayBuffer(30));
  lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);
  lh.setUint32(14,crc,true);lh.setUint32(18,size,true);lh.setUint32(22,size,true);lh.setUint16(26,name.length,true);
  var ch=new DataView(new ArrayBuffer(46));
  ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);
  ch.setUint32(16,crc,true);ch.setUint32(20,size,true);ch.setUint32(24,size,true);ch.setUint16(28,name.length,true);ch.setUint32(42,offset,true);
  locals.push(new Uint8Array(lh.buffer),name,e.data);centrals.push(new Uint8Array(ch.buffer),name);
  offset+=30+name.length+size;
 });
 var cdSize=centrals.reduce(function(s,b){return s+b.length;},0),end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);
 end.setUint32(12,cdSize,true);end.setUint32(16,offset,true);
 var parts=locals.concat(centrals,[new Uint8Array(end.buffer)]),total=parts.reduce(function(s,b){return s+b.length;},0),out=new Uint8Array(total),pos=0;
 parts.forEach(function(b){out.set(b,pos);pos+=b.length;});
 return out.buffer;
}
function relativeTarget(relsPath,target){
 if(target.charAt(0)!=='/')return target;
 var base=relsPath.replace(/_rels\/[^/]*$/,'').split('/').filter(Boolean),dest=target.slice(1).split('/');
 var i=0;while(i<base.length&&i<dest.length-1&&base[i]===dest[i])i++;
 var up=base.slice(i).map(function(){return '..';});
 return up.concat(dest.slice(i)).join('/');
}
function fixXml(name,text){
 var t=text.replace(/^﻿/,'');
 var m=t.match(/xmlns:([A-Za-z_][\w.-]*)="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/);
 if(m){
  var p=m[1].replace(/[.]/g,'\\.');
  t=t.replace(new RegExp('<(/?)'+p+':','g'),'<$1').replace('xmlns:'+m[1]+'="'+MAIN_NS+'"','xmlns="'+MAIN_NS+'"');
 }
 if(/\.rels$/.test(name))t=t.replace(/Target="(\/[^"]*)"/g,function(_,tg){return 'Target="'+relativeTarget(name,tg)+'"';});
 return t;
}
function needsFix(entries){
 var dec=new TextDecoder();
 return entries.some(function(e){
  if(!/\.(xml|rels)$/.test(e.name))return false;
  var head=dec.decode(e.data.subarray(0,4096));
  return /xmlns:[A-Za-z_][\w.-]*="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/.test(head)||(/\.rels$/.test(e.name)&&/Target="\//.test(head));
 });
}
async function normalize(buffer){
 var entries=await readZip(buffer);
 if(!needsFix(entries))return {buffer:buffer,changed:false};
 var dec=new TextDecoder(),enc=new TextEncoder();
 entries=entries.map(function(e){
  if(!/\.(xml|rels)$/.test(e.name))return e;
  return {name:e.name,data:enc.encode(fixXml(e.name,dec.decode(e.data)))};
 });
 return {buffer:writeZip(entries),changed:true};
}
var api={normalize:normalize,readZip:readZip,writeZip:writeZip,fixXml:fixXml,relativeTarget:relativeTarget,crc32:crc32};
root.INVENTA_XLSX=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
