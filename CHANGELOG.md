# Registro de cambios · VISURA INVENTA

## 0.31.0 · 2026-11-18 · PROGRAMADO (rama lab/000-unificacion-inventa-20261118)

- Conexión al proyecto Supabase unificado de VISURA (`oevetnszmfxeukcncwji`, control-cargas-movil) en lugar del proyecto INVENTA (`wlejxnpphysogrzcxjfh`).
- Todas las llamadas REST y RPC usan el esquema `inventa` (cabeceras `Accept-Profile` y `Content-Profile`).
- Nueva clave de sesión local `visura-inventa-auth-v2`: las sesiones del proyecto anterior no se reutilizan y el usuario vuelve a iniciar sesión.
- Caché del service worker `inventa-demo-v0310-01`.
- Sin cambios funcionales. El proyecto INVENTA original queda intacto como respaldo.

## 0.30.12

- Pulido visual de Gestión almacén (CP031).
