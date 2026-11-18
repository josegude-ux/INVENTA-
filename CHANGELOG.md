# Registro de cambios · VISURA INVENTA

## 0.31.1 · 2026-11-18 · PROGRAMADO (rama lab/000-unificacion-inventa-20261118)

- Lectura de los Excel exportados directamente desde Business Central. BC genera el .xlsx con el espacio de nombres prefijado (`<x:workbook>`) y rutas absolutas (`/xl/...`), y ExcelJS fallaba con «undefined is not an object (evaluating 'e.sheets')».
- Nuevo `xlsx-normalize.js`: antes de leer, reescribe solo esos detalles del formato, sin tocar valores. Si el Excel ya es normal, lo deja intacto. Se usa en la importación de existencias BC y en la de posiciones fijas.
- Prueba nueva `tests/xlsx-normalize.test.cjs` con un Excel ficticio en formato BC.
- La prueba de scripts precargados pasa de 6 a 7 scripts.

## 0.31.0 · 2026-11-18 · PROGRAMADO (rama lab/000-unificacion-inventa-20261118)

- Conexión al proyecto Supabase unificado de VISURA (`oevetnszmfxeukcncwji`, control-cargas-movil) en lugar del proyecto INVENTA (`wlejxnpphysogrzcxjfh`).
- Todas las llamadas REST y RPC usan el esquema `inventa` (cabeceras `Accept-Profile` y `Content-Profile`).
- Nueva clave de sesión local `visura-inventa-auth-v2`: las sesiones del proyecto anterior no se reutilizan y el usuario vuelve a iniciar sesión.
- Caché del service worker `inventa-demo-v0310-01`.
- Sin cambios funcionales. El proyecto INVENTA original queda intacto como respaldo.

## 0.30.12

- Pulido visual de Gestión almacén (CP031).
