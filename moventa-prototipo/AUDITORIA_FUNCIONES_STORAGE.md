# MOVENTA · Auditoría de funciones, escrituras y Storage — 25/10/2026

## Comprobaciones reales, solo lectura
Proyecto KONTROLA: `oevetnszmfxeukcncwji`.

- `kontrola_es_administrador()`, `kontrola_puede_almacen(p_almacen text)` y `kontrola_usuario_activo()` existen y están marcadas `SECURITY DEFINER`.
- Para `kontrola_cargas`, `kontrola_preparaciones` y `kontrola_importaciones`, `pg_policies` devolvió únicamente políticas `SELECT`. No aparecen políticas INSERT/UPDATE/DELETE en estas tres tablas. Esto no prueba que la aplicación no escriba: podría utilizar RPC o funciones privilegiadas.
- Storage contiene buckets privados `kontrola-pdfs` y `pdf-cargas`.

## Riesgos antes de migrar
1. Auditar el código de las funciones `SECURITY DEFINER`, `search_path`, grants EXECUTE y llamadas RPC; no trasladarlas sin revisión.
2. Identificar las funciones de escritura que puedan operar con privilegios y comprobar sus autorizaciones.
3. Migrar documentos privados conservando políticas Storage y rutas, no exponer buckets.
4. Ejecutar pruebas de acceso permitido y denegado por usuario, rol y almacén.

**No se modificó ninguna base ni aplicación.**
