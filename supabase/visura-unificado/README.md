# Migraciones de la unificación VISURA (línea 000)

Proyecto Supabase unificado: **control-cargas-movil** (`oevetnszmfxeukcncwji`). INVENTA vive en el esquema `inventa` (funciones auxiliares en `inventa_internal`); el acceso común por aplicación, en `visura`.

Estas migraciones **ya están aplicadas** en ese proyecto y figuran en su historial (`supabase_migrations.schema_migrations`). Se guardan aquí para cumplir las normas VISURA R6 §8: todo cambio aplicado a Supabase debe quedar también en el repositorio. No se vuelven a ejecutar.

| Versión | Nombre | MD5 del texto aplicado |
|---|---|---|
| 20261118004914 | visura_acceso_comun | 68a8a7549e99758026fecd54e2c37948 |
| 20261118005010 | inventa_estructura_unificada | dee8ac00c562a67d8a53df986fe4a6fb |
| 20261118005120 | inventa_bc_posiciones_f2k | 187285dfeb87ae19a183c671651888a9 |
| 20261118005136 | inventa_compat_moventa_app_access | 8121c69b7b85e73510ccc9a7c704b33d |
| 20261118083051 | inventa_retirada_f2 | edc946270ffdd622f8aa7ecc0ee9e044 |

## Diferencias con lo aplicado

El repositorio es público (normas R6 §7), así que se han sustituido datos personales por marcadores:

- `20261118004914_visura_acceso_comun.sql`: el correo de la cuenta propietaria aparece como `<correo-propietario>`.
- `20261118005120_inventa_bc_posiciones_f2k.sql`: el correo y el nombre visible de la cuenta propietaria aparecen como `<correo-propietario>` y `<nombre-propietario>`.

Por eso el MD5 de esos dos archivos no coincide con el de la tabla. El resto es idéntico, byte a byte, al texto aplicado.

## Notas

- La tercera migración crea las tablas F2-K y la función `f2_k_command`. La quinta las retira (decisión D1 de 000, 18/11/2026) y se niega a ejecutarse si encuentra datos.
- Las pruebas de la retirada se hicieron en PostgreSQL desechable (checkpoint VISURA-000-CP-RETIRADA-F2-UNIFICADO-20261118-012).

## Línea 100 · inventa_tramos (aplicada el 18/11/2026)

| Versión aplicada | Archivo | MD5 del texto aplicado |
|---|---|---|
| `20261118221403` | `20261118221403_inventa_tramos.sql` | `b557dddca46e6c87e1ca16d57132a537` (idéntico al archivo) |

- Autorización del usuario (22:06–23:12): «AUTORIZO: aplicar la migración 20261118140000_inventa_tramos en el Supabase unificado (oevetnszmfxeukcncwji) y comprobar la web publicada».
- Motivo: INVENTA 0.32.1 se publicó (fusión de #28–#30) sin esta migración (incidencia CP100-012).
- Reversión: `supabase/visura-unificado-pendiente/reversion_tramos.sql`.
- El comentario de cabecera del archivo dice «PENDIENTE» porque es el texto exacto que se aplicó; el estado real es este README.
