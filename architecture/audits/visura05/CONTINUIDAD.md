# VISURA 05 — Ensayo independiente de lector y publicador

**Fecha:** 27/10/2026. **Responsable:** chat 05. **Objeto:** una única prueba nueva de lectura coherente en PostgreSQL 16 descartable, derivada del HEAD auditado de INVENTA PR #22 `a6691f789c390e8bd5a3eb35998205970f5931cb`; contrato consumidor KONTROLA PR #76 `fb723501e60597f70197e59cc895818203d2403d`.

## Alcance y límites
Solo SQL de pruebas con fixtures 100% sintéticos y workflow de CI de solo lectura del repositorio. No cambia `architecture/lib`, borradores de arquitectura, RLS de aplicaciones, PR #22, PR #76, Business Central, Supabase, Control de Cargas, Tanques ni las PWA. NO APLICAR EN BASES REALES. Ningún endpoint/RPC se activa. Este ensayo no autentica identidades reales ni certifica el importador XLSX.

## Novedad frente a CI existente
El workflow de PR #22 ya prueba **dos publicadores** y bloqueo por almacén; falta confrontar un **lector que mantiene una instantánea coherente** mientras un segundo actor publica. Esta rama ejecuta el esquema/borradores de PR #22 solo en PostgreSQL 16 desechable y usa sus datos inventados.

1. El lector abre transacción **REPEATABLE READ READ ONLY**, lee lote D4 de COR_01_COR, stock 12.25 y procedencia.
2. Publicador independiente sustituye D4 por F6 (stock 7), con CAS, COMMIT y auditoría.
3. El lector sigue viendo exclusivamente D4, stock 12.25 y el origen del mismo lote (sin mezclar los dos commits). El almacén COR_02_NAR conserva el puntero original.
4. Cerrada la transacción del lector, una lectura nueva ve F6, stock 7 y procedencia congruente. La importación incompleta de COR_02_NAR no se expone.
5. Si alguna aserción falla, el trabajo termina con error. Sin cambiar estado real ni publicar datos.

**Puerta no resuelta:** el `loadSnapshot` real del futuro servidor debe emplear una única transacción o mecanismo equivalente con snapshot coherente; que esta prueba supere PostgreSQL no demuestra que el gateway de producción haya sido construido. También faltan Auth, ACL, fecha acreditada de exportación BC, parser confiable, reconciliación de fijos/ubicaciones, E2E y autorización de activar.

## Continuidad
En este chat se verificaron PR #22 y #76 OPEN/DRAFT/UNMERGED y no hay rama existente VISURA 05. Este es un desarrollo de **pruebas, independiente y aditivo**, nunca una sustitución del propietario de la arquitectura. Tras CI, añadir aquí el run exacto/conclusión y comunicar la puerta al chat 04. Mantener la rama en borrador, sin fusionar ni desplegar.
