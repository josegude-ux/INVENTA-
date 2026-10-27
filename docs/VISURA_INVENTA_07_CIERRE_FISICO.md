# VISURA INVENTA 07 — Cierre físico de ubicaciones y validación administrativa

**Ámbito:** feature/visura-inventa-07-domain-20261027 (PR #24, borrador).
**Fecha:** 28/10/2026. **Tipo:** contratos puros y pruebas, sin modificar la PWA real ni Supabase.

## Reglas implementadas en inventory-core/workflow.cjs

1. Abrir una ubicación o consultar/escanear una referencia **no inicia** el recuento. El inicio físico solo se marca cuando se introduce una cantidad, cero expreso o producto provisional.
2. Una ubicación nunca iniciada no se puede finalizar por la mera ausencia de referencias pendientes. Si está físicamente vacía y no tiene artículos conocidos, se necesita un procedimiento específico de comprobación de vacío **pendiente de definición**, sin suponer automáticamente que se ha contado ni inventar una referencia.
3. Limpiar todos los borradores no revierte everStarted. Sin ninguna confirmación física, reviewLocation().ready devuelve falso y no habilita finalización.
4. El cero expreso confirmado cuenta como una referencia físicamente revisada. Vacío ≠ 0.
5. Los provisionales cuentan para la revisión física con physicalStatus=confirmed, aunque status=pending indique que Administración aún no ha resuelto su referencia oficial. La ubicación puede quedar lista físicamente si no existen otros recuentos pendientes; la campaña sigue bloqueada mientras haya provisionales administrativos pendientes, según campaignClosureReview(). El indicador físico debe verificarse en servidor; un campo enviado por el cliente no es autoridad.
6. Se acepta el estado previo status=confirmed para provisionales sin physicalStatus, preservando compatibilidad con pruebas existentes.
7. La finalización real sigue siendo una acción manual, autorizada y transaccional, con equipo original y campaña abierta. Las comprobaciones JavaScript no sustituyen las del servidor.

## Cobertura nueva de regresión

- tests/inventa07-location-completion.test.cjs: cinco casos (ubicación intacta, revisión vacía, borrador retirado, cero expreso y provisional no confirmado).
- tests/inventa07-provisional-physical-vs-admin.test.cjs: cinco casos (provisional confirmado físicamente y pendiente en Administración, provisional en borrador, compatibilidad antigua, campaña bloqueada por pendientes, aceptación expresa de diferencias).

## Pendientes antes de integración

- Diseñar acreditación de ubicación físicamente vacía sin referencia susceptible de marcar cero; no obligar a inventar productos.
- Persistir everStarted inmutable y physicalStatus de provisional en servidor, sin confiar en la interfaz ni en estado administrativo.
- Comprobar atómicamente todas las referencias conocidas y provisionales físicos en el momento de finalizar, sin doble conteo ni omisiones.
- Tratar incidencias del recuento y bloqueos administrativos separadamente, sin reapertura automática.
- Verificar las pantallas definitivas en dispositivos reales, con permisos de rol, parejas y sesiones reales.

**Restricciones:** no merge, no despliegue, no migración, no datos de producción ni conexión directa con BC. Estructura definitiva Excel BC pendiente de muestra real.
