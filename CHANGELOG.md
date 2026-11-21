# Registro de cambios · VISURA INVENTA

## Sin cambio de versión · 2026-11-21 · guion de homologación de «Mi tramo» R2 (rama lab/100-homologacion-mi-tramo-20261118, línea 100)

- El guion apunta a la versión publicada 0.32.3 y a la migración aplicada `supabase/visura-unificado/20261118221403_inventa_tramos.sql`.
- Se añade la comprobación parcial R1–R5, ya hecha (solo lectura, CP100-023). Los pasos H02–H16 no cambian.
- Se fusiona el main actual en la rama. Nueva prueba `tests/homologacion-guion.test.cjs`. Pruebas: laboratorio de tramos 118 OK + ensayo H02–H16 + reversión 7/7 (PostgreSQL 16 desechable), interfaz 262/262.

## 0.32.3 · 2026-11-21 · PROBADO LAB (rama lab/100-recuperar-contrasena-20261119, línea 100)

- Renumerada desde 0.32.2 por decisión del usuario (CP000-030): la 0.32.2 queda reservada al recuento ciego. Mismo contenido funcional.

- Acceso seguro: botón **He olvidado mi contraseña**. Supabase envía un enlace y, al abrirlo, INVENTA pide la contraseña nueva dos veces y deja a la persona dentro.
- El aviso es igual exista o no la cuenta. Los códigos del enlace se borran de la barra de direcciones y la contraseña nunca se guarda en el móvil.
- Mensajes en castellano para el enlace caducado, la contraseña repetida o débil, el límite de correos y la dirección no autorizada. Si fallan las credenciales, se indica cómo recuperarlas.
- Pendiente en Supabase (decide 000): añadir la dirección de INVENTA a Redirect URLs y configurar un servidor de correo propio (SMTP). Ver `docs/RECUPERAR_CONTRASENA.md`.
- Pruebas: 88/88 (16 nuevas) y recorrido en el navegador con Supabase simulado.
## Sin cambio de versión · 2026-11-18 · migración de tramos APLICADA en el Supabase unificado (línea 100)

- `inventa_tramos` aplicada en `oevetnszmfxeukcncwji` como versión `20261118221403`. Resuelve la incidencia CP100-012: la 0.32.1 publicada ya tiene su servidor.
- El archivo pasa de `supabase/visura-unificado-pendiente/` a `supabase/visura-unificado/20261118221403_inventa_tramos.sql`, idéntico (MD5 `b557dddca46e6c87e1ca16d57132a537`).
## Sin cambio de versión · 2026-11-18 · guion de homologación de «Mi tramo» (rama lab/100-homologacion-mi-tramo-20261118, línea 100)

- `docs/HOMOLOGACION_MI_TRAMO.md`: guion H01–H17 para el móvil (pareja, relevo, segundo recuento ciego, solapes, idempotencia, reasignación y cierre) con datos ficticios.
- `supabase/homologacion/ficticio_mi_tramo.sql`: 10 ubicaciones ZZH, 2 artículos ZZHOM, campaña en borrador y teórico ficticio. Se puede repetir sin duplicar y **se niega si hay otra campaña activa**, para no mezclarse con un inventario real.
- `tests/tramos-lab/050_ensayo_homologacion.sql`: ensayo de H02–H16 en PostgreSQL desechable (también en CI).
- Hallazgo: solo puede haber una campaña activa. En el unificado ya está activa la real, así que la homologación va al entorno LAB (D3).

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
