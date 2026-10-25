# Integración INVENTA ↔ KONTROLA · entorno de pruebas

Fecha: 2026-10-25. Rama aislada: `integracion/kontrola-supabase-pruebas`.

## Estado verificado
- INVENTA (v0.30.5 instalada en dos dispositivos): Supabase `wlejxnpphysogrzcxjfh`. Usuario de prueba con sesión en ambos; creación de campaña y cambio de estado visibles entre dispositivos.
- KONTROLA: Supabase `oevetnszmfxeukcncwji`; tablas `kontrola_*` y RPC de consulta/publicación. Rama de trabajo `cursor/verificacion-fisica-cargas-8ba0`; las últimas comprobaciones CI no están verdes.
- No comparten Auth ni base de datos todavía. Que ambos dispositivos de INVENTA sincronicen no implica integración entre aplicaciones.

## Contrato de integración propuesto
1. Supabase común: escoger proyecto destino tras inventariar Auth, tablas, políticas RLS, funciones, almacenamiento y migraciones. Nunca copiar usuarios Auth mediante SQL sin plan de sesiones.
2. Espacios lógicos separados: tablas y funciones `inventa_*` y `kontrola_*` o esquemas propios; políticas por usuario, rol y almacén; operaciones de KONTROLA no alteran existencias BC de INVENTA.
3. Intercambio inicial: referencias de artículos, ubicaciones, cargas publicadas, líneas, bultos y estado de preparación/verificación; claves de origen y unicidad para idempotencia.
4. Pruebas de escritura controladas: dos dispositivos de INVENTA + KONTROLA, cambios visibles tras actualizar, acceso denegado a usuarios sin permisos, reintentos sin duplicados, separación entre almacenes.
5. Migración reversible: inventario previo, copia de prueba, ejecución por fases, pruebas RLS y de regresión, conmutación de clientes solo tras validar ambos. No cambiar URLs ni claves de la versión estable antes de la aceptación.

## Siguiente paso técnico
- Comparar el esquema y políticas reales de INVENTA y KONTROLA.
- Preparar migraciones en la rama, no aplicarlas todavía a la base estable.
- Resolver Auth compartido y ejecutar pruebas de integración con cuentas de ensayo.
- Documentar resultados, límites y rollback.

## Límites
- Esta rama es preparación y no es una integración ejecutable todavía.
- No se han modificado tablas, registros, sesiones ni apps publicadas.
