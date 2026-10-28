# VISURA INVENTA 08 — Propuesta de contrato servidor, lectura coherente y retirada reversible
**28/10/2026 · DISEÑO NO APLICADO · Alcance exclusivo chat 08**

## Estado / propiedad de integración
Este documento especifica el adaptador necesario para conectar el motor puro `fixed-stock-08/report.mjs` al backend, pero **no implementa un endpoint ni autoriza modificar bases reales**. Integración Auth/RLS, identidad de almacén e instantáneas compartidas pertenecen a la arquitectura PR #22/#23; inventario físico a PR #24. No editar esos componentes desde 08 sin coordinación. No usar datos de PREPARA ni crear un segundo maestro independiente.

## Contrato de solicitud
- Ruta interna futura (nombre provisional): `GET /admin/fixed-stock/snapshot?warehouse=<id>`.
- La sesión se obtiene de la identidad autenticada validada en servidor, **nunca** de `verifiedByServer`, `authorized`, `userId` o `warehouseGrants` enviados por el navegador.
- Comprobar en backend, antes de leer una línea teórica, permisos efectivos de usuario + módulo INVENTA administración + ámbito del almacén, con denegación por defecto. Los recuentos operarios no disponen de esta lectura.
- Si no hay almacén único identificable o la fuente BC no acredita cobertura: devolver error de dominio y no ofrecer falsos ceros. No extender ámbito por adivinación.
- Respuesta JSON completa (o generación XLSX integral en servidor); no paginar en múltiples transacciones sin instantánea persistente, pues mezclaría versiones. Límites de tamaño nunca deben crear informes aparentemente completos.
- No registrar contenido sensible ni referencias/stock en logs de acceso, trazas del cliente o mensajes de error.

## Transacción de lectura (pseudocódigo, NO ejecutar)
1. Abrir transacción **REPEATABLE READ, READ ONLY** (o garantía transaccional equivalente) *antes de la primera SELECT*. No asumir que un SELECT tras otro en READ COMMITTED mantiene coherencia.
2. Resolver autorización servidor/RLS para el almacén seleccionado; rechazar acceso no autorizado **sin devolver filas**.
3. Leer el puntero publicado, el identificador del lote BC y su estado de integridad; rechazar lote incompleto, no publicado, truncado o caducado según regla documentada. Evitar el puntero BC singleton histórico como prueba de un supuesto total global.
4. Leer, en la misma instantánea, catálogo, ubicaciones por clave `(warehouse, location_code)`, asociaciones activas del maestro único y **todas las líneas de stock del artículo del lote en ese almacén**, incluidas ubicaciones NO fijas.
5. Leer versión de asociaciones y metadatos de procedencia bajo la misma instantánea; verificar que no hay pares activos duplicados `(warehouse, product_code, location_code)`, referencias huérfanas, almacenes cruzados ni cantidades inválidas.
6. Emitir el sobre `{meta, products, locations, fixed, stock}` conforme a `docs/VISURA_INVENTA_08_CONTINUIDAD.md`. `verifiedByServer`, `authorized` y completitud solo se producen tras **validaciones auténticas en servidor**, nunca por un adaptador del navegador.
7. Confirmar el cierre de la transacción y devolver la instantánea completa. Si no hay prueba de completitud, error de dominio o estado `NO FIABLE`; no publicar cantidades ni indicadores como acreditados.

## Definiciones de invariantes
- `stockTotal(warehouse, artículo, batch)` = suma decimal exacta de todas sus líneas en el **ámbito importado y certificado**, sin restringir por posiciones fijas. Dos posiciones del mismo artículo muestran informativamente el mismo total; el indicador de referencias cuenta una sola.
- Ninguna fila de un almacén ajeno puede aparecer, **ni siquiera en vista NO FIABLE**. Si llega una asociación ajena al motor, se excluye y la instantánea se declara inconsistente.
- `CERO` por ausencia de línea solo se permite con certificación documental expresa de la regla de exportación BC que omite ceros; en cualquier otro caso `SIN DATOS`.
- Las fechas BC exportado, importado/publicado y generado son hechos distintos; faltar fecha BC exportada se comunica como `no acreditada`.
- El XLSX contiene una sola hoja, todas las asociaciones filtradas activas, códigos como texto y cantidades negativas/decimales sin fórmula ejecutable.

## Propuesta de transición de asociaciones (NO SQL aplicado)
- Evaluar migración **aditiva y reversible**: identidad de asociación inmutable, `active`, `revision`, metadatos de origen y tabla append-only de eventos `RETIRAR`/`REACTIVAR` con motivo, texto opcional `OTROS`, actor autenticado, momento servidor, estado anterior/nuevo y revisión.
- Crear respaldo probado y un mapeo verificable desde claves históricas de `fixed_positions`; detectar colisiones de almacén/códigos antes de backfill. No asumir almacén del código de posición.
- Verificar consumidores de las migraciones 006 y 008, del modo replace y de `warehouse-management.js` antes de activar escritura. Sustituir semántica destructiva de `DELETE` solo tras reconciliar los flujos y crear pruebas de compatibilidad.
- Transición atómica optimista: `WHERE association_id=? AND revision=revision_esperada AND active=estado_esperado`; al modificar **una** fila, insertar evento en la misma transacción; rechazo seguro para conflictos/concurrencia. Deben verificarse en servidor permiso por almacén y motivo obligatorio. La tabla del informe sigue siendo solo lectura.
- Estrategia de vuelta atrás: feature flag desactivable, conservar tablas/columnas anteriores durante transición y eventos históricos; rollback de aplicación sin borrar auditoría; cualquier reversión de datos requiere plan y autorización independientes.

## Matriz mínima de pruebas y puertas
| Caso | Resultado obligatorio |
|---|---|
| Usuario operario y usuario sin almacén | HTTP 403/denegación sin datos ni metadatos BC |
| Almacén extraño en snapshot | No aparece ninguna asociación ajena; origen NO FIABLE |
| Publicación concurrente de lote BC | Una única versión publicada para todo el informe |
| Retirada/re-activación simultánea | Una transición confirmada; conflicto versionado en la otra; historia intacta |
| 0 por compensación / -12.125 / sin líneas | CERO / NEGATIVO / SIN DATOS, sin duplicar totales |
| Exportación de 1208 filas | XLSX de una hoja y 1208 filas de datos |
| Stock de archivo con almacén parcial | Se indica ámbito parcial, nunca total global |
| Simulación documental / datos sintéticos | NO equivale a autorización Auth/RLS real ni a validación BC |

## Bloqueos antes de integración
Falta corroborar estructura real de Excel BC y reglas de omisión, modelo de almacenes del maestro, tablas reales y permisos de cada rol, propiedad final del adaptador con PR #22/#23, ensayo de concurrencia con servidor y respaldo/reversión autorizados. Sin autorización expresa: **NO crear RPC real, NO aplicar migraciones, NO cambiar RLS, NO fusionar, NO desplegar**.
