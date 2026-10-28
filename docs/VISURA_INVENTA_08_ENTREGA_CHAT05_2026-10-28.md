# VISURA INVENTA 08 — entrega para nueva auditoría cruzada del chat 05

**28/10/2026 · Rama propia PR #25 · NO MERGE · NO DEPLOY · NO MIGRACIONES**

## 1. Referencias congeladas
| Origen | HEAD verificado |
| --- | --- |
| Chat 08 / PR #25 al iniciar | `18912ee42cc4464ed306fd73c700325d1dbc95f5` |
| Chat 04 / PR #22, adaptador real auditado y PIN de CI | `7e35f1a748343604166a63388d10fd4c415b8c61` |
| Chat 05 / PR #23 al iniciar | `977885f0105ef782228a781ff2e18093b80c6e78` |
| PR #25 tras corrección funcional y contrato versionado | `57335c83849c222ecba0b833c29e4bc7102dab24` |
| PR #25 final | Consultar HEAD real de rama al concluir documentación |

No hubo escrituras en las ramas #22, #23, #24 o KONTROLA. Los archivos de PR #25 no se solapan por nombre con los de los responsables 04, 05 y 07. Esto no es prueba de integración funcional.

## 2. Defectos reproducidos y resueltos exclusivamente en PR #25
- **05 H-02 / aceptación por omisión:** antes el motor usaba truthiness; `truncated` o `stale` ausentes / mal tipados permitían stock como fiable. Ahora exige `meta.truncated === false` y `meta.stale === false` además de todas las banderas de completitud `=== true`.
- **05 H-03 / certificación booleana:** cadenas `"false"` eran truthy para `authorized` y `verifiedByServer`. Ahora se exige `=== true` y el modo `absentStockIsZero` debe ser booleano explícito.
- **05 H-04 / ubicación BC desconocida:** `stock[].location_code` ya se coteja con todas las ubicaciones certificadas por `(warehouse, location)`. Se permiten ubicaciones **no fijas pero certificadas**; se invalida la instantánea al llegar una ubicación no reconocida.
- **Identidad/revisión de asociaciones:** se exige `associationId` estable, único en el conjunto (incluidas retiradas), `active` booleano y `revision` entero seguro >= 1. No se generan IDs a partir de código/posición históricos.
- **Sobre de arquitectura:** ahora exige `meta.contractVersion === "visura-inventa08-fixed-stock-v1"`, versión de posiciones, snapshot y lote; certifica el orden de fechas exportación→importación→publicación cuando se comunica `stale:false`. No se infiere que una publicación reciente renueve un Excel antiguo.
- **Ficheros de prueba y demo:** se añaden los códigos de ubicaciones BC no fijas al catálogo **ficticio**, las revisiones de asociaciones y la versión de contrato. No se altera ningún dato real.

### Desarrollo y pruebas en PR #25
- Modificados: `fixed-stock-08/report.mjs`, `fixed-stock-08/preview.mjs`, `tests/inventa08-fixed-stock.test.mjs`.
- Añadidos: `tests/inventa08-architecture-v1.test.mjs`, `.github/workflows/inventa08-architecture-contract.yml` y este informe.
- Permanecen intactos: escritor `fixed-stock-08/xlsx.mjs`, estilos y layout, tests visuales existentes, contratos de bajas y PostgreSQL descartable, migraciones históricas 006/008 y todos los archivos de 04/05/07.

## 3. Contrato v1 compartido — compatibilidad probada con el adaptador auténtico
El workflow nuevo hace checkout de la **PR #22 en un directorio exclusivamente de lectura**, fijando el SHA `7e35f1a7` y comprobándolo con `git rev-parse HEAD`. Ejecuta el **adaptador original** `architecture/lib/to-inventa08-fixed-stock-v1.mjs`, no un mapeo ficticio de PREPARA.

Afirmaciones acotadas por la prueba:
- `{meta,products,locations,fixed,stock}`, `contractVersion`, `snapshotId`, `positionsVersion`, `publishedBatchId`, `importId`, `associationId`, `active`, `revision` y fechas de procedencia conservan el shape real de PR22.
- Un SKU fijo en dos posiciones sigue contando como una sola referencia; se suma stock de **todas** las ubicaciones certificadas, también las no fijas. Otros artículos en la misma ubicación permanecen independientes.
- La clasificación negativa/cero, ausencia distinta de cero, lote obsoleto/incompleto, lectura administrativa limitada, sesión ficticia revocada y localización desconocida se contrastan usando el adaptador original.
- El XLSX continúa siendo **una sola hoja** y conserva cantidad con 6 decimales y 11 dígitos enteros (`99999999999.123456`) como texto exacto, sin redondear.
- Las pruebas usan certificados y usuarios **sintéticos**. `serverVerified`, `sessionValid` y `authorized` NO prueban Auth/RLS empresariales: el futuro gateway debe calcularlos en servidor antes de emitir datos.

## 4. Pruebas y CI
- Pruebas Node propias: 38 `test(...)` en `tests/inventa08-fixed-stock.test.mjs`.
- Pruebas cruzadas reales sobre PR22: 7 `test(...)` en `tests/inventa08-architecture-v1.test.mjs`.
- Chromium: diseños 1440/820/390 px y filtros independientes, descarga de hoja única.
- PostgreSQL 16: ensayos descartables ya desarrollados para revisión, historia, concurrencia y roles simulados.
- Evidencia del commit funcional `57335c83`: [Node 40637046221](https://github.com/josegude-ux/INVENTA-/actions/runs/40637046221) SUCCESS; [INVENTA checks 40637046227](https://github.com/josegude-ux/INVENTA-/actions/runs/40637046227) SUCCESS; [Contrato PR22 40637046265](https://github.com/josegude-ux/INVENTA-/actions/runs/40637046265) SUCCESS. La comprobación de Chromium/PG16 debe consultarse también para el HEAD final.

**Registro de reproducción:** el commit `05f551bca2eede86b5c3a5855a98900992d21263` añadió pruebas de los defectos y falló Node (40636684847) *antes* de corregir el motor; después de los cambios las pruebas ya pasan. Hubo un fallo intermedio por capitalización de la palabra «Fechas» en una aserción, corregido en `68d31d30`. Ningún fallo previo se presenta como éxito.

## 5. Riesgos pendientes, propietario y siguiente puerta
- **04 / PR #22:** gateway autenticado real con consulta transaccional coherente, permisos por almacén, revocación por petición y validación de certificados del origen BC. El adaptador JS es solo un contrato y su contexto servidor se simula.
- **04 + migración autorizada:** mapeo sin pérdidas desde `public.fixed_positions`/`public.locations` históricas (sin almacén), migración aditiva, reconciliación del par activo, identidad y revisiones; tabla de eventos append-only y transiciones CAS con actor no suplantable.
- **Integración histórica:** SQL 006 suma por posición y usa `COALESCE` para ceros ficticios; SQL 008 contiene `DELETE` con `p_replace`; `warehouse-management.js`, `consultation-ui.js` y `fixed-positions-import.js` siguen usando rutas antiguas. **No se han modificado**.
- **Importador de BC / PR #18:** auditoría 05 demostró conversión prematura a JS `Number` (valor `99999999999.123456` degradado). El informe 08 conserva texto exacto pero **no puede recuperar** precisión perdida antes del backend; no acreditar stock de ese importador hasta reparación y verificación.
- **Autorización empresarial:** todavía faltan permisos reales, perfiles y RLS, Excel BC auténtico, frescura del documento exportado, backups/restauración, pruebas iPhone/Safari y despliegue por separado. Ninguna de estas acciones está autorizada por esta orden.
- **07 / PR #24 y PREPARA:** preservación de recuento ciego y módulos propios sin exponer BC; no editar estas ramas.

## 6. Operación requerida al chat 05
1. Volver a fijar `HEAD` de PR #25 después de estos cambios. Los tests de #23 `observedGap(...)` codifican **la reproducción del fallo anterior como resultado esperado**. Tras la corrección deben actualizarse las aserciones de aceptación a `NO FIABLE`, nunca atribuir a los tests antiguos un PASS de compatibilidad.
2. Ejecutar pruebas cruzadas del adaptador `to-inventa08-fixed-stock-v1.mjs` desde PR22 SHA exacto, motor actual PR25 SHA exacto, y recuento físico original PR24 fijado por 05 (sin tocar código de 07).
3. Verificar que la fuente de stock es manual BC certificada, sin fallback a campaña física, y que el XLSX usa las filas filtradas sin pérdida decimal.
4. Mantener separados resultados de laboratorio, permisos reales de Supabase, migración productiva y pruebas de dispositivo.
5. Devolver incidencias de arquitectura a **04**, nunca editar PR #22 desde el chat 08.

**Resultado propuesto:** MOTOR 08 ENDURECIDO, COMPATIBLE CON SHAPE V1 A NIVEL DE LABORATORIO; INTEGRACIÓN EMPRESARIAL NO ACTIVADA.
