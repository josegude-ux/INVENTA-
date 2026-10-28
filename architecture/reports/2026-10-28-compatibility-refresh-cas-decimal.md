# VISURA 04 — Matriz revisada de compatibilidad y cierre de pendientes técnicos

**Fecha:** 28/10/2026. **Ámbito:** PR #22, aislada. **No aplica SQL a Supabase ni modifica ramas #23/#24/#25/KONTROLA #76.**

## 1. Control de versiones y pruebas comprobadas

| Responsable | PR | HEAD contrastado antes de implementar | Estado / evidencia |
| --- | --- | --- | --- |
| 04 · arquitectura | [INVENTA #22](https://github.com/josegude-ux/INVENTA-/pull/22) | `7e35f1a748343604166a63388d10fd4c415b8c61` | OPEN/DRAFT; CI original SUCCESS |
| 05 · auditoría | [INVENTA #23](https://github.com/josegude-ux/INVENTA-/pull/23) | `977885f0105ef782228a781ff2e18093b80c6e78` | OPEN/DRAFT; workflow cruzado anterior SUCCESS pero sujeto a actualizar SHA |
| 07 · físico | [INVENTA #24](https://github.com/josegude-ux/INVENTA-/pull/24) | `aace927c20ba642a9d915a574e9f07c7c1221a9d` | OPEN/DRAFT; PG16 y pruebas generales SUCCESS |
| 08 · stock teórico | [INVENTA #25](https://github.com/josegude-ux/INVENTA-/pull/25) | `c98b86b41cddb9a68458613c9f583e7b0bb65612` | OPEN/DRAFT; **5 workflows SUCCESS** |
| PREPARA 02 | [KONTROLA #76](https://github.com/josegude-ux/KONTROLA/pull/76) | `3ec761c6e5cac52154846bda17737406499f479d` | OPEN/DRAFT; **3 workflows SUCCESS** |

**Atención:** #25 avanzó 13 commits desde `18912ee`, y #76 avanzó 14 commits desde `fb72350`. No atribuir pruebas antiguas a esos cambios. Los checks del HEAD actual de ambas PR se consultaron por separado. El chat 05 trabajó con pines anteriores y debe actualizar solo sus ensayos afectados.

## 2. Matriz funcional consolidada

| Contrato | Fuente / propietario | Compatibilidad actual | Incidencia o puerta restante |
| --- | --- | --- | --- |
| Catálogo único, clave SKU textual y ubicación (almacén, ubicación) | 04 #22 | Laboratorio PG16 compatible | Reconciliar maestros históricos sin almacén; no duplicar catálogo |
| Recuento físico 07, solo datos físicos | 07 #24; proyección 04 | Forma de `inventory-ui/location-view.js` cubierta por allowlist de 04 | Validación de sesión/campaña/equipo/terminal en servidor real; cierre y corrección siguen con 07 |
| Stock total por SKU (todas las ubicaciones) y no por posición | 08 #25 + adaptador 04 | **Verificado por propia CI cruzada #25** con SHA original #22; sin doble conteo | Snapshot empresarial real, cobertura de stock y catálogo |
| Asociaciones `associationId,active,revision` | 08 #25 + esquema 04 | Simulado y verificado en `warehouse_fixed_positions` privado | Histórico `public.fixed_positions` sin almacén; autoridad de asociación y backfill |
| Retirada/reactivación con evento y control de revisión | 04 + 08 | Nueva operación CAS privada en PG16; un evento por transición, la escritura y el evento revierten juntos | Actor identificado por sesión real; permisos mínimos, privilegios de tablas, event log sin bypass de DB owner; no hay mutación productiva |
| Ubicaciones de stock no fijas | 08 #25 | **Corrección funcional aplicada en #25**: todas deben pertenecer al catálogo de ubicaciones del almacén | Certificación de cobertura y migración de ubicaciones |
| `stale,truncated,authorized,verifiedByServer` estrictamente booleanos | 08 #25 | **Defecto del chat 05 corregido por 08** | Gateway real debe emitirlos, no navegador |
| Contrato PREPARA `visura-prepara-fixed-read-v1` | 02 #76 + adaptador 04 | **Guard de forma nuevo en #76**, compatible con campos de 04: fecha exportada/importada/publicada, conteos, SKU, lotes, ubicación y `truncated` | Test cruzado del nuevo guard de #76 contra HEAD 04 a cargo de 05; RPC empresarial no habilitada |
| Fecha BC exportada vs importada vs publicada | 04 + 02 + 08 | Envolturas de ambos consumidores separadas; no inferir vigencia de `published_at` | Procedencia y sellos confiables del XLSX auténtico; aprobación política antigüedad |
| BC stock cero explícito / ausente sin valor | 04/08/02 | Cero real preservado; ausencia no equivale a cero sin regla documentada | `absentStockIsZero` requiere certificación del exportador; no afirmarla con filas ausentes |
| Carga Excel manual BC y SHA | 04 | Validador/recibo SHA-256 y digest PostgreSQL V2 en laboratorio | Parser auténtico aprobado; no hay API BC; `expiry_date` fuera de huella V2 |
| Importación precisa del decimal BC | 04; importador histórico #18 | **Mitigación nueva en validador 04:** cantidades `Number` son inválidas, solo cadena decimal fuente | Importador #18 sigue sin corregir; un decimal ya redondeado no puede reconstruirse |
| Lectura coherente entre publicador y lector | 05 #23 | REPEATABLE READ positivo / READ COMMITTED negativo demostrados anteriormente | Servidor real debe garantizar instantánea transaccional de lote, catálogo, posición y metadatos; no duplicar prueba ya completada |
| XLSX INVENTA de una hoja vs PREPARA XLSX/CSV/PDF | 08/02 | No comparten escritor; ambos probados en sus ramas aisladas | E2E navegador real/iOS y autorizaciones antes de exportar |

## 3. Implementación exclusiva 04 tras las revisiones

- `architecture/drafts/visura_shared_fixed_transition_cas_UNAPPLIED.sql` añade **solo una función privada** `transition_fixed_association_cas_isolated` al maestro `visura_shared.warehouse_fixed_positions`, mediante `UPDATE ... WHERE association_id/warehouse/revision/active` + inserción de evento en **la misma operación**. Función `SECURITY INVOKER` sin `GRANT` a `anon` ni `authenticated`.
- `architecture/tests/sql/150_verify_fixed_transition_cas_pg16.sql`: autorización simulada por almacén, CAS obsoleto, acceso a almacén ajeno, evento inmutable, evento fallido que revierte el UPDATE, rollback de transacción y revocación de actor. Reutiliza permisos y fijos ficticios preexistentes, sin multiplicar fixtures.
- `architecture/tests/sql/151_hold_fixed_cas_pg16.sql`, `152_conflicting_fixed_cas_pg16.sql`, `153_verify_fixed_cas_concurrency_pg16.sql`: **dos sesiones PostgreSQL reales**; ambas intentan la misma revisión de asociación. Exactamente una modificación y un evento nuevo; segunda rechazada y Ferrol sin cambios.
- `architecture/lib/validate-bc-batch.mjs`: el límite de confianza ahora rechaza `Number` como cantidad BC, porque `99999999999.123456` puede llegar ya convertido a `99999999999.12346`. Solo se acepta texto decimal original; sin reconstrucción especulativa.
- Regresiones de precisión en `architecture/tests/validate-bc-batch.test.mjs` y `architecture/tests/attest-bc-manual-upload.test.mjs`: no se genera recibo ni digest validado para importes recibidos como JS Number.
- `.github/workflows/visura-shared-core-isolated.yml` prueba la función y la carrera CAS en PostgreSQL 16 descartable.

**Alcance limitado:** la función CAS recibe `p_actor` sintético, revisa una ACL de laboratorio y no se publica a ningún cliente. **No enlaza `p_actor` con identidad de sesión auténtica.** Un propietario SQL puede alterar directamente filas o triggers. Esto **NO** sustituye los GRANT/RLS reales, la autorización por backend, la transacción aislada de lectura o el control de cambios de tablas empresariales.

## 4. Incidencias remitibles por propietario

**07 / PR #24:** revisar la proyección `to-inventa07-blind-location-v1.mjs`; confirmar detalles de permisos al cambiar equipo, terminal, ubicación y campaña mientras hay recuentos pendientes, en especial el contrato de pareja y cierre. Ningún campo BC se devuelve al operario; validar el servidor real antes de enlazar la PWA.

**08 / PR #25:** confirmar que la fuente futura suministrará `associationId/active/revision/positionsVersion` **desde maestro versionado**, nunca fabricados por posición; que las transiciones administrativas CAS con motivo conservan una sola secuencia de eventos; y que la CI de nuevo HEAD sigue utilizando el SHA de 04 explícito. Conservar XLSX **de una hoja**. Su corrección de booleanos y ubicaciones ya existe: no duplicarla.

**PREPARA / PR #76:** verificar que `assertPreparaFixedReadV1` reciba salida de `to-prepara-fixed-read-v1.mjs` del HEAD de 04; la función nueva de guard no autentica usuarios y su aprobación depende de un servidor; no habilitar RPC antigua de `visura_reporting` ni copiar credenciales.

**05 / PR #23:** actualizar matriz de HEAD/pines de 04/08/PREPARA, no presumir que los tests que reprodujeron defectos anteriores deban seguir esperando defectos **ya corregidos** en 08. Ejecutar pruebas cruzadas solo sobre contratos afectados: 07 vista ciega, 08 motor revisado, PREPARA nuevo guard V1, CAS de asociaciones y fronteras físico/teórico. Conservar el test de RR ya realizado, sin duplicarlo. No hacer merge/rebase unilateral sobre PR #22.

## 5. Plan reversible (NO ejecutado)

1. Congelar HEAD, inventariar registros y consultas del singleton `bc_import_current`, `public.locations`, `public.fixed_positions` y consumidores SQL 006/008, incluidas rutas con `DELETE` y `COALESCE`.
2. Planificar respaldo/restauración **probados y autorizados** de catálogo, ubicaciones, fijos, campañas y auditoría; conservar identificadores y autores originales sin falsificar el almacén.
3. Conciliar cada posición histórica mediante `(warehouse_code,product_code,location_code)` certificado; detectar colisiones y filas sin identidad. Mantenerlas en cuarentena hasta atribución humana.
4. Evaluar transición aditiva sin borrado físico: `association_id,active,revision` y eventos append-only. Implementar CAS con identidad servidor no suplantable y privilegios mínimos; verificar revocación y rol de cada actor.
5. Comparar lectura de la única autoridad con el sistema antiguo, **sin publicar dos stock diferentes**. Puerta de entrada desactivada por defecto; ensayar snapshot RR, digest BC, stock total y físico ciego por almacén.
6. Tras aprobación separada, habilitar lectura progresiva, rollback de código por flag y recuperación consistente; nunca borrar eventos para «volver atrás». Realizar regresiones de consumidores, exportaciones y dispositivos.
7. Sin autorización empresarial de migración/permisos/despliegue, **no ejecutar ninguno** de estos pasos en Supabase.

## 6. Evidencia y siguiente validación

CI final de esta iteración: verificar la conclusión de la acción sobre el último commit con código. No citar un SHA anterior para declarar probada la última modificación. La evidencia verde precedente de CAS sintético con concurrencia en `f618fb7a1310c8a4f265e5108e3955f2306275fd` consta en los workflows de ese SHA.

**Siguen bloqueadas:** identidad/Auth real, datos empresariales, origen temporal del Excel, importador XLSX exacto, histórico fijos sin almacén, RLS real, validación E2E y aprobación de despliegue/merge. La PR #22 no constituye integración real ni permisos de publicación.
