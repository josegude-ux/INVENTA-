# VISURA INVENTA 07 — Equipo original y concesión única de terminal (LAB)

Fecha de trabajo: 28/10/2026.
Repositorio: josegude-ux/INVENTA-.
Rama: feature/visura-inventa-07-domain-20261027. PR #24 en borrador.
Estado: ENSAYO POSTGRESQL DESCARTABLE; NO conectado a Supabase Auth ni a la PWA.

## Implementación aislada

inventory-lab/008_disposable_team_terminal.sql modela:
- Equipo persistido por campaña y ubicación con integrantes originales A y opcional B, distintos y no editables por roles clientes.
- Terminal físico enrolado para el equipo, una única concesión activa por dispositivo (índice parcial), una única sesión y cuenta titular por equipo.
- Sesiones de operario individuales, ligadas al terminal y revocables por el propietario del laboratorio. No se cambia la identidad de un operario por un selector UI.
- Activación individual/pareja, cambio de modalidad, relevo A→B con sesión propia del compañero en el MISMO terminal, renovación de concesión de 15 minutos y liberación manual.
- CAS de versión sobre una fila bloqueada con FOR UPDATE, histórico inmutable de cada transición y clave de mutación idempotente.
- Validación de campaña abierta, asignación vigente y perfil activo. En pareja, ambos integrantes originales deben seguir habilitados y asignados, independientemente de cuál esté autenticado.
- Guardas de base sobre lot_states y lot_confirmation_events. Cada evento confirmado desde este módulo conserva ID del equipo, originales A/B y la cuenta/sesión realmente autenticadas.
- Cierre de la ruta directa anterior apply_lot y de lot_v2_receipt para el rol de laboratorio. team_apply_lot y team_lot_v2_receipt exigen titular de concesión antes de enviar o recuperar un acuse. apply_reference y apply_correction anteriores se inhabilitan también para el rol cliente tras instalar el módulo, pues no incorporaban la validación de terminal.

Los scripts anteriores 001–007 se prueban por separado ANTES de instalar 008. No se ha reescrito su historia ni sustituido contratos de otros chats.

## Pruebas nuevas

tests/sql/inventa07_lab_team_terminal.sql valida:
- El antiguo guardado no puede escribir sin concesión.
- Dos miembros originales, iniciando pareja con A autenticado.
- B continúa un borrador de A tras identificarse en su propia sesión.
- El tercer operario no puede incorporarse ni escribir aunque se le simule una asignación.
- Otra sesión A desde un terminal diferente es rechazada.
- La sesión A previa pierde el derecho a escribir y consultar recibos tras el relevo a B.
- Liberar, renovar, caducar y recuperar una concesión requiere la sesión titular vigente.
- Revocar el perfil o asignación original invalida el recuento correspondiente.
- Ambos originales y el titular autenticado quedan registrados en el evento de confirmación.
- Un mismo terminal no puede tener dos equipos activos, y la revocación del miembro NO titular bloquea igualmente la pareja.
- La antigua ruta SQL y el recibo directo no están accesibles tras la nueva barrera.

tests/sql/inventa07_lab_team_concurrency.sh ejecuta dos conexiones separadas con cuentas A y B que activan simultáneamente el mismo equipo en PostgreSQL. La condición de aceptación es un único titular, una sola revisión, un solo evento de transición y rechazo CAS de la otra petición.

El workflow .github/workflows/inventa07-ephemeral-db.yml ejecuta las pruebas con un contenedor PostgreSQL 16 llamado inventa07_test y sin secretos de Supabase. El SQL aborta si la base no tiene ese nombre.

## Límites explícitos / bloqueos

- Las identidades de la CI se simulan con request.jwt.claim.sub/session_id y cuentas enroladas manualmente por psql. Los claims pueden falsificarse en una sesión SQL normal. NO se ha demostrado autenticación real JWT, validación de identidad del hardware ni sesiones Supabase reales.
- En producción, el dispositivo debe tener acreditación verificable y los permisos JWT, RLS, membresía, revocación, sesión y equipo deben comprobarse en la misma transacción que cada escritura, sin confiar en parámetros del navegador.
- El laboratorio todavía contiene otras operaciones experimentales de incidencias y provisionales que no pasan por todas las barreras finales de equipo. La integración real requiere cerrar cualquier vía alternativa y probar que no se puede saltar la concesión.
- El laboratorio usa las tablas y políticas de prueba, NO replica automáticamente schema shared / almacenes de PR #22/#23 y NO puede fusionarse ni desplegarse sin coordinación.
- La PWA no usa las funciones nuevas; el escáner, la UI responsive definitiva, recuperación offline y prueba real de dos personas en un terminal siguen pendientes.
- La duración de 15 minutos es un parámetro EXCLUSIVO de ensayo. Debe revisarse conforme a la operativa y decidir heartbeat, suspensión y recuperación offline antes de aprobar diseño real.

## Próxima tarea independiente segura

Revisar la traza de eventos de escáner y la evidencia real de uso de códigos alternativos, simular la autorización de parejas durante provisionales e incidencias con otra capa de ensayos PostgreSQL; diseñar la integración de sesiones Supabase en una base separada únicamente cuando exista acceso y autorización. No cambiar tablas de producción ni mezclar decisiones de otros chats.

NO MERGE. NO DESPLIEGUE. NO MIGRACIONES EN SUPABASE ACTIVA. NO ACCESO API A BUSINESS CENTRAL.
