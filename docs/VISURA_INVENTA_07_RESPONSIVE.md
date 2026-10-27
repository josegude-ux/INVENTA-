# VISURA INVENTA 07 — refuerzo y auditoría responsive (27/10/2026)

**Naturaleza:** ampliación de los apartados 22 y 24 del prompt maestro; no altera decisiones previas.  
**Rama aislada:** feature/visura-inventa-07-domain-20261027, PR #24 (borrador).  
**Producción:** ningún cambio. No hay merge ni integración de estos estilos en index.html.

## Hallazgo comprobado de la interfaz actual

El CSS de index.html en main define por defecto \`#app{max-width:640px}\`. En pantallas >=1000px amplía parcialmente \`#app:not(.counter)\` hasta 1180px, con excepción de la pantalla \`.counter\`, que conserva ancho móvil. La portada puede alcanzar 960px; esto no equivale a adaptar todos los flujos de trabajo a escritorio. El formulario real individual de real-counts.js es una cadena de controles dentro de tarjetas, sin panel administrativo lateral ni distribución específica para monitores grandes. **No declarar aprobado el diseño desktop de la PWA actual.**

## Implementación aislada de preparación visual

Se añadieron **solo archivos nuevos**:
- \`inventory-ui/responsive.css\`: estilos bajo el prefijo \`.vi07-\`; base móvil, adaptación tablet a partir de 700px, desktop a partir de 1180px, ajuste de móvil apaisado de poca altura y reglas de impresión. No altera \`#app\`, marca ni estilos publicados.
- \`inventory-ui/preview.html\`: prototipo **visual no operativo**, con datos ficticios y navegación entre ocho escenarios. No tiene conexión a Supabase ni Business Central.
- \`tests/inventa07-responsive.test.cjs\`: seis contratos sintéticos de CSS/HTML, sin dependencias adicionales.

El contenedor de contenido es fluido hasta 1720px; en desktop se prevé barra lateral de 288px y zona de trabajo de dos paneles, sin reproducir simplemente el diseño de teléfono. En tablet la barra lateral es de 220px. En móvil es una columna con navegación horizontal de acceso táctil. Se exige que tablas anchas desplacen dentro de su superficie y que elementos interactivos conserven al menos 44px de alto. La referencia y su escáner están asociados por fila, el control de palés permanece después de los campos de unidades/cajas y las referencias confirmadas están en un \`details\` cerrado por defecto. Los paneles no seleccionados deben llevar \`hidden\` y un guardado CSS que lo respete.

## Matriz obligatoria de verificación visual

| Flujo | Móvil vertical y horizontal | Tablet vertical y horizontal | Sobremesa 1366/1920 |
|---|---|---|---|
| Recuento físico | Código/descr./escáner asociados; campos táctiles; botón palés debajo; confirmadas plegadas | Recuento + progreso simultáneos si caben | Recuento principal + progreso lateral, sin ancho 640px |
| Ubicaciones | Lista legible y regreso sin avance automático | Lista + progreso | Columnas de asignadas/pendientes/historial |
| Pasillos/tramos | Tabla dentro de scroll propio, extremos visibles | Tabla más amplia | Tabla completa y panel de control |
| Administración | Acciones grandes y jerarquía | Métricas en dos columnas | Menú lateral, métricas en tres columnas y tablas |
| Provisionales | Escáner y descripción sin cortes | Captura + reglas de validación | Captura y verificación administrativa simultáneas |
| Incidencias | Tabla interna o tarjetas | Tabla y seguimiento | Tabla amplia, filtros y detalle |
| Informes | Listado de versiones accesible | Listado y detalle | Paneles e histórico simultáneos |
| Cierre | Bloqueos destacados y confirmación | Resumen más bloqueos | Resumen, diferencias y bloqueos separados |

**Viewport obligatorio:** 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080, más cambio de tamaño de ventana. Comprobar sin desplazamiento horizontal del documento, sin controles solapados, sin menús inaccesibles, con foco de teclado visible y tamaños táctiles. Inspeccionar capturas reales, no solamente media queries.

## Resultados y límites

- **Auditoría de código original:** completada; limitación de anchura identificada.
- **CSS + vista preliminar de ocho áreas:** implementados aisladamente; son una propuesta, no una modificación visual en producción.
- **Pruebas estáticas automatizadas:** añadidas; su resultado se registra en la CI de la PR.
- **Capturas y pruebas con navegador/dispositivos reales:** pendientes hasta completar el ensayo visual reproducible; las pruebas CSS por texto NO prueban que el diseño funcione en todas las orientaciones.
- **Prueba funcional de interfaces reales:** pendiente de conectar con los componentes operativos después de validar RLS/backend, conflictos de branding y cola de sincronización.
- **Cierre de campaña, informes y administración reales:** no implementados por la existencia de una maqueta; mantenerlos como pendientes.

## Próximo trabajo seguro

1. Ejecutar y registrar inspección visual de la maqueta con navegador a los seis tamaños, revisar overflow, densidad y distribución.
2. Corregir problemas de accesibilidad/densidad **solo** en \`inventory-ui/\`, sin tocar la aplicación publicada.
3. Coordinar el contrato con \`real-counts.js\` y la PR #20 de marca antes de integrar diseños en \`index.html\`.
4. Después del servidor de prueba, conectar progresivamente recuento real, asignaciones y administración; repetir ensayos de navegación, escáner, borradores y sin teórico BC para operarios.

**NO FUSIONAR · NO DESPLEGAR · NO MODIFICAR SUPABASE PRODUCTIVO · NO CONECTAR BC.**


## Evidencia visual local adicional (27/10/2026)

Se reprodujo en Chromium de escritorio (motor real, modo headless) **el contenido exacto de \`inventory-ui/responsive.css\` del commit \`c4561b913b5efe3570771451f85f06cd5a5bd836\`**. Se comprobó igualdad de longitud (6057 caracteres) y firma FNV32 (1741551598) entre el CSS leído de GitHub y la copia utilizada en el navegador. Esto verifica el CSS ensayado, no una versión desplegada.

**Seis resoluciones evaluadas del recuento representativo:** 390×844, 844×390, 768×1024, 1024×768, 1366×768 y 1920×1080.

- \`document.documentElement.scrollWidth <= innerWidth\` en los seis tamaños.
- La navegación pasa de horizontal táctil (menos de 700px) a barra lateral (700px y más).
- El contenido del escritorio a 1366px ocupa 1078px de ancho, y a 1920px ocupa 1632px; no está limitado a 640px.
- El escáner de referencia mide 48px de alto, el botón de acción al menos 44px, las confirmadas empiezan plegadas y el botón de palés sigue por debajo de unidades/cajas.
- Se detectó y corrigió un error de densidad: a 768px el contenido quedaba dividido en dos columnas de 248px; ahora el recuento usa una columna de contenido de 512px con barra lateral, manteniendo dos paneles a 1024px y escritorio.
- Se detectó y corrigió un problema de especificidad que reducía el botón del escáner a 44px pese a declarar 48px.
- Se comprobó adicionalmente una **maqueta local representativa** con ocho secciones a las seis resoluciones (48 combinaciones), sin desbordamiento horizontal y con navegación que ocultaba correctamente los paneles no seleccionados.

**Límite de esta evidencia:** las 48 combinaciones se ejecutaron contra una maqueta local representativa, NO contra la versión publicada ni contra una copia completa del \`preview.html\` remoto. Las capturas locales se generaron durante la auditoría y no están versionadas en GitHub. Las comprobaciones estáticas de \`tests/inventa07-responsive.test.cjs\` sí apuntan al HTML/CSS exactos versionados, y GitHub CI ejecuta el conjunto Node. Para repetir visuales sobre los archivos exactos del repositorio se añadió \`tests/visual/inventa07_responsive_visual.py\`, script opcional con Playwright + Chromium; no forma parte del CI Node y su ejecución sobre el checkout completo sigue pendiente.

**Bloqueos pendientes para aceptación final:** evaluación funcional con identidades/permisos reales, escáner real en navegador móvil, pruebas en iPhone/Android/tablets reales, datos físicos, persistencia, modales y flujos administrativos después de integración. No se ha alterado \`index.html\`, el servicio PWA ni producción.

