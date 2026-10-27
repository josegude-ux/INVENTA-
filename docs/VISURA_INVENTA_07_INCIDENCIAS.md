# VISURA INVENTA 07 — Gestión de incidencias (contrato aislado)

**Proyecto:** VISURA INVENTA (josegude-ux/INVENTA-).  
**Rama:** feature/visura-inventa-07-domain-20261027. PR #24 sin fusionar.  
**Ámbito:** inventario físico; el código no está conectado aún a la PWA ni a Supabase real.

## Implementación nueva

inventory-core/incidents.cjs conserva las incidencias como resultados de dominio separados de los recuentos oficiales. No altera cantidades ni reabre automáticamente la ubicación. Permite:

- Incidencia por etiqueta o código ilegible, preservando una cantidad física explícita, incluidos ceros marcados expresamente.
- Incidencia de código alternativo atribuido erróneamente solo cuando se aportan referencias de eventos de recuento que efectivamente utilizaron dicho código.
- Incidencia física adicional con descripción y fotografía opcional.
- Decisión administrativa con motivo registrado, evento nuevo y conservación de la evidencia anterior.
- Estado awaiting_correction si se determina que requiere corrección, que sigue bloqueando el cierre hasta vincular un evento de corrección confirmado.
- Resumen de incidencias abiertas, pendientes de corrección y resueltas para la posterior verificación del cierre general.

Las cantidades históricas originales permanecen intactas: el módulo solo registra decisiones y referencias de corrección. El autor autenticado del evento se registra por separado y no sustituye los datos reales de sesión del servidor.

## Pruebas

tests/inventa07-incidents.test.cjs: once casos sintéticos, incluidos código ilegible con cantidad física, cero expreso, requerimiento de uso real de código alternativo, motivos administrativos, historial, resolución, revisión pendiente, conflictos de versión y bloqueo de campaña. La ejecución se valida en el workflow INVENTA checks de la PR.

## Límites de seguridad

Todas las validaciones de rol y actor en JavaScript son solamente pruebas de contrato. Un cliente puede falsear isAdmin, authenticatedUserId y correctionEventId. Para integrar se requieren autorización de JWT en Supabase, verificación de que el evento de corrección existe y fue confirmado, un registro transaccional inmutable, RLS, idempotencia y resolución de incidencias sin afectar a campañas cerradas.

## Próxima tarea segura

1. Diseñar y verificar un contrato equivalente de incidencias en PostgreSQL 16 descartable.
2. Coordinar con el ciclo de confirmaciones, productos provisionales y recuento real la creación de incidencias sin convertir las lecturas manuales en supuestos escaneos válidos.
3. Mantener las cantidades físicas confirmadas separadas de las incidencias de validación administrativa y bloquear solo el cierre de campaña cuando corresponda.
4. Integrar la UI responsive y la persistencia real después de pruebas de permisos/solapamientos y autorización productiva específica.

**No se ha modificado main, otras ramas, Supabase real, Business Central ni ningún despliegue.**


## Segundo hito de incidencias: PostgreSQL aislado

Se añaden inventory-lab/005_disposable_incidents.sql y tests/sql/inventa07_lab_incidents.sql, ejecutados en PostgreSQL 16 descartable desde el workflow de la PR. **No son migraciones productivas.**

Condiciones ensayadas: denuncia de código ilegible con recuento físico expreso; prohibición de inventar un evento de recuento para afirmar un código alternativo utilizado; acceso del operario solo a sus propias incidencias; consulta pendiente exclusivamente a Administración; revisión con motivo; incidencia awaiting_correction bloqueante; cierre solo con referencia a una corrección real de la misma campaña y ubicación; eventos append-only e idempotencia; cantidades físicas sin modificación indirecta.

La revisión y registro siguen siendo RPC sintéticas con identidad simulada por psql. Todavía se requieren sesiones autenticadas por Supabase, permisos transaccionales reales y compatibilidad de la interfaz antes de cualquier despliegue. La función administrativa no crea rectificaciones automáticamente.


## Barreras adicionales detectadas en ensayo SQL

La lista de correcciones candidatas para una incidencia se consulta mediante una función restringida a Administración, sin abrir SELECT general a todos los eventos de recuento. Las incidencias relacionadas con una referencia previamente contada solo pueden vincularse, en este contrato, a correcciones de la misma campaña, ubicación y código oficial. Un identificador de corrección perteneciente a otro artículo de la misma ubicación debe rechazarse, aunque corresponda a un evento real.

**Importante:** demostrar que existe un evento de recuento no acredita por sí solo que su lectura haya empleado un código alternativo concreto. El uso real del código deberá vincularse, en producción, a un evento de escaneo autenticado y a la versión del catálogo de alias vigente al contabilizar; la prueba SQL actual es únicamente un ensayo de asociación y controles de referencia. Tampoco puede tratarse una sesión de psql simulada como un JWT validado. Ninguno de estos controles se ha aplicado a Supabase.
