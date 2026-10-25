# MOVENTA — Auditoría RLS KONTROLA (25/10/2026)

Consulta de solo lectura al proyecto `oevetnszmfxeukcncwji` mediante `pg_policies`.

## Políticas verificadas
- `kontrola_cargas` / `kontrola_cargas_lectura`: `kontrola_puede_almacen(almacen)`.
- `kontrola_importaciones` / `kontrola_importaciones_admin`: `kontrola_es_administrador()`.
- `kontrola_preparaciones` / `kontrola_preparaciones_propias`: `kontrola_es_administrador() OR (kontrola_usuario_activo() AND operario_id = auth.uid())`.

Estas reglas son específicas de KONTROLA y deben preservarse funcionalmente al migrar: acceso por almacén, importación reservada a administración y preparaciones propias para operarios activos. Copiar solo tablas o sustituir las políticas por `auth.uid() IS NOT NULL` abriría accesos indebidos.

## Próximas tareas
- Inspeccionar funciones `kontrola_puede_almacen`, `kontrola_es_administrador`, `kontrola_usuario_activo` y dependencias, incluyendo `SECURITY DEFINER` y privilegios de ejecución.
- Inspeccionar políticas de escritura, buckets Storage y rutas de documentos.
- Crear pruebas de autorización denegada/permitida con identidades de prueba.
- Preparar scripts de migración versionados; no aplicar a proyectos activos ni publicar PWA sin revisión.

**Estado:** políticas de lectura auditadas parcialmente; ningún cambio en base de datos.
