# Auditoría de autenticación: INVENTA (lectura de código)

Fecha: 2026-10-25. Fuente: rama principal de INVENTA, `index.html` y `warehouse-management.js`.

## Hallazgos confirmados
- INVENTA usa el mismo proyecto Supabase que MOVENTA: `wlejxnpphysogrzcxjfh`.
- INVENTA implementa Auth mediante peticiones REST a `/auth/v1/token?grant_type=password`, no mediante el cliente `supabase-js` usado por MOVENTA.
- Guarda su sesión en `localStorage` con clave `inventa-real-auth-v1`, mientras MOVENTA utiliza el almacenamiento predeterminado de supabase-js.
- INVENTA carga `warehouse-management.js` desde `index.html` y comprueba un perfil interno para autorizar la gestión. Los permisos de MOVENTA no sustituyen estos roles.
- Ambos están previstos en rutas bajo `josegude-ux.github.io`; si MOVENTA se publica en ese mismo origen, localStorage es compartido por origen pero **las claves de sesión son diferentes**. En otros orígenes no hay almacenamiento compartido.
- No se ha verificado todavía la autenticación de KONTROLA: la ruta `index.html` del repositorio `josegude-ux/KONTROLA` no se pudo recuperar.

## Próxima implementación segura
1. Verificar la ubicación real de KONTROLA y su Supabase Auth.
2. Para INVENTA, diseñar un adaptador de sesión **solo en rama de pruebas** que sincronice los eventos de Auth con su gestor interno; no copiar tokens por URL.
3. Añadir pruebas de cierre de sesión y refresco de tokens, además de las pruebas de permisos.
4. Probar la integración en navegador y iPhone antes de publicar. No reemplazar roles internos ni migrar datos por este cambio.

**Estado:** auditoría de INVENTA completada a nivel de código; SSO no implementado ni probado.
