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
