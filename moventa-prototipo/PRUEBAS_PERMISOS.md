# MOVENTA · Pruebas de permisos (fase de implementación)

## Archivo SQL
`moventa-prototipo/sql/001_app_access.sql` define la primera tabla de permisos independientes por módulo.

**Estado:** SQL versionado en la rama de pruebas; **NO aplicado** a Supabase. No cambia las aplicaciones publicadas.

## Contrato
- `user_id` referencia al usuario de Supabase Auth del proyecto común.
- `app_id`: `inventa` o `kontrola`.
- `app_role`: `admin`, `operator`, `viewer`; este rol no sustituye todavía los roles internos de INVENTA y KONTROLA.
- `enabled=false` por defecto: el acceso no se concede automáticamente.
- Solo el usuario autenticado puede leer sus propias autorizaciones; no puede autoasignarse permisos.
- Las modificaciones de acceso requerirán una interfaz administrativa y un procedimiento privilegiado revisado.

## Pruebas pendientes tras aplicación en entorno controlado
1. Usuario sin filas: ninguna aplicación disponible.
2. Usuario con INVENTA habilitada: INVENTA visible, KONTROLA oculta.
3. Usuario con ambas: dos accesos.
4. Usuario deshabilitado: acceso denegado por el backend.
5. Intentos de insertar o modificar permisos desde el cliente: rechazados.
6. Acceso directo a la API de KONTROLA sin permiso: rechazado tras adaptar sus funciones y RLS.
7. Operario autorizado de KONTROLA: acceso a todos los almacenes activos, sin asignación individual.

**Advertencia:** ocultar tarjetas en MOVENTA no constituye autorización suficiente. Las tablas y RPC de cada aplicación deben validar el permiso de módulo en servidor. No aplicar la tabla aislada y afirmar que la integración está terminada.
