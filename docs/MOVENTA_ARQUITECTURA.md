# MOVENTA — arquitectura y conservación de instalaciones

Fecha: 2026-10-25. Rama: `moventa/arquitectura-pruebas`.

## Decisión
MOVENTA es la plataforma principal. INVENTA y KONTROLA son aplicaciones hermanas, no anidadas entre sí. El objetivo final es **un solo icono MOVENTA** y un inicio de sesión compartido.

## Restricciones verificadas
- INVENTA estable publica `index.html`, `manifest.webmanifest` con `id: "./"`, `start_url: "./"`, `scope: "./"` y `service-worker.js` en la raíz de su sitio.
- Cambiar el `id`, el ámbito, el origen o la URL de instalación puede causar que el sistema considere la PWA una aplicación distinta; **no garantizar ausencia de reinstalación** sin probarlo en dispositivos.
- KONTROLA conserva su propia URL y repositorio; MOVENTA no debe reubicar sus archivos.
- Los datos son ficticios y pueden migrarse o reiniciarse, pero la identidad PWA y las instalaciones merecen pruebas independientes.

## Prototipo
`moventa-preview/index.html` ofrece una pantalla de selección de aplicaciones y enlaces reales a sus URLs actuales. **No es aún una SPA integrada**: navegar a otro origen puede abrir el navegador y requerir otra sesión. No afirmar SSO.

## Fases
1. Probar la pantalla de selección aislada sin cambiar el inicio de INVENTA.
2. Elegir el origen y la identidad PWA definitiva de MOVENTA; probar la actualización sobre una instalación de ensayo en iPhone y Windows.
3. Crear identidad y permisos compartidos en Supabase, con roles por aplicación/almacén.
4. Adaptar INVENTA y KONTROLA para navegar bajo el contenedor MOVENTA sin redirecciones externas ni sesiones duplicadas; comprobar offline, rutas, botón atrás y caché.
5. Publicar solo después de las pruebas en dispositivos y aprobación expresa.

## Estado
Rama y prototipo aislados; ninguna instalación actual modificada. No se han tocado bases de datos ni KONTROLA.
