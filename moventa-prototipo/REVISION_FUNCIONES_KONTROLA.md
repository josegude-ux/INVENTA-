# MOVENTA — Revisión real de funciones KONTROLA

Fecha: 25/10/2026. Proyecto origen: `oevetnszmfxeukcncwji`. Consulta de solo lectura a `pg_get_functiondef`.

## Comportamiento confirmado
- `kontrola_es_administrador()`: exige fila en `usuarios_app`, `activo=true`, `rol='administrador'` y `id=auth.uid()`.
- `kontrola_usuario_activo()`: exige `usuarios_app.activo=true`, rol `operario` o `administrador` e identidad actual.
- `kontrola_puede_almacen(p_almacen)`: administrador activo puede acceder; operario activo necesita almacén activo. **Si el usuario no tiene ninguna fila en `kontrola_usuario_almacenes`, puede acceder a todos los almacenes activos**. Si tiene asignaciones, solo a las marcadas activas.
- Las tres son `STABLE SECURITY DEFINER` y declaran `SET search_path TO ''`; usan referencias cualificadas.

## Decisión de diseño para MOVENTA
**Decisión confirmada por el usuario (25/10/2026): los operarios activos pueden acceder a todos los almacenes activos.** No se requerirá asignación individual por almacén. En la integración MOVENTA, el acceso a almacenes se basará en usuario activo y acceso habilitado al módulo KONTROLA; se mantiene la comprobación de almacén activo. Los roles y funciones administrativas seguirán restringidos. Revisar las políticas y RPC para que cualquier asignación histórica no limite accidentalmente este acceso global.

## Siguiente trabajo de implementación
1. Definir esquema `moventa_app_access` para permisos separados por módulo y sus políticas RLS; mantener la administración de INVENTA sin autopromoción.
2. Diseñar mapeo entre `profiles.user_id` y `usuarios_app.id` para identidad única.
3. Adaptar funciones de KONTROLA al nuevo esquema y revisar todos los RPC de escritura.
4. Probar permisos por rol, almacén y módulo en entorno de pruebas antes de migrar o publicar.

**Sin cambios en Supabase ni en aplicaciones instaladas.**
