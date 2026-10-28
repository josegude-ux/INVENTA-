# VISURA INVENTA 08 — laboratorio PostgreSQL 16 descartable
**28/10/2026 · SIN integración empresarial · Sin migraciones productivas**

## Misión y alcance
Ensayar, mediante PostgreSQL 16 efímero de GitHub Actions, el contrato funcional de posiciones fijas, historial de retiradas/reactivaciones y lectura de una publicación BC coherente. Todos los datos, roles, códigos, almacenes y lotes son **ficticios**; el laboratorio no lee el repositorio Supabase real, ni Microsoft Dynamics Business Central, ni recuentos físicos.

La definición **NO** constituye un segundo maestro de posiciones ni una propuesta automática de tablas finales para INVENTA: el maestro productivo y la identidad del almacén están pendientes de coordinación con la arquitectura PR #22/#23.

## Protección
- Base de datos exclusiva `inventa08_test` creada por el contenedor local `postgres:16` de GitHub Actions.
- Scripts protegidos por `current_database()='inventa08_test'` (o por `PGDATABASE` en scripts shell). El workflow exige que ejecutar el esquema principal contra la base `postgres` falle.
- No hay secretos empresariales, conexión a Supabase, migraciones reales, cambios de RLS ni permisos productivos.
- El código de laboratorio está contenido en `fixed-stock-08/lab/**` y su CI solo en `.github/workflows/inventa08-ephemeral-db.yml`.

## Guion de ensayos
1. `001_disposable_associations.sql`: crea asociaciones con varias referencias por posición, varias posiciones por referencia, índice único parcial de pares activos y eventos append-only. La función `transition` bloquea la fila, comprueba revisión, cambia estado e inserta evento **en la misma transacción**.
2. `002_disposable_associations_tests.sql`: rechazo de duplicados activos, retirada con razón, reactivación con OTROS, revisión antigua, actor/motivo ausentes, historial inmutable, no borrado físico, identidad de almacenes con código K02 repetido y rollback real.
3. `003_concurrent_transition.sh`: dos procesos `psql` intentan retirar el mismo par con revisión 1. El primero retiene un bloqueo de fila y confirma; el segundo espera y recibe `REVISION_CONFLICT`. Se exige un único evento.
4. `004_reactivation_collision.sql`: retirada del par original, alta de otro par idéntico activo y rechazo de reactivación sin registrar un evento fantasma; la asociación retirada conserva su ID/historia.
5. `005_disposable_bc_snapshot.sql`: lotes `BC-A` y `BC-B` sintéticos, suma decimal 0 por compensación (-8 y +8) en ubicaciones no fijas, negativo -12.125, ausencia con resultado NULL y otro almacén separado.
6. `006_disposable_bc_concurrency.sh`: un lector `REPEATABLE READ READ ONLY` ve BC-A antes y después de que otro proceso publique BC-B; una sesión nueva ve BC-B. Esta prueba no necesita conexión real a BC.
7. `007_disposable_read_roles.sql`: crea `inv08_lab_reader` y `inv08_lab_operator` (roles temporales SIN LOGIN). El primero recibe exclusivamente SELECT de datos de este laboratorio y el segundo no puede leer teoría.
8. `008_disposable_role_checks.sh`: simula `SET ROLE` para verificar autorización de lectura del perfil administrativo, denegación de lectura de stock e historia al operario y denegación de UPDATE de la publicación al lector.

## Evidencias ya verificadas
- Primer ensayo de ciclo/historial/rollback: [GitHub Actions 40609611694](https://github.com/josegude-ux/INVENTA-/actions/runs/40609611694) **SUCCESS**.
- Primera prueba con dos sesiones en conflicto: [GitHub Actions 40609791183](https://github.com/josegude-ux/INVENTA-/actions/runs/40609791183) **SUCCESS**.
- Primer ensayo de publicación concurrente BC y colisión de reactivación: [GitHub Actions 40609977562](https://github.com/josegude-ux/INVENTA-/actions/runs/40609977562) **SUCCESS**.
- Validaciones de roles nuevos: comprobar la ejecución del HEAD que incluye `9077818e` antes de declararlas superadas.

## Bloqueos de integración productiva
1. No se ha verificado ninguna política Auth/RLS productiva mediante este laboratorio: `SET ROLE` solo simula roles SQL, **no prueba JWT, permisos efectivos de Supabase ni revocaciones reales**.
2. No está resuelta la identidad inequívoca de almacenes, ni el paso reversible desde las migraciones reales 006/008 y sus consumidores activos.
3. No existe autorización para aplicar migraciones, desplegar, fusionar, modificar identidades o tocar Business Central.
4. La ausencia de líneas BC, las fechas certificadas y los encabezados del Excel auténtico necesitan evidencia real antes de publicar cifras.
5. El diseño responsive ha pasado Chromium, pero no se ha validado en iPhone/Safari real.

**CONCLUSIÓN:** test de contratos aislados, nunca equivalencia con implementación o seguridad empresarial.
