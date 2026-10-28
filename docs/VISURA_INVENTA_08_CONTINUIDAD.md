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
