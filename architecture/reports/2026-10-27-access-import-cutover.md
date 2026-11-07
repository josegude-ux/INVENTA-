# VISURA 04 — Contratos, identidad y puertas de implantación

Actualizado: 27/10/2026. **Especificación de preparación, NO autorización para desplegar o migrar**. Responsable de arquitectura: chat 04. Referencia única: PR #22, rama `architecture/visura-shared-core-20261027`.

## Modelo de autoridad

- Fuente prevista para catálogo, ubicaciones, posiciones fijas y stock **calculado BC**: SUPABASE INVENTA, sin crear una copia sincronizada en PREPARA. Esta decisión técnica sigue **pendiente de integración real**.
- `public.products` permanece maestro existente; vistas `visura_shared.products_v1`, `locations_v1` y `fixed_positions_v1` son **privadas y no autorizadas** hasta reconciliación y revisión.
- `visura_shared.warehouse_locations` distingue cada `(warehouse_code,location_code)`, de modo que un código presente en Coruña y Ferrol no se identifica por error como la misma posición física.
- `visura_shared.bc_current_by_warehouse` apunta a **un único lote vigente por almacén**; las líneas validadas mantienen un histórico inmutable por importación.
- `public.campaigns`, `counts`, `assignments`, `incidents` y demás operaciones INVENTA **no** deben sustituirse por importaciones BC. PREPARA mantiene sus propias cargas, revisiones, documentos y estados.
- No se toca Tanques, historiales de Control de Cargas, PDFs o OneDrive.

## Matriz de permisos objetivo (nunca inferir permiso por iniciar sesión)

| Rol y módulo | Catálogo por almacén | Stock BC calculado | Modificar importaciones | Procesos propios |
| --- | --- | --- | --- | --- |
| INVENTA / operario | según almacén autorizado | **denegado** en recuento ciego | denegado | recuentos asignados, separados del stock |
| INVENTA / supervisor | autorizado explícitamente | solo concesión explícita | denegado por defecto | supervisión de recuentos |
| INVENTA / administrador | autorizado explícitamente | concesión explícita | solo permiso administrativo de importación y almacén | gestión INVENTA |
| PREPARA / operario | lo requerido para preparación autorizada | denegado por defecto | denegado | cargas y verificación según permisos |
| PREPARA / administrador | almacenes autorizados | solo concesión explícita al informe aprobado | denegado para stock BC salvo permiso administrativo específico, no implícito | informes, revisión documental |
| Control de Tanques | **ninguno nuevo** | denegado | denegado | módulo inactivo y oculto |

Ningún rol administrador de PREPARA equivale automáticamente a administrador de INVENTA.

## Autenticación y trazabilidad

1. No combinar identidades Auth de proyectos distintos suponiendo que correo o nombre equivalen a UUID compartida.
2. La identidad común requiere correspondencia aprobada entre `auth.users` de origen y destino; conservar UUID de origen, proyecto, autoría y eventos previos sin reescribirlos.
3. No migrar contraseñas, sesiones, JWT, `service_role` ni credenciales. Alta y verificación individuales mediante el proceso de identidad aprobado.
4. La revocación debe afectar módulos y almacenes en servidor, validando permisos efectivos en cada operación sensible (no confiar exclusivamente en JWT desactualizado).
5. El backend confiable establecerá la identidad de autor de la publicación. **Prohibido** exponer al usuario una RPC que acepte `p_actor` arbitrario: el borrador SQL actual es un prototipo privado para validar concurrencia y semántica.

## Excel manual: contrato antes de publicar

1. Excel seleccionado manualmente por Administración; no APIs BC.
2. Verificación de cabeceras, existencia de almacén, cantidad de filas y `Stock calculado` exclusivamente; cantidades físicas/diferencias jamás sustituyen stock BC.
3. `sha256` del original y digest de filas normalizadas, almacenados de forma verificable. El prototipo **todavía no prueba criptográficamente que las filas correspondan al Excel**.
4. Staging privado y validación completa de estructura, maestros, duplicados, lotes, unidades, cantidades, fechas y conciliación; no mezclar almacenes.
5. Bloqueo de almacén + permiso aprobado + comprobación de hash/conteos + compare-and-swap del puntero + auditoría, todo en una sola transacción.
6. Reintento del mismo lote debe devolver **already_published** sin nuevo evento; reintento obsoleto de otro lote debe fallar.
7. Reversión futura: nueva transacción auditada que restaure el puntero previo (sin borrar importaciones ni eventos). **No diseñada ni probada todavía**.
8. Diferenciar stock calculado cero real, stock negativo permitido, sin línea desconocido, origen obsoleto y ubicación fija sin stock. No convertir ausencia de línea en cero.

## Material aislado incorporado

- `architecture/drafts/visura_shared_schema_UNAPPLIED.sql`: tablas propuestas sin grants, RLS denegación por defecto.
- `architecture/drafts/visura_shared_internal_publish_UNAPPLIED.sql`: experimento interno `SECURITY INVOKER` para validación/cambio de puntero, **sin GRANT ni endpoint de cliente**.
- `architecture/drafts/visura_shared_staging_guard_UNAPPLIED.sql`: bloquea inserción, edición o borrado de líneas tras salir de `staged`.
- `architecture/drafts/visura_shared_read_contracts_UNAPPLIED.sql`: stock vigente solo de lote `published` completo.
- `architecture/drafts/visura_shared_reference_contracts_UNAPPLIED.sql`: contratos privados `products_v1`, `locations_v1`, `fixed_positions_v1`.
- `architecture/tests/sql/40_*`, `50_*`, `51_*`, `52_*`, `60_*`, `70_*`: pruebas PostgreSQL descartable, nunca ejecutadas sobre los proyectos de usuario.
- `.github/workflows/visura-shared-core-isolated.yml`: ejecutor de GitHub Actions con PostgreSQL 16 efímero.

## Puertas técnicas pendientes

- Identidad del actor verificada en servidor real, asignaciones de módulos y almacenes reconciliadas con los dos proyectos.
- Evitar el acceso del operario INVENTA a stock durante recuento ciego; probar RLS/roles como usuarios no privilegiados en un Supabase descartable.
- Proteger el cambio `staged -> validated`, validar hash del archivo y digest de filas bajo una única operación autorizada; hoy solo se prueba inmutabilidad de líneas al salir de `staged`.
- Compatibilidad con todas las importaciones Excel reales autorizadas, posiciones fijas e informes de PREPARA.
- Pruebas de Auth, Storage, PDFs, ejecución simultánea de clientes, respaldo y reversión.
- Cualquier modificación de PREPARA/INVENTA o ejecución de migración real necesita aprobación específica; no se fusiona la PR #22.

**Continuidad segura siguiente:** corregir cualquier fallo del workflow aislado; diseñar transición protegida de validación y política de permisos de lectura verificable, sin tocar datos empresariales.
