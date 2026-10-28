# VISURA 04 — Integración arquitectónica INVENTA 07 / 08 / PREPARA

**Fecha de revisión:** 28/10/2026. **Repositorio:** josegude-ux/INVENTA-. **Rama exclusiva:** architecture/visura-shared-core-20261027. **PR #22** DRAFT/OPEN, SIN MERGE. **Alcance:** contratos, simulaciones Node/PG16 y auditoría de referencias, NO conexión empresarial.

## Evidencia contrastada antes del cambio

| PR | Responsable | HEAD observado | Estado |
|---|---|---|---|
| [#22](https://github.com/josegude-ux/INVENTA-/pull/22) | 04 | `a6691f789c390e8bd5a3eb35998205970f5931cb` inicial | DRAFT/OPEN, CI SUCCESS #40569294174 / #40569294006 |
| [#23](https://github.com/josegude-ux/INVENTA-/pull/23) | 05 | `977885f0105ef782228a781ff2e18093b80c6e78` | DRAFT/OPEN, PR apilada sobre #22, CI SUCCESS #40614222860 y relacionados |
| [#24](https://github.com/josegude-ux/INVENTA-/pull/24) | 07 | `aace927c20ba642a9d915a574e9f07c7c1221a9d` | DRAFT/OPEN, CI SUCCESS #40612070349 / #40612070352 |
| [#25](https://github.com/josegude-ux/INVENTA-/pull/25) | 08 | `18912ee42cc4464ed306fd73c700325d1dbc95f5` | DRAFT/OPEN, 4 workflows SUCCESS, incluido #40610333678 |
| [#76](https://github.com/josegude-ux/KONTROLA/pull/76) | PREPARA 02 | `fb723501e60597f70197e59cc895818203d2403d` | DRAFT/OPEN, 3 workflows SUCCESS, entre ellos #40558827490 |

La PR #23 fue basada sobre el mismo SHA de #22 antes de esta ampliación; al avanzar #22, su base nominal cambia sin que su rama propia sea modificada. Antes de fusionar ninguna se debe volver a evaluar la comparabilidad y los checkouts fijados por 05. Consultar también `architecture/audits/visura05/CONTINUIDAD.md`, `INTEGRACION_07_08_2026-10-28.md` y `INVENTA08_AUDITORIA_2026-10-28.md` en #23.

## Matriz de funciones, propiedad y estado

| Contrato/componente | Propietario | Estado verificable | Dependencia de integración |
|---|---|---|---|
| Catálogo único `public.products`, clave almacén/ubicación, ubicaciones `warehouse_locations` | 04 #22 | Borrador SQL, PG16 ficticio | Reconciliar legacy `public.locations` y cobertura real |
| Lotes BC manuales, staging/validador, huella XLSX/filas V2, publicación CAS | 04 #22 | Implementado solo en Node/SQL de laboratorio | Parser XLSX fiable; bitácora servidor; aprobación de despliegue |
| Puntero por almacén y vista BC privada, `REPEATABLE READ READ ONLY` | 04 #22 / auditoría 05 #23 | PG16 ficticio, CI 05 verificada | Backend real con una sola transacción; no mezclar SELECT en READ COMMITTED |
| Físico: campaña, pareja, terminal, borradores, correcciones, provisionales, cierre | 07 #24 | Dominio + UI + laboratorio autónomos | Identity+assignment+campaign RLS, sin lector BC para operario |
| Teórico: total SKU de todas las ubicaciones, fijas, historia, XLSX una hoja | 08 #25 | Motor + UI + laboratorio autónomos | Asociación `associationId`, `active`, `revision` y origen BC certificado |
| Informe administrativo de fijos PREPARA, CSV/XLSX/PDF | 02 #76 | Código y pruebas aisladas | Gateway central y autorización por rol/almacén |
| Auditoría y coordinación cruzada | 05 #23 | Suites exactas y TODO declarados | Revisión de nuevos SHA, no cambios en ramas 04/07/08 |
| Auth unificada, RLS real, migración y consumidores PWA | Integración tras autorización | NO IMPLEMENTADO / NO AUTORIZADO | Aprobación, backup/restore, prueba real, desactivación reversible |

## Entregas nuevas exclusivas de PR #22

### INVENTA 07 — recuento físico ciego

`architecture/lib/to-inventa07-blind-location-v1.mjs` toma un snapshot físico obtenido de fuente confiable y un `serverContext` aportado por backend (no navegador): usuario activo, sesión y terminal válidos, módulo INVENTA, rol operario, campaña/almacén/ubicación y asignación vigentes. **No autoriza de verdad:** los campos son una interfaz para futuro servidor y sus proveedores de comprobación siguen sin implementarse.

La salida es **exactamente** `{locationCode,locationStatus,references,provisionals}` admitida por `inventory-ui/location-view.js` de PR #24. Cada referencia recoge `productCode,lot,description,status,quantity,explicitZero,correctionPending`. La única cantidad permitida es `physical_quantity` (texto, hasta tres decimales), nunca `stock_calculated` o `warehouseTotal`; no se copian objetos anidados, lotes BC, diferencias, precios ni metadatos teóricos. El cero físico exige `explicitZero=true`. Una consulta con asignación, terminal o campaña revocados se rechaza. Ensayo sintético: `architecture/tests/to-inventa07-blind-location-v1.test.mjs`.

**Responsable 07:** mantener semántica de confirmación, revisión/cierre, correcciones, parejas y outbox; 04 no modifica el motor físico ni crea tablas operativas. El servidor deberá filtrar campos antes de serializar la respuesta al dispositivo: ocultarlos solo en UI es insuficiente.

### INVENTA 08 — total teórico y asociaciones

`architecture/lib/to-inventa08-fixed-stock-v1.mjs` emite `{meta,products,locations,fixed,stock}` requerido por `fixed-stock-08/report.mjs`. Requiere contexto servidor de admin INVENTA en almacén concreto, `currentBatchId`, `snapshotId` y `positionsVersion`. Las asociaciones deben aportar **identidad estable, estado `active` booleano y `revision` monotónica**; no se pueden fabricar IDs a partir de la posición histórica sin conciliar. La línea BC conserva `importId`, SKU, ubicación, lote y decimal exacto como texto; incluye **todas** las ubicaciones certificadas de ese SKU, fijas o no, sin duplicar stock por asociación. Las entradas de almacén ajeno, ubicaciones no registradas o lotes duplicados se rechazan.

Las banderas `stockComplete/catalogComplete/positionsComplete/locationsComplete` solo aparecen como verdaderas tras certificaciones independientes; `stale` exige fecha de **exportación BC acreditada**, no publicación reciente. `exportedAt`, `importedAt` y `publishedAt` no se confunden. El modelo actual no prueba por sí mismo tales certificados, solo valida su forma. Prueba: `architecture/tests/to-inventa08-fixed-stock-v1.test.mjs`. El XLSX de **una sola hoja** continúa siendo competencia de PR #25 y no se reimplementa aquí.

Borrador de estructura que falta en #22: `architecture/drafts/visura_shared_inventa08_association_v1_UNAPPLIED.sql` **evoluciona aditivamente** el mismo maestro `visura_shared.warehouse_fixed_positions` con `association_id`, `active`, `revision` y nueva tabla de eventos apéndice. Vista privada `security_invoker` `visura_shared.inventa08_associations_v1`. **No** es migración ejecutada, la tabla histórica de fijos no se toca, ni se crea un maestro paralelo. El nuevo trigger impide UPDATE/DELETE de eventos en el contenedor de prueba; el propietario SQL podría alterar triggers. **La transición atómica de estado y evento, con CAS y autor autenticado, sigue sin implementarse**. La prueba de estructura, almacenes distintos, revisión y evento ficticio es `architecture/tests/sql/140_verify_inventa08_association_pg16.sql`.

### PREPARA

Se conserva `architecture/lib/to-prepara-fixed-read-v1.mjs` y el gateway de ensayo `prepara-fixed-read-gateway-seam.mjs`, con `products,locations,fixed,stock,meta`. No crear `visura_reporting` duplicado. **Corrección prioritaria:** su `stale` se calcula ahora desde **`exported_at` certificado**, no `published_at`; `importedAt` refleja la importación, con `publishedAt` distinto. Los datos históricos que no prueban exportación/importación se tratan como obsoletos, no fiables. Los certificados no pueden proceder del navegador.

## Auth/RLS — puertas concretas

1. **Una identidad autoritativa** futura; correspondencia de las dos cuentas existentes aprobada sin copiar contraseñas/JWT, manteniendo actor original y acceso individual revocable. Decidir papel de `profiles` INVENTA y `usuarios_app` PREPARA sin doble autoridad.
2. Validación servidor **por petición**: sesión activa y no revocada; usuario vigente; permiso módulo `inventa`/ `prepara`, rol y almacén; campaña/asignación/terminal específicos para físico 07. Leer el permiso antes de los datos BC.
3. Cierre con **deny-by-default** y RLS. Vistas `security_invoker` en esquema privado y sin `GRANT` a `anon/authenticated`. El usuario SQL del futuro gateway debe tener permisos mínimos y una identidad de actor no suplantable: `p_actor` y `serverVerified` sintéticos **no** garantizan esto.
4. Diferenciar físicamente en servidor la vista de operario de la de administrador. Nunca enviar stock teórico al teléfono del operario, aunque se oculte visualmente.

## BC Excel manual, lotes y exactitud

- **Prohibido** API, sincronización automática y escritura hacia Business Central. El administrador aporta archivos Excel manualmente.
- PR #18 del parser histórico contiene un defecto reproducido por el chat 05: texto `99999999999.123456` convertido a `Number` deja `99999999999.12346`, silenciosamente. Este resultado es **una prueba de error**, no certificación. El responsable de #18 debe corregir la conversión y aceptar valores originales como texto decimal, o el servidor debe rechazar el archivo/filas sin exactitud.
- El prototipo `attest-bc-manual-upload.mjs` exige mismos bytes/filas y conteo independiente; el hash DB V2 verifica la normalización. No hay **parser XLSX real homologado** conectado, tampoco un archivo BC auténtico autorizado ni prueba de pérdida irreversible anterior a la lectura.
- `expected_rows` de lote de stock dedicado no es necesariamente el total de filas/hojas del Excel mixto. Una ausencia nunca equivale a cero salvo regla BC explícita y acreditada.
- `expiry_date` permanece fuera del digest V2; debe decidirse si el Excel lo contiene y versionar el compromiso criptográfico antes de consumirlo como dato confiable.
- Fechas distintas: **exportación BC** → **importación manual** → **validación** → **publicación**; cada sello necesita evidencia de su hecho y origen. Fecha de publicación actual no renueva un archivo anterior.

## Compatibilidad histórica y plan reversible

La migración histórica 006 calcula stock por posición y usa `COALESCE` para inventar ceros cuando faltan líneas, `bc_import_current` global y ubicación sin almacén. La 008 y consumidores `warehouse-management.js` / `fixed-positions-import.js` incluyen reemplazo/DELETE físico y paginación con lectores sin instantánea estable. **No** modificar estos consumidores ni ejecutar DELETE para forzar compatibilidad.

Plan futuro solo tras autorización: congelar HEAD y auditar datos/consumidores; backup/restauración ensayada; mapa manual de fijos/ubicaciones por `(warehouse,location,product)` y detección de conflictos; migración **aditiva** e historial con identidad original; comparar lectura sin escribir en dos autoridades; ensayar Auth/RLS y concurrencia; activar lectura por almacén con feature flag, validación E2E y fallback sin borrar registros ni eventos; migrar escrituras solo con responsable funcional y plan aprobado; detener sistema anterior por decisión expresa. No ejecutar paso alguno de producción desde chat 04.

## Pruebas y aceptación

La CI de PR #22 ejecuta `node --test architecture/tests/*.test.mjs` y PostgreSQL 16 descartable. Las pruebas añadidas cubren **negación de físico BC** y sesiones/terminales/campañas ficticios, **lectura 08 con identidad/revisión** y no extrapolar importaciones, **antigüedad real BC**, **esquema aditivo e historia append-only ficticia**. El control lector/publicador `REPEATABLE READ` de PR #23 ya es SUCCESS y no se duplica.

**No confundir éxito en CI con fuente empresarial, autenticación real o disponibilidad de interfaz.** Los cambios de #22 se mantendrán en su propia PR; #23 de 05, #24 de 07, #25 de 08 y KONTROLA de PREPARA no son objetos de escritura de este chat.

## Entrega y próximos responsables

- **04:** mantener contrato único, completar interfaz de gateway autenticado en entorno descartable, digest de filas y snapshots de lectura consistente; diseñar los pasos aditivos de migración.
- **07:** revisar forma física de `references/provisionals`, terminal, pareja, campaña, permisos por tramo, cierres y los campos que necesitan sin exponer BC.
- **08:** revisar forma de `meta/fixed/stock`, `positionsVersion`, revocaciones y reconciliación/retirada; conservar su XLSX de una hoja.
- **02/PREPARA:** confirmar contrato de salida, flags de completitud, expiración, y actualizaciones de consumidor en su rama propia.
- **05:** volver a ejecutar únicamente pruebas cruzadas con los nuevos SHA y revisar el plan de acoplamiento; no hacer merge ni despliegue.
- **Responsable empresarial:** autorizar cuando proceda backup, identidad, permisos, reconciliación de fijos, importaciones reales, migración, pruebas E2E y corte.

**Bloqueos duros:** Auth empresarial y correspondencia de cuentas, Excel auténtico y parser homologado, fecha de exportación acreditada, backfill de fijos sin almacén, RLS y API reales, transacción de retiro/reactivación con actor no suplantable, pruebas completas en PWA/dispositivo físico y aprobación expresa. No ocultar pendientes ni abrir RPC pública.
