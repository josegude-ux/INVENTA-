# VISURA 04 — Interfaz aislada para lectura confiable del Excel manual

Fecha: 27/10/2026. Estado: PROTOTIPO DE PRUEBAS, **no integrado**. Rama aislada `architecture/visura-shared-core-20261027` y PR #22 DRAFT.

## Riesgo que reduce

La primera implementación de recibos aceptaba `fileBytes` y `normalizedRows` como dos argumentos separados. Un consumidor defectuoso podía calcular un recibo consistente a partir de **un Excel** y de filas obtenidas de otra fuente. Ahora `architecture/lib/attest-bc-manual-upload.mjs` ofrece una alternativa más estricta para el futuro adaptador de importación:

- Recibe **solo** los bytes binarios del archivo de entrada manual, almacén, nombre y la función `readRowsFromBytes` que debe proporcionar el parser XLSX de confianza.
- Captura una copia independiente de los bytes originales y pasa una copia a ese parser una única vez, rechazando modificaciones del buffer de lectura durante el proceso.
- El parser debe devolver **`{rows,expectedRows}`**, con el número esperado de filas verificado a partir de la fuente, **no inferido automáticamente** de `rows.length`. Un resultado con filas truncadas se rechaza.
- Revalida almacén, unidades, descripciones, lotes, cantidad calculada, ubicaciones y duplicados mediante el validador ya existente de INVENTA, conservando el valor `0` y los negativos.
- Solo cuando la validación es completa construye un recibo de SHA-256 de los bytes, SHA-256 original de JSON normalizado y el SHA-256 V2 encuadrado que puede recalcular independientemente PostgreSQL 16.
- No realiza escrituras; no llama a Business Central; no usa tokens, claves ni sesión de otro proyecto.

Las pruebas `architecture/tests/attest-bc-manual-upload.test.mjs` comprueban copia de bytes, llamada única al parser, fila truncada, ausencia de stock calculado (nunca usar físico como sustituto), mezcla de almacenes, buffer alterado, parser ausente, salida inválida y rechazo de parseo fallido.

## Qué NO se garantiza aún

1. `readRowsFromBytes` **no está implementada aquí como parser real XLSX**. Es un punto de integración seguro por diseño pero una función defectuosa o maliciosa todavía puede devolver filas ajenas al archivo. Debe sustituirse por la biblioteca/implementación aprobada por el responsable de importaciones y probarse sobre archivos representativos **sin copiar datos empresariales a esta rama**.
2. El recuento devuelto por el parser debe provenir de una interpretación independiente y revisada del Excel (hoja, cabeceras, filas válidas y totales). Pasar `rows.length` como `expectedRows` anula la prueba de integridad de filas truncadas.
3. No se verifica la firma digital ni la identidad del usuario que aporta el Excel; la futura pasarela deberá usar Auth de servidor y permisos efectivos por módulo/almacén.
4. El recibo debe almacenarse y vincularse al lote en el servidor. No confiar en hashes que envía libremente el navegador ni permitir que el cliente altere las filas entre validación y publicación.
5. La versión V2 solo cubre los siete campos normalizados hoy. `expiry_date` del esquema SQL requiere decisión de fuente y un contrato posterior, no se presume incluido.
6. La carga aún no es transaccional en una base real: falta cierre atómico `archivo → parser → staging → validación DB → digest DB → publicación CAS`, control de identidad, límites de tamaño y ensayo de regresiones.

## Pruebas y continuidad

Los módulos son importables directamente por Node 22, sin dependencias externas adicionales ni acciones de red. Se ejecutan con `node --test architecture/tests/*.test.mjs` en el workflow GitHub de PostgreSQL 16 descartable. **No declarar SUCCESS en pruebas de esta etapa hasta confirmar la ejecución que contiene `attest-bc-manual-upload.test.mjs`**.

Siguiente tarea segura: verificar el workflow; si falla, corregir solo la nueva superficie aislada. Una vez superado, preparar sin aplicar el contrato de gateway que vincule identidad/almacén y el digest V2 de la tabla staging al recibo emitido por el parser aprobado.
