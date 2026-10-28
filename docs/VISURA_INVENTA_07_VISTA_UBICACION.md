# VISURA INVENTA 07 — Vista segura de ubicación física

Fecha: 28/10/2026. Repositorio: josegude-ux/INVENTA-.
Rama: feature/visura-inventa-07-domain-20261027, PR #24 borrador.
ESTADO: prototipo y modelo AISLADOS. No vinculado a PWA real o Supabase.

## Componentes

- inventory-ui/location-view.js: adaptador UMD sin red ni persistencia, ejecutable en navegador o Node. Construye un modelo por ubicación y preserva los códigos y lotes de referencia, cantidad física y cero explícito, sin leer ni transmitir stock teórico, costes o diferencias BC.
- inventory-ui/location-layout.css: composición responsive independiente, estilos acotados a vi07-location-layout para móvil, tableta, escritorio e impresión; no afecta la PWA publicada.
- inventory-ui/location-layout.html: demostración con datos completamente ficticios, sin login, guardado o botones con acciones falsas. Reutiliza responsive.css, invoca la vista mediante script y muestra contadores.
- tests/inventa07-location-view.test.cjs y tests/inventa07-location-layout.test.cjs: validación de orden de grupos, estados físicos, lotes con ceros iniciales, cero explícito, provisionales, datos prohibidos, estados desconocidos, escape por textContent (sin innerHTML) y señalización clara de prototipo.

## Comportamiento preservado

- Las referencias pendientes (sin contar, borradores y correcciones físicas pendientes) siempre aparecen ANTES del grupo de confirmadas.
- Las referencias confirmadas se muestran al final, dentro de un desplegable cerrado inicialmente. Nunca se pasan automáticamente a otra ubicación o referencia.
- Una referencia provisional confirmada físicamente puede seguir pendiente de identificación por Administración. Se muestra su situación física y se diferencia la revisión administrativa; su cantidad nunca se fusiona automáticamente con otro artículo.
- Cada artículo conserva el lote y el identificador completo (incluidos ceros iniciales). Dos lotes del mismo artículo son dos referencias físicas diferentes.
- Un cero no es un campo en blanco. Requiere marca explícita y confirmación.
- El modelo de visualización NO concede permisos ni da por cerrado un recuento: physicallyReadyCandidate es solo una propuesta visual, requiresServerAuthorization=true recuerda que las decisiones se deben validar en servidor.

## Seguridad, dependencias y limitaciones

Los campos que puede recibir el cliente de visualización son exclusivamente datos físicos permitidos: códigos, lotes, descripciones, estados de conteo y cantidades físicas. No pasa stock teórico, diferencias Business Central, costes internos, roles secretos o tokens. El render utiliza exclusivamente textContent para los datos, no innerHTML.

Todo el contenido es de demostración. No se modifican index.html, real-counts.js, manifest, service worker, base de datos, roles, permisos ni ramas de otros responsables; no hay escáner, sincronización, botones operativos o autenticación real en este prototipo. Su aspecto deberá coordinarse con el chat responsable de branding y el chat de arquitectura compartida antes de cualquier integración.

La visualización en Playwright real y pruebas físicas de accesibilidad/diseño en iPhone, tableta y escritorio aún están pendientes de ejecución sobre la interfaz definitiva. La compatibilidad de la hoja CSS no sustituye dicha validación.

## Siguiente tarea segura

Definir de forma aislada el contrato de datos entre la vista y una RPC autenticada de lectura de recuentos, sin hacer que el cliente vea stock teórico; después revisar con responsables compartidos el plan de integración de PWA. No duplicar el módulo del chat 08.

NO MERGE; NO DEPLOY; NO DDL EN SUPABASE REAL; NO API BC.
