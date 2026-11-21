# VISURA INVENTA 07 — Cierre físico transaccional y progreso automático

Fecha: 28/10/2026. Repositorio: josegude-ux/INVENTA-.
Rama: feature/visura-inventa-07-domain-20261027; PR #24 en borrador.
ESTADO: código y pruebas AISLADOS, SIN uso en PWA ni cambios de Supabase.

## Tarea pendiente atendida

El módulo previo ya distinguía la finalización manual de ubicación y el estado administrativo de referencias provisionales, pero carecía de un contrato transaccional que volviese a comprobar el inventario físico y derivase el cierre de todos los tramos/pasillos.

Se han añadido:
- inventory-core/physical-closure.cjs: cálculo puro de referencias confirmadas, pendientes, ceros explícitos y provisionales confirmados físicamente; cierre mediante acción manual, sesión y concesión de equipo, revisión física y versión vigentes, registro de evento inmutable, reapertura autorizada con motivo, y estado derivado de segmentos y pasillo.
- tests/inventa07-physical-closure.test.cjs: regresiones de cantidad en blanco vs. cero, confirmación, lote, conservación de equipos, sesión, revision CAS, ausencia de inventario, provisional pendiente solo de Administración, cambios entre revisión y cierre, manualidad, reapertura y progreso de tramos.
- inventory-lab/011_disposable_physical_closure.sql: tablas exclusivas del experimento para ubicaciones y tramos, cierres manuales y eventos, snapshot físico sin stock teórico BC, revisión atómica e idempotente por mutación, reapertura reservada a Administración, barreras de escritura física al estar cerrada y resumen automático por ubicación, tramo y pasillo.
- tests/sql/inventa07_lab_physical_closure.sql: pruebas con ubicación P01 de referencias completas tras confirmar borrador, P02 con provisional ya contado físicamente y pendiente administrativo que NO se borra, y una ubicación P05 realmente nueva y vacía que NO puede cerrarse solo por ausencia de cantidades. Tras registrar cero expresamente y confirmarlo, los tres cierres manuales permiten que los tramos y el pasillo se completen automáticamente; una reapertura autorizada invalida el tramo y pasillo correspondientes.

## Reglas preservadas

- Abrir la pantalla, consultar o escanear sin registrar cantidad NO inicia la ubicación. El resumen vacío no constituye una confirmación de cero.
- Una referencia de cantidad cero exige acción expresa y confirmación por referencia. No se admite cierre cuando quedan borradores o correcciones físicas pendientes.
- La referencia provisional cuenta para el inventario físico una vez capturada y confirmada la cantidad, aunque su referencia oficial siga pendiente de conciliación administrativa. La campaña NO se considera definitivamente cerrada hasta que Administración resuelva sus pendientes.
- Únicamente la finalización de una ubicación requiere pulsación manual y revisión vigente. No se realiza una finalización automática de ubicaciones.
- Las finalizaciones de rangos y pasillos son automáticas y DERIVADAS de todas sus ubicaciones y asignaciones, no operaciones de usuario; si se reabre una ubicación, se vuelve a calcular su estado.
- Los eventos históricos se mantienen, sin borrar el primer cierre tras una reapertura. La ubicación conserva su equipo original; el cierre usa la sesión autenticada y concesión vigente del terminal.
- No se muestra stock teórico ni diferencias BC en la información de operadores. El origen sigue siendo Excel cargado manualmente; nunca API BC.

## Seguridad y dependencia real

Las funciones de PostgreSQL solo pueden ejecutarse en una base llamada inventa07_test. No representan una migración para la base actual. La identidad del ensayo es una simulación mediante valores request.jwt.claim.*, el enrolamiento de terminales es ficticio, y no están conectados a Auth, RLS ni sesiones reales de Supabase. Deben rediseñarse y auditarse las transacciones, bloqueos, operaciones de recuperación offline, permisos de acceso y temporalidad antes de migrar o activar.

No se introduce un procedimiento de ubicación físicamente vacía sin artículos: sigue pendiente de definición/validación específica, en lugar de inventar una referencia para marcar cero. Los snapshots del ensayo no son acreditación de captura física en dispositivo. Los rangos del laboratorio se precargan como fixtures; la asignación administrativa real de tramos y no solapamiento pertenece a la integración aprobada.

Esta tarea pertenece exclusivamente al ámbito de INVENTARIO FÍSICO del chat 07. NO agrega maestro de posiciones fijas, existencias teóricas totales, filtros ni exportaciones de chat 08. Tampoco edita aplicaciones de PREPARA ni arquitectura compartida.

## Condiciones antes de integrar

1. Sesiones individuales y titular único de dispositivo validados por servidor Auth real.
2. Inventario de ubicaciones y referencias cargado desde Excel manual, sin inventar columnas de Business Central.
3. Pruebas de dos usuarios en mismo terminal, cambios de asignación durante recuento, y respuesta perdida durante cierre.
4. Comprobación de que cada mutación física bloquea y revalida la ubicación bajo una política transaccional segura.
5. Confirmación de que recuentos provisional, incidencia y rectificaciones posteriores se respetan sin borrar historial.
6. Validación de PWA y listas al final de pantalla real en móvil, tableta y escritorio.
7. Revisión y autorización específica antes de despliegue, migraciones, merges o cambios de permisos productivos.

NO MERGE · NO DEPLOY · NO DDL EN SUPABASE ACTIVA · NO CAMBIOS REALES EN BUSINESS CENTRAL.
