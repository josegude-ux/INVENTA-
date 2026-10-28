# VISURA INVENTA 07 — Continuidad de inventario físico

**Fecha de auditoría:** 2026-10-27. **Ámbito:** exclusivamente `josegude-ux/INVENTA-`.
**Rama de este desarrollo:** `feature/visura-inventa-07-domain-20261027`.
**Base verificada de `main`:** `a0f76ab1b1a6515ac647facbadca84cfe838d8ac`.
**Estado:** motor de dominio aislado y probado localmente. No integrado todavía en la PWA ni en Supabase. **NO PUBLICAR ni FUSIONAR automáticamente.**

## Evidencias de continuidad

- Se han leído `docs/CONTINUIDAD.md` de `main`, `.cursor/rules/inventa.mdc`, `README.md`, `real-counts.js`, pruebas y migraciones disponibles. La ficha de `main` fue actualizada el 25/10; no representa todos los trabajos en otras ramas.
- `main` contiene el recuento individual real con cola local e idempotencia; el recuento en pareja, el escáner integrado en recuento real y el teclado anterior siguen separados de la implementación real. La UI de `real-counts.js` utiliza un cálculo antiguo de cuatro factores y no sigue todavía la nueva especificación.
- Existe Supabase INVENTA, independiente del proyecto de Control de Cargas/PREPARA. Lectura de solo metadatos en 27/10: 18 tablas públicas, RLS activado en todas las tablas listadas; nueve migraciones registradas; `counts` sin filas en ese instante; maestros y lotes de importación BC ya existentes. Ningún dato ni permiso fue modificado.
- PR #18 (importador, abierta), #19 (vista previa iPhone, borrador), #20 (identidad comercial, borrador), #22 (arquitectura compartida, borrador) y #23 (ensayo concurrente, borrador) se comprobaron abiertas y sin fusionar a la fecha. NO copiar código ni integrar ninguna por suposición.
- No hay acceso remoto a los worktrees locales o cambios sin commit de otros agentes. Se necesita comprobarlos en su entorno antes de cualquier fusión.
- La estructura **definitiva** del Excel real BC (decisión 15) sigue pendiente: no se inventa mapeo ni se conecta una API directa con BC.

## Primer hito de desarrollo, sin efectos secundarios

Archivos **nuevos**, sin modificar existentes:
- `inventory-core/counting.cjs`: cálculo exacto de unidades sueltas, cajas sueltas y grupos de palés (alturas totales × cajas/base × unidades/caja), cero expreso, campos vacíos distintos del cero, desglose, rechazo de cantidades inválidas y límite compatible con `numeric(16,3)`. No crea fichas obligatorias individuales por palé.
- `inventory-core/workflow.cjs`: guardas puras para inicio persistente de ubicación, finalización manual, revisión de pendientes, asignación correlativa según orden REAL de ubicaciones suministrado, extremos inclusivos, parejas autorizadas, no solapamiento y no traspaso de ubicaciones iniciadas. Resumen físico de pasillo independiente de incidencias administrativas.
- `inventory-core/administration.cjs`: doble escaneo independiente, conflictos de código oficial/alternativo y verificación previa al cierre manual de campaña, sin efectos secundarios.
- `tests/inventa07-domain.test.cjs`: 11 escenarios sintéticos.
- `tests/inventa07-administration.test.cjs`: 4 escenarios sintéticos adicionales. Ejecutar `node --test tests/*.test.cjs` para todas las pruebas y `node --test tests/inventa07-*.test.cjs` para los dos hitos.

**Resultado comprobado localmente:** 15/15 pruebas de dominio y administración con Node.js 22.16.0, 0 fallos. GitHub Actions INVENTA checks: PASS sobre el commit `a5d8a4cbc6074403666e9c80031f6248f624248c`, ejecución `40597962335`; 15/15 pruebas del dominio ejecutadas localmente. Este documento actualizado implica un nuevo HEAD, por lo que la CI volverá a comprobarlo.

### Segundo hito aislado — validación administrativa

Se implementó `inventory-core/administration.cjs` para comprobar dos lecturas distintas exactamente iguales, preservar ceros iniciales, bloquear conflictos entre código oficial y código alternativo interno, y determinar condiciones de cierre general. Son validaciones puras y NO operan sobre datos reales. Se añadieron cuatro pruebas locales, todas correctas. El escaneo real, la evidencia autenticada de cada lectura, la resolución administrativa de provisionales y el cierre transaccional continúan pendientes de integración en servidor.

## Limitaciones expresas

Estas funciones son **reglas puras de demostración técnica** y no constituyen un recuento operativo integrado. En particular:
- No hay todavía conexión de este módulo con `real-counts.js`, PWA, cola offline ni formularios.
- No hay RLS nueva, ni validación transaccional de segmentos, ni doble escaneo de provisionales, ni registro inmutable de correcciones, ni cierre definitivo de campañas: esos controles deberán implementarse y probarse en backend.
- El orden correlativo de ubicaciones se recibe como parámetro; debe venir de un catálogo de ubicaciones real y verificado. No deducir `K00`–`K50` por incrementos inventados en el sistema real.
- Las comprobaciones de autorización en JavaScript **nunca sustituyen** RLS/operaciones atómicas en servidor.
- El diseño responsive y pruebas físicas de móvil, tablet y escritorio siguen pendientes.
- No se ha cargado, cambiado ni publicado ningún dato de Business Central o Supabase. No se han modificado credenciales ni proyectos ajenos.

## Ruta próxima y condiciones de integración

1. Comprobar CI y regresiones de la PR aislada; si hay errores, corregir en la misma rama.
2. Auditar detalladamente el contrato de `counts`, `assignments`, campañas, roles y los conflictos con `real-counts.js`; definir capa de persistencia que soporte borradores, confirmaciones y correcciones, manteniendo lo existente.
3. Añadir pruebas de seguridad y atomicidad contra **PostgreSQL descartable** antes de proponer migraciones no destructivas.
4. Integrar gradualmente el motor físico en UI de recuento real con vista previa, marcado expreso de cero, escáner individual y responsive real; actualizar caché/versionado **solo cuando se autorice una integración compatible** con la rama de branding.
5. Implementar parejas, redistribución, provisionales, incidencias, cierre, rectificaciones e informes según el prompt maestro; mantener el Excel definitivo pendiente hasta recibir muestra auténtica.
6. Someter la integración con otras PR y cualquier cambio en Supabase/productivo a revisión y autorización separadas.

**Regla:** continuar por tareas independientes sin asumir que la arquitectura compartida de #22/#23 esté implantada. No hacer merge, despliegues, migraciones ni operaciones destructivas.


## Continuación verificada — borradores, confirmaciones, pareja y persistencia (27/10/2026)

**Estado real:** módulos de dominio puros y pruebas. NO se han conectado a la PWA, al backend operativo ni a las tablas reales. La verificación CI del HEAD 7fdc1c8c21ba3764b4f799813a38c070228a90a9 fue PASS (run 40599170438); 29 pruebas adicionales de esta ampliación fueron ejecutadas localmente con Node 22 (29/29 PASS) sobre una copia aislada de dependencias compatibles. Para confirmar el conjunto definitivo, CI ejecuta todas las pruebas existentes y nuevas del repositorio.

Archivos NUEVOS incorporados, sin reemplazar archivos existentes:
- inventory-core/count-lifecycle.cjs — borradores por referencia con versión optimista, revisión física previa a confirmar, cero expreso, eventos de confirmación inmutables, propuesta y revisión de corrección, motivo único por operación, valores anterior/nuevo y autor declarado separado de cuenta autenticada. No registrar un evento por cada pulsación de borrador.
- inventory-core/team-session.cjs — integrantes originales de uno o dos operarios, una cuenta autenticada en el terminal, paso pareja/individual sin motivo obligatorio, relevo con nueva sesión, reincorporación de los originales y prohibición de terceros.
- tests/inventa07-lifecycle.test.cjs — 15 pruebas.
- tests/inventa07-team.test.cjs — 9 pruebas.
- tests/inventa07-integrated.test.cjs — 5 pruebas entre equipo, recuento y estado de ubicación.
- docs/VISURA_INVENTA_07_PERSISTENCIA_PROPUESTA.md — contrato de persistencia y seguridad para revisar antes de diseñar una migración, **SIN SQL aplicado**.

La revisión de metadatos de Supabase INVENTA confirmó que la tabla actual public.counts no dispone de estructura completa para estados de borrador, versión de confirmación, equipo original o corrección con autor declarado. NO se han escrito tablas, filas, permisos ni migraciones. Las guardas JavaScript son ensayos de dominio: el cliente NO puede acreditar autenticación ni permisos vigentes, y una futura integración debe aplicar tales verificaciones transaccionalmente en el servidor.

### Concurrencia entre desarrollos

Se observó en la misma rama el commit 31d254735408cfdc8185af3b63efc0e00c12d8fc, que añade inventory-ui/responsive.css. No fue generado por este bloque de recuentos y se ha conservado; su autoría funcional debe contrastarse con el agente correspondiente. Ningún archivo compartido fue sobrescrito. Las PR #18/#19/#20/#22/#23 continúan como dependencias separadas que no deben fusionarse automáticamente.

### Próximo trabajo seguro

1. Auditar contratos servidor actuales y diseñar implementación aditiva de borradores/confirmaciones en entorno desechable, con aislamiento de stock teórico, RLS, CAS e idempotencia. No aplicar a Supabase activa sin aprobación.
2. Probar transacciones con dos usuarios y concurrencia real en PostgreSQL temporal; verificar sesión, equipo y asignaciones antes de escribir cantidades.
3. Solo tras las pruebas del backend, conectar el módulo de recuento a real-counts.js conservando cola/offline y sin editar index.html/manifest/service-worker.js mientras el trabajo de branding esté abierto. Realizar UX responsive verificable por dispositivo.
4. Revalidar CI y conflictos justo antes de proponer integración; no merge, no deploy ni conexión directa con Business Central.


## Hito adicional — rectificaciones posteriores al cierre (27/10/2026)

Nuevos archivos aditivos:
- inventory-core/rectifications.cjs: composición inmutable de resultado original de campaña, expediente independiente pendiente, aprobación/rechazo por Administración, publicación MANUAL de versiones V1/V2..., acumulación de aprobados, identificación de casos incluidos y conflicto explícito cuando dos cambios incompatibles pretenden modificar la misma cantidad.
- tests/inventa07-rectifications.test.cjs: 11 pruebas sintéticas de cierre, autorización, integridad histórica, publicación, rechazo, duplicidad y conflicto. 11/11 locales correctas con Node.js 22.
- Suite de dominio TOTAL a fecha de esta edición: 55 pruebas sintéticas añadidas en los hitos 1–4 (15 iniciales + 15 lifecycle + 9 equipos + 5 integradas + 11 rectificaciones). La suite CI de GitHub valida adicionalmente las pruebas preexistentes; revisar el HEAD final antes de asumir PASS.

Importante: el módulo es lógica pura, **no** es generación de Excel/PDF, expediente guardado en Supabase ni firma real del Administrador. Los indicadores physicalComplete/administrativeReviewed y la identidad de Administración en un contrato JavaScript NO son sustitutos de controles de servidor. Se requieren almacenamiento inmutable, RLS, revisión y prueba de operaciones transaccionales antes de uso real.


## Continuación de backend aislado, seguridad y RLS — 28/10/2026

**Alcance comprobado:** tres contratos SQL sintéticos en \`inventory-lab/\` para borradores/confirmaciones, correcciones justificadas y códigos alternativos administrados. No hay migración activa, integración PWA ni alteración de datos de usuario. No se han realizado commits sobre \`main\`, PREPARA u otras ramas.

**Archivos añadidos:** \`inventory-lab/001_disposable_reference_contract.sql\`, \`002_disposable_correction_contract.sql\`, \`003_disposable_barcode_admin.sql\`, \`tests/sql/inventa07_lab_contract.sql\`, \`inventa07_lab_concurrency.sh\`, \`inventa07_lab_corrections.sql\`, \`inventa07_lab_barcode_admin.sql\` y workflow exclusivo \`.github/workflows/inventa07-ephemeral-db.yml\`.

**Pruebas PASS verificadas:** PostgreSQL 16 descartable (run 40602351353, commit fe782c3dc8a73246d24d83dbb61bfe2681efa4e7) y suite general INVENTA (PASS para ese commit). Ejercitados: cero explícito, validación de borrador, revisión de confirmación, denegación de stock teórico, revocación de usuario/asignación, idempotencia, dos conexiones compitiendo por igual versión, corrección revisada y auditada con autor declarado distinto de la cuenta autenticada, códigos alternativos con administración exclusiva, conflicto, desactivación y recuentos históricos preservados. El laboratorio rechaza ejecuciones fuera de la base llamada \`inventa07_test\`. Los fallos iniciales del laboratorio se corrigieron y se revalidaron antes de documentar el PASS. Las dos configuraciones de GitHub Actions (suite general y Postgres temporal) quedan independientes.

**Revisión de Supabase real, solo lectura:** consulta a \`pg_policies\` confirmó que la política \`barcodes_insert\` vigente aún acepta altas de cualquier cuenta habilitada; la nueva decisión exige validación administrativa. \`counts_insert\` sigue admitiendo inserciones sin el nuevo protocolo de revisión. NO se cambiaron estas políticas: hacerlo antes de modificar el cliente rompería la compatibilidad. Ver \`docs/VISURA_INVENTA_07_RLS_AUDIT.md\` y \`docs/VISURA_INVENTA_07_SQL_LAB.md\`.

**Limitaciones explícitas:** las identidades del laboratorio son simuladas con claims de prueba; la autenticación real, validación de session_id, RLS en Supabase, terminal de pareja, acceso entre dos usuarios reales, supresión de recuentos teóricos por toda vía de datos y cierre/rectificaciones definitivos siguen pendientes de integración y pruebas de seguridad. El SQL de laboratorio no es un artefacto de migración listo para producción.

**Siguiente tarea independiente:** diseñar la capa de compatibilidad con \`public.counts\`, \`public.assignments\` y la cola de \`real-counts.js\`, incluyendo un endpoint transaccional autenticado y un plan de migración aditiva sometido a aprobación. Antes de editar UI, contrastar trabajo de PR #20 (branding), #18/#19 (Excel) y #22/#23 (arquitectura). La estructura definitiva del Excel real de BC sigue pendiente; no paraliza el trabajo independiente.

**Restricciones persistentes:** NO MERGE; NO DESPLIEGUE; NO APLICAR SQL A SUPABASE ACTIVA; NO CONECTAR API BC; NO CAMBIAR CREDENCIALES, ROLES NI DATOS REALES. La PR #24 permanece como borrador.

## Cuarto hito de backend aislado — provisionales (28/10/2026)

Archivos nuevos: inventory-lab/004_disposable_provisionals.sql y tests/sql/inventa07_lab_provisionals.sql; workflow PostgreSQL temporal actualizado. Implementan solo en el laboratorio: doble escaneo simulado, rechazo de lecturas no independientes o divergentes, descripción obligatoria, cantidad explícita, provisionales independientes por ubicación, bloqueo de duplicados dentro de la misma ubicación y cola de revisión únicamente administrativa.

Vinculación administrativa manual: el Administrador elige referencia oficial y documenta si el provisional es duplicado o cantidad adicional. La cantidad adicional permanece awaiting_consolidation, sin modificar automáticamente recuentos ni crear artículos oficiales. Ninguna vinculación o sugerencia se ejecuta tras importar Excel.

Pruebas: run 40603077570, commit 1ffe71f412a8e5fb36775e571b3f9d0974b3ffbc, PostgreSQL 16 PASS. La suite general INVENTA también PASS sobre ese commit. Escáner y sesiones de dispositivo en el laboratorio son simulados; se necesita validación real antes de integrar.

Siguiente tarea técnica no bloqueada: preparar contratos de consolidación administrativa y cierre con protección de recuentos físicos, después verificar inserciones y permisos reales en una base descartable con roles Supabase equivalentes. No aplicar migrations a la base activa. Priorizar la compatibilidad con la PR #22 de arquitectura antes de cambiar almacenes/identidades compartidos.


## Continuidad verificada — 28/10/2026: cierre físico, provisionales e incidencias

**Ámbito autorizado:** exclusivamente VISURA INVENTA 07, rama feature/visura-inventa-07-domain-20261027, PR #24 borrador. Se conservan main, las PR paralelas, los permisos y datos de Supabase real, y Business Central sin cambios.

### Nuevas reglas de dominio, sin despliegue

- inventory-core/workflow.cjs: una ubicación no puede marcarse finalizada por revisión vacía ni si jamás comenzó un recuento efectivo; borrar todos los borradores no revierte su marca de inicio. La ausencia de mercancía conocida en una ubicación vacía requiere procedimiento de verificación pendiente de definición; no inventar referencias o ceros.
- La confirmación física de provisionales se diferencia del estado administrativo pendiente: la ubicación puede terminar físicamente mientras el cierre de campaña continúa bloqueado. Ningún cliente acredita por sí solo la confirmación.
- inventory-core/incidents.cjs: conservación de cantidad física en etiquetas ilegibles; incidencias de código alternativo que afectan a recuentos históricos; decisión administrativa auditada con motivo y estado awaiting_correction bloqueante, hasta obtener corrección verificada.
- inventory-lab/005_disposable_incidents.sql: RPC ficticias de alta, revisión, cola autorizada y corrección vinculada a un evento real de mismo artículo, campaña y ubicación, con PostgreSQL descartable; NO migración productiva.

### Regresiones nuevas

- tests/inventa07-location-completion.test.cjs: cinco casos sintéticos.
- tests/inventa07-provisional-physical-vs-admin.test.cjs: cinco casos sintéticos.
- tests/inventa07-incidents.test.cjs: once casos sintéticos.
- tests/sql/inventa07_lab_incidents.sql: autenticación ficticia, permisos de operario/Administración, cantidad física, idempotencia, motivos, rechazo de eventos inventados o de correcciones de otra referencia, y trazabilidad sin reescribir el histórico.
- docs/VISURA_INVENTA_07_CIERRE_FISICO.md y docs/VISURA_INVENTA_07_INCIDENCIAS.md detallan las decisiones, limitaciones y pendientes.

**Evidencia CI:** suite general INVENTA PASS sobre el commit de pruebas incidentes 8ea7314e9933a958161e2547818d4a23066b55d8; PostgreSQL 16 descartable PASS con el contrato y regresión de corrección vinculada al producto en commit 626eb267fdad02ebc2ed7183f2587cdc84ef5055, GitHub Actions run 40604184315. Los commits posteriores de documentación no cambian la lógica del ensayo SQL.

### Pendiente y bloqueo parcial

- La autenticación en laboratorio usa claims de psql; NO acredita sesiones reales. La vinculación efectiva de alias mal atribuido requiere evento de escáner autenticado y versión del catálogo vigente, no solo evento de recuento. La corrección de producto asociada debe comprobarse transaccionalmente.
- Faltan repositorios de autorizaciones y validaciones de sesión reales, migración aditiva probada de Supabase, compatibilidad de cola offline, PWA operativa, E2E en dispositivos, y resolución de los conflictos con PR #18/#19/#20/#22/#23.
- El formato definitivo Excel de Business Central permanece pendiente de ejemplo auténtico.
- **Próximo trabajo seguro:** contrato del servidor de incidencias/provisionales y compatibilidad de datos heredados sobre PostgreSQL temporal, sin modificar la base activa. Solo integrar y activar con autorización expresa de producción.

**No merge, no deploy, no cambios en producción, no API directa de BC.**


## Continuación segura — 28/10/2026: transición de sincronización y clave por lote

**Estado de partida comprobado:** main en a0f76ab1b1a6515ac647facbadca84cfe838d8ac; PR #24 en borrador, sin merge. Se leyó real-counts.js de main y el contrato de persistencia de esta rama; se verificó que la cola actual es inventa-count-outbox-v1:<uid>, usa client_mutation_id y POST directo a public.counts, con campo lot que no se debe perder. No se han modificado archivos de la PWA publicada ni datos reales.

Nuevos archivos aislados:
- inventory-core/outbox-compat.cjs y tests/inventa07-outbox-compat.test.cjs: auditoría no destructiva de cola heredada, sin descartar duplicados; cola V2 separada, conservando producto, lote, desglose y cantidad exacta; borrador, confirmación y corrección; cero explícito; recibo idempotente y bloqueo por capacidades no comprobadas.
- inventory-core/sync-runner.cjs y tests/inventa07-sync-runner.test.cjs: orquestación con adaptadores inyectados y lock obligatorio de nombre compatible con flush V1, comprobación de identidad y permisos antes/después del envío, recuperación de respuesta perdida usando el mismo UUID, denegación de lectura tras 401/403, conservación al modificar la cola o cambiar la cuenta.
- inventory-lab/006_disposable_lot_contract.sql y tests/sql/inventa07_lab_lot_contract.sql: en PostgreSQL temporal, nueva clave por (campaña, ubicación, referencia, lote), borrador/revisión/confirmación y recálculo de unidades, cajas y palés EN SERVIDOR, sin confiar en subtotales del cliente; históricos por lote. No altera las tablas de prueba anteriores.
- docs/VISURA_INVENTA_07_COMPATIBILIDAD_OUTBOX.md: contrato de transición, requisitos de permiso y límites de activación.

**Evidencia:** suite general INVENTA PASS sobre commit 2ac2b90aa4e557b27c112c0e859dfb985ba23023; PostgreSQL temporal con lotes y recálculo PASS en commit 3db87f8b674340ebacfacfa3f7576faf7048409e (run 40606918036). Después se añadieron pruebas de denegación de acceso por cuenta no asignada y de UPDATE directo sobre lotes; verificar el HEAD final y su CI antes de considerar concluido el hito.

**Errores de ensayo corregidos:** aserción textual de una cola V1 conservada, simulación de logout en el test de transportes y aserción de acceso a históricos de lote que se estaba ejecutando erróneamente desde el rol de operario. Las nuevas pruebas pasan en CI después de las correcciones correspondientes; no se relajaron permisos reales.

**Limitación principal:** la PWA no llama al nuevo contrato; los ensayos PostgreSQL usan una identidad simulada por psql, no JWT ni sesión real Supabase. El nuevo prototipo de lote todavía no añade todas las operaciones V2 de parejas/correcciones por lote ni el recibo estándar del adaptador. Ningún handshake de capacidades productivo debe estar activo. Continuar con laboratorio y pruebas seguras, no forzar la migración.

**Siguiente tarea independiente autorizada:** unificar la devolución de recibos idempotentes entre el contrato PostgreSQL de lotes y el adaptador V2, añadir control de autor original/pareja y verificar permisos con sesiones realmente autenticadas en entorno de pruebas separado antes de integrar PWA. No alterar real-counts.js mientras PR #20 y #22/#23 sigan en curso sin verificar integración.

**Prohibiciones preservadas:** NO MERGE, NO DEPLOY, NO MIGRACIONES A SUPABASE ACTIVA, NO CAMBIAR DATOS NI PERMISOS REALES, NO API DE BUSINESS CENTRAL, NO CONVERSION AUTOMATICA DE COLAS.


## Hito adicional 28/10/2026 — acuses de recibo V2 por lote (solo laboratorio)

Se añadieron inventario-lab/007_disposable_v2_receipt.sql y tests/sql/inventa07_lab_v2_receipts.sql. El nombre exacto en repositorio es inventory-lab (no inventario-lab). Son únicamente ficheros de PostgreSQL 16 descartable: reconstruyen el recibo de una mutación identificada por UUID en la forma lógica esperada por la cola V2, incluyendo operación, lote, desglose de borrador, cero expreso, autor y revisión confirmada. Un usuario distinto no puede recuperar la mutación y una cuenta deshabilitada pierde acceso.

**CI comprobada:** INVEnTA checks PASS ejecución 40607250717 y PostgreSQL 16 PASS ejecución 40607250735, ambas en el commit fdd0c2723900a81569b820787dc5144a4df62244. La suite comprueba además que el recuento por lote se recalcula en servidor, que dos lotes de un artículo no se fusionan y que no se concede actualización directa a operarios.

**Limitaciones:** la devolución del laboratorio no constituye todavía una API real, una sesión Supabase validada ni garantía criptográfica del recibo. No hay reescritura automática de la cola V1, despliegue, migraciones o cambios en datos reales. La integración debe seguir bloqueada hasta obtener una autorización e implementar el backend de personas/parejas, permisos, lotes y recibos con E2E reales.

**Siguiente tarea independiente:** probar en un entorno desechable la concesión única del terminal y los integrantes originales de pareja, así como revocación de sesión/ubicación con eventos inmutables; posteriormente diseño de migración aditiva y revisión de PR abiertas, sin modificar la PWA activa.


## Hito de parejas / terminal — 28/10/2026 (contrato de servidor descartable)

**Continuación verificada:** PR #24, rama feature/visura-inventa-07-domain-20261027. El main sigue siendo a0f76ab1b1a6515ac647facbadca84cfe838d8ac. Este chat es responsable exclusivamente del inventario físico (07), no del módulo administrativo 08 ni de PREPARA.

**Archivos nuevos:** inventory-lab/008_disposable_team_terminal.sql; tests/sql/inventa07_lab_team_terminal.sql; tests/sql/inventa07_lab_team_concurrency.sh; docs/VISURA_INVENTA_07_PAREJA_TERMINAL.md. La CI PostgreSQL temporal instala la barrera al final de los contratos antiguos y la valida sin acceso a ningún dato real.

**Implementación y pruebas:** miembros originales individuales o pareja (máximo 2), una concesión activa por dispositivo y un único titular de sesión, relevo A→B con sesión propia en el mismo terminal, no incorporación de terceros, rechazo de sesión en otro dispositivo, caducidad, renovación, release, revocación de cuenta/asignación de cualquiera de los miembros en modo pareja, revisión CAS y eventos históricos inmutables. Una confirmación conserva ambos miembros originales y el actor/sesión autenticados. Se deniegan los accesos directos antiguos a apply_lot, lot_v2_receipt, apply_reference y apply_correction tras instalar la nueva barrera; los caminos de equipo requieren la concesión vigente. Un ensayo con dos conexiones PostgreSQL simultáneas solo admite una activación.

**CI PASS verificada:** commit 45659993586d4bc9a0e0d9b1f5ed12b7efaba6f0, workflow general 40608869350 y PostgreSQL temporal 40608869419. Los cambios documentales posteriores no alteran los tests.

**Límites importantes:** las cuentas y sesiones son fixtures psql, no JWT ni tokens verificados realmente. Los restantes caminos experimentales de provisionales e incidencias requieren el mismo control transaccional. Aún faltan migración aditiva revisada, API real, cliente PWA, cola offline y E2E de dispositivos reales. No confundir protección de laboratorio con seguridad aplicada en producción.

**Siguiente tarea segura:** preservar evidencia real de escáner de códigos alternativos utilizados y controles transaccionales de equipo para provisionales e incidencias, de forma aislada. Mantener PR borrador; no fusionar, no aplicar SQL a Supabase real, no desplegar y no consultar API Business Central.


## Continuación de escáner y provisionales — 28/10/2026 (PostgreSQL aislado)

**Ficheros añadidos en la rama de INVENTA 07:**
- inventory-lab/009_disposable_verified_scans.sql
- tests/sql/inventa07_lab_verified_scans.sql
- docs/VISURA_INVENTA_07_ESCANEOS.md

El ensayo ahora exige dos eventos de lectura sintéticos previamente inscritos por el propietario de la base, distintos y no consumidos, del mismo código, campaña, ubicación, sesión y terminal activo; descarta dispositivos ajenos, lecturas caducadas y datos inventados por el cliente. Inserciones de provisionales e incidencias verifican la concesión de equipo y conservan A/B originales y cuenta/sesión autenticadas en el laboratorio. Administración puede resolver sin alterar evidencia física. Las pruebas anteriores se ejecutan antes de este módulo, sin modificar sus datos históricos.

**GitHub Actions PostgreSQL temporal PASS:** run 40609298803, commit a03e339f9b05e5566199e2386578f047596c37af. Suite general INVENTA también PASS para ese commit. La prueba de concurrencia de activación y protección de terminal PASS en run 40608869419, commit 45659993586d4bc9a0e0d9b1f5ed12b7efaba6f0.

**Límite de seguridad innegociable:** los eventos supuestamente confiables son fixtures inventados por PostgreSQL y los claims de sesión son simulados; NO prueban que un dispositivo o cámara real haya producido las lecturas. Antes de integrar hay que implementar captura verificada, sesiones JWT reales, RLS, token de terminal seguro y asociación de lectura con el evento de recuento efectivo y versión del catálogo de códigos alternativos.

**Siguiente tarea independiente segura:** contractar evento de escaneo verificado + versión de código alternativo + evento de confirmación en PostgreSQL temporal, para impedir incidencias por asociaciones nunca usadas. No migrar Supabase, no tocar PWA, no fusionar/desplegar y no conectar BC directamente.


## Continuidad 28/10/2026 — procedencia histórica de códigos alternativos (solo laboratorio)

Se han añadido inventory-lab/010_disposable_actual_alias_use.sql, tests/sql/inventa07_lab_actual_alias_use.sql y docs/VISURA_INVENTA_07_CODIGOS_USADOS.md. El contrato experimental ya no permite crear una incidencia de alias atribuido incorrectamente únicamente por mencionar un recuento existente: exige un enlace privilegiado entre el evento de confirmación, la lectura original, el evento concreto de activación de la asociación y sus marcas temporales, verificando artículo, ubicación, campaña, cuenta, sesión y dispositivo de la lectura. Un evento de lectura distinto del artículo registrado o un recuento sin lectura acreditada son rechazados.

**CI verificada:** la suite general INVENTA run 40609694176 PASS y PostgreSQL 16 temporal run 40609694200 PASS, commit 8247dcfcad1dd453163e2f9b741a25116ccba5a5. Se ejecutaron de nuevo las pruebas de recuento, lote, recibos idempotentes, pareja y terminal, provisionales, incidencias y procedencia de alias. El SQL no se ha aplicado fuera de inventa07_test.

**Límite crítico:** tanto la procedencia del escáner como la identidad JWT son SIMULADAS por datos insertados por la cuenta privilegiada del ensayo. NO existe componente de captura/atestación real, no se han validado sesiones reales y los recibos no son garantías criptográficas. Las pruebas no constituyen una implementación desplegable.

**Siguiente tarea segura:** integrar, solo en rama independiente y entorno aislado, el contrato de captura y confirmación física con sesiones reales verificables y versión de catálogo, validando dos dispositivos/usuarios reales antes de recomendar cualquier migración a Supabase. Mantener coordinación con otros responsables VISURA; NO MERGE, NO DEPLOY, NO CAMBIOS PROD, NO API BC.
