# VISURA — Seguridad centralizada (diseño inicial, 26/10/2026)

Estado: especificación en rama aislada. NO desplegado ni aplicado a Supabase.

## Reglas acordadas
- Una cuenta personal (usuario y contraseña) por operario; sin cuentas compartidas por terminal.
- Un administrador puede desactivar un usuario y revocar individualmente un dispositivo extraviado, sin afectar a otros usuarios ni borrar los datos compartidos.
- Una aplicación desactualizada no debe poder eludir el bloqueo: todas las lecturas y escrituras de datos privados se autorizan en servidor (RLS y funciones con validación de sesión/dispositivo).
- Una PWA no puede garantizar borrado remoto mientras esté desconectada; al reconectar se deniega el acceso y se limpia la caché privada que esté bajo control de la aplicación. El service worker no debe cachear respuestas autenticadas ni datos personales.
- No guardar credenciales en claro ni contraseñas propias en tablas de aplicación. Utilizar Supabase Auth y perfiles separados. Reautenticar periódicamente, caducar sesiones y aplicar límites de acceso offline.
- Mantener trazabilidad de operaciones previas del operario bloqueado.
- Business Central sin conexión directa: solo cargas manuales Excel/PDF según la aplicación.
- Datos actuales de prueba; no autoriza cambios destructivos ni modificación de Business Central.

## Diseño a implementar, previa inspección y pruebas
1. Inventariar Auth, perfiles, roles, políticas RLS, almacenamiento local y service workers de ambas PWA.
2. Definir modelo de usuarios, dispositivos registrados, sesiones y revocaciones. Identificador de dispositivo generado por instalación, no basado en fingerprinting; secretos del servidor fuera del cliente.
3. Crear políticas de mínimo privilegio para cada tabla/RPC y comprobar que el usuario revocado no puede acceder ni con tokens antiguos aún vigentes. La revocación de refresh token por sí sola no invalida necesariamente JWT emitidos.
4. Construir panel administrativo: usuarios, roles, dispositivos, último acceso, desactivar usuario, revocar terminal y auditoría. Exigir permisos administrativos en servidor.
5. En arranque y retorno a primer plano comprobar sesión y estado; ante revocación, bloquear interfaz, eliminar datos privados locales accesibles y cerrar sesión. Sin conexión, bloquear operaciones privadas cuando caduque la autorización local; evitar datos privados persistentes.
6. Probar con dos usuarios y dos dispositivos: revocar uno sin bloquear otro, usuario despedido, sesión antigua, app sin actualizar, sin red, PWA iOS/Android/Windows y RLS.
7. Preparar migración de Auth compartida entre proyectos Supabase actualmente separados: una sesión central requiere arquitectura y proyecto de autenticación compatibles; no asumir SSO entre proyectos por compartir nombre de usuario.
8. Mantener la implementación en PR aislada; no publicar ni aplicar migraciones sin verificación de compatibilidad.

## Continuidad
Consultar también `moventa-prototipo/VISURA_0_1_CONTINUIDAD.md`. Actualizar `docs/CONTINUIDAD.md` del repositorio de cada aplicación en el mismo commit que sus cambios funcionales. Ninguna función de esta especificación se considera implementada.
