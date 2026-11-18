# Fase B · Tramos de inventario

Estado: **propuesta en PR, sin aplicar en Supabase real y sin publicar.** Datos de prueba solamente.

## Qué es un tramo
Un rango de ubicaciones dentro de una campaña, por ejemplo `K00-P01 → K09-P08`, asignado en un solo paso a **una o dos personas** (pareja).

- Incluye todas las ubicaciones **habilitadas** entre «Desde» y «Hasta» en **orden natural** (K2 va antes que K10, mayúsculas y ceros indiferentes).
- Solo entran códigos con el **mismo formato** que los extremos (`K#-P#`). Los de otro formato (`K05`, `K03-P03-A`) y los deshabilitados se avisan en la vista previa y quedan fuera.
- Una ubicación solo puede estar en **un tramo activo por campaña** (índice único en servidor + bloqueo por campaña ante dos Supervisores a la vez).

## Flujo en Gestión almacén → Tramos
1. Campaña, Desde, Hasta, Persona 1 y Persona 2 opcional.
2. **Ver ubicaciones del tramo**: total, primera/última, orden de recorrido, avisos y solapes (con quién).
3. **Asignar tramo**: el servidor comprueba que el rango no cambió desde la vista previa (huella).
4. Seguimiento por tramo: avance «ubicaciones con algún recuento», sin cantidades.
5. **Reasignar** o **Liberar** con motivo y control de versión. Nada se borra: las asignaciones antiguas pasan a `active=false` y lo contado se conserva. Partir un tramo = liberar y crear dos.

## Servidor (migración `20261117220000_inventa_fase_b_tramos.sql`)
- Tablas `segments` y `segment_locations`; columnas `assignments.segment_id` y `assignments.active`.
- RPC solo para Supervisor/Administrador: `preview_segment`, `assign_segment`, `reassign_segment`, `release_segment`, `list_segments`.
- Las asignaciones ya no se insertan a mano; solo su estado es editable. `counts_insert` exige asignación activa.
- El Operario lee únicamente sus tramos y nunca el teórico.

## Pruebas
- `PGDATABASE=inventa_tramos_test bash tests/tramos-lab/run.sh` sobre PostgreSQL desechable (también en CI).
- `node --test tests/segments-management.test.cjs`.

## Pendiente (siguiente PR)
Recuento real en pareja dentro de «Mi tramo»: identificación de las dos personas, autoría por apunte y relevo.
