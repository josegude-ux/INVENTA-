# INVENTA · Supabase (preparación)

Proyecto **independiente** de Control de Cargas y Control de Tanques. No aplicar estas migraciones sobre esas bases.

## Estado

- Migraciones SQL listas en `migrations/`.
- **No** se ha creado el proyecto Supabase desde este repositorio.
- **No** hay secretos ni `service_role` en el código.
- La PWA demo sigue en `localStorage` hasta que exista un proyecto autorizado y URL/anon key configuradas fuera de Git.

## Cómo aplicar (cuando haya autorización)

1. Crear un proyecto Supabase nuevo llamado de forma explícita `inventa` (u organización acordada).
2. Confirmar que la plaza gratuita liberada al pausar `control-tanques-staging` sigue disponible si se usa ese cupo.
3. En el SQL editor (o CLI `supabase db push`), ejecutar en orden:
   - `migrations/001_inventa_schema.sql`
   - `migrations/002_inventa_rls.sql`
4. Verificar con un usuario rol `operario` y campaña `active` que `select * from stock_snapshots` falla o no devuelve filas (RLS).
5. Configurar en el entorno del cliente solo la URL pública y la **anon key** (nunca `service_role` en el navegador).

## Seguridad teórica BC

Durante campaña activa, un **Operario** no debe poder leer `stock_snapshots.theoretical_qty` ni por UI ni por API. Las políticas de `002_inventa_rls.sql` lo bloquean en servidor; la demo HTML aún contiene `TEST.theoretical` en el cliente y **no debe usarse en producción**.
