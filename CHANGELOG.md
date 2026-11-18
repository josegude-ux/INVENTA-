# Registro de cambios · VISURA INVENTA

Estados: PROPUESTO → PROGRAMADO → PROBADO LAB → HOMOLOGADO → PUBLICADO.

## 0.30.14 · PROBADO LAB · 18/11/2026 (rama lab/100-tramos-20261118, sin push)
- Tramos: segundo recuento ciego (ciclo 2), solo sobre ubicaciones con primer recuento y por personas que no participaron en el primero. Idea recogida de F2 tramos K (CP012).
- Idempotencia por identificador de orden en asignar/reasignar/liberar: repetir una orden con respuesta perdida devuelve el mismo resultado sin duplicar. Idea de F2 (CP012).
- counts.cycle lo fija el servidor según la asignación activa; el navegador no puede forzarlo.
- Pruebas: 84 comprobaciones SQL + concurrencia en PostgreSQL desechable; 13/13 de interfaz; 12 fallos previos de main sin cambios.

## 0.30.13 · PROBADO LAB · 18/11/2026 (rama fase-b/tramos, PR #26 en borrador)
- Tramos por rango (K00-P01 → K09-P08) asignados en un paso a una o dos personas; vista previa, orden natural, sin solapes, reasignar/liberar con motivo y versión.

## 0.30.12 · PUBLICADO PARA PRUEBAS · CP031 (4d7dfea)
- Base de partida (fase A cerrada).
