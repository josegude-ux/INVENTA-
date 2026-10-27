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

## Compatibilidad con el sistema existente

\`main\` usa \`public.counts\` como entradas append-only, \`public.assignments\` por usuario y \`real-counts.js\` como interfaz real individual con cola local; carece del contrato completo de borrador y confirmación. Los experimentos están bajo \`inventory-lab/\` para **no sustituir** esos componentes ni interferir con PR #18/#19 (Excel), #20 (marca) o #22/#23 (arquitectura compartida).

## Próxima tarea segura

1. Documentar mapeo de las entidades ficticias al esquema real de INVENTA y puntos de conflicto, **sin modificar ni migrar tablas existentes**.
2. Diseñar API autenticada de borradores, equipos, estado de ubicación y eventos, con denegación por defecto, PostgreSQL efímero y pruebas de sesiones de dos usuarios reales antes de proponer cambio de base activa.
3. Extender ensayo de parejas a control verificable de sesión y un terminal, y probar revocación de asignación entre apertura de pantalla y escritura.
4. Incorporar el contrato mediante una capa de compatibilidad con cola offline e idempotencia de \`real-counts.js\`, conservando la UI y marca actuales hasta resolver las PR solapadas.
5. Validar pantalla real en móvil vertical/horizontal, tablet vertical/horizontal y escritorio; no confundir maqueta responsive con aplicación integrada.

**Prohibiciones:** NO MERGE, NO DEPLOY, NO SQL A SUPABASE ACTIVA, NO CAMBIAR USUARIOS, NO ESCRIBIR EN BUSINESS CENTRAL.
