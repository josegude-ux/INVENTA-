# VISURA INVENTA 07 — Continuidad de inventario físico

**Fecha de auditoría:** 2026-10-27. **Ámbito:** exclusivamente `josegude-ux/INVENTA-`.
**Rama de este desarrollo:** `feature/visura-inventa-07-domain-20261027`.
**Base verificada de `main`:** `a0f76ab1b1a6515ac647facbadca84cfe838d8ac`.
**Estado:** motor de dominio aislado y probado localmente. No integrado todavía en la PWA ni en Supabase. **NO PUBLICAR ni FUSIONAR automáticamente.**

## Evidencias de continuidad

- Se han leído `docs/CONTINUIDAD.md` de `main`, `.cursor/rules/inventa.mdc`, `README.md`, `real-counts.js`, pruebas y migraciones disponibles. La ficha de `main` fue actualizada el 25/10; no representa todos los trabajos en otras ramas.
- `main` contiene el recuento individual real con cola local e idempotencia; el recuento en pareja, el escáner integrado en recuento real y el teclado anterior siguen separados de la implementación real. La UI de `real-counts.js` utiliza un cálculo antiguo de cuatro factores y no sigue todavía la nueva especificación.
- Existe Supabase INVENTA, independiente del proyecto de Control de Cargas/PREPARA. Lectura de solo metadatos en 27/10: 18 tablas públicas, RLS activado en todas las tablas listadas; nueve migraciones registradas; `counts` sin filas en ese instante; maestros y lotes de importación BC ya existentes. Ningún dato ni permiso fue modificado.
- PR #18 (importador, abierta), #19 (vista previa iPhone, borrador), #20 (identidad comercial, borrador), #22 (arquitectura compartida, borrador) y #23 (ensayo concurrente, borrador) se comprobaron abiertas y sin fusionar a la fecha. NO copiar código ni integrar ninguna por suposición.
- No hay acceso remoto a los worktrees locales o cambios sin commit de otros agentes. Se necesita comprobarlos en su entorno antes de cualquier fusión.
- La estructura **definitiva** del Excel real BC (decisión 15) sigue pendiente: no se inventa mapeo ni se conecta una API directa con BC.

## Primer hito de desarrollo, sin efectos secundarios

Archivos **nuevos**, sin modificar existentes:
- `inventory-core/counting.cjs`: cálculo exacto de unidades sueltas, cajas sueltas y grupos de palés (alturas totales × cajas/base × unidades/caja), cero expreso, campos vacíos distintos del cero, desglose, rechazo de cantidades inválidas y límite compatible con `numeric(16,3)`. No crea fichas obligatorias individuales por palé.
- `inventory-core/workflow.cjs`: guardas puras para inicio persistente de ubicación, finalización manual, revisión de pendientes, asignación correlativa según orden REAL de ubicaciones suministrado, extremos inclusivos, parejas autorizadas, no solapamiento y no traspaso de ubicaciones iniciadas. Resumen físico de pasillo independiente de incidencias administrativas.
- `inventory-core/administration.cjs`: doble escaneo independiente, conflictos de código oficial/alternativo y verificación previa al cierre manual de campaña, sin efectos secundarios.
- `tests/inventa07-domain.test.cjs`: 11 escenarios sintéticos.
- `tests/inventa07-administration.test.cjs`: 4 escenarios sintéticos adicionales. Ejecutar `node --test tests/*.test.cjs` para todas las pruebas y `node --test tests/inventa07-domain.test.cjs` para este hito.

**Resultado comprobado localmente:** 15/15 pruebas de dominio y administración con Node.js 22.16.0, 0 fallos. Pendiente comprobación de CI para la PR y regresiones generales.

### Segundo hito aislado — validación administrativa

Se implementó `inventory-core/administration.cjs` para comprobar dos lecturas distintas exactamente iguales, preservar ceros iniciales, bloquear conflictos entre código oficial y código alternativo interno, y determinar condiciones de cierre general. Son validaciones puras y NO operan sobre datos reales. Se añadieron cuatro pruebas locales, todas correctas. El escaneo real, la evidencia autenticada de cada lectura, la resolución administrativa de provisionales y el cierre transaccional continúan pendientes de integración en servidor.

## Limitaciones expresas

Estas funciones son **reglas puras de demostración técnica** y no constituyen un recuento operativo integrado. En particular:
- No hay todavía conexión de este módulo con `real-counts.js`, PWA, cola offline ni formularios.
- No hay RLS nueva, ni validación transaccional de segmentos, ni doble escaneo de provisionales, ni registro inmutable de correcciones, ni cierre definitivo de campañas: esos controles deberán implementarse y probarse en backend.
- El orden correlativo de ubicaciones se recibe como parámetro; debe venir de un catálogo de ubicaciones real y verificado. No deducir `K00`–`K50` por incrementos inventados en el sistema real.
- Las comprobaciones de autorización en JavaScript **nunca sustituyen** RLS/operaciones atómicas en servidor.
- El diseño responsive y pruebas físicas de móvil, tablet y escritorio siguen pendientes.
- No se ha cargado, cambiado ni publicado ningún dato de Business Central o Supabase. No se han modificado credenciales ni proyectos ajenos.

## Ruta próxima y condiciones de integración

1. Comprobar CI y regresiones de la PR aislada; si hay errores, corregir en la misma rama.
2. Auditar detalladamente el contrato de `counts`, `assignments`, campañas, roles y los conflictos con `real-counts.js`; definir capa de persistencia que soporte borradores, confirmaciones y correcciones, manteniendo lo existente.
3. Añadir pruebas de seguridad y atomicidad contra **PostgreSQL descartable** antes de proponer migraciones no destructivas.
4. Integrar gradualmente el motor físico en UI de recuento real con vista previa, marcado expreso de cero, escáner individual y responsive real; actualizar caché/versionado **solo cuando se autorice una integración compatible** con la rama de branding.
5. Implementar parejas, redistribución, provisionales, incidencias, cierre, rectificaciones e informes según el prompt maestro; mantener el Excel definitivo pendiente hasta recibir muestra auténtica.
6. Someter la integración con otras PR y cualquier cambio en Supabase/productivo a revisión y autorización separadas.

**Regla:** continuar por tareas independientes sin asumir que la arquitectura compartida de #22/#23 esté implantada. No hacer merge, despliegues, migraciones ni operaciones destructivas.
