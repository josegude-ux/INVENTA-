# VISURA 04 — Contrato binario SHA-256 de filas BC, V2 (NO aplicado)

**Fecha:** 27/10/2026. **Ámbito:** únicamente pruebas Node + PostgreSQL 16 descartable. Sin SQL real, sin `service_role`, sin API, sin operaciones de inventario y sin cambios en las ramas funcionales.

## Motivación

El comprobante SHA-256 inicial de `architecture/lib/bc-integrity-receipt.mjs` genera el digest de filas con un JSON canónico en Node. Ese JSON **no puede asumirse idéntico** a la serialización de `json`/`jsonb` de PostgreSQL para todos los datos. Comparar simplemente el hash declarado por el navegador contra otra columna declarada tampoco demuestra que las filas guardadas sean idénticas.

La propuesta V2 adopta un formato explícito, byte a byte, con pruebas de paridad entre Node, Python (vector independiente) y PostgreSQL 16.

## Contrato binario

Cada campo se codifica como `uint32 big-endian` con la longitud **en bytes UTF-8**, seguido exactamente por esos bytes, sin normalización Unicode implícita ni delimitadores. El flujo incluye cuatro campos de cabecera, seguidos de siete campos por fila.

Cabecera:
`visura-bc-rows-len32-v1`, `visura-bc-batch-v1`, `warehouse_code`, `expected_rows` (entero decimal sin relleno).

Por fila, en el orden validado del Excel: `almacen`, `codigoArticulo`, `descripcion`, `unidad`, `ubicacion`, `lote`, `stockCalculado`. Cantidades normalizadas con punto decimal, sin ceros decimales sobrantes, ceros exactos iguales a `0` y negativos permitidos. SKU, lote y ubicaciones preservan su identidad textual, incluidos ceros iniciales y espacios internos aprobados.

El digest es SHA-256 de toda la concatenación. El número y el orden de filas son parte del compromiso. En base de datos, las líneas se leen por `row_number` y debe cumplirse que el rango sea **exactamente 1..expected_rows** sin huecos.

**Vector sintético reproducible:**

- Almacén `COR_01_COR`, 2 líneas.
- Primera: `0000123`, `Niño / Café`, `UD`, `A-01`, `L1`, `0`.
- Segunda: `0000123`, `Otro producto`, `UD`, `A-01`, `L2`, `-2.5`.
- SHA-256 V2 esperado: `d9db1f1eabf30fd0fd6369315671196bada3efd7773a4e7d9d6a8a8d93ca2515`.

El valor esperado se obtuvo de forma independiente con `hashlib.sha256` y `struct.pack('>I',len(utf8_bytes))` de Python. Se contrasta con la implementación Node y la función SQL privada.

## Archivos y pruebas

- `architecture/lib/bc-row-frame-digest.mjs`: hash streaming de los campos normalizados, sin escribir datos ni conectarse a BD.
- `architecture/tests/bc-row-frame-digest.test.mjs`: vector Unicode, importes negativos, equivalencia decimal, cambios de contenido y de orden, rechazo de falsificaciones superficiales.
- `architecture/drafts/visura_shared_rows_digest_v2_UNAPPLIED.sql`: funciones privadas `bc_frame_field_v2` y `bc_batch_rows_sha256_v2`, `SECURITY INVOKER`, sin `GRANT` a `anon` o `authenticated`; SQL **fuera** de migraciones.
- `architecture/tests/sql/110_verify_rows_digest_v2_pg16.sql`: vector de datos sintéticos PostgreSQL; comprueba comparación exacta con SHA Node/Python, modificación de stock, discontinuidad de filas y almacén incorrecto.
- Workflow aislado `.github/workflows/visura-shared-core-isolated.yml`, sin bases reales.

## Condiciones críticas pendientes

1. **Prueba de procedencia:** un importador XLSX de confianza debe extraer las filas de los **mismos bytes** cuyo SHA-256 se verificó; no admitir dos objetos independientes remitidos por el cliente como prueba.
2. **Autoridad de la comparación:** el digest DB se debe calcular con permisos de servidor sobre filas inmutables, vinculadas al lote y almacén correctos. La aplicación debe contrastar recibos frente a una evidencia almacenada por un servicio de confianza, **no** simplemente frente a una cadena elegida por el cliente.
3. **Autoría e identidad:** los prototipos con `p_actor` no prueban la identidad del usuario. Las sesiones y permisos efectivos por módulo/almacén requieren verificaciones de servidor, revocación y pruebas reales de Auth.
4. **Cobertura de columnas:** el contrato V2 cubre exactamente las siete columnas del validador BC. La columna SQL `expiry_date` no forma parte aún del validador original y NO queda comprometida por V2. Antes de integrar hay que decidir si está presente en el Excel aprobado y versionar explícitamente el contrato.
5. **Protección de datos:** validar que lote, metadatos, `file_sha256` y digest de filas no sean alterables una vez validados, mediante roles y triggers adecuados. Los borradores existentes no confieren por sí solos esta garantía frente a un administrador SQL.
6. **Eficiencia:** verificar consumo de memoria y tiempo con importaciones cercanas a 3.041 filas actuales y hasta el máximo previsto de 200.000 antes de cualquier integración real.
7. **Autorización:** sin aprobación explícita NO crear migración productiva, endpoint RPC, integraciones de PWA, modificación de permisos ni despliegue.

**Resultado CI:** registrar por ejecución real en documentación de continuidad; no dar por superada la comparación PostgreSQL hasta obtener `SUCCESS` confirmado de la acción nueva.
