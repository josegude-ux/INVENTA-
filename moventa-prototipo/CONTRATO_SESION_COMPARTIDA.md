# Contrato de integración de sesiones MOVENTA (borrador)

## INVENTA (mismo proyecto Supabase)
- MOVENTA es la autoridad de sesión con supabase-js.
- INVENTA debe consumir `getSession()` y suscribirse a `onAuthStateChange`, sin mantener un segundo login REST en el módulo integrado.
- Mantener comprobaciones de roles internos y RLS en servidor; `app_access` solo controla la entrada al módulo.
- Verificar caducidad, refresh, cierre de sesión, usuario cambiado y acceso revocado. Nunca pasar tokens por URL ni guardarlos en logs.

## KONTROLA (proyecto Supabase distinto)
- No copiar access/refresh tokens del proyecto MOVENTA al de KONTROLA: no son intercambiables.
- Antes de implementar SSO elegir y probar un proveedor de identidad común admitido por ambos proyectos o una migración de Auth controlada a un proyecto común.
- Mantener datos, RLS, roles internos y buckets privados separados hasta demostrar equivalencia de permisos.
- El acceso a todos los almacenes activos para operarios autorizados es una decisión funcional, no equivale a acceso anónimo.

## Pruebas obligatorias antes de producción
1. Usuario sin sesión no puede leer módulos ni datos.
2. Usuario con permiso INVENTA únicamente no accede a KONTROLA.
3. Usuario con ambos permisos abre ambos módulos sin login adicional.
4. Revocar permisos, cerrar sesión y caducar tokens impide nuevas lecturas.
5. Confirmar que roles de administración y buckets privados siguen protegidos.
6. Probar en navegador, PWA iPhone y PC.

**Estado:** contrato documental. No ejecuta cambios en producción ni implementa SSO.