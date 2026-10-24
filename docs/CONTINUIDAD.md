# INVENTA — Ficha maestra de continuidad

**Actualizada:** 2026-10-25  
**Repositorio:** `josegude-ux/INVENTA-`  
**Alcance:** solo INVENTA. No mezclar tareas con KONTROLA, MOVENTA, Control de Cargas, Control de Tanques ni Mi Jornada.

> Esta ficha conserva el contexto funcional y el estado comunicado en ChatGPT/Cursor. **No convierte en terminada ninguna función que no haya sido comprobada en código, pruebas y entorno real.** En caso de conflicto, verificar GitHub, Supabase y las decisiones del usuario antes de actuar.

## Estado y versiones

- **0.30.5:** última versión estable comunicada como publicada y en uso en el iPhone. El usuario confirma que **todas las referencias de artículos de Business Central ya están cargadas**. No repetir la importación general como si faltase.
- **0.30.6 candidata:** mejoras del selector de Excel de Business Central en Safari/iPhone, conservación de archivos elegidos, visualización de nombre/tamaño, tolerancia a fallos de ExcelJS y caché PWA.
- **PR #18:** https://github.com/josegude-ux/INVENTA-/pull/18 — rama `cursor/consolidate-bc-import-234d`, commit `ac2aa7c1accfefd30cfed295bc136c8cc13affc4`, pendiente de fusión en la última consulta.
- **PR #19:** https://github.com/josegude-ux/INVENTA-/pull/19 — vista previa aislada para el iPhone; rama `cursor/iphone-import-preview-234d`, commit `199134d34845204b3bccefe9f23f6defe4ed8bf5`, borrador, no se debe confundir con una publicación de INVENTA.
- La PR #18 informó 41 pruebas locales correctas; la demo aislada de la PR #19 informó 44. Las pruebas remotas **no sustituyen** una validación física en Safari.
- La URL temporal de la demo Cloudflare **no es una URL permanente**, ni el repositorio debe depender de ella.

## Decisiones funcionales

- PWA para móvil y PC. En iPhone: interfaz limpia, botones grandes, pocos elementos por pantalla.
- Flujo táctil de recuento: **ubicación → artículo → cantidad → revisión**. Cantidad inicial seleccionable para sobrescribir y calculadora para sumas como `12 + 8 + 5`.
- Roles contemplados: **Operario, Supervisor, Administrador**. Los permisos deben comprobarse en servidor/Supabase, no solo en botones.
- Recuento individual y en pareja; en pareja: **un único dispositivo y un único recuento**, con identificación y trazabilidad.
- **Recuento ciego** para operarios durante campañas; las cantidades teóricas de BC no deben filtrarse al cliente del operario.
- Existencias, ubicaciones, posiciones fijas e importaciones BC: conservar lo que existe y evitar duplicaciones o pérdida de datos.
- La integración con Supabase y los ciclos de campañas, revisiones, diferencias y sincronización requieren verificación de su implementación real antes de darla por concluida.

## Prioridades al retomar

1. Leer este documento y `.cursor/rules/inventa.mdc`.
2. Consultar estado actual de `main`, PR #18, PR #19, migraciones y pruebas; distinguir diseño aprobado, función demostrada y función integrada.
3. **No regresar a la importación masiva de referencias**: ya está resuelta para el uso actual, según el usuario.
4. Avanzar en la operación real de campañas de inventario, recuentos, diferencias, incidencias y sincronización, empezando por el primer bloque efectivamente pendiente tras inspeccionar el código.
5. Proteger los datos reales de Supabase y no alterar Business Central sin autorización.
6. Nunca fusionar ramas, publicar versiones ni aplicar migraciones sin aprobación explícita.

## Procedimiento entre conversaciones

Al abrir otro chat: «Continuamos INVENTA. Consulta `docs/CONTINUIDAD.md` y `.cursor/rules/inventa.mdc` en GitHub. Contrasta el estado del código antes de proponer cambios, sin mezclarlo con KONTROLA».

Al finalizar un avance, actualizar esta ficha con **fecha; versión/commit/PR; hecho y probado; decisiones nuevas; pendientes; riesgos; siguiente tarea concreta**. La actualización documental no sustituye los commits del código.
