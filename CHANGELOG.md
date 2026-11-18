# Registro de cambios · VISURA INVENTA

## 0.32.1 · 2026-11-18 · PROBADO LAB (rama lab/100-pareja-20261118, línea 100)

- «Mi tramo» en Mis recuentos: tramo, recuento (primero o segundo ciego), pareja con nombres, avance «N de M», siguientes ubicaciones en orden de recorrido y preselección de la siguiente pendiente.
- Pareja: un móvil y un único recuento. Cada apunte queda a nombre de quien tiene la sesión abierta, y el servidor fija la pareja desde el tramo (el navegador no la envía ni puede falsearla).
- Relevo: solo si no quedan apuntes sin confirmar; entonces se cierra la sesión para que entre la otra persona. La cola del móvil nunca se borra.
- Servidor (migración pendiente): `inventa.my_segments()` (lectura por GET, sin cantidades) y pareja automática en `counts`.
- Pruebas: laboratorio 91 comprobaciones + concurrencia; reversión 7/7; interfaz 72/72.

## 0.32.0 · 2026-11-18 · PROBADO LAB (rama lab/100-tramos-unificado-20261118, línea 100)

- Tramos de la línea 100 (0.30.14, PR #27) trasladados a la unificación, según D2 de 000: esquema `inventa` / `inventa_internal`.
- Gestión almacén → Tramos: rango en un paso para una o dos personas, vista previa, sin solapes, segundo recuento ciego, idempotencia; reasignar y liberar con motivo y versión.
- El recuento real solo usa asignaciones activas.
- Migración **pendiente** en `supabase/visura-unificado-pendiente/` (no aplicada) y su reversión.
- Laboratorio: las 5 migraciones de la unificación + tramos, 84 comprobaciones + concurrencia; reversión 7/7. CI con PostgreSQL 17.

## Sin cambio de versión · 2026-11-18 · PROBADO LAB · CI «INVENTA checks» en verde (rama lab/100-ci-previos-20261118, línea 100)

- Se corrigen los 12 fallos previos de las pruebas; no cambia código de la aplicación, solo `tests/`.
- 9 fallaban porque los entornos de prueba no tenían `homeIcon`, que la app real define en `index.html`: se simula en los arneses.
- 2 comprobaban versiones fijas antiguas (`?v=0.30.5`): ahora se comprueba que cada script que carga `index.html` está en la caché del service worker con la misma versión, sea cual sea.
- 1 expresión de CSS admite el `;` final que añadió la fase A.
- Resultado: 51/51.

## Sin cambio de versión · 2026-11-18 · migraciones de la unificación

- `supabase/visura-unificado/`: las 5 migraciones ya aplicadas en el Supabase unificado (control-cargas-movil), incluida la retirada de F2. Sin datos personales; ver el README de la carpeta. La aplicación no cambia (sigue en 0.31.2).

## 0.31.2 · 2026-11-18 · PROGRAMADO (rama lab/000-unificacion-inventa-20261118)

- La importación de existencias BC ignora las líneas vacías del diario de Business Central (sin artículo, ubicación, descripción, lote ni unidad, y con stock 0), avisando con una advertencia. Antes bloqueaban toda la carga («Fila 2: … inválidos»).
- Cualquier fila con algún dato pero incompleta, o vacía con stock distinto de 0, sigue siendo un error.
- Prueba nueva con datos ficticios.

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
