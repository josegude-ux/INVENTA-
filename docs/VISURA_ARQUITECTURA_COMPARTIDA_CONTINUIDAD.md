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
- architecture/tests/validate-bc-batch.test.mjs: suite Node sin escrituras.
- architecture/drafts/visura_shared_schema_UNAPPLIED.sql: diseño multialmacén fuera de migrations, tablas con RLS activado sin políticas permisivas ni grants.
No hay RPC de publicación ni pruebas PostgreSQL ni cambios de base. No fusionar ni desplegar esta rama.

## Continuidad / puertas
COMPLETADO: auditoría read-only; diseño; validador y pruebas locales. PREPARADO: SQL NO aplicado. PENDIENTE: contrato read-only real, compatibilidad códigos almacén, identidad, RLS, Auth/Storage/PDF, pruebas PostgreSQL y regresión. BLOQUEOS DE APROBACIÓN: migrar cuentas/datos, costes, ejecutar DDL real, cambios de permisos, fusionar, desplegar, pausar sistemas.
**Siguiente tarea técnica segura:** convertir el borrador en una migración validada en PostgreSQL descartable, probar integridad y concurrencia; revisar el SQL existente antes de introducir cualquier adaptador de consumo.
