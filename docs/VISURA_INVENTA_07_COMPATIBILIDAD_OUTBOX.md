# VISURA INVENTA 07 — Transición segura V1/V2

Fecha: 28/10/2026. Repositorio: josegude-ux/INVENTA-. Rama: feature/visura-inventa-07-domain-20261027, PR #24 en borrador.
Estado: IMPLEMENTACIÓN AISLADA. No conectada a PWA, Supabase ni Business Central.

## Contrato publicado y riesgos

La versión main de real-counts.js almacena la cola local como inventa-count-outbox-v1:<uid>. Cada registro incluye campaign_id, location_code, product_code, lot, quantity, actor_id, entries, client_mutation_id y, en correcciones, previous_id y correction_reason. Envía mediante POST directo a public.counts; usa lock inventa-count-sync:<uid> cuando navegador lo permite y atiende conflictos 409 consultando client_mutation_id. El cálculo de palés publicado todavía usa fórmula anterior. La interfaz no soporta todavía el nuevo ciclo de borrador, revisión, confirmación o parejas.

PROHIBIDO convertir o eliminar automáticamente entradas V1, colapsar duplicados por comodidad, alterar UUID de mutación, omitir lotes o redirigir operaciones V1 a RPC nuevas sin protocolo de migración validado.

## Implementación nueva aislada

- inventory-core/outbox-compat.cjs: inspección no destructiva de V1, detección de conflictos de ID; cola V2 separada por cuenta; cálculo preciso con calculateCount; cero explícito, lote y desglose; comandos independientes de borrador, confirmación y corrección; protección de clave idempotente; denegación de envío cuando haya V1 pendientes o falten capacidades del servidor; retirada únicamente con recibo autenticado que corresponda exactamente a actor, ID, solicitud y versión.
- inventory-core/sync-runner.cjs: sincronización con transporte inyectado, sin efectos en red o almacenamiento; bloqueo exclusivo con el nombre del lock heredado; revalidación de sesión tras negociar capacidades y recibir respuesta; reintento con el mismo ID; búsqueda de recibo en pérdida de respuesta o 409; bloqueo en revocación 401/403, cambio de cuenta, cola cambiada o V1 añadido durante la operación. No hay fallback a POST antiguo.
- tests/inventa07-outbox-compat.test.cjs y tests/inventa07-sync-runner.test.cjs: regresiones sintéticas de conservación de cola, separación por usuario, cero, lote, CAS, revisión, idempotencia, respuesta perdida, desconexión, logout, recibos insuficientes, bloqueo entre pestañas y cambios concurrentes.

## Barreras que impiden la activación en producción

1. Los contratos iniciales del laboratorio SQL no incluían el lote en las claves de referencia y evento. Se ha añadido el ensayo V2 independiente inventory-lab/006_disposable_lot_contract.sql, con clave completa por campaña, ubicación, referencia y lote, sin modificar las tablas de prueba previas. Esto NO significa que el servidor real tenga todavía capacidades V2 ni que pueda anunciarse un handshake operativo.
2. La identidad del laboratorio es simulada mediante claims de psql, no autenticación Supabase verificada. La autoridad se debe comprobar EN SERVIDOR con JWT, sesión, equipo original, asignación, versión y campaña dentro de la misma transacción.
3. No existe todavía una RPC productiva que devuelva el recibo firmado por transporte autenticado, con protocolo V2, mutación, usuario, solicitud completa y revisión.
4. El handshake de capacidades del cliente no acredita permisos: cada RPC debe denegar por defecto, y una bandera local no sustituye RLS/validación.
5. El adaptador requiere una implementación real del bloqueo exclusivo; no permitir fallback inseguro sin coordinación entre pestañas.
6. No se ha alterado real-counts.js, index.html, service worker, caché PWA ni almacenamiento activo.

## Criterios para integrar después

Comprobar pérdida de respuesta tras escritura, revocación de permisos durante vuelo, colas de A/B, competencia de dos envíos, lote y cantidades exactas, revisión física, cuentas compartidas nunca, cambios de rol, y recuperación tras desconexión o cierre forzoso. Ejecutar E2E con dos cuentas reales en entorno autorizado y validar móvil/tablet/escritorio con la interfaz final.

Próximo paso independiente: ensayar en PostgreSQL 16 descartable una clave completa por campaña, ubicación, referencia y lote, además de un recibo persistente con la solicitud completa y desglose. No tocar tablas reales hasta aprobación.

NO MERGE, NO DEPLOY, NO DDL EN SUPABASE REAL, NO API DIRECTA BC, NO CAMBIOS EN PRODUCCIÓN.


## Nuevo ensayo de claves por lote y recálculo en servidor

Archivos: inventory-lab/006_disposable_lot_contract.sql y tests/sql/inventa07_lab_lot_contract.sql. Una tabla de prueba separada conserva como clave (campaign_id, location_code, product_code, lot). Un borrador guarda desglose y cantidad recalculada por servidor, con revisión CAS y cero expreso. Confirmar crea evento histórico inmutable con lote, cantidad, desglose, usuario autenticado y sesión de ensayo. Se deniegan modificaciones directas a operarios y el ensayo no concede SELECT general sobre los eventos históricos. Los tests verifican mismo artículo con dos lotes distintos y referencia sin lote, además de rechazar subtotales client-side falsificados.

Este ensayo, por sí solo, NO implementa el protocolo V2 completo: faltan RLS de pareja y terminal, protección de revocación de Auth real, recibos compatibles con las nuevas colas y las operaciones de corrección por lote. La PWA y Supabase real no han sido modificadas.
