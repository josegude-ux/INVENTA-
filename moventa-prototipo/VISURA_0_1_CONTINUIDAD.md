# VISURA 0.1 — Continuidad maestra (26/10/2026)

> Punto de recuperación del chat «MOVENTA 0.3» al nuevo «VISURA 0.1». Documento de coordinación del lanzador anterior MOVENTA, conservado en su rama aislada. No equivale a una publicación, migración de datos ni validación funcional de los dispositivos.

## Identidad y límites

- VISURA: marca matriz, plataforma de entrada con un solo icono y acceso a aplicaciones hermanas.
- VISURA INVENTA: nombre comercial de INVENTA, repositorio técnico `josegude-ux/INVENTA-`.
- VISURA PREPARA: nombre comercial de KONTROLA, repositorio técnico `josegude-ux/KONTROLA`.
- MOVENTA: nombre anterior del proyecto lanzador. Está en `INVENTA-`, rama `moventa/prototipo-lanzador`, directorio `moventa-prototipo/`, sin integración funcional definitiva.
- Conservar nombres técnicos, URLs, ID PWA, cuentas, tablas y despliegues hasta decisión explícita. No utilizar Cursor como procedimiento. Priorizar móviles y no borrar funciones ni datos.

## Verificado directamente en GitHub el 26/10/2026

- KONTROLA rama operativa `cursor/verificacion-fisica-cargas-8ba0`: commit `980fd9df854ce6accc59f569657661601f8c096e` incorpora v0.3.29, incluyendo selección/mensajes de almacén. CI de esa revisión correcta (run 40244112263) y acción de Pages de pruebas correcta (run 40244107243). Publicación real en dispositivos no verificada.
- KONTROLA v0.3.27: cuatro escenas tridimensionales locales propias (preparación, verificación, control de cargas y administración), sin repetir ni reutilizar INVENTA.
- KONTROLA v0.3.28: recuperados el flujo de preparación con reloj de servidor, tratamiento explícito de errores y botón Volver superior izquierdo común. Integrados en la rama operativa; aceptación física iPhone/Android/Windows pendiente.
- KONTROLA PR #28 `branding/visura-prepara-20261026`: versión propuesta 0.3.30, etiquetas/icono vectorial provisional VISURA PREPARA. CI del commit `cf48fcec942a7b1ee8de4b738bcefd4a018389a0` correcta, run 40246152495. No fusionada ni desplegada.
- INVENTA main: versión estable comunicada 0.30.5, CI y Pages correctos. PR #18 mejora de importador 0.30.6 y PR #19 vista de prueba aislada; no considerar ambas como producción.
- INVENTA PR #20 `branding/visura-inventa-20261026`: VISURA INVENTA comercial, CI run 40246072694 correcta. No fusionada ni desplegada.
- El ZIP `VISURA_Identidad_3D(1).zip` con recursos aprobados no está incorporado a las PR de marca ni accesible como archivo binario en esta recuperación. No inventar ni sustituir automáticamente sus diseños.

## Verificado directamente en Supabase el 26/10/2026 (solo lectura)

- INVENTA / proyecto `wlejxnpphysogrzcxjfh`: activo; 1.853 artículos, 794 ubicaciones, 2 campañas, tabla `moventa_app_access` con 2 asignaciones (una a cada app). RLS activo en tablas inspeccionadas.
- KONTROLA / proyecto `oevetnszmfxeukcncwji` (`control-cargas-movil`): activo; 14 cargas, 15 importaciones, 14 revisiones, 2 preparaciones, 3 almacenes, 18 eventos de actividad. Todas las 14 cargas están en `COR_01_COR`: 12 publicadas, 2 preparadas; ninguna en Ferrol. Las cifras son una fotografía temporal y pueden variar.
- La pantalla vacía vista en pruebas coincide con selección de Ferrol sin cargas en esa tabla; **no se ha producido un vaciado general**. Si vuelve a haber ceros, comprobar almacén, versión PWA, conexión, permisos/RLS y respuesta RPC antes de modificar datos.
- En INVENTA existe la migración `moventa_app_access_initial`; los proyectos Supabase de INVENTA y KONTROLA siguen separados. Una lista de permisos no equivale a inicio de sesión único. No migrar tablas, Auth o Storage sin revisión/autorización.

## Prioridad de continuación

1. Preservar PREPARA v0.3.29, preparar incorporación de los recursos gráficos oficiales en las PR #28 y #20 sin tocar funcionamiento. No modificar INVENTA funcional ni trasladar datos por una decisión de marca.
2. Verificar en dispositivos instalados preparación, reloj, cambio de almacén, pantalla de Verificación, consulta en solo lectura y botón Volver; comprobar caché/versiones y sincronización con dos dispositivos.
3. Probar la identidad visual oficial VISURA MATRIZ distinta de las otras dos, iconos PWA en iOS/Android/Windows y no duplicación de ilustraciones entre tarjetas.
4. Estudiar el origen canónico y Auth común de la plataforma VISURA. Mantener las dos bases separadas hasta contar con plan reproducible, políticas RLS y aceptación expresa de migración.
5. No publicar ni fusionar las PR de marca mientras falten los recursos oficiales y validación móvil. No alterar Business Central: entrada de PDF manual, sin integración directa ni escritura.
6. Al siguiente avance actualizar el documento de continuidad propio del proyecto modificado en el mismo commit; anotar SHA, CI, pruebas físicas, pendientes e incidencias.

## Enlaces de referencia

- https://github.com/josegude-ux/KONTROLA/blob/cursor/verificacion-fisica-cargas-8ba0/docs/CONTINUIDAD.md
- https://github.com/josegude-ux/KONTROLA/pull/28
- https://github.com/josegude-ux/INVENTA-/pull/20
- https://github.com/josegude-ux/INVENTA-/pull/18
- https://github.com/josegude-ux/INVENTA-/pull/19

## Protocolo de lectura en «VISURA 0.2» y sucesivas conversaciones

Leer primero este fichero, luego `docs/CONTINUIDAD.md` de las ramas operativas y propuestas, revisar los HEAD y CI actuales en GitHub, comprobar Supabase solo lectura y contrastar con las decisiones de usuario. Conservar problemas pendientes sin convertirlos en funciones terminadas. No reiniciar desde cero ni dar por publicada una rama de desarrollo.
