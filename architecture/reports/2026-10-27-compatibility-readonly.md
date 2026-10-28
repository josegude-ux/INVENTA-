# VISURA 04 — Contraste real de compatibilidad entre catálogos (solo lectura)

Fecha: 2026-10-27. Estado: **auditoría y regresión aislada**, SIN migración ni consulta de credenciales. Responsable: 04 - Arquitectura y Base de Datos Compartida. La evidencia está referida al estado de las tablas durante la consulta, no a una certificación futura.

## Hallazgos contrastados con Supabase

| Evidencia | INVENTA `wlejxnpphysogrzcxjfh` |
| --- | ---: |
| Artículos de `public.products` | 1.853 |
| Ubicaciones de `public.locations` | 794 |
| Líneas BC de `public.bc_import_lines` | 3.041 |
| Importación BC vigente | `COR_01_COR`, 3.041 líneas completas, `committed` |
| Líneas BC sin artículo maestro | 0 |
| Líneas BC sin ubicación maestra | 0 |
| Posiciones fijas en `public.fixed_positions` | 1, origen `manual` |
| Registros en `public.fixed_position_imports` | 0 |

PREPARA / Control de Cargas `oevetnszmfxeukcncwji` tiene en `public.kontrola_almacenes` dos almacenes activos: `COR_01_COR` (A Coruña) y `COR_02_NAR` (Ferrol). El registro `PEND_00_CLAS` figura inactivo. No crear ni deducir artificialmente un almacén `FER_01_FER` a partir de los fixtures sintéticos del borrador SQL.

### Compatibilidad con ubicaciones reales

La primera versión de `architecture/lib/validate-bc-batch.mjs` rechazaba ubicaciones con espacios, aunque existen códigos válidos:

- `PLV USAD`: 39 líneas en `bc_import_lines`.
- `SUELO 3`: 14 líneas en `bc_import_lines`.

Total afectado inicialmente: **53 de 3.041 líneas BC** (sin inferir pérdida de datos: se trataba solo de un validador nuevo, no conectado). Corregida la admisión de espacios **internos** en ubicación, sin permitir códigos de artículo con espacios ni cadenas de control/formulas. Nuevo test: `architecture/tests/locations-inventa-compat.test.mjs`.

**Control antes de integrar:** la API futura debe usar claves de ubicación como texto, sin convertirlas a rutas de archivo, y respetar los códigos tal como están en el maestro. El resto de políticas de normalización deben cotejarse con Excel reales autorizados.

### Posiciones fijas: no confundir código preparado con datos publicados

La rama funcional INVENTA implementó importación de posiciones fijas, pero **en la consulta actual solo figura una posición manual y no existe ningún registro en `fixed_position_imports`**. Esto NO demuestra eliminación de posiciones ni permite afirmar que se haya efectuado una importación de fijos al backend. Debe conciliarse con el administrador de INVENTA antes de dar por actualizadas las posiciones fijas empresariales. No repetir ni ejecutar importaciones automáticamente.

### Límites del borrador SQL aislado

1. `public.locations` usa PK solo por código: no diferencia `COR_01_COR` y `COR_02_NAR`. La propuesta `warehouse_locations` todavía referencia la tabla global. Si Ferrol usa ubicaciones distintas o un mismo código con atributos diferentes, **el modelo requiere modificación y pruebas antes del corte**.
2. `bc_current_by_warehouse` está preparado como selector por almacén, pero aún **no existe una RPC de publicación con control de estado/filas/hash, bloqueo de concurrencia, autorización y auditoría**. En su estado actual no debe exponerse a clientes ni emplearse en producción.
3. El ensayo PostgreSQL 16 usa fixtures sintéticos y no verifica Auth/Storage reales ni completa la regresión de PREPARA/INVENTA. El workflow aislado se ejecutó satisfactoriamente: https://github.com/josegude-ux/INVENTA-/actions/runs/40532644402.
4. El informe administrativo de posiciones fijas de PREPARA tiene responsable propio. Solo puede consumir contratos validados; no duplicar su interfaz ni modificar su PR.

## Próxima tarea segura

Preparar el contrato de ubicaciones multialmacén sin dependencia obligatoria de `public.locations(code)`, con un procedimiento de conciliación **sin escrituras** por códigos existentes, y pruebas PG para reutilización de códigos entre almacenes. Después diseñar publicación validada y pruebas de concurrencia PostgreSQL; **sin ejecutar sobre Supabase actual, sin merge y sin despliegue**.
