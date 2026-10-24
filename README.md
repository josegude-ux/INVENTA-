# INVENTA — Demostración instalable del operario v0.15

Esta versión sirve exclusivamente para probar una experiencia móvil de inventario, sin tocar Business Central ni Supabase.

## Instalación

En iPhone/iPad, abrir la URL publicada por HTTPS con Safari > Compartir > Añadir a pantalla de inicio. En Android, abrir con Chrome > Instalar aplicación.

## Recorrido

1. Identificarse: operario 1/2 y PIN ficticio **1234**.
2. Seleccionar una ubicación ficticia. Confirmar su etiqueta o visualmente.
3. Seleccionar artículo, o registrar provisionalmente otro no listado. Las existencias teóricas nunca se muestran.
4. Contar con el teclado aprobado (B): introducir sueltos o palés (cajas por base × alturas × unidades/caja), sumar varias líneas, deshacer.
5. Revisar el total y guardar. Si la diferencia absoluta supera una tolerancia de prueba `max(2 unidades, floor(5% teórico))`, aparece una advertencia sin revelar el teórico.
6. Marcar artículos no encontrados y cerrar la ubicación únicamente cuando todos están revisados. Revisiones y cambios en la demo no requieren autorización real.

**Seguridad**: El PIN es ficticio. El almacenamiento local es una simulación. El trabajo en varios dispositivos, el bloqueo real de ubicaciones, el respaldo y los conflictos offline serán responsabilidad del backend definitivo. Esta versión NO debe usarse para inventarios reales.

## Publicación en GitHub desde el iPhone

Los 8 archivos están en la raíz del ZIP, sin subcarpetas. En la app Archivos del iPhone, descomprime el ZIP. En github.com/josegude-ux/INVENTA-, usa Add file > Upload files y selecciona **todos** los archivos extraídos (incluidas las cuatro imágenes PNG), y confirma Commit changes. Por último, Settings > Pages > Deploy from a branch > main > /(root). Al terminar la publicación, visita `https://josegude-ux.github.io/INVENTA-/` desde Safari y Share > Add to Home Screen.
