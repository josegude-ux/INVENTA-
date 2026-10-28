# VISURA INVENTA 08 — Control de posiciones fijas y stock
**Auditoría y desarrollo aislado, 28/10/2026.**

## Fuentes y HEAD de partida
- Repo: `josegude-ux/INVENTA-`, rama principal `main` @ `a0f76ab1b1a6515ac647facbadca84cfe838d8ac`.
- Rama propia: `feature/visura-inventa-08-fixed-stock-20261028` (no fusionar).
- La PR #15 de INVENTA fue fusionada: `006_admin_fixed_positions_report.sql`, `warehouse-management.js`, `consultation-ui.js`.
- La PR #16 fue fusionada: importación Excel de posiciones fijas, migraciones 007/008.
- PR #22 arquitectura compartida: ABIERTA, BORRADOR; `architecture/`, no implementa la integración.
- PR #23 instantánea concurrente: ABIERTA, BORRADOR; `architecture/audits/`, datos ficticios.
- PR #24 inventario físico (chat 07): ABIERTA, BORRADOR, archivos `inventory-core/`, `inventory-ui/`, `inventory-lab/`, `tests/inventa07-*`.
- PR #76 de PREPARA: ABIERTA, BORRADOR; su XLSX tiene 2 hojas, incompatible sin adaptar.

## Fallos históricos verificados (lectura de archivos, NO auditoría productiva)
- 006: `coalesce(bc.qty,0)` induce ceros ficticios sin líneas; suma el stock de la misma posición fija en vez del total del artículo en todo el ámbito BC.
- 006: trigger de `DELETE` guarda evento de baja, pero no estado retirado ni motivo obligatorio en asociación.
- 008: modo reemplazo usa `DELETE` de asociaciones BC antiguas.
- Las tablas actuales de `fixed_positions` y `locations` no identifican inequívocamente cada almacén; `bc_import_current` es singleton. Prohibido inventar reparto multialmacén.
- `warehouse-management.js` consulta RPC histórica paginada y permite cambios de posición; nueva vista administrativa no puede asumir que su contrato ya sea correcto.
- La base real pudo evolucionar: estas observaciones son del código histórico y los PR, no un SELECT de producción de 28/10.

## Trabajo de este chat (NO conectado a producción)
- `fixed-stock-08/report.mjs`: motor de solo lectura; suma decimal exacta por artículo para **todas las ubicaciones** del ámbito certificado, nunca por posición fija. Distingue CERO, NEGATIVO, POSITIVO, SIN DATOS, NO FIABLE. Un artículo puede aparecer en varias posiciones sin inflar indicadores.
- `fixed-stock-08/associations.mjs`: contrato de transición lógica y evento trazable (retirada/reactivación, motivo obligatorio). No realiza escrituras.
- `fixed-stock-08/xlsx.mjs`: adapta el escritor de PREPARA #76 a una **única hoja**, una fila por asociación filtrada, con fechas diferenciadas, cadenas escapadas y stock de alta precisión como texto.
- `tests/inventa08-fixed-stock.test.mjs`: pruebas con datos ficticios exclusivamente.
- CI propia aislada. No modifica `index.html`, `warehouse-management.js`, migraciones, RLS, cuentas, Excel BC, recuentos físicos ni ramas de otros responsables.

## Contrato del futuro backend (no implementado)
Debe producir UNA instantánea atómica y autorizada que incluya:
- `meta`: `verifiedByServer`, `authorized`, `stockComplete`, `catalogComplete`, `positionsComplete`, `locationsComplete`, `truncated`, `stale`, `warehouse`, `publishedBatchId`, `snapshotId`, `positionsVersion`, `sourceFile`, `exportedAt` cuando se acredite, `importedAt`, `publishedAt`, `absentStockIsZero` SOLO por regla BC documentada.
- `products`: `code`, `description`, `unit`.
- `locations`: `warehouse`, `code`, `aisle`.
- `fixed`: `associationId`, `warehouse`, `product_code`, `location_code`, `active`; sin pares activos duplicados.
- `stock`: `warehouse`, `importId`, `product_code`, `location_code`, `quantity` decimal canónica.
- Los flags de completitud y autorización NUNCA pueden obtenerse de respuestas del navegador o de parámetros que controle el usuario. El motor puro no constituye un control de acceso, y un adaptador no debe suministrarle stock si la cuenta no está autorizada.
- La instantánea debe resolverse en una única operación consistente en servidor (transacción `REPEATABLE READ READ ONLY` u operación equivalente), con lote de BC ya validado/publicado y versiones de posiciones coherentes. Relectura de puntero antes/después no sustituye aislamiento transaccional.
- Falta materializar asignaciones retiradas sin borrados históricos, ámbitos de almacén y permisos reales. No activar RPC, no realizar migraciones sin autorización.

## Bloqueos y siguiente tarea segura
1. Completar y comprobar CI aislada y revisión del PR propio.
2. Incorporar vista responsive desacoplada y pruebas visuales con datos sintéticos, sin conectarla a la navegación actual.
3. Proponer contrato SQL/adapter de solo lectura, coordinado con propietarios de PR #22/#23 y PR #24, sin aplicarlo.
4. Requiere autorización separada: cambios de tablas reales, historial con migración reversible, identidad de almacenes, RLS, integración con navegación, publicación y pruebas con ficheros BC empresariales auténticos.
5. Antes de habilitar resultados productivos: prueba de concurrencia y roles reales, prueba iOS/desktop y revisión de compatibilidad de importación #16.

**ESTADO:** fase aislada; ninguna habilitación productiva, despliegue, fusión ni operación en Business Central/Supabase.

## Hito 2 — prototipo responsive y resultados CI (28/10/2026)
- `fixed-stock-08/preview.html`, `preview.css`, `preview.mjs`: pantalla de DEMOSTRACIÓN con menú lateral y cinco indicadores en escritorio; reajuste para tableta; tarjetas táctiles y filtros a una columna en móvil. Nunca llama a Supabase y utiliza referencias/stock totalmente inventados.
- La ficha de la asociación se abre en **solo lectura**. Al volver se conservan filtros, orden y estado de la tabla; exporta las filas filtradas a XLSX de una sola hoja.
- `tests/inventa08-visual.spec.mjs`: pruebas Chromium reales con 1440, 820 y 390 px; comprueban filtros, apertura de ficha, vuelta sin pérdida de filtros, ausencia de desbordamiento horizontal y descarga XLSX ZIP con una sola hoja. No equivalen a una validación física de Safari/iPhone.
- Workflow aislado `.github/workflows/inventa08-responsive.yml`, sin deploy ni claves.
- **CI de HEAD `2f2b307c526d02ce8c93a20d494e1dff12f559ac`:**
  - `40606928555` — motor sintético Node: SUCCESS.
  - `40606928742` — regresión general INVENTA: SUCCESS.
  - `40606928683` — Chromium responsive: SUCCESS.
- PR propio: https://github.com/josegude-ux/INVENTA-/pull/25 (BORRADOR, sin fusión).

### Límites pendientes antes de conexión empresarial
No hay enlace a `index.html` ni autorización real de servidor; existe un riesgo histórico no resuelto en las migraciones 006/008. No activar botones de edición ni datos teóricos de producción hasta auditar Auth/RLS, crear un adaptador read-only con una instantánea transaccional, resolver ámbito inequívoco del almacén y migrar retirada lógica con copia/respaldo y reversión autorizados.


## Hito 3 — contrato de lectura y no filtración entre almacenes (28/10/2026)
- Corrección en `fixed-stock-08/report.mjs`: una asociación activa cuyo almacén no coincide con el certificado **nunca se devuelve** al usuario, ni en vista completa o no fiable. El lote se marca NO FIABLE.
- Regresión añadida a `tests/inventa08-fixed-stock.test.mjs` con código reservado del almacén ajeno; no prueba por sí sola que RLS real esté protegido.
- Contrato de lectura `docs/VISURA_INVENTA_08_CONTRATO_LECTURA_Y_RETIRADA.md`: propuesta no aplicada para autorización en servidor, instantánea REPEATABLE READ, lectura BC por todas las ubicaciones y retirada lógica reversible.
- Pendiente CI del HEAD posterior a estos cambios. No hay adaptador de red, integración real ni modificaciones de otras ramas.

## Hito 4 — controles de integridad reforzados (28/10/2026)

**Código funcional HEAD:** `0b6449a8988cedbc3ab0bd46a7068400af2ffc04` (la actualización documental posterior no modifica el motor).

- `fixed-stock-08/report.mjs`: control opcional de cantidades esperadas del lote y maestros si el servidor acredita `expectedStockRows`, `expectedProducts`, `expectedLocations` y `expectedFixedRows`. Una discrepancia impide declarar stock fiable.
- Se detectan códigos de artículos maestros duplicados, unidades ausentes, ubicaciones repetidas o de otro almacén, asociaciones activas huérfanas, cantidades BC que hayan pasado por `Number` (riesgo de precisión perdida), unidades BC incompatibles con la unidad del maestro y líneas repetidas por artículo + ubicación + lote.
- Los lotes diferentes en una misma ubicación siguen acumulándose mediante decimal exacto; los artículos con varias posiciones conservan un único total lógico.
- Las asociaciones de almacenes ajenos **se excluyen siempre del resultado**, también de la vista de incidencias no fiables. La instantánea propia se marca inconsistente.
- `tests/inventa08-fixed-stock.test.mjs`: **29 pruebas sintéticas** en total, incluidas importación incompleta, maestros huérfanos, duplicados BC, lotes distintos, 24 decimales y exportación XLSX con más de 15 cifras significativas conservadas como texto.
- CI sobre commit de código `0b6449a8`: `40608164207` (motor Node): **SUCCESS**; `40608164003` (regresión INVENTA): **SUCCESS**. La ejecución visual `40608164045` continuaba en progreso en la última consulta; revisar antes de calificar el HEAD completo.
- La validación no modifica la arquitectura compartida, PREPARA, el inventario físico ni la navegación pública. Sigue sin conexión a Supabase y sin datos BC auténticos.

**Advertencia de integración:** todos los indicadores de completitud son una propuesta de contrato, no un permiso ni una prueba real por sí solos. Únicamente el servidor, tras comprobar la importación y permisos por almacén, puede certificarlos. El módulo 08 no puede habilitarse en producción hasta aprobar el modelo multialmacén de PR #22/#23, las autorizaciones efectivas y la sustitución reversible de los comportamientos destructivos de las migraciones 006/008.

**Siguiente tarea independiente segura:** pruebas adicionales de límites y documentación del plan de compatibilidad con los consumidores históricos del RPC sin crear endpoints ni alterar datos reales.

## Hito 5 — compatibilidad, filtros completos y ceros ausentes (28/10/2026)
- Auditoría de consumidores reales en el código histórico: `docs/VISURA_INVENTA_08_COMPATIBILIDAD_HISTORICA.md` identifica el DELETE directo desde Gestión/Consulta, el `p_replace` destructivo del importador, la RPC antigua que calcula por ubicación y el CSV que no respeta filtros. **No se modifican esos flujos** hasta contar con la coordinación y autorizaciones necesarias.
- Confirmado el fallback histórico de Consulta a `stock_snapshot` de campaña si no existe importación BC publicada: el **módulo 08 no lo reutilizará** como fuente de stock total.
- Los filtros del motor y de la vista aislada admiten ahora **referencia y descripción independientes**, además de búsqueda general, pasillo, posición y estado. La exportación XLSX se genera a partir del resultado filtrado y mantiene la hoja única.
- Una ausencia de líneas BC solo puede clasificarse como CERO cuando `absentStockIsZero=true` viene de un backend certificado **y** existe identificador no vacío de regla documentada `zeroOmissionRuleId`. Sin regla, el informe se marca NO FIABLE, sin inferir cero.
- Pruebas sintéticas ampliadas a **31** en `tests/inventa08-fixed-stock.test.mjs`; prueba visual adicional para filtros independientes en `tests/inventa08-visual.spec.mjs`.
- Última modificación funcional incluida en `afab702ee2310943c46e7de6708ca5ea3dbedcc2`. En la comprobación inicial, `INVENTA checks` SUCCESS (run 40608638284); pruebas aisladas de motor y Chromium aún en curso. Verificar CI después de terminar; no declarar PASS anticipado.

**Pendientes fuera del alcance autónomo:** la semántica real de la exportación BC debe acreditarse con archivo auténtico, los permisos/almacenes deben certificarse en servidor y la migración de historia/estado requiere autorización explícita. No se ha conectado a Supabase, fusionado ni desplegado.
