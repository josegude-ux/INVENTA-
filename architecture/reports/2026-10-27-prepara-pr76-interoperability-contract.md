# VISURA 04 → VISURA PREPARA 02 — Contrato de interoperabilidad PR #22 / PR #76

**Fecha de conciliación:** 27/10/2026. **Ámbito:** arquitectura, adaptador administrativo de solo lectura y pruebas ficticias. **SIN MIGRACIÓN, RPC OPERATIVA, GRANTS, MERGE NI DESPLIEGUE.**

**Fuentes contrastadas**: INVENTA [PR #22](https://github.com/josegude-ux/INVENTA-/pull/22), rama `architecture/visura-shared-core-20261027`, estado **OPEN/DRAFT**; PREPARA [PR #76](https://github.com/josegude-ux/KONTROLA/pull/76), rama `feat/visura-prepara-admin-posiciones-fijas-20261027`, base `cursor/verificacion-fisica-cargas-8ba0`, estado **OPEN/DRAFT**, último HEAD observado `fb723501e60597f70197e59cc895818203d2403d`. No se ha escrito ningún archivo en el repositorio KONTROLA.

## 1. Decisión de compatibilidad: una fuente única

La propuesta PR #76 (`supabase/proposals/visura_posiciones_fijas_central_rpc.sql`) menciona `visura_reporting.import_state`, `warehouse_access`, `fixed_by_warehouse`, `locations_by_warehouse`, y las tablas históricas `public.bc_import_*`. Son nombres de un modelo **propuesto**, que NO equivalen a nuevas fuentes o tablas que deban crearse. Una materialización dual de estos objetos rompería el principio de autoridad única.

**Arquitectura acordada como propuesta no desplegada:** utilizar directamente `visura_shared` de PR #22 y su maestro `public.products` de INVENTA. Los nombres `visura_reporting` son únicamente **semántica lógica** de entrada del adaptador, **no tablas, esquemas, sincronizaciones ni bases independientes**. Ni PREPARA ni su navegador abren una conexión cruzada de Supabase o reciben `service_role`.

Se entregan **solo en PR #22**:
- `architecture/drafts/visura_shared_prepara_projection_UNAPPLIED.sql`: vistas privadas `security_invoker`, `prepara_fixed_stock_rows_v1` y `prepara_fixed_import_provenance_v1`, derivadas respectivamente del stock publicado por almacén y del puntero central. **Sin grants**.
- `architecture/lib/to-prepara-fixed-read-v1.mjs`: transformador de un *snapshot* servidor autorizado hacia la forma JSON ya esperada por PR #76. No realiza lecturas reales ni valida la autenticación de una sesión: `verifiedScope` debe construirse **en servidor de confianza**, no aceptar atributos del navegador.
- `architecture/tests/to-prepara-fixed-read-v1.test.mjs` y `architecture/tests/sql/130_verify_prepara_projection_pg16.sql`: pruebas aisladas de formato, lote, inventario, almacén, continuidad y denegación por roles.

## 2. Correspondencia exacta de atributos

| Origen autoritativo de PR #22 | Salida esperada PR #76 | Garantía / límite |
| --- | --- | --- |
| `public.products(code,description,unit)` a través de `visura_shared.products_v1` | `products:[{code,description,unit}]` | ÚNICO catálogo central, sin duplicación ni copiar productos a PREPARA |
| `visura_shared.warehouse_locations(warehouse_code,location_code,aisle,zone,...)` | `locations:[{warehouse,code,aisle,zone}]` | Clave compuesta almacén+ubicación; el mismo `A-01` puede pertenecer a Coruña y Ferrol |
| `visura_shared.warehouse_fixed_positions(...)` | `fixed:[{warehouse,product_code,location_code}]` | Solo posiciones ya conciliadas **por almacén**; no importar sin atribuir las históricas `public.fixed_positions` |
| `visura_shared.bc_current_by_warehouse` → lote `state='published'` y líneas `bc_batch_lines` | `stock:[{warehouse,product_code,location_code,lot,quantity,unit}]` | **quantity = stock_calculated**, nunca stock físico, recuento ciego, diferencias ni movimientos; preservar cero, negativo y lote |
| `bc_batch_lines.expiry_date` | `stock[].expiryDate` opcional y aditivo | PR #76 **no lo consume** en el informe. El contrato de validación/hash V2 actual no cubre caducidad; decidir fuente y versionar antes de integrar |
| `bc_batches.file_name, id, source` + `bc_current_by_warehouse.published_at` | `meta.sourceFile,meta.importId,meta.importedAt` | `importedAt` es publicación central del puntero, **no** fecha automática de exportación BC; fecha de importación real requerirá evento propio acreditado |
| `bc_batches.expected_rows,validated_rows` y conteo efectivo de `bc_batch_lines` | `meta.stockExpectedRows,meta.stockRows` | En este modelo **son líneas de stock normalizadas**; no equiparar con todas las filas, cabeceras u hojas del Excel |
| `bc_batches.total_import_rows` de futuro contrato, si existiera | `meta.totalImportRows` o `null` | No existe hoy en el borrador central. Solo se usa como diagnóstico opcional, nunca para validar stock |
| Servicio de identidad/roles y ACL `user_module_warehouses` | `meta.authorized=true` | Solo cuando **servidor de confianza** haya autorizado usuario activo, admin PREPARA y almacén específico; no existe pasarela activa |
| Certificados independientes de importación/catálogo/posiciones/ubicaciones | Flags `meta.*Complete` | Denegación conservadora por defecto; **NO se infieren** de un array no vacío |
| Política de vigencia de origen | `meta.stale` | Por defecto true si falta tiempo de referencia, antigüedad máxima o certificación de frescura |
| Acreditación BC explícita de ceros omitidos | `meta.absentStockIsZero` | Por defecto **false**; la falta de línea = DESCONOCIDO, no cero |

## 3. Contrato que debe conservar la UI de PR #76

**Nombre esperado actual de RPC, solo futuro:** `kontrola_admin_posiciones_fijas(p_almacen text)` → un objeto JSON, no una lista de respuestas. La UI `src/admin-fixed-positions.mjs` comprueba `meta.warehouse===p_almacen`, `meta.truncated===false` y después entrega las colecciones a `classifyFixedPositions`.

**Forma exacta (ejemplo 100% ficticio de salida del adaptador aislado):**

```json
{
  "warehouse": "COR_01_COR",
  "meta": {
    "warehouse": "COR_01_COR",
    "authorized": true,
    "truncated": false,
    "stockComplete": true,
    "catalogComplete": false,
    "positionsComplete": false,
    "locationsComplete": false,
    "absentStockIsZero": false,
    "stale": false,
    "sourceFile": "BC.xlsx",
    "importedAt": "2026-10-27T10:00:00.000Z",
    "importId": "solo-ejemplo",
    "stockRows": 1,
    "stockExpectedRows": 1,
    "totalImportRows": null,
    "contractVersion": "visura-prepara-fixed-read-v1"
  },
  "products": [{"code":"0000123","description":"Producto ficticio","unit":"UD"}],
  "locations": [{"warehouse":"COR_01_COR","code":"SUELO 3","aisle":"S","zone":"Z"}],
  "fixed": [],
  "stock": [{"warehouse":"COR_01_COR","product_code":"0000123",
    "location_code":"SUELO 3","lot":"L1","quantity":"-2.5","unit":"UD"}]
}
```

**Nota:** el ejemplo separa deliberadamente `stockComplete=true` de `positionsComplete=false`: un lote BC completo **no acredita** que estén importadas o reconciliadas las posiciones fijas. El informe de PREPARA seguirá indicando insuficiencia. Las cifras, usuarios y hashes del ejemplo no son datos empresariales.

## 4. Definición de cada bandera (regla del servidor futuro)

- **stockComplete=true** solo con un lote del almacén **publicado** mediante `bc_current_by_warehouse`, `source='bc_excel_manual'`, conteo exacto `expected_rows=validated_rows=count(*)` de líneas de stock dedicadas y certificado de parser y digest de las filas con el archivo. Estado histórico INVENTA `committed` no equivale directamente a `published` y exige conciliación/documento de corte.
- **catalogComplete=true** solo si existe una prueba independiente de cobertura del catálogo maestro respecto al alcance BC esperado; `products.length > 0` no lo demuestra.
- **positionsComplete=true** solo si se han reconciliado las posiciones con identidad de almacén y comprobado su cobertura; los registros legacy `public.fixed_positions` sin almacén **no se atribuyen** por proximidad.
- **locationsComplete=true** solo si ubicación/almacén y cobertura están validados; la clave global histórica `public.locations(code)` no es suficiente.
- **absentStockIsZero=true** solo con certificado expreso de la política del exportador BC que omite todos los ceros en las combinaciones pertinentes, sujeto a importación completa. En cualquier otro caso `false`. Una línea con cantidad **exactamente cero** sí es cero real.
- **stale=false** solo con fecha válida no futura, ventana máxima aprobada y señal explícita de no obsolescencia; si no se acredita, `true`. El hecho de publicar hoy no acredita que el Excel se exportara hoy.
- **truncated=false** solo si no se perdió ninguna línea por paginación ni límite del servidor. Si el conjunto supera el umbral seguro, **rechazar** la respuesta/consultar por lotes verificados; nunca declarar `truncated=false` ante una respuesta recortada.
- **authorized=true** solo dentro del servidor autorizado. El adaptador Node comprueba un `verifiedScope` *aportado por el servidor*, lo que **no sustituye** la comprobación real de identidad/sesión. Un navegador podría falsificar ese objeto si se le expusiera el adaptador.

## 5. Almacenes y reconciliación

- `COR_01_COR` y `COR_02_NAR` son los códigos reales verificados previamente. Todos los registros `stock`, `fixed` y `locations` deben pertenecer al almacén de la petición; no inferir almacén del nombre de ubicación ni compartir posiciones fijas entre ambos.
- El `bc_import_current` global de INVENTA **no** puede respaldar la publicación de COR_02_NAR. La arquitectura futura selecciona lote por `bc_current_by_warehouse(warehouse_code)`.
- `stock_rows` del modelo histórico PR #76 puede representar **filas de stock del lote**, mientras que `expected_rows` de una importación mixta puede representar todas las filas del documento: si estas magnitudes difieren, no imponer igualdad ciega ni acreditar completitud. El diseño compartido actual solo admite lote *dedicado a líneas de stock*. Cualquier archivo mixto requiere manifiesto/certificado de importación adicional.
- Códigos reales con espacios como `SUELO 3` o `PLV USAD` son válidos en las ubicaciones; las cantidades viajan como cadenas decimales para evitar pérdida de precisión en JavaScript.
- Los lotes sin caducidad informada no deben recibir fechas ficticias.

## 6. Condiciones de activación NO autorizadas

1. Construir gateway de confianza que ligue identidad efectiva `auth.uid()`/sesión, usuario activo, rol admin PREPARA y almacén autorizado, comprobados **en cada petición**, sin transferir UUID, contraseñas, JWT o `service_role` al navegador.
2. Aprobar y ensayar el parser XLSX manual con el mismo buffer que se firma; contrastar el digest V2 calculado de las líneas almacenadas en PostgreSQL con prueba creada por el importador de confianza.
3. Conciliar `public.fixed_positions` y `public.locations` históricos con fuentes por almacén y derechos de autoría. No crear tablas `visura_reporting`.
4. Habilitar posteriormente **solo mediante aprobación expresa** la política de mínimo privilegio/ejecución en servidor y un endpoint compatible con el nombre de PR #76, sin otorgar acceso general al esquema privado.
5. Ensayos E2E autorizados en ambas PWA, pruebas de Auth, roles, cobertura y recuperación, más rollback y comprobación de almacenes; revisar PRs funcionales y caches offline antes del corte.
6. No fusionar, desplegar ni ejecutar SQL real de esta PR. Control de Cargas y Tanques quedan fuera.

**Entrega a chat 02:** la interfaz de PR #76 y su nombre de RPC se mantienen intactos. El propietario de la PR #76 debe revisar este documento antes de cualquier integración y NO presupone que el backend ya esté disponible. Las pruebas actuales solo verifican forma y comportamiento en datos ficticios, no autorización productiva ni sincronización real.

## 7. Pasarela administrativa y caso de lote sin ninguna línea

- `architecture/lib/prepara-fixed-read-gateway-seam.mjs` es un prototipo de servicio de servidor con funciones inyectadas `authorize(session,warehouse,module)`, `loadSnapshot(warehouse,userId)` y `serverNow()`. **No implementa Auth real, no se expone en HTTP ni como RPC y no consulta Supabase.** Exige aprobación administrativa activa, sesión vigente, módulo PREPARA y almacén por solicitud, y deniega ANTES de leer datos. `architecture/tests/prepara-fixed-read-gateway-seam.test.mjs` comprueba la revocación entre solicitudes, operarios, almacén equivocado y ausencia de credenciales, con identidades ficticias.
- **Importación sin líneas de stock:** el esquema compartido V1 solo admite `expected_rows >= 1` para lotes de stock. Un snapshot con `stockLines=[]` NO puede marcar `stockComplete=true` en ese modelo, aunque se anuncie `expected_rows=0`. Para legitimar un almacén vacío tendría que diseñarse un manifiesto explícito de lote vacío, de fuente y ámbito certificados; **no** reinterpretar una lista vacía como ceros de todas las posiciones.
- El adaptador no transforma por sí mismo las cuentas entre Supabase PREPARA e INVENTA ni importa credenciales de un proyecto al otro. Solo el gateway aprobado podrá dar `verifiedScope` de servidor tras hacer cumplir identidad y permisos reales.
