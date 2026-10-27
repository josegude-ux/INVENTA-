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
