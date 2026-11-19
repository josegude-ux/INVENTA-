# Fase B · Tramos de inventario

Estado: **PROBADO LAB** (0.32.0, rama lab/100-tramos-unificado-20261118). Supabase unificado, esquema `inventa`. Migración pendiente en `supabase/visura-unificado-pendiente/`, sin aplicar y sin publicar. Datos de prueba solamente.

## Qué es un tramo
Un rango de ubicaciones dentro de una campaña, por ejemplo `K00-P01 → K09-P08`, asignado en un solo paso a **una o dos personas** (pareja).

- Incluye todas las ubicaciones **habilitadas** entre «Desde» y «Hasta» en **orden natural** (K2 va antes que K10, mayúsculas y ceros indiferentes).
- Solo entran códigos con el **mismo formato** que los extremos (`K#-P#`). Los de otro formato (`K05`, `K03-P03-A`) y los deshabilitados se avisan en la vista previa y quedan fuera.
- Una ubicación solo puede estar en **un tramo activo por campaña** (índice único en servidor + bloqueo por campaña ante dos Supervisores a la vez).

## Segundo recuento ciego (ciclo 2) · recogido de F2 CP012
- En el formulario, «Recuento: Segundo recuento (ciego, otras personas)».
- Solo entran ubicaciones del rango con primer recuento; las demás se avisan.
- No pueden hacerlo quienes contaron, fueron pareja o tuvieron asignado el primer recuento de esas ubicaciones.
- El segundo contador no ve el primer recuento ni el teórico. `counts.cycle` lo fija el servidor.

## Idempotencia · recogida de F2 CP012
Asignar, reasignar y liberar llevan `p_mutation_id`. Si se pierde la respuesta y se reintenta, el servidor devuelve el mismo resultado sin duplicar; el mismo identificador con otros datos se rechaza.

## Flujo en Gestión almacén → Tramos
1. Campaña, Desde, Hasta, Persona 1 y Persona 2 opcional.
2. **Ver ubicaciones del tramo**: total, primera/última, orden de recorrido, avisos y solapes (con quién).
3. **Asignar tramo**: el servidor comprueba que el rango no cambió desde la vista previa (huella).
4. Seguimiento por tramo: avance «ubicaciones con algún recuento», sin cantidades.
5. **Reasignar** o **Liberar** con motivo y control de versión. Nada se borra: las asignaciones antiguas pasan a `active=false` y lo contado se conserva. Partir un tramo = liberar y crear dos.

## Servidor (migración APLICADA el 18/11/2026: `supabase/visura-unificado/20261118221403_inventa_tramos.sql`, esquema `inventa`)
- Tablas `segments` y `segment_locations`; columnas `assignments.segment_id` y `assignments.active`.
- RPC solo para Supervisor/Administrador: `preview_segment`, `assign_segment`, `reassign_segment`, `release_segment`, `list_segments`.
- Las asignaciones ya no se insertan a mano; solo su estado es editable. `counts_insert` exige asignación activa.
- El Operario lee únicamente sus tramos y nunca el teórico.

## Pruebas
- `PGDATABASE=inventa_tramos_test bash tests/tramos-lab/run.sh` y `tests/tramos-lab/040_reversion.sh` sobre PostgreSQL desechable con las 5 migraciones de la unificación (CI con PostgreSQL 17).
- `node --test tests/segments-management.test.cjs`.

## «Mi tramo» y pareja (0.32.1)
- En Mis recuentos, cada persona ve sus tramos activos: recuento, pareja, avance y siguientes ubicaciones en orden.
- Un móvil y un único recuento: el autor de cada apunte es quien tiene la sesión abierta; el servidor pone como pareja a la otra persona del tramo.
- Relevo: se envía todo lo pendiente y la otra persona inicia sesión en el mismo móvil. Si queda algo sin confirmar, no se hace el relevo y la cola se conserva.
