# VISURA 05 — Auditoría e integración segura de INVENTA PR #25
**Fecha:** 28/10/2026 · **Propietario:** chat 05, auditoría independiente · **No es autorización de despliegue**

## 1. Objetivo, fuentes y trazabilidad
Auditoría de la funcionalidad aislada de posiciones fijas y stock total teórico de INVENTA PR #25 sin cambiar la rama del chat 08. PR #25 HEAD **18912ee42cc4464ed306fd73c700325d1dbc95f5**, rama feature/visura-inventa-08-fixed-stock-20261028, contra main a0f76ab1b1a6515ac647facbadca84cfe838d8ac: OPEN/DRAFT/UNMERGED, 53 commits, 23 ficheros, ninguno integrado en la navegación actual. Sus **cuatro Actions** sobre ese HEAD figuran SUCCESS: Node [40610333817](https://github.com/josegude-ux/INVENTA-/actions/runs/40610333817), Chromium [40610333713](https://github.com/josegude-ux/INVENTA-/actions/runs/40610333713), regresión [40610333747](https://github.com/josegude-ux/INVENTA-/actions/runs/40610333747), PostgreSQL 16 efímero [40610333678](https://github.com/josegude-ux/INVENTA-/actions/runs/40610333678).

Dependencias comprobadas: arquitectura [PR #22](https://github.com/josegude-ux/INVENTA-/pull/22) a6691f789c390e8bd5a3eb35998205970f5931cb; pruebas VISURA05 [#23](https://github.com/josegude-ux/INVENTA-/pull/23) 686d667dfc2d754434de83a8ae4eee81659e6dc0 (antes de esta auditoría); inventario físico [#24](https://github.com/josegude-ux/INVENTA-/pull/24) dinámico, HA CAMBIADO durante esta inspección de 88d73402ff3c106d5678716669c789dab2805862 a 4f21611d5f17484b008131729c7d7dc60e662a2b (+4 commits, incluyendo inventory-ui/location-view.js, SQL de cierre y docs), CI nuevo en curso. PREPARA [#76](https://github.com/josegude-ux/KONTROLA/pull/76) fb723501e60597f70197e59cc895818203d2403d. El consumidor de #76 ya está incluido funcionalmente en Bloque 01 por la ruta #79/#80; no copiar indiscriminadamente.

Solo existen evidencias de **GitHub, ficheros versionados y CI con fixtures ficticios**. Los metadatos históricos que dicen "migración aplicada" no han sido contrastados con una lectura actual del estado de Supabase. No hay archivo real BC, login Auth real, RLS empresarial contrastada, prueba Safari físico ni instalación de estas PR.

## 2. Evaluación de PR #25: A implementado/probado aislado, B prototipo aislado, C documentado, D dependencia, E autorización
| Requisito funcional | Estado | Evidencia |
| --- | --- | --- |
| Stock TOTAL por artículo con todas las líneas del lote BC del almacén, incluso ubicaciones NO fijas | A | fixed-stock-08/report.mjs:103-106; tests/inventa08-fixed-stock.test.mjs:28-42 |
| Varias asociaciones por artículo y varios artículos por posición | A | report.mjs:108-135; pruebas Node + SQL fijo del chat 08 |
| 1 fila por asociación activa, sin borrar retiras del historial | A/B | report.mjs:108-135; associations.mjs genera transición pura, SQL ficticio historiza; sin persistencia empresarial |
| No duplicar conteo de referencias y total teórico por asociación | A | report.mjs:148-153 y tests:28-42 |
| Cero compensado/negativo/ausencia/no fiable/cero omitido certificado | A | report.mjs:7-24,120-135; tests:28-75; lab/005 |
| Filtrar por referencia, descripción, pasillo, posición, estado, todos | A/B | report.mjs:136-147; preview.mjs y test visual |
| Orden natural pasillo/posición/referencia | A | Intl.Collator('es',{numeric:true}) en report.mjs:4,147 |
| Solo asociaciones activas en el listado, historial de bajas/reactivaciones | A/B | report.mjs:108-135, associations.mjs:4-34, lab/001..004; sin DB real |
| Motivo obligatorio, actor, revisión consecutiva/fecha UTC | A/B | associations.mjs:7-34; lab/002,003,004 |
| XLSX de UNA hoja, todas las filas filtradas, sin fórmulas | A | fixed-stock-08/xlsx.mjs:72-106; tests:124-145; Chromium |
| Fechas BC exportado, importado, publicado y generación distintas | A/B | report.mjs:130-134, XLSX:76-82; exportación real todavía no acreditada |
| Ficha solo lectura sin editar desde listado | B | preview.mjs:30-45, prototipo sin navegación real |
| Responsive escritorio/tablet/móvil | B | preview.css:7-49, prueba Chromium 1440/820/390; no Safari físico |
| Denegación de existencias teóricas a operario | A en SQL simulado / D en backend | lab/007..008 con SET ROLE; no JWT/RLS real |
| Consulta independiente de inventario físico y recuento ciego | B/D | Sin imports ni archivos solapados; falta integrar seguridad y consumidores reales |
| Backend compartido con PR #22 y lectura atómica | C/D | docs/VISURA_INVENTA_08_CONTRATO_LECTURA_Y_RETIRADA.md, no endpoint |
| Migración reversible de asociaciones y consumidores 006/008 | C/E | docs/VISURA_INVENTA_08_COMPATIBILIDAD_HISTORICA.md, no SQL aplicado |

## 3. Hallazgos independientes reproducidos con módulos auténticos
Se evalúan el adaptador de PR #22 (architecture/lib/to-prepara-fixed-read-v1.mjs, blob e26ba75c342ab682aabf5cd7a9da82c1fe251909) y el motor report de #25 (blob 95fd71a6890a6287692b0fc34ca0ea9ed29ac768), **sin modificar ninguno**, con datos ficticios.

**H-01. INCOMPATIBILIDAD DIRECTA DE CONTRATO — CRÍTICA PARA INTEGRACIÓN.**
El adaptador existente tiene destinatario PREPARA, no INVENTA 08. No contiene meta.verifiedByServer, publishedBatchId, snapshotId, positionsVersion ni publishedAt, ni fixed[].associationId/active, ni stock[].importId. Pasarlo directamente al motor 08 produce 0 asociaciones e incidencias de origen: no se debe conectar sin nuevo mapeo de servidor bajo gobierno del chat 04. Una transformación ilustrativa con identificadores y flags **inventados solo en fixture** permite obtener NEGATIVO -2, pero NO acredita integridad ni permite inferir IDs reales de asociaciones.

**H-02. FLAGS INCOMPLETAS — validación insuficiente si se invoca el motor puro directamente.**
fixed-stock-08/report.mjs:29-31 usa \`meta.truncated||meta.stale\`; omitir estas flags se acepta como no truncado/no obsoleto. Solo \`true\` explícito se bloquea. Deben exigirse \`truncated===false\` y \`stale===false\` cuando se declare fiable.

**H-03. FLAGS DE AUTORIZACIÓN NO BOOLEANAS.**
El mismo bloque usa comprobaciones truthy (\`meta.verifiedByServer\`, \`meta.authorized\`); el valor de cadena \`"false"\` se acepta como acreditación en el módulo puro. **No equivale a acceso no autorizado a producción**: falta endpoint y nunca se debe confiar en la propia señal del navegador. Es una defensa en profundidad exigible al contrato del backend.

**H-04. LÍNEA BC CON UBICACIÓN DESCONOCIDA.**
report.mjs:73-95 comprueba lote, almacén, unidad, producto, formato y duplicados, pero no verifica que \`line.location_code\` esté incluida en \`locations\` del almacén certificado. Con ubicación \`UNKNOWN\` en la línea sintética se obtiene stock NEGATIVO -2 y 0 incidencias. Un almacén puede tener stock en ubicaciones NO fijas, pero deben conservarse referencias de ubicación verificables bajo catálogo autorizado; revisar si el contrato requiere todas las ubicaciones de stock en el maestro o una certificación alternativa explícita de cobertura.

**H-05. XLSX de prototipo no es una ruta empresarial.**
El escritor exporta la lista que recibe (una sola hoja, fórmulas escapadas). La autorización y la instantánea completa deben garantizarse antes del escritor, también para conjuntos filtrados mayores que la página visible.

**H-06. FRESCURA BC REAL.**
report.mjs puede mostrar exportedAt opcional pero no acredita ese origen; PR #22 utiliza published_at para cálculo de stale (architecture/lib/to-prepara-fixed-read-v1.mjs:70-76). La publicación reciente no hace reciente un Excel antiguo. Fecha de exportación, importación, publicación y generación son cuatro conceptos independientes.

## 4. Riesgos históricos confirmados desde el código de main, NO desde el estado vivo de la base
| Identificador | Archivo y líneas | Conducta incompatibles | Remediación reservada |
| --- | --- | --- | --- |
| HIST-006-STOCK | supabase/migrations/006_admin_fixed_positions_report.sql:55-79 | Suma por ubicación fija \`line.location_code=f.location_code\`; total no global, \`coalesce(bc.qty,0::numeric)\` inventa cero y \`bc_import_current.singleton\` no distingue almacén | Chat 04 + responsables backend, consulta stock del lote certificado por almacén |
| HIST-006-DELETE | 006:17-52 y warehouse-management.js:423-438 | Trigger registra DELETE, pero la asociación se borra y carece de motivo/revisión | Migración aditiva, estado lógico, evento append-only y UI coordinada |
| HIST-008-REPLACE | supabase/migrations/008_fixed_positions_safe_merge_mode.sql:75-91; fixed-positions-import.js:189-200 | p_replace borra \`fixed_positions\` BC ya no presentes; puede destruir estado necesario | Actualizar importador y semántica de sustitución sin pérdida de historia |
| HIST-CLIENT-RPC | warehouse-management.js:152-160 | Llamadas RPC en bloques de 1000 sin snapshot persistente entre paginaciones | Consulta/coherencia total o paginado estable en backend |
| HIST-CLIENT-UI | warehouse-management.js:204-229,469-495 | Muestra solo 100, \`Number(stock_quantity||0)\` oculta ausente y limita a 3 decimales; exporta CSV completo ignorando el filtro visual, no XLSX de una hoja | Reconciliar filtros, precisión y exportación con motor 08 |
| HIST-CONSULT | warehouse-management.js:108-124 | Si BC no existe, usa \`stock_snapshot\` de campaña para Consulta | NO reutilizar ese fallback en el nuevo stock teórico; preservar Consulta hasta migración aprobada |
| HIST-WH | 008:28-33,61-75 y 006:69-70 | Ubicaciones históricas \`public.locations(code)\` sin almacén; singleton BC | Mapa verificable por almacén y colisiones antes de migrar |
| AUTH-ALTO | Migración 006 y PR #22 | SECURITY DEFINER histórica autorizada con \`internal.is_admin()\`; PR #22 usa user_module_warehouses propuesto, no implantado | Verificar roles/claims/RLS y revocación en futuro servidor, sin afirmar exposición real |

## 5. Matriz de integración y aceptación (estados: COMPATIBLE / REQUIERE ADAPTACIÓN / BLOQUEADO POR DEPENDENCIA / REQUIERE AUTORIZACIÓN / NO VERIFICABLE)
| Componente o contrato | Origen actual | Responsable | Estado comprobado | Compatibilidad con #25 | Riesgo | Dependencia | Acción necesaria | Autorización requerida | Criterio verificable de aceptación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Motor stock total exacto | PR25/report.mjs | 08 | A aislado | COMPATIBLE | Bajo en fixture | BC certificado | Conservar suma por artículo | No en laboratorio | Cero -8+8, negativo, múltiples ubicaciones no fijas |
| Asociación activa e historial | PR25/associations.mjs y SQL lab | 08/04 | B aislado | REQUIERE ADAPTACIÓN | Alto | Maestro compartido, estado versionado | Migración aditiva sin DELETE | Sí, SQL real | Retirada/reactivación atómicas, motivo, actor, revisión, eventos |
| XLSX de hoja única | PR25/xlsx.mjs | 08 | A aislado | COMPATIBLE | Medio por datos | Autorización previa | Mantener 1 hoja y filas filtradas | Integración UI | 1 hoja XML y n filas + cabecera, sin fórmulas |
| Filtros y orden natural | PR25/report.mjs, preview | 08 | A/B aislado | COMPATIBLE | Bajo | Datos validados | No copiar lista antigua | UI tras revisión | Filtrado completo, sin recorte, orden K02/K10 |
| Diseño responsive | PR25/preview.css | 08 | B aislado | COMPATIBLE | Bajo/medio | Integración visual | Verificar en app real | Integración PWA | 1440/820/390, Safari real |
| Catálogo autoritativo | PR22 visura_shared + public.products | 04 | Draft | BLOQUEADO POR DEPENDENCIA | Alto | Contrato de cutover | Mantener fuente INVENTA única | Migración/merge posterior | Mismo código, unidad y descripción, sin catálogo duplicado |
| Almacén de ubicaciones | PR22 warehouse_locations | 04 | Draft | REQUIERE ADAPTACIÓN | Alto | Colisiones legacy | Clave (warehouse,location_code) | Migración real | Dos K02 distintos sin mezcla y backfill auditado |
| Asociaciones por almacén | PR22 warehouse_fixed_positions | 04/08 | Draft sin active/revision | REQUIERE ADAPTACIÓN | Crítico | Estado lógico + IDs estables | Añadir contrato consensuado, no parche unilateral | Revisión de arquitectura y SQL | Identidad inmutable, estados y eventos, pareja única activa |
| Adaptador PREPARA→INVENTA 08 | PR22/to-prepara-fixed-read-v1.mjs | 04 | Desacople confirmado | REQUIERE ADAPTACIÓN | Crítico | Nuevos metadatos y asociaciones | Nuevo shape server específico autorizado | Coordinación 04/08 | Nunca inventar flags, version, active ni IDs |
| Puntero BC por almacén | PR22/bc_current_by_warehouse | 04 | Draft PostgreSQL | BLOQUEADO POR DEPENDENCIA | Alto | Publicación autenticada | Usar puntero vigente y SHA de filas | Migración/gateway | Todo informe desde un lote por warehouse |
| Snapshot transaccional | PR23 PG16 y PR25 lab | 05/04/08 | A solo en PostgreSQL falso | BLOQUEADO POR DEPENDENCIA | Alto | Endpoint real | REPEATABLE READ READ ONLY por informe completo | Backend/integración | Sin mezcla entre pointer/stock/positions tras publish |
| Exportación auténtica BC | PR22 parser callback | 04 | C | BLOQUEADO POR DEPENDENCIA | Alto | XLSX real, hash original y fecha | Validación manual desde bytes firmados | Datos reales/servidor | SHA, conteos, exportación acreditada, sin API BC |
| Flags explícitas/ubicación en stock | PR25/report.mjs:29-95 | 08 | 5 casos aislados reproducidos | REQUIERE ADAPTACIÓN | Alto por fail-open de motor puro | Verificación 08 | Endurecer flags y pertenencia de ubicaciones | No para rama 08 si responsable acepta | Ausencia/valor no booleano da NO FIABLE; ubicación ajena da NO FIABLE |
| Permisos admin INVENTA | PR22 ACL propuesta, PR25 SQL ficticio | 04 | B laboratorio | BLOQUEADO POR DEPENDENCIA | Crítico | Auth y revocación real | Verificar sesión/módulo/warehouse antes de leer | Sí, Auth/RLS | Operario 403 sin teoría; administrador limitado; revocado 403 |
| Separación recuento ciego | PR24 inventory-core | 07 | A aislado | COMPATIBLE en archivos, NO VERIFICABLE en runtime | Crítico | Integración PWA | Sin stock teórico para operarios, test E2E | Prueba integrada | Escaneo/recuento no muestran cifras, campañas intactas |
| Migración antigua 006 | main SQL y RPC | Integración/04 | Código real histórico | REQUIERE ADAPTACIÓN | Crítico | Consumidores vivos | Crear RPC nueva; no sustituir a ciegas | SQL productivo | Total por artículo, ausencia no cero, almacén correcto |
| Migración antigua 008 | main SQL p_replace | Integración/04 | Código histórico | REQUIERE ADAPTACIÓN | Crítico | Backfill historial | Reconciliación no destructiva | SQL productivo | Reemplazo registra retiros y eventos sin DELETE |
| Gestión/Consulta | main warehouse-management.js | Integración/08 | Código histórico | REQUIERE ADAPTACIÓN | Alto | UI y nuevas RPC | Sustituir acciones atómicamente tras pruebas | Navegación/despliegue | Marcado/retirada desde ambas pantallas con motivos y eventos |
| PREPARA informe | KONTROLA PR76 / PR80 | 02 | A aislado | COMPATIBLE concepto; NO copiar contrato | Medio | Shape diferente | Reusar solo patrones validados | Coordinación | Una hoja INVENTA, cantidades totales BC certificadas |
| CI / pruebas sin producción | PR25 y PR23 | 05/08 | A ejecutado en GH Actions | COMPATIBLE | Bajo en fixture | Sin acceso empresarial | Mantener pines y documentar SHA | No | Todas suites nuevas y anteriores PASS con datos ficticios |
| Integración/rollback empresarial | Plan de corte | 04 + responsables | C | REQUIERE AUTORIZACIÓN | Alto | Backup, inventario de RLS, piloto y QA | Cutover progresivo, feature flags, reversión verificada | Sí, específica | Puertas por etapa y copia restaurable comprobada |

## 6. Plan reversible, responsables y puertas
**FASE A — Auditoría de cambios:** VISURA05 verifica PR25, PR24, PR22, PR23, migraciones 006/008 y consumidores; mantiene los HEAD exactos y pruebas; sin edición ajena.

**FASE B — Conciliación de contratos:** chat 04 lidera fuente única de catálogo, almacenes, lote, metadatos, versión e identidad de asociación. Chat 08 revisa reglas estrictas en su propio motor. Chat 07 valida preservación de recuento ciego. PREPARA chat 02 solo presta patrones ya probados, sin copia ni segunda base.

**FASE C — Laboratorio descartable cruzado:** ejecutar módulos originales fijados y PostgreSQL aislado con estados/revisiones versionadas, stock BC y seguridad simulada. Registrar tanto casos positivos como hallazgos, sin convertir éxito de laboratorio en seguridad empresarial.

**FASE D — Diseño de migración reversible:** mapear public.fixed_positions, public.locations, public.bc_import_current y migraciones 006/008 hacia modelos compartidos con claves por almacén; detectar colisiones, crear respaldo y recuperación, conciliación de importadores y consumidores, sin DELETE final hasta verificación. NO aplicar SQL ahora.

**FASE E — Autenticación/verificación:** Auth real, revocación por persona/terminal/almacén, RLS, sesión verificada, permisos lectura/escritura, denies para operadores físicos, no confiar en flags cliente. Prueba con usuarios ficticios autorizados en entorno destinado al ensayo, no permisos productivos.

**FASE F — Pruebas integradas autorizadas:** Excel BC auténtico proporcionado por usuario y entornos consentidos; validar fichero, SHA, fecha exportación, lote y almacén, exportación XLSX, iPhone/Safari físico, flujo inventario ciego y gestión.

**FASE G — Integración y despliegue separados:** revisión independiente, freeze de ramas/PR, backup restaurado en ensayo, plan de rollback/feature flag, autorización explícita de migración, merge, despliegue y habilitación de claves. Ninguna acción automática de VISURA05.

## 7. Veredicto
**NECESITA ADAPTACIONES — MANTENER AISLADA PR #25.** Las funciones del dominio son aptas para pruebas independientes, pero la arquitectura PR #22 no aporta aún el contrato exacto de INVENTA08, el legacy 006/008 incumple semántica de stock total e historial, no hay autenticación ni parser BC acreditados, y el recuento ciego de PR24 no ha sido probado en integración. Las puertas no se levantan por CI verde.

### Próxima tarea propia VISURA05
Ejecutar el test de contrato mixto en rama propia PR23, fijado al HEAD de PR25; continuar auditando CI y cambios exclusivamente para nuevos commits, comunicar hallazgos a responsables y conservar evidencia. No alterar PR22, PR24, PR25 ni PREPARA.
