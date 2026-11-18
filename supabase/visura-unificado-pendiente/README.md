# Migraciones PENDIENTES del Supabase unificado (línea 100 · INVENTA)

Proyecto: **control-cargas-movil** (`oevetnszmfxeukcncwji`), esquema `inventa`.

**`20261118140000_inventa_tramos.sql` YA ESTÁ APLICADA** (18/11/2026 23:14, versión `20261118221403`) y se ha movido a `supabase/visura-unificado/20261118221403_inventa_tramos.sql`. Aquí solo queda la reversión.

Lo que sigue documenta el plan original. Por decisión D2 de 000 (checkpoint VISURA-000-CP-PONTE-AL-DIA-20261118-011):

1. Primero se homologa y publica INVENTA unificado 0.31.x.
2. Después, `20261118140000_inventa_tramos.sql` se aplica **solo en la misma ventana** que la publicación de INVENTA 0.32.0, con «AUTORIZO» y con `reversion_tramos.sql` preparada.

Al aplicarla, el archivo pasa a `supabase/visura-unificado/` (R6 §8).

| Archivo | Qué hace |
|---|---|
| `20261118140000_inventa_tramos.sql` | Tramos por rango con una o dos personas, segundo recuento ciego, idempotencia. Incompatible con la 0.31.x publicada: «Nueva asignación» deja de funcionar. |
| `reversion_tramos.sql` | Vuelve a la unificación 0.31.x. Se niega si ya hay tramos o segundos recuentos. |

Pruebas: `PGDATABASE=inventa_tramos_test bash tests/tramos-lab/run.sh` y `tests/tramos-lab/040_reversion.sh`, en PostgreSQL desechable con las 5 migraciones de la unificación (en CI, PostgreSQL 17).
