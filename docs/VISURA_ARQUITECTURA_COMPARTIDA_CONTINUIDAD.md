# VISURA 04 — Arquitectura compartida, continuidad verificable
**Fecha:** 27 octubre 2026. **Rama exclusiva:** architecture/visura-shared-core-20261027. **Estado:** preparación aislada, NO migración, NO despliegue.

## Auditoría de lectura real
- INVENTA: josegude-ux/INVENTA- (default main HEAD observado a0f76ab1b1a6515ac647facbadca84cfe838d8ac). Supabase wlejxnpphysogrzcxjfh ACTIVE_HEALTHY. Tablas: products (1.853), locations (794), fixed_positions, bc_import_batches, bc_import_lines (3.041 en lote vigente COR_01_COR), bc_import_current, profiles, audit_events. Nueve migraciones registradas.
- PREPARA: josegude-ux/KONTROLA (main HEAD observado 01cb7db9fafc550c1efa40774c01f1bf82414d2a; **main NO contiene toda la aplicación**). Supabase oevetnszmfxeukcncwji ACTIVE_HEALTHY. Tablas kontrola_cargas, kontrola_preparaciones, kontrola_verificaciones, incidencias, usuarios_app y kontrola_usuario_almacenes. Doce migraciones registradas; el estudio histórico del 25/10 que indicaba migraciones pendientes está desactualizado.
- Estudio anterior identificado en rama funcional **feat/visura-prepara-admin-posiciones-fijas-20261027**, archivo docs/ESTUDIO_UNIFICACION_SUPABASE.md; ausente en main comprobada. El desarrollo funcional de su informe **NO** se duplica.
- Control de Cargas sigue como sistema independiente. El proyecto control-tanques-staging permanece INACTIVE y las tablas históricas Tanques del backend de Control de Cargas no se tocan.

## Riesgos prioritarios
1. bc_import_current de INVENTA tiene puntero singleton global: no representa publicación multialmacén. Necesita referencia por almacén con actualización transaccional.
2. public.locations usa PK solo code y public.fixed_positions PK product_code + location_code; no identifican el almacén. Verificar colisiones Coruña/Ferrol antes de cambiar lectura. Conservar INVENTA existente hasta transición aprobada.
3. Auth entre proyectos independiente. No copiar contraseñas, JWT, secretos o UUID supuestos; futuro único Auth con correspondencia de usuarios autorizada y autoría histórica inmutable.
4. Supabase Security Advisor: funciones SECURITY DEFINER expuestas a roles en ambos proyectos; cinco avisos de EXECUTE para anon en PREPARA. Requieren auditoría función por función (no equivalen automáticamente a explotación). No cambiar RLS o GRANT de producción en este chat sin aprobación.
5. PDFs históricos no necesariamente alojados en Supabase. No migrar ni borrar por presunción. Tanques permanece inactivo y oculto.

## Elección de arquitectura (PROPUESTA, no ejecutada)
Aprovechar INVENTA como backend empresarial central, preservando public.products y toda lógica de recuentos. Diseñar módulos con permisos por aplicación y almacén, sin permisos cruzados implícitos. Mantener entidades operativas PREPARA separadas (cargas, preparación, verificación, revisiones, incidencias, documentos). Una nueva base implicaría coste y más riesgo; duplicar catálogo mediante sync entre bases no cumple la fuente única.

**Transición sin doble autoridad:** el borrador visura_shared.warehouse_fixed_positions NO reemplaza ni complementa lecturas de public.fixed_positions hasta reconciliar registros y aprobar corte. No publicar existencias desde el nuevo modelo hasta que se ensaye y se autorice la selección por almacén.

## Contratos objetivo NO PUBLICADOS
- products.v1: código, descripción, unidad y código de barras autorizado.
- locations.v1: warehouse_code, location_code, aisle, zone, description, enabled.
- fixed_positions.v1: warehouse_code, product_code, location_code, origin, effective_at.
- bc_stock.v1: warehouse_code, product_code, location_code, lot, expiry_date, **stock_calculated** decimal, import_id, published_at, completeness (cero confirmado / sin dato / caducado).
- bc_import.v1: fuente bc_excel_manual, archivo/hash SHA256, lote, almacén, versión, conteos y fecha.
- identity_access.v1: user_id, module, warehouse_code, role, enabled, permissions efectivos.
Cada consumidor debe utilizar permisos de servidor. Los operarios INVENTA con recuento ciego no reciben stock BC solo por acceder a PREPARA.

## Importación manual aprobada por diseño
Administración selecciona Excel; el parser existente mapea los encabezados a 'almacen', 'codigoArticulo', 'descripcion', 'unidad', 'ubicacion', 'lote' y 'stockCalculado'. El validador aislado rechaza:
- mezcla de almacenes, celdas requeridas ausentes, archivos incompletos, pares SKU+ubicación+lote repetidos, cantidades malformadas;
- sustitución accidental de stock calculado por físico.
Conserva SKU con ceros y acepta cero/negativo calculado (negativos señalados), sin publicar datos. SHA, staging, seguridad, auditoría, publicación por almacén e importación XLSX real **aún no implementados aquí**.

## Publicación futura / pruebas obligatorias
Staging no visible -> conteos/hash y permisos -> lock exclusivo por almacén -> cambio transaccional de puntero del MISMO almacén + auditoría -> validación de lectura. Probar concurrencia mismo almacén, almacenes distintos, duplicados, rollback, respuesta perdida, recuentos y PDF históricos. Ensayo en PostgreSQL/Supabase descartable autorizado; no usar bases existentes como sandbox.

## Entregables de la rama
- architecture/lib/validate-bc-batch.mjs: validador puro offline, sin conexión a BD.
- architecture/tests/validate-bc-batch.test.mjs y architecture/tests/locations-inventa-compat.test.mjs: suite Node sin escrituras, incluye formatos reales de códigos de ubicación (espacios internos seguros).
- architecture/drafts/visura_shared_schema_UNAPPLIED.sql: diseño multialmacén fuera de migrations, tablas con RLS activado sin políticas permisivas ni grants.
No hay RPC de publicación expuesta ni cambios de bases reales. Se ha preparado un prototipo **interno** de publicación no desplegado. **Prueba PostgreSQL 16 descartable SUPERADA** (GitHub Actions 40532549110, 27/10/2026): SQL del borrador aplicado solamente al contenedor, con datos ficticios; comprobados dos almacenes, stock cero/negativo, prohibición de batch cruzado por FK, duplicados y RLS deny-by-default. Las 15 pruebas Node de la rama también han pasado. Las comprobaciones generales INVENTA también han pasado (run 40532548973). Esto NO prueba Auth/Storage/RPC futuros ni seguridad efectiva productiva. No fusionar ni desplegar esta rama.

## Continuidad / puertas
COMPLETADO: auditoría read-only; diseño; validador + 15 pruebas Node en CI; esquema ficticio y restricciones verificadas en PostgreSQL 16 efímero (40532549110); suite general de INVENTA verde. PREPARADO: SQL NO aplicado en bases reales. PENDIENTE: contratos read-only, compatibilidad real de códigos de almacén, correspondencia de identidad y RLS, Auth/Storage/PDF, pruebas de publicación/concurrencia, regresión E2E de ambas PWA y restauración ensayada. BLOQUEOS DE APROBACIÓN: migrar cuentas/datos, costes, ejecutar DDL real, cambios de permisos, fusionar, desplegar, pausar sistemas.
**Siguiente tarea técnica segura:** convertir el borrador en una migración validada en PostgreSQL descartable, probar integridad y concurrencia; revisar el SQL existente antes de introducir cualquier adaptador de consumo.


## Addenda de compatibilidad 27/10 (contrastada después de la auditoría inicial)

- Almacenes PREPARA reales: `COR_01_COR` (A Coruña) y `COR_02_NAR` (Ferrol); `PEND_00_CLAS` está inactivo. El nombre sintético anterior `FER_01_FER` no es un código de almacén verificado.
- En INVENTA hay 3.041 líneas de stock BC importadas para COR_01_COR; **0 referencias a artículo o ubicación inexistentes** en los maestros consultados.
- Los códigos de ubicación `PLV USAD` y `SUELO 3` ocupan 39 y 14 líneas BC respectivamente. El validador inicial rechazaba espacios; se corrigió y se añadieron pruebas de regresión sin publicar ni reimportar datos.
- `fixed_positions` contiene **1** asignación manual y `fixed_position_imports` **0** registros en el estado consultado. El código de importación preparado no prueba que las posiciones del Excel estén ya publicadas: conciliación pendiente con el responsable de INVENTA.
- En el borrador `visura_shared.warehouse_locations` ya se permite `(almacén,código)` como clave compuesta independiente del `public.locations(code)` histórico. El sistema existente conserva su modelo sin modificación.
- `architecture/drafts/visura_shared_read_contracts_UNAPPLIED.sql` prepara una vista `security_invoker` **privada**, limitada a batches completos con `state='published'`, sin grants a usuarios. No existe todavía RPC **de cliente autorizada** ni integración de PWA; el publicador privado posterior es únicamente un borrador experimental.
- `architecture/tests/sql/30_verify_read_contract_pg16.sql` añade prueba PostgreSQL 16 de los contratos privados. Verificar la ejecución CI de la rama y no confundirla con prueba Auth/Storage, prueba de permisos reales o despliegue.
- Evidencia detallada: `architecture/reports/2026-10-27-compatibility-readonly.md`.

**Siguiente trabajo seguro:** corregir posibles incidencias CI; diseñar autorización por módulo/almacén, staging/publicación con bloqueo y trazabilidad, y pruebas de concurrencia sobre un PostgreSQL descartable. **Sin activar API, ejecutar SQL real, fusionar ni desplegar.**


## Addenda de publicación y acceso aislados 27/10 (segunda continuidad)

- La misma rama y **PR #22 en borrador** contienen propuestas nuevas, exclusivamente bajo `architecture/`, sin tocar los códigos operativos:
  - `drafts/visura_shared_internal_publish_UNAPPLIED.sql`: función interna `SECURITY INVOKER`, sin acceso anónimo/autenticado ni exposición por API; bloqueo de fila por almacén, chequeo de privilegio administrativo explícito, comparación del puntero previo, publicación atómica, auditoría y reintentos idempotentes.
  - `drafts/visura_shared_staging_guard_UNAPPLIED.sql`: impide modificar líneas de un lote cuyo estado no sea `staged`.
  - `drafts/visura_shared_reference_contracts_UNAPPLIED.sql`: vistas privadas y `security_invoker` de artículos, ubicaciones y posiciones fijas; sin grants a `anon` o `authenticated` y sin rellenar posiciones fijas históricas automáticamente.
- Pruebas PostgreSQL 16 con datos **sintéticos**: lotes incompletos denegados, identidad no aprobada denegada, almacén ajeno bloqueado, estados antiguos rechazados, sin duplicar auditoría, permisos directos denegados, integridad de referencias, misma ubicación en almacenes distintos y dos conexiones simultáneas contra un bloqueo de almacén.
- Evidencias actuales: **GitHub Actions VISURA shared-core isolated run 40541282735 — SUCCESS**, suite general INVENTA run 40541283110 — SUCCESS. Son pruebas de PostgreSQL local descartable, no de Auth ni Storage en Supabase real.
- Especificación de permisos y puertas: `architecture/reports/2026-10-27-access-import-cutover.md`.

**Limitaciones expresas:** la función acepta un `p_actor` sintético y no establece de forma autónoma identidad verificada; es **inseguro exponerla como RPC pública**. Falta validación criptográfica del Excel/filas, control estricto de transición a estado validado, política de lectura RLS para módulos, correspondencia de identidades, ensayo de reversión y E2E con INVENTA/PREPARA. No ejecutar borradores en ninguna base real, ni fusionar o desplegar.

**Siguiente tarea dentro del alcance:** ensayo en PostgreSQL descartable de transición validada protegida y aislamiento de permisos por rol/almacén; coordinar interfaces exclusivamente mediante contratos aprobados, sin tocar ramas de los otros responsables.


## Addenda de validación previa protegida (27/10)

- Nuevos borradores de prueba: `architecture/drafts/visura_shared_internal_validate_UNAPPLIED.sql` (prototipo interno de transición `staged -> validated`) y `architecture/tests/sql/80_verify_validation_gate_pg16.sql`.
- La función comprueba que el almacén está habilitado, que existe autorización administrativa explícita por módulo y almacén, que el identificador de archivo recibido coincide con el registrado, que hay todas las filas esperadas y que las ubicaciones de las líneas están habilitadas.
- Bloquea el lote durante la validación, comparte el bloqueo de lote utilizado por el trigger de modificación de líneas y devuelve una respuesta idempotente si ya se había validado. **No** cambia el puntero de existencias vigentes.
- Este ensayo **no verifica el hash real del archivo original**, ni garantiza por sí mismo la identidad de un administrador mediante una sesión de servidor, ni sustituye los controles RLS y Auth que faltan.
- Se integra en el workflow de PostgreSQL descartable de la PR #22; confirmar la ejecución más reciente antes de considerarlo validado.

**Puertas antes de integración:** gateway de confianza con identidad comprobada, certificado criptográfico de archivo/filas, pruebas por rol/almacén y auditoría completa, restauración/reversión y aprobación expresa de migración. No ejecutar estos borradores en Supabase real.


## Addenda de integridad SHA-256 y auditoría de privilegios (27/10, última continuidad)

**Verificación de rama:** misma rama `architecture/visura-shared-core-20261027`, PR #22 DRAFT/OPEN, base `main`; ninguna fusión ni despliegue.

- `architecture/lib/bc-integrity-receipt.mjs`: comprobante **puramente offline** de SHA-256 de bytes binarios del Excel manual más SHA-256 separado de datos BC normalizados. Protege SKU, lote, ubicación, almacén, stock calculado, orden de filas, contrato y conteo; `timingSafeEqual` compara ambos hashes ante un comprobante de confianza. No se conecta a Supabase.
- `architecture/tests/bc-integrity-receipt.test.mjs`: regresiones sobre cambio de bytes/filas, ceros y negativos, códigos reales con espacios, orden, decimales, datos inválidos y ausencia de mutación. **CI #40552454034 SUCCESS**, suite general INVENTA **#40552453783 SUCCESS**.
- `architecture/tests/sql/90_verify_client_role_denial_pg16.sql`: intentos de leer vistas privadas y ejecutar prototipos como `SET ROLE anon/authenticated`; no afecta los roles de producción.
- `architecture/tests/sql/100_verify_rollback_pg16.sql`: transacción de publicación ficticia seguida de ROLLBACK, restauración de puntero, estados y auditoría. No es mecanismo de revertir transacciones ya confirmadas.
- `architecture/reports/2026-10-27-import-integrity-and-cutover-plan.md`: propone corte por almacén de **solo lectura**, sin doble autoridad ni escrituras espejo, con autorización y regreso controlado a lecturas anteriores. No autoriza ejecución.
- `architecture/reports/2026-10-27-privileged-function-body-review-readonly.md`: lectura de cuerpos y triggers de cinco funciones SECURITY DEFINER de PREPARA. Dos son triggers, dos consultan `auth.uid()` y la RPC de finalización valida identidad y propiedad; **no se ha demostrado explotación**, y **no se han revocado permisos**.
- Evidencia de las pruebas SQL 90/100: confirmar el estado de GitHub Actions posterior al commit `fcdd56a099e4e922680872c8a5c01f37f303e790`. Si sigue QUEUED/IN_PROGRESS, no informar SUCCESS para esas pruebas.

**Bloqueo principal:** no existe un parser XLSX confiable que ligue bytes originales con filas introducidas, ni una pasarela de identidad de servidor vinculada a Auth, ni un digest SQL validado de forma independiente. El comprobante SHA offline detecta alteraciones con referencia de confianza, **no certifica la procedencia de filas por sí solo**. No exponer `p_actor` ni habilitar SQL en bases reales.

**Siguiente tarea segura tras CI:** si fallan pruebas, corregir el test sin tocar código operativo; si pasan, documentar protocolo de attestation y probar negación por rol/almacén en base descartable, luego ensayar reversión compensatoria sin aplicar nada a producción.


## Cierre de verificación CI SHA y rollback (27/10/2026)

Se ha consultado GitHub Actions **después** de las pruebas nuevas. Resultados reales:

- [VISURA shared-core isolated #40553218829](https://github.com/josegude-ux/INVENTA-/actions/runs/40553218829): **SUCCESS**, con pruebas Node de huella SHA-256 más PostgreSQL 16 descartable que ejecuta denegaciones `anon/authenticated` y reversión transaccional ficticia (junto con las pruebas anteriores).
- [INVENTA checks #40553218792](https://github.com/josegude-ux/INVENTA-/actions/runs/40553218792): **SUCCESS**.

**La PR #22 continúa en DRAFT sin merge.** Ningún SQL se ha aplicado al Supabase del usuario. La siguiente fase de integración real depende de aprobación explícita, gateway de identidad Auth, vínculo comprobable XLSX→filas→digest DB, permisos mínimos comprobados y plan de reversión confirmado. Los tests actuales **no** sustituyen estas puertas.


## Nueva continuidad: conciliación de digest Node/PostgreSQL y cierre de lote

Fecha 27/10/2026; misma rama privada `architecture/visura-shared-core-20261027`, PR #22 `DRAFT`, sin cambios en sistemas operativos.

1. **SHA de filas V2 entre lenguajes:** `architecture/lib/bc-row-frame-digest.mjs` y `architecture/drafts/visura_shared_rows_digest_v2_UNAPPLIED.sql` implementan SHA-256 sobre campos UTF-8 encuadrados con `uint32 big-endian`, en orden fijo por lote/almacén. El vector independiente Unicode `Niño / Café`, cero y negativo se verifica en Node y PostgreSQL 16. Acciones [40555809120](https://github.com/josegude-ux/INVENTA-/actions/runs/40555809120) **SUCCESS** y [40555809344](https://github.com/josegude-ux/INVENTA-/actions/runs/40555809344) **SUCCESS**.
2. **Contrato de entrada de un único archivo:** `architecture/lib/attest-bc-manual-upload.mjs` y sus pruebas toman bytes originales y llaman una sola vez al callback `readRowsFromBytes`, que debe ser un parser XLSX **confiable** y producir `{rows,expectedRows}`. El número esperado debe derivarse de la fuente, sin igualarse artificialmente a `rows.length`; se detectan cargas incompletas, cambios del buffer y stock físico usado como sustituto. [CI aislada 40556409522](https://github.com/josegude-ux/INVENTA-/actions/runs/40556409522) **SUCCESS**, [INVENTA 40556410623](https://github.com/josegude-ux/INVENTA-/actions/runs/40556410623) **SUCCESS**.
3. **Nueva protección de cabecera y estados:** `architecture/drafts/visura_shared_batch_metadata_guard_UNAPPLIED.sql` y `architecture/tests/sql/120_verify_batch_metadata_guard_pg16.sql` impiden modificar SHA/nombre/alma­cén/contador y autor del lote, saltar `staged → published` o alterar contadores después de validarlos. Los tests verifican la transición normal y el rollback. **Confirmación posterior:** PostgreSQL aislado [run 40556762941](https://github.com/josegude-ux/INVENTA-/actions/runs/40556762941) **SUCCESS** y suite general INVENTA [run 40556762899](https://github.com/josegude-ux/INVENTA-/actions/runs/40556762899) **SUCCESS**, sobre commit `1e3bd215bbe835b6caaab6643dfe0fff78a6902f`.
4. Especificaciones: `architecture/reports/2026-10-27-row-digest-v2-cross-runtime.md` y `architecture/reports/2026-10-27-trusted-import-boundary.md`. No existe lector XLSX real integrado aquí.

**Pendientes y bloqueos:** el parser real homologado debe ligar los mismos bytes a las filas; las versiones V1/V2 omiten `expiry_date` de la tabla SQL y requieren decisión de contrato; el SHA esperado debe proceder de un servidor de confianza y la identidad de la sesión real, no de un parámetro `p_actor`; falta garantía de autoría histórica, RLS real, pruebas E2E, rollback compensatorio posterior a commit, restauración y aprobación de integración. **No ejecutar borradores sobre Supabase, no crear RPC pública, no fusionar, no desplegar.**


## Continuidad 27/10 — interoperabilidad PR #22 con PREPARA PR #76

- **Prueba de estado previa a escrituras:** INVENTA [PR #22](https://github.com/josegude-ux/INVENTA-/pull/22) OPEN/DRAFT, rama `architecture/visura-shared-core-20261027`, PR PREPARA [#76](https://github.com/josegude-ux/KONTROLA/pull/76) OPEN/DRAFT, cabeza `fb723501e60597f70197e59cc895818203d2403d`, base `cursor/verificacion-fisica-cargas-8ba0`.
- **Contrato entregado para chat 02:** `architecture/reports/2026-10-27-prepara-pr76-interoperability-contract.md`, comparación explícita de `visura_shared` con el `visura_reporting` lógico de PR #76 y mapa exacto de `products,locations,fixed,stock,meta`. **No se crean** tablas ni sincronización `visura_reporting`; la única autoridad propuesta son `visura_shared` y el catálogo `public.products` de INVENTA.
- `architecture/lib/to-prepara-fixed-read-v1.mjs`: adaptador **puro, no conectado**, requiere que el FUTURO servidor compruebe identidad admin PREPARA y acceso al almacén, y que proporcione snapshot íntegro y certificados. Rechaza mezcla `COR_01_COR/COR_02_NAR`, lotes duplicados, ubicaciones no registradas, cantidades inseguras y recortes. Sin credenciales, RPC ni cambios PREPARA.
- `architecture/drafts/visura_shared_prepara_projection_UNAPPLIED.sql`: dos vistas privadas `security_invoker=true` sobre el esquema central: filas de stock vigentes por almacén, y procedencia/conteo de la importación. Sin grants a roles cliente ni segunda fuente. `architecture/tests/sql/130_verify_prepara_projection_pg16.sql` ensaya stock incompleto de Ferrol, estado por almacén, denegación `anon/authenticated`.
- `architecture/tests/to-prepara-fixed-read-v1.test.mjs`: contrato compatible con PR #76, cantidades decimales exactas y negativas, ubicación con espacios, ceros omitidos certificados vs desconocidos, importación total distinta de filas de stock, antigüedad conservadora, flags independientes y aislamiento por almacén.
- **CI de esta etapa:** ejecución aislada [#40568134207](https://github.com/josegude-ux/INVENTA-/actions/runs/40568134207) **SUCCESS** y regresión general INVENTA [#40568134286](https://github.com/josegude-ux/INVENTA-/actions/runs/40568134286) **SUCCESS** tras corregir solo la expresión esperada en un test de rechazo cruzado. En PREPARA, último HEAD #76 comprobado: [visual #40558827488](https://github.com/josegude-ux/KONTROLA/actions/runs/40558827488), [general #40558827584](https://github.com/josegude-ux/KONTROLA/actions/runs/40558827584), [RPC aislada #40558827490](https://github.com/josegude-ux/KONTROLA/actions/runs/40558827490), las tres **SUCCESS**. **No** son pruebas de integración entre repositorios ni validación productiva.
- **No modificado:** rama/archivos/PR #76, otros PRs, Supabase real, Business Central, usuarios/permisos, APIs expuestas, las PWA, Control de Cargas y Tanques.

**Pendientes concretos y puertas:** identidad unificada y permiso efectivo de un administrador PREPARA, servidor confiable que transforme snapshot con claves por almacén, parser XLSX homologado y digest comprobado contra BD, `expiry_date` incluido en futuro contrato de huella si se consume, conciliación del legacy de posiciones fijas sin almacén, certificaciones de completitud/vigencia de los cuatro maestros, política de ceros omitidos, límites del informe y pruebas E2E auténticas. Activar RPC, conceder GRANT, migrar, fusionar o desplegar sigue exigiendo autorización separada. El `meta.importedAt` propuesto representa actualmente tiempo de publicación del puntero; no atribuirlo erróneamente a la exportación del Excel BC.

**Próxima acción segura:** remitir el contrato a revisión del chat 02/propietario de PR #76, y ensayar en entorno descartable un gateway con identidad autorizada que produzca el snapshot sin exposición del esquema central, incluyendo errores por revocación de cuenta y almacén. **No se realiza integración real**.


## Cierre adicional 04 — pasarela de lectura de PREPARA

**Fecha:** 27/10/2026. La PR #22 sigue abierta en borrador y PR #76 de KONTROLA sigue en rama ajena SIN modificaciones por este chat. Contrato preciso para chat 02: `architecture/reports/2026-10-27-prepara-pr76-interoperability-contract.md`. La relación lógica `visura_reporting` de la propuesta de PR #76 se traduce a `visura_shared` y `public.products`; no hay catálogo/sync/tablas duplicadas.

- Adaptador aislado `architecture/lib/to-prepara-fixed-read-v1.mjs` + test: colecciones `products/locations/fixed/stock/meta`, aislamiento por `warehouse_code`, no inventar cero, no confundir stock_rows con todas las filas Excel; incompletitud de posiciones/ubicaciones/catálogo acreditadas por separado.
- Vistas privadas `architecture/drafts/visura_shared_prepara_projection_UNAPPLIED.sql` con `security_invoker` y sin GRANT a `anon/authenticated`. SQL de regresión `architecture/tests/sql/130_verify_prepara_projection_pg16.sql` verifica que un puntero Ferrol incompleto no produzca stock publicado y que el puntero Coruña sea independiente.
- Pasarela de servidor de **ensayo** `architecture/lib/prepara-fixed-read-gateway-seam.mjs`: autorización inyectada desde futuro servidor confiable, comprobada ANTES de leer el snapshot, en cada petición y revocación; pruebas en `architecture/tests/prepara-fixed-read-gateway-seam.test.mjs`. No expone endpoint ni vincula sesión Auth real. Un componente navegador no puede proporcionar los callbacks de confianza.
- El borrador de lotes BC exige `expected_rows>=1`: importación sin stock **no** se declarará completa por defecto. Se requiere manifiesto vacío específico antes de considerar un almacén realmente sin líneas; ninguna ausencia se convierte en cero.
- **CI VERIFICADA**: [VISURA shared-core isolated #40568557077](https://github.com/josegude-ux/INVENTA-/actions/runs/40568557077) **SUCCESS** y [INVENTA checks #40568556838](https://github.com/josegude-ux/INVENTA-/actions/runs/40568556838) **SUCCESS** en el commit `227ce579118c77038b8c1ef80a97c7b877959cb0`. Los tres workflows del HEAD de PR #76 `fb723501e60597f70197e59cc895818203d2403d` también se comprobaron SUCCESS (runs 40558827488, 40558827584 y 40558827490). Son CI **independientes**, NO integración real.

**Pendiente ANTES DE ACTIVACIÓN:** conciliación de posiciones sin almacén, correspondencia Auth entre sistemas, parser XLSX autenticado y digest end-to-end, expiry_date comprometida en contrato V3 si se usa como dato acreditado, política de caducidad del Excel, certificados de cobertura para cada almacén, API/RPC de confianza por servidor, pruebas con roles/usuarios de prueba y E2E de ambas PWAs; permiso expreso para todo cambio de permisos/migración/merge/deploy. Sin autorizar, la PR #76 debe continuar indicando origen central no disponible.

**Próxima acción técnica segura:** revisión documental y de ensayos privados por responsable de chat 02. Si pide ajustar la forma JSON, modificar exclusivamente el adaptador/borradores de PR #22 con pruebas, no su rama. Queda prohibido ejecutar SQL de borrador en los Supabase existentes.


## Aseguramiento de puntero vigente en interoperabilidad (27/10/2026)

Tras la primera entrega del adaptador PR #76, se ha reforzado la exigencia de que `snapshot.currentBatchId` coincida con `snapshot.batch.id`, y además que el lote esté vinculado al `warehouse_code` solicitado. Evita que un lote histórico o un snapshot sin puntero vigente parezca una publicación actual. El gateway futuro debe leer puntero, lote y líneas mediante una **instantánea consistente de base de datos**, con identidad y permiso efectivos, sin confiar en un puntero proporcionado por navegador.

Archivos cambiados exclusivamente en PR #22:
- `architecture/lib/to-prepara-fixed-read-v1.mjs`
- `architecture/tests/to-prepara-fixed-read-v1.test.mjs`
- `architecture/tests/prepara-fixed-read-gateway-seam.test.mjs`
- `architecture/reports/2026-10-27-prepara-pr76-interoperability-contract.md`

Prueba de regresión del lote histórico y ausencia de puntero añadida. Acción del último código `a8e3b2b0ac01da5deb246ea61a0cbd741aadba81` / [CI aislada #40569134490](https://github.com/josegude-ux/INVENTA-/actions/runs/40569134490): **SUCCESS verificado en GitHub Actions**. [Suite INVENTA #40569134491](https://github.com/josegude-ux/INVENTA-/actions/runs/40569134491): SUCCESS observado. No se ha tocado la rama de PR #76, ni SQL/RLS de producción, ni se ha creado conexión entre aplicaciones.
