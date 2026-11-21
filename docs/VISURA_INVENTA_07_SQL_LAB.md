# VISURA INVENTA 07 — Ensayo de persistencia PostgreSQL 16 (NO PRODUCTIVO)

**Auditoría y hito:** 27–28/10/2026. **Repositorio:** josegude-ux/INVENTA-.  
**Rama:** feature/visura-inventa-07-domain-20261027. **PR:** #24, borrador; sin merge ni despliegue.

## Propósito y límites

Este laboratorio es una implementación **aislada** de parte del contrato de persistencia, NO una migración lista para Supabase y NO un backend conectado a la PWA. Su función es demostrar controles de datos antes de integrar una arquitectura definitiva.

Archivos:
- inventory-lab/001_disposable_reference_contract.sql — tablas de prueba, roles, RLS de lectura, borradores y confirmaciones atómicas, recibos idempotentes, CAS por versión y denegación de stock BC.
- inventory-lab/002_disposable_correction_contract.sql — preparación de corrección sin cambiar el valor confirmado, revisión, motivo, autor declarado (puede diferir del autenticado), historial append-only y confirmación atómica.
- tests/sql/inventa07_lab_contract.sql — fixtures ficticios de dos usuarios, revocación de lectura/escritura, prohibición de modificación directa, confirmación, cero, denegación de teórico BC y cierre.
- tests/sql/inventa07_lab_concurrency.sh — dos conexiones reales compitiendo por la misma revisión: una acepta y otra rechaza por versión obsoleta, sin duplicar cantidades.
- tests/sql/inventa07_lab_corrections.sql — revisión previa, motivos, rechazo de autor no autorizado, confirmación histórica y sesión autenticada.
- .github/workflows/inventa07-ephemeral-db.yml — ejecución en servicio PostgreSQL 16 descartable; no utiliza secretos ni conexiones del proyecto Supabase.

## Evidencia verificada

**GitHub Actions PostgreSQL 16 PASS:** ejecución 40601884067 sobre el commit a8db053f981f5b214c5b7788e46cfd73f4a9f79f.  
**Suite general INVENTA PASS:** ejecución 40601884192 sobre el mismo commit.

Las primeras ejecuciones fallaron por aserciones del formato decimal de cero y delimitadores SQL; los fallos se localizaron en el propio laboratorio, se corrigieron y las pruebas se repitieron hasta PASS. La CI también verifica que ejecutar el esquema contra la base ficticia llamada \`postgres\` **fracasa por diseño**: solo se permite \`inventa07_test\`.

La ejecución PostgreSQL confirma exclusivamente propiedades del modelo ficticio: no certifica RLS ni JWT real en Supabase, ni funcionamiento móvil, ni un servidor de recuento productivo.

## Seguridad crítica: NO copiar este esquema a producción

- El entorno de pruebas simula identidad y sesión mediante \`request.jwt.claim.sub\` / \`request.jwt.claim.session_id\` introducidos por psql. **Los datos de este contexto no constituyen por sí solos autenticación**. En producción, la identidad debe proceder de una sesión realmente validada por Supabase/PostgREST, con revocación verificable.
- El laboratorio usa funciones SECURITY DEFINER cerradas al rol ficticio creado por la prueba y con comprobaciones internas. Antes de cualquier integración deben diseñarse permisos mínimos reales, funciones privadas, RLS, aislamiento multialmacén, búsqueda segura y evaluación de \`SECURITY DEFINER\`.
- El laboratorio NO implementa todavía doble lectura real del escáner, tramos compartidos en el esquema de INVENTA, arrendamiento de un terminal activo para pareja, validación de equipos con sesión real, controles completos de campañas, rectificaciones postcierre en BD, exportaciones Excel, ni protección de snapshot de catálogo durante importaciones concurrentes.
- No modificar ni publicar datos de Business Central. El Excel definitivo de BC sigue pendiente de archivo real.
- No se ha tocado ningún proyecto Supabase, credencial, usuario real, política, migración activa ni tabla productiva.


## Tercer contrato experimental — códigos alternativos

Se han añadido \`inventory-lab/003_disposable_barcode_admin.sql\` y \`tests/sql/inventa07_lab_barcode_admin.sql\`, integrados en la CI aislada. El contrato **solo ficticio** verifica que activar o desactivar un código alternativo exija Administrador habilitado y motivo, que ningún código oficial pueda reutilizarse como alias, que una asociación activa no se sobrescriba y que primero se desactive justificadamente antes de vincular otra referencia. Los eventos de asociación se conservan sin modificar automáticamente ningún recuento anterior. La política de consulta de alias ocultará asociaciones desactivadas a lectores ordinarios. Aún no constituye migración ni cambio de políticas reales.

**Resultado comprobado de la tercera ampliación:** PostgreSQL 16 aislado PASS, ejecución 40602351353, commit fe782c3dc8a73246d24d83dbb61bfe2681efa4e7. Las pruebas de la suite general también finalizaron correctamente sobre ese commit. La prueba de revocación de asignación al cambiar una pantalla abierta fue añadida y verificada antes de esta ampliación (commit f520bbae916f4f460af9a111904e0f9ed1a0e075). La CI del laboratorio queda con activación por PR o manual para evitar ejecuciones duplicadas.  

Este ensayo aborda el hallazgo comprobado por SELECT a \`pg_policies\`: \`public.barcodes\` en la base real todavía permite INSERT a cualquier perfil habilitado. Ese permiso debe modificarse únicamente al integrar el nuevo flujo administrativo, con revisión de compatibilidad y autorización. La auditoría está en \`docs/VISURA_INVENTA_07_RLS_AUDIT.md\`.

## Compatibilidad con el sistema existente

\`main\` usa \`public.counts\` como entradas append-only, \`public.assignments\` por usuario y \`real-counts.js\` como interfaz real individual con cola local; carece del contrato completo de borrador y confirmación. Los experimentos están bajo \`inventory-lab/\` para **no sustituir** esos componentes ni interferir con PR #18/#19 (Excel), #20 (marca) o #22/#23 (arquitectura compartida).

## Próxima tarea segura

1. Documentar mapeo de las entidades ficticias al esquema real de INVENTA y puntos de conflicto, **sin modificar ni migrar tablas existentes**.
2. Diseñar API autenticada de borradores, equipos, estado de ubicación y eventos, con denegación por defecto, PostgreSQL efímero y pruebas de sesiones de dos usuarios reales antes de proponer cambio de base activa.
3. Extender ensayo de parejas a control verificable de sesión y un terminal, y probar revocación de asignación entre apertura de pantalla y escritura.
4. Incorporar el contrato mediante una capa de compatibilidad con cola offline e idempotencia de \`real-counts.js\`, conservando la UI y marca actuales hasta resolver las PR solapadas.
5. Validar pantalla real en móvil vertical/horizontal, tablet vertical/horizontal y escritorio; no confundir maqueta responsive con aplicación integrada.

**Prohibiciones:** NO MERGE, NO DEPLOY, NO SQL A SUPABASE ACTIVA, NO CAMBIAR USUARIOS, NO ESCRIBIR EN BUSINESS CENTRAL.

## Cuarto contrato experimental — provisionales y validación administrativa

- inventory-lab/004_disposable_provisionals.sql: registro sintético por ubicación de producto desconocido con dos lecturas distintas y coincidentes, descripción obligatoria, cantidad física explícita y fotografía opcional. No se crean referencias oficiales.
- tests/sql/inventa07_lab_provisionals.sql: rechazo de una sola lectura, discrepancia de códigos, descripción ausente, duplicado en una ubicación, aceptación de la misma lectura en otra ubicación y lectura segregada por operario.
- Cola admin_pending_provisionals(): muestra pendientes exclusivamente a Administración habilitada; no sugiere ninguna referencia oficial.
- review_provisional(): Administración introduce manualmente la referencia y una decisión justificada. Los duplicados se documentan sin sumar; las cantidades adicionales pasan a awaiting_consolidation hasta una operación administrativa diferente. No se alteran automáticamente recuentos confirmados.
- Los eventos de escáner simulados NO constituyen prueba técnica de una cámara real ni autenticación de segunda persona.

**Evidencia PostgreSQL 16**: PASS en commit 1ffe71f412a8e5fb36775e571b3f9d0974b3ffbc, ejecución 40603077570. La suite general INVENTA también terminó correctamente sobre ese mismo commit. La API sigue aislada, sin Supabase ni Business Central.
