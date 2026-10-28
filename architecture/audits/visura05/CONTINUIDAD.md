# VISURA 05 — Ensayo independiente de lector y publicador

**Fecha:** 27/10/2026. **Responsable:** chat 05. **Objeto:** una única prueba nueva de lectura coherente en PostgreSQL 16 descartable, derivada del HEAD auditado de INVENTA PR #22 `a6691f789c390e8bd5a3eb35998205970f5931cb`; contrato consumidor KONTROLA PR #76 `fb723501e60597f70197e59cc895818203d2403d`.

## Alcance y límites
Solo SQL de pruebas con fixtures 100% sintéticos y workflow de CI de solo lectura del repositorio. No cambia `architecture/lib`, borradores de arquitectura, RLS de aplicaciones, PR #22, PR #76, Business Central, Supabase, Control de Cargas, Tanques ni las PWA. NO APLICAR EN BASES REALES. Ningún endpoint/RPC se activa. Este ensayo no autentica identidades reales ni certifica el importador XLSX.

## Novedad frente a CI existente
El workflow de PR #22 ya prueba **dos publicadores** y bloqueo por almacén; falta confrontar un **lector que mantiene una instantánea coherente** mientras un segundo actor publica. Esta rama ejecuta el esquema/borradores de PR #22 solo en PostgreSQL 16 desechable y usa sus datos inventados.

1. El lector abre transacción **REPEATABLE READ READ ONLY**, lee lote D4 de COR_01_COR, stock 12.25 y procedencia.
2. Publicador independiente sustituye D4 por F6 (stock 7), con CAS, COMMIT y auditoría.
3. El lector sigue viendo exclusivamente D4, stock 12.25 y el origen del mismo lote (sin mezclar los dos commits). El almacén COR_02_NAR conserva el puntero original.
4. Cerrada la transacción del lector, una lectura nueva ve F6, stock 7 y procedencia congruente. La importación incompleta de COR_02_NAR no se expone.
5. Si alguna aserción falla, el trabajo termina con error. Sin cambiar estado real ni publicar datos.

**Puerta no resuelta:** el `loadSnapshot` real del futuro servidor debe emplear una única transacción o mecanismo equivalente con snapshot coherente; que esta prueba supere PostgreSQL no demuestra que el gateway de producción haya sido construido. También faltan Auth, ACL, fecha acreditada de exportación BC, parser confiable, reconciliación de fijos/ubicaciones, E2E y autorización de activar.

## Continuidad
En este chat se verificaron PR #22 y #76 OPEN/DRAFT/UNMERGED y no hay rama existente VISURA 05. Este es un desarrollo de **pruebas, independiente y aditivo**, nunca una sustitución del propietario de la arquitectura. Tras CI, añadir aquí el run exacto/conclusión y comunicar la puerta al chat 04. Mantener la rama en borrador, sin fusionar ni desplegar.

## Resultados comprobados del primer hito (27/10/2026)
- PR #23 DRAFT/OPEN; commit `d139b4739793d6d1cdb5b9ccc04c779cf87e82a0`. Ensayo propio [GitHub Actions 40576410334](https://github.com/josegude-ux/INVENTA-/actions/runs/40576410334): job `read-race` **SUCCESS**, marcadores `VISURA05_REPEATABLE_READ_SNAPSHOT_OK`, `VISURA05_WRITER_COMMITTED_OK`, `VISURA05_NEW_READ_COMMITTED_BATCH_OK` y `VISURA05_READER_PUBLISHER_RR_ISOLATED_OK` en el log. Regresión original sobre el mismo SHA [GitHub Actions 40576451263](https://github.com/josegude-ux/INVENTA-/actions/runs/40576451263): job `isolated` **SUCCESS**.
- Ensayo V8 de interoperabilidad **no incorporado a GitHub Actions**: 16/16 casos sintéticos ejecutando el adaptador original INVENTA (blob `e26ba75c342ab682aabf5cd7a9da82c1fe251909`) y el clasificador original KONTROLA (blob `db7e0ffebf804751f9461f12c996866354b190ab`), con validador (blob `9c0ae22122063be9ac2f925d8c4585ac3495a1d3`). Cero explícito, stock negativo/decimal, omisión no certificada, omisión certificada, incompletitud de catálogo/ubicaciones/fijos, datos obsoletos, recuentos, lote histórico, almacén cruzado, referencia desconocida, respuesta truncada y línea duplicada.
- El último control negativo que se añade al workflow demuestra que una transacción **READ COMMITTED** puede observar referencias de lotes distintos en SELECT sucesivos mientras otro proceso publica; la prueba se considera válida solo si detecta esta variación controlada. No confundir esa observación con una falla de PostgreSQL.

**No resuelto:** el futuro `loadSnapshot` empresarial NO está implementado. En su futura implementación, debe usar aislamiento real de una sola instantánea para puntero, lote, líneas, catálogo, fijos y acreditaciones. Una ejecución PG verde no concede autorización para activar.

## VISURA 05 — contrato automatizado entre dos repositorios (hito adicional)

- Detectada **KONTROLA PR #80** con HEAD `65a9ddc343921f6be8844476903748a493881a8f`: incorpora el informe de #76 mediante #79 en B01; no reutilizar/mezclar #76 otra vez. El módulo consumidor `src/fixed-position-report.mjs` tiene el **mismo blob** `db7e0ffebf804751f9461f12c996866354b190ab` en #76 y #80.
- La comprobación nueva en `cross-repo-contract.test.mjs` importa directamente los dos **módulos originales** (adaptador INVENTA + clasificador PREPARA) usando checkout explícito de KONTROLA, fijado al SHA de #80. No copia ni modifica la lógica de PREPARA. Todo dato es ficticio; sin conexión a Business Central ni Supabase, sin credenciales, sin servicios de terceros.
- Son **16 ensayos de compatibilidad** y **4 TODO visibles** que requieren intervención de los propietarios de chats 02/04. Los TODO no son aprobaciones de seguridad, y no deben volverse PASS antes de cambios reales en las ramas correspondientes.
- Workflow CI solo sobre la rama VISURA05 o la PR en GitHub con `contents: read`, sin escritura ni ejecución del código de aplicaciones empresariales. Bloquea deriva inesperada de HEAD/archivo consumidor.
- Mantener dependencia técnica documentada con PR #22 y PR #80; si cambian sus versiones, renovar pines tras revisar exactamente el diff y reejecutar la batería. No inferir garantía E2E ni permisos RLS reales de pruebas de JS puro.

## Ampliación de casos de contrato cruzado — 27/10/2026
- Se añaden regresiones específicas de **misma ubicación en dos almacenes**, **artículo sin fija mostrando ubicaciones reales**, **suma precisa de lotes distintos**, **fija desconocida rechazada** y **caducidad opcional (sin inventar fecha)**, usando el mismo contrato fuente y consumidor reales.
- Evidencia independiente y decisiones consolidadas: `architecture/audits/visura05/MATRIZ_ACEPTACION.md`. Las fechas de digest/caducidad de BC continúan pendientes de acreditar.

## Auditoría independiente del chat 08 / INVENTA PR #25 — 28/10/2026
- PR #25 HEAD `18912ee42cc4464ed306fd73c700325d1dbc95f5` (OPEN/DRAFT), 4 workflows SUCCESS en su HEAD. Se auditó código original, docs de continuidad, históricos 006/008 y consumidores. No se modifica la rama del chat 08.
- Se detectó incompatibilidad directa entre el adaptador de PREPARA de PR22 y el contrato INVENTA08 (faltan `active`, `associationId`, `importId`, versiones y certificaciones reales). No inventar un puente sin servidor real.
- Cinco casos de fail-open del motor puro reproducidos con fixtures: ausencia de `truncated` / `stale`, autorización/verifiedByServer como cadenas y ubicación de stock no acreditada. NO es evidencia de fuga productiva; falta el endpoint.
- El inventario físico PR24 cambió DURANTE la auditoría (HEAD `88d7340` -> `4f21611` con cuatro commits nuevos). Reevaluar HEAD/CI posterior antes de afirmar compatibilidad runtime; no editar la rama chat07.
- Informe y matriz: `architecture/audits/visura05/INVENTA08_AUDITORIA_2026-10-28.md`; prueba reproducible CI con checkout de #25 en `architecture/audits/visura05/inventa08-boundary.test.mjs` y workflow nuevo `visura05-inventa08-audit.yml`.
- **Prohibido:** mezclar, desplegar, modificar migraciones 006/008 o RLS/credenciales, tocar recuentos, afirmar validación real de BC. El veredicto es `NECESITA ADAPTACIONES; PR25 AISLADA` hasta resolver las puertas.

## 28/10/2026 — Auditoría conjunta y pruebas originales de PR #24 + #25
- PR24 congelada para test: aace927c20ba642a9d915a574e9f07c7c1221a9d; PR25: 18912ee42cc4464ed306fd73c700325d1dbc95f5. Ambas OPEN/DRAFT/UNMERGED, CI respectivas SUCCESS según informes exactos. PR22 a6691f7 sigue sin aplicarse.
- Archivos propios creados: .github/workflows/visura05-07-08-cross.yml y architecture/audits/visura05/cross-07-08.test.mjs. Los dos checkouts son de solo lectura, fijados al SHA y a hashes Git del código original.
- [CI conjunta 40613434738](https://github.com/josegude-ux/INVENTA-/actions/runs/40613434738): SUCCESS, 14 PASS, 0 FAIL, 6 TODO. Los TODO no se ejecutaron; los datos físicos/BC son exclusivamente sintéticos. No acredita Auth/RLS real.
- Cobertura: no mezcla teoría BC y cantidad física, proyección física no refleja stock BC, cierre histórico independiente, estado de provisional, separación almacenes, V1 y 401/403, pareja, XLSX 1 hoja y dependencias sin acoplamiento.
- Matriz, riesgos, contratos de físico/teoría, fases y reversión en architecture/audits/visura05/INTEGRACION_07_08_2026-10-28.md.
- Siguiente tarea: revisión de responsables 04/07/08 del contrato y adaptador real de servidor; VISURA05 validará nuevos commits sin cambiar ramas ajenas. NO desplegar, fusionar, aplicar SQL, permisos productivos o BC.

## 28/10/2026 — Auditoría adicional del importador PR18
- PR15 y PR16 MERGED; PR18 OPEN, PR19 OPEN/DRAFT. Reproducción directa en código PR18: cantidad original 99999999999.123456 se parsea como Number 99999999999.12346 sin error. No reutilizar este parser como garantía de decimal BC exacto sin corrección de su propietario; no tocar la rama PR18.
- El test cruzado 07/08 incorpora chequeo negativo pinned de PR18 y un TODO explícito de precisión; no se considera PASS de integridad. Ver INTEGRACION_07_08_2026-10-28.md, sección 8.

## Resultado definitivo de esta iteración de auditoría de importador, 28/10/2026
- Test fuente PR18 añadido en branch VISURA05 y ejecutado con PR07/08 original; tras corregir orden del checkout, [CI #40614114479](https://github.com/josegude-ux/INVENTA-/actions/runs/40614114479) SUCCESS: **15 PASS, 0 FAIL, 7 TODO**. De los PASS, uno reproduce un defecto de precisión de PR18 y NO valida el parser.
- CI previa #40614045642 FAILED por orden de checkout de auditoría; se corrigió en commit 4a65dc7a8cc99742044bea6ab1f6a4ba01b8e447 sin tocar fuentes 07/08/18. Ver sección 9 del informe conjunto.

## 28/10/2026 — Auditoría cruzada PREPARA 02 (#76) y Bloque 01 (#75/#80)
- HEAD verificados: K76 `154555fe9990d5347679d23967848c3fc14e6eb4`; K75 `861dce15ea8dceba94e2f370fad8f0155c34e215`; K80 `65a9ddc343921f6be8844476903748a493881a8f`; K79 CLOSED/MERGED en rama B01; arquitectura I22 `e08c45bb68ee029ef48c703d4e7de588db957067`. Ningún merge/despliegue de esta auditoría.
- Confirmada versión faltante `src/fixed-position-contract-v1.mjs` en K80 y precarga de `sw.js`; el admin-fixed-positions actualizado de K76 depende de ella. Sobrescribir admin.mjs, index, document-review y SW desde la rama 76 dañaría o arriesgaría funciones B01.
- Pruebas aisladas propias: `prepara-b01-sw-contract.test.mjs` (VM service worker, 1205 filas, 2 hojas, neto cero, almacen, flags), workflow `visura05-prepara-b01-audit.yml`, [CI 40638245074](https://github.com/josegude-ux/INVENTA-/actions/runs/40638245074) SUCCESS: 64 PASS en cuatro invocaciones, 0 FAIL, 2 TODO. Precarga offline con manifest K80 reproduce falta del nuevo módulo; propuesta de manifest con V1 + versión nueva lo cubre en simulación.
- Browser real Chromium en runner descartable: `prepara-b01-browser.mjs`, `visura05-prepara-b01-browser.yml`; consultar CI de su último HEAD antes de declarar éxito.
- Entrega principal y matriz: `architecture/audits/visura05/PREPARA02_B01_CROSS_AUDIT_2026-10-28.md`. Dar instrucciones a 02/06/04; no modificar ramas KONTROLA ni reimplementar informe. Safari/iPhone y Auth/RLS/BC empresariales siguen pendientes.

## 28/10/2026 — Cierre de navegador Chromium y CI PREPARA B01
- Browser aislado en `architecture/audits/visura05/prepara-b01-browser.mjs` y workflow `visura05-prepara-b01-browser.yml`. El primer escenario CI `40638439334` FAIL por corte de red local insuficiente, no por informe real; se endureció el servidor de prueba en commit `23aa07d034ba59ce2827e54bb856a19c96ea0aaa`. [Chromium CI #40638666089](https://github.com/josegude-ux/INVENTA-/actions/runs/40638666089) SUCCESS, 1 test integral, tres subescenarios, incluyendo preferencia local conservada y activación de caché actualizada.
- [Node/VM #40638245074](https://github.com/josegude-ux/INVENTA-/actions/runs/40638245074) SUCCESS: 64 PASS, 0 FAIL, 2 TODO entre suite nueva/PR75/PR76/PR80. CI #75 exacta recuperada: [40567880740](https://github.com/josegude-ux/KONTROLA/actions/runs/40567880740) SUCCESS.
- El HEAD de arquitectura #22 avanzó a `0d8c444e4b39e1862a241cc1e59949c545c79d84` solo en archivos de documentación respecto a e08c45b. No hay gateway empresarial nuevo demostrado por el ensayo.
- Matriz/conclusión de auditoría en `PREPARA02_B01_CROSS_AUDIT_2026-10-28.md`; responsable 06 debe integrar nuevos blobs del informe y manifest/cache, 02 validar informe, 04 el servidor. NO modificar ramas ajenas, merge, deploy, SQL, RLS, usuario o PWA real.
