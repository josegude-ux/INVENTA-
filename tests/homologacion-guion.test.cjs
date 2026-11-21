'use strict';
// Guion de homologación de «Mi tramo» (R2): debe apuntar a la versión publicada y a archivos que existen.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const doc=fs.readFileSync(path.join(root,'docs/HOMOLOGACION_MI_TRAMO.md'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/homologacion/ficticio_mi_tramo.sql'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version;

test('el guion pide la versión publicada (version.json)',()=>{
 assert.match(doc,new RegExp('Versión a homologar: \\*\\*INVENTA '+version.replace(/\./g,'\\.')+'\\*\\*'));
 assert.match(doc,new RegExp('H01 \\| Todos \\| Ajustes \\| Se ve la versión \\*\\*'+version.replace(/\./g,'\\.')+'\\*\\*'));
});

test('todas las rutas de supabase/, tests/ y docs/ citadas en el guion existen',()=>{
 const paths=[...new Set([...doc.matchAll(/`((?:supabase|tests|docs)\/[^`\s]+)`/g)].map(m=>m[1]))];
 assert.ok(paths.length>=3,'el guion cita sus archivos');
 for(const p of paths)assert.ok(fs.existsSync(path.join(root,p)),'no existe '+p);
});

test('ya no cita la migración de tramos como pendiente',()=>{
 for(const t of [doc,sql])assert.doesNotMatch(t,/visura-unificado-pendiente\/20261118140000_inventa_tramos\.sql/);
 assert.match(sql,/supabase\/visura-unificado\/20261118221403_inventa_tramos\.sql/);
 assert.ok(fs.existsSync(path.join(root,'supabase/visura-unificado/20261118221403_inventa_tramos.sql')));
});

test('la comprobación parcial R1–R5 consta como hecha y no sustituye a H02–H16',()=>{
 for(const r of ['R1','R2','R3','R4','R5'])assert.match(doc,new RegExp('\\| '+r+' \\|[^\\n]*✔ OK'));
 assert.match(doc,/No sustituye a H02–H16/);
 assert.match(doc,/sin pulsar «Asignar tramo»/);
});

test('el script ficticio sigue protegido frente al entorno real',()=>{
 assert.match(sql,/Hay otra campaña activa/);
 assert.match(sql,/NO EJECUTAR en Supabase sin decisión de 000 y «AUTORIZO»/);
});
