# Auditoría autenticación KONTROLA — 2026-10-25

## Ubicación verificada
Repositorio `josegude-ux/KONTROLA`, rama `cursor/verificacion-fisica-cargas-8ba0`. Entrada `index.html` que importa `src/app.mjs`; configuración en `src/config.mjs`. Versión declarada 0.3.20. Otra versión de `index.html` existe en `desarrollo/fase-1-operario`.

## Arquitectura confirmada
- KONTROLA: proyecto Supabase `oevetnszmfxeukcncwji`, distinto al de INVENTA/MOVENTA (`wlejxnpphysogrzcxjfh`).
- KONTROLA utiliza `createClient` de `vendor/supabase.mjs` con persistencia y refresco de sesión y login `signInWithPassword`.
- INVENTA utiliza autenticación REST y almacena sesión en `inventa-real-auth-v1`.
- MOVENTA utiliza supabase-js y consulta `moventa_app_access` en proyecto INVENTA.

## Implicación
La sesión Supabase del proyecto INVENTA no es válida automáticamente para el proyecto KONTROLA. Los permisos de `moventa_app_access` solo habilitan el acceso en el lanzador, no autentican ni conceden roles dentro de KONTROLA. No transferir tokens mediante URL ni suplantar identidades.

## Siguiente diseño
Evaluar identidad federada/OIDC compatible para ambos proyectos o backend seguro que emita sesiones de cada proyecto tras validar una identidad central; comprobar compatibilidad real antes de implementar. Mantener políticas RLS, roles y almacenes de KONTROLA. Preparar pruebas de login, logout, refresh, acceso denegado y permisos de almacén. No publicar ni cambiar producción.
