# INVENTA · Estado de desarrollo (v0.25.0)

Resumen operativo. Detalle ampliado en el informe del Agent Store del coordinador cuando esté montado.

## Qué funciona (demo local)

- Menú: Inventario / Consulta / Gestión (esta última tras identificar Supervisor o Admin).
- Inventario: login operario → modalidad individual o pareja (un móvil, un resultado) → pasillos → ubicaciones → teclado B → tolerancia cero e incidencias.
- Consulta bloqueada para operario con campaña demo abierta; staff sí entra.
- PWA: service worker network-first, borradores locales, escáner de cámara.

## Qué se añadió en v0.25.0 (sin credenciales Supabase)

- Migraciones SQL + RLS en `supabase/migrations/` (proyecto INVENTA independiente; no aplicadas).
- Libs: `lib/roles.js`, `lib/sync-queue.js`, `lib/incidents.js`.
- Gestión almacén muestra incidencias locales y cola de sync (sin envío remoto).
- Tests Node: `npm test`.

## Pendiente (requiere autorización / proyecto)

- Crear proyecto Supabase INVENTA y aplicar migraciones.
- Auth real, RLS viviendo en servidor, sync multi-dispositivo probada.
- Quitar `TEST.theoretical` del cliente antes de producción.
- Gestión real (asignaciones, movimientos, conciliación BC solo con revisión humana).
