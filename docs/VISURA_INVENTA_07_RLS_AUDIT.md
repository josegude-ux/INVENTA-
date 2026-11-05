# VISURA INVENTA 07 — Diferencias entre contrato nuevo y RLS real

**Verificación de solo lectura:** 28/10/2026. **Proyecto:** Supabase INVENTA (no PREPARA).  
**Fuente:** pg_policies de public.barcodes, counts, assignments, stock_snapshot, campaigns y profiles, más metadatos reales de tablas.  
**Acción realizada:** SOLO SELECT. **No se han modificado políticas ni datos.**

## Diferencias reales y prioridad

| Área | Regla actualmente observable | Contrato aprobado nuevo | Acción segura pendiente |
|---|---|---|---|
| Códigos alternativos | \`barcodes_insert\` permite INSERT a cualquier perfil habilitado con \`created_by=auth.uid()\` | Solo Administración valida y activa asociaciones; razón y auditoría | Preparar migración compatible y operación administrativa; no cambiar RLS hasta eliminar dependencia funcional de las altas actuales |
| Modificaciones de códigos | \`barcodes_manager_update\` permite UPDATE al rol Supervisor o Administrador | Desactivar y reasignar con motivo, historial íntegro e incidencias de recuentos efectivamente afectados | Sustituir actualizaciones directas por operaciones auditadas tras pruebas de regresión |
| Recuentos | \`counts_insert\` admite inserciones directamente para Operario asignado y para Supervisor/Administrador, con campaña activa | Cada referencia requiere borrador, revisión física, confirmación y, si cambia, corrección justificada; un único resultado por ubicación/referencia | No eliminar la API heredada hasta instalar transacciones y cola de compatibilidad; verificar que no exista vía de escritura que eluda confirmación |
| Lectura de pareja | \`counts_read\` filtra por \`actor_id=auth.uid()\` (salvo responsables de gestión) | Participación conjunta de A+B; uno autenticado en terminal, autoría diferenciada y acceso conforme a pertenencia original | Nueva entidad de equipo, política de lectura por asignación efectiva y auditoría; no confiar en \`partner_id\` enviado por cliente |
| Asignación | \`assignments_manager_update\` permite cambios de Supervisor/Administrador sin distinguir ubicación iniciada en la política | Redistribución ordinaria únicamente si no ha empezado el recuento, siempre sin solapamiento y con equipo original persistente | Transacción que bloquee reasignación iniciada; resolver alcance final de Supervisor conforme a decisiones del proyecto |
| Campaña | \`campaigns\` tiene \`draft/active/closed\` y política de actualización Admin | Abierta, preparada para cierre, cerrada con revisión general de diferencias, provisionales e incidencias | Cierre por RPC transaccional con bloqueos verificados, nunca por un simple botón cliente |
| Stock oficial | \`stock_manager_read\` exige Supervisor/Administrador | Operario sin acceso a cantidades teóricas durante campaña | Conservar esta separación y ensayar también RPC, vistas, Storage y cachés, no solo la política SELECT |
| Usuarios | \`profiles\` contiene \`enabled\` y versión de perfil | Revocación individual, sesión activa y trazabilidad aunque se deshabilite | Validar revocación de sesión/JWT en servidor; no basarse en botón o claims controlados por cliente |

## Riesgos de compatibilidad

- El \`real-counts.js\` actual depende de INSERT en \`public.counts\`, por lo que endurecer \`counts_insert\` precipitadamente podría paralizar recuentos individuales ya existentes.
- Un código alternativo añadido actualmente por Operario pudo utilizarse en recuentos históricos; ninguna migración puede reasignarlos o borrarlos de forma retroactiva.
- La estructura actual de \`assignments\` identifica operario, ubicación y campaña. No constituye por sí sola un tramo exclusivo de equipo con dos participantes, versión, terminal o bloqueo histórico de inicio.
- Las PR #22/#23 experimentan con arquitectura compartida. No asumir que esa arquitectura haya resuelto los permisos o el esquema multialmacén.
- No se ha verificado con dos usuarios reales una API definitiva de recuento en pareja ni la denegación de accesos tras revocar sesiones. El laboratorio \`inventory-lab/\` únicamente ensaya condiciones equivalentes con identidades ficticias.

## Plan antes de migración real

1. Construir contrato autenticado de lectura/escritura con denegación por defecto y eventos inmutables, sin modificar las tablas productivas.
2. Reproducir en PostgreSQL descartable roles y políticas de recuento, incluyendo recuentos previos, correcciones, recuento en pareja, pérdida de sesión y revocación de asignación.
3. Preparar migración aditiva **revisada** con respaldo, análisis de dependencias del cliente heredado, plan de reversión y pruebas de dos cuentas independientes.
4. Aislar el cambio de permisos de códigos alternativos del nuevo flujo de recuento para que una PR no altere múltiples áreas simultáneamente.
5. Solicitar aprobación específica antes de ejecutar migraciones, alterar RLS real o desplegar.

**No equiparar RLS habilitada con cumplimiento completo del nuevo prompt. No ejecutar cambios de producción ni fusionar ramas por este informe.**
