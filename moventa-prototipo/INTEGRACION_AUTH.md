# MOVENTA · Autenticación compartida (especificación)

La sesión única requiere que los dos módulos usen el mismo proveedor/proyecto de Supabase Auth. Compartir solo un correo no comparte sesión. Si se sirven desde orígenes distintos, el almacenamiento local de tokens no se comparte: se necesita redirección segura de autenticación o módulos bajo un mismo origen.

## Contrato propuesto
- Tabla `platform_app_access`: `user_id uuid`, `app_id text`, `role text`, `enabled boolean`; clave única `(user_id, app_id)`.
- Roles de aplicación: `admin`, `operator`, `viewer`; la UI no es un control de seguridad.
- RLS basada en `auth.uid()` para lecturas y escrituras; permisos de administrador verificados en servidor.
- No colocar claves `service_role` en JavaScript cliente.
- Antes de implementar: confirmar estructura real de Supabase, dominios, rutas de KONTROLA y despliegue de MOVENTA.

## Pruebas
1. Inicio de sesión en MOVENTA y acceso a ambos módulos sin volver a autenticarse.
2. Usuario autorizado a INVENTA pero no KONTROLA.
3. Usuario autorizado a ambos módulos.
4. Revocación de acceso, expiración y cierre de sesión.
5. Sincronización entre dos dispositivos.

**Estado:** contrato propuesto, no autenticación implementada.
