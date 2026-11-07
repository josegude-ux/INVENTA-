# VISURA 04 — Evidencias criptográficas y corte reversible por almacén (27/10/2026)

**Carácter:** diseño de arquitectura y pruebas ficticias exclusivamente. Ninguna orden de migración, modificación de producción, fusión, activación de RPC, apertura de permisos o despliegue. Proyecto: VISURA / EXCELL, rama aislada `architecture/visura-shared-core-20261027`, PR #22 todavía DRAFT.

## Hallazgo y mitigación parcial

Un campo `file_sha256` de una fila de base de datos no demuestra por sí mismo que el XLSX original haya sido realmente leído ni que sus filas coincidan con las insertadas. Tampoco comparar dos cadenas de hash declaradas por la misma parte constituye una comprobación independiente.

La librería Node pura `architecture/lib/bc-integrity-receipt.mjs` ahora construye un comprobante **local** que vincula:
- Bytes exactos del archivo binario cargado manualmente: SHA-256 del `Uint8Array` original, no del nombre de archivo.
- Versión de contrato `visura-bc-batch-v1`, almacén y cantidad de filas.
- Un digest separado del arreglo normalizado usando orden fijo `almacen,codigoArticulo,descripcion,unidad,ubicacion,lote,stockCalculado`, con cantidades decimales normalizadas; el orden de filas queda vinculado.
- `receiptVersion=visura-bc-evidence-sha256-v1`. Los recibos no contienen el XLSX ni las contraseñas.
- Comparación `timingSafeEqual` de dos resúmenes SHA-256 frente a un comprobante esperado de confianza.

**Límite crítico:** el helper no parsea XLSX ni autentica el origen de `normalizedRows`: quien presente filas falsas también puede crear una huella consistente de esas filas. El adaptador de importación todavía pendiente debe producir `fileBytes` y filas desde **una misma lectura autorizada** y almacenar el comprobante en un punto de confianza. No basta con aceptar el comprobante desde un cliente. No hay validación criptográfica DB↔archivo real ni firma digital del remitente.

## Pruebas incluidas

`architecture/tests/bc-integrity-receipt.test.mjs` cubre:
- byte distinto del fichero -> fallo;
- valor calculado, SKU con ceros, ubicación, lote o almacén alterados -> fallo;
- orden de filas alterado -> fallo;
- decimales equivalentes `12,5000` y `12.5` -> mismo digest semántico;
- archivo vacío, texto en lugar de bytes, lote inválido, cadena SHA no hexadecimal -> fallo;
- ausencia de mutación del fichero, lote o recibo.

`architecture/tests/sql/90_verify_client_role_denial_pg16.sql`: login simulado con `SET ROLE anon` y `SET ROLE authenticated` para intentar lectura de tablas/vistas privadas y llamada a las funciones internas.

`architecture/tests/sql/100_verify_rollback_pg16.sql`: dentro de una única transacción aislada publica otro lote y luego realiza `ROLLBACK`; exige que el puntero anterior, estados de lote y número de eventos retornen a su valor previo. **Esto no equivale** a poder retroceder una publicación previamente confirmada en producción.

## Plan de implantación reversible (propuesta no ejecutada)

1. **Inventario y acuerdo de propietarios:** confirmar ramas y PRs activos de INVENTA/PREPARA; verificar almacenes `COR_01_COR` y `COR_02_NAR` y correspondencia de entidades con los administradores. Identificar cuentas con UUID independiente y datos históricos sin reasignarlos.
2. **Respaldo y ensayo:** obtener backup autorizado y prueba de restauración en un proyecto descartable; registrar volúmenes, hashes, fechas y nivel de servicio. No asumir que PDFs están en tablas o Storage.
3. **Paralelo silencioso sin doble autoridad:** nuevo esquema privado, sin grants a operarios; cargas manuales Excel a staging; comparar conteos, artículos, unidades, ubicaciones por almacén y lotes. Ninguna aplicación productiva consume el borrador ni se cambia el puntero real.
4. **Verificación de acceso:** vínculo de sesión Auth REAL en un gateway de confianza; permisos efectivos por módulo + almacén en servidor; denegar operario INVENTA durante recuento ciego; comprobar revocación de cuenta/dispositivo y sin transferencia automática de derechos PREPARA.
5. **Aprobación por almacén:** Administración aprueba explícitamente cambiar **solo** la lectura de un almacén tras conciliación; congelar punto de referencia y comprobar que stock publicado tiene `source=bc_excel_manual`, conteos, huellas, auditoría y antigüedad aceptables.
6. **Corte reversible solo de lectura:** conmutador interno por almacén, inicialmente desactivado; activarlo de forma ordenada tras aprobación y medición E2E. No dual-write de inventarios/posiciones. Registrar responsable, instante, configuración y criterio de vuelta atrás.
7. **Vuelta atrás de lectura:** si hay divergencias o errores, desactivar el conmutador del almacén afectado y volver a fuente anterior **sin borrar datos ni migraciones**. Revalidar consistencia de cada lector y registrar incidente. No confundir esto con `ROLLBACK` de una transacción ya confirmada.
8. **Rollback de publicación confirmada (diseño posterior):** operación administrativa auditada, atómica por almacén, con precondición de puntero CAS, motivo obligatorio, actor autenticado, nuevo evento compensatorio y preservación de todos los lotes históricos. Nunca actualizar evento histórico ni borrar entradas.
9. **Expansión por etapas:** habilitar un segundo almacén únicamente tras aprobación adicional. No apagar sistema anterior, cerrar PR ni desplegar sin autorización explícita.

## Bloqueos que impiden fusionar o usarlo en producción

- Falta parser XLSX conectado a los bytes y prueba de huella desde misma fuente.
- El borrador de validación acepta SHA de quien lo invoca: no crea prueba independiente sobre las filas. Se requiere gateway e integridad verificada en DB.
- `p_actor` es un parámetro, NO usuario autenticado. **No exponer ninguna RPC interna**.
- Permisos de funciones/tablas y RLS en sistema real deben diseñarse, restringirse y probarse sobre entorno descartable que replique Auth/claims sin reutilizar usuarios reales.
- Falta firma/reconciliación de posiciones fijas, compatibilidad de consumidores, Storage/PDF, pruebas E2E, ensayo de restauración, coste y autorización de corte.

**Continuidad:** consultar los resultados reales de GitHub Actions tras cada commit. Si un check está en curso, documentar PENDIENTE, no SUCCESS. La única rama permitida para esta preparación sigue siendo `architecture/visura-shared-core-20261027`.
