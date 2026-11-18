# Guion de homologación en móvil · «Mi tramo» (pareja, relevo y segundo recuento)

**VISURA-100-GUION-HOMOLOGACION-MI-TRAMO-0.32.1-R1** · línea 100 · datos ficticios.

Versión a homologar: **INVENTA 0.32.1**, commit `958ac9a` (PR #30). Cómo saber que estás en la versión de prueba: en **Ajustes** debe aparecer **0.32.1**. La versión publicada muestra 0.30.12 o 0.31.x.

Cada paso de este guion se ha ensayado en PostgreSQL desechable (`tests/tramos-lab/050_ensayo_homologacion.sql`, H02–H16 superados). El ensayo no sustituye la prueba en el móvil, que es lo que da el estado HOMOLOGADO.

## 1. Entorno (decide 000)

Solo puede haber **una campaña activa** (`one_active_inventa_campaign`), y en el Supabase unificado ya está activa la campaña real «Inventario». Por eso:

- ☑ **LAB (D3), recomendado:** el proyecto INVENTA antiguo, convertido en LAB con datos ficticios, con las 5 migraciones de la unificación más la de tramos, y una vista previa de la 0.32.1 que apunte al LAB. Requiere «AUTORIZO» y preparar esa vista previa.
- ☐ Unificado, cuando no haya ninguna campaña real activa.
- ☐ Unificado usando la campaña real: no recomendado, porque los recuentos ficticios quedarían para siempre en el inventario real.

El script de datos ficticios **se niega a ejecutarse si hay otra campaña activa**.

## 2. Preparación

| | Quién | Qué |
|---|---|---|
| P1 | 000 | Entorno elegido con las migraciones aplicadas («AUTORIZO»). |
| P2 | 000 | Ejecutar `supabase/homologacion/ficticio_mi_tramo.sql` («AUTORIZO»). Crea 10 ubicaciones ZZH01-P01…P06 y ZZH02-P01…P04, los artículos ZZHOM-001 y ZZHOM-002, la campaña en borrador «HOMOLOGACIÓN 100 · DATOS FICTICIOS» y un teórico ficticio de 7 en ZZH01-P01. |
| P3 | Usuario | Crear 4 cuentas de prueba con correos de pruebas propios. Nombres visibles: **Prueba Supervisión** (Supervisor), **Prueba Uno**, **Prueba Dos** y **Prueba Tres** (Operario). Administración las habilita con el motivo «homologación». |
| P4 | Usuario | Dispositivos: móvil A (pareja y relevo), móvil B o el mismo (Prueba Tres) y un PC o tableta (Supervisión y Administración). |
| P5 | Usuario | Capturas con el nombre del paso (H05.png…), sin datos personales; se suben a la carpeta 100. |

## 3. Pasos

| Nº | Quién · dónde | Acción | Resultado esperado | ✔ |
|---|---|---|---|---|
| H01 | Todos | Ajustes | Se ve la versión **0.32.1** | ☐ |
| H02 | Supervisión · PC | Gestión almacén → Tramos. Campaña: HOMOLOGACIÓN 100. Recuento: Primer recuento. Desde ZZH01-P01, hasta ZZH01-P06. Persona 1: Prueba Uno; persona 2: Prueba Dos. «Ver ubicaciones del tramo» → «Asignar tramo» | Vista previa «Primer recuento · 6 ubicaciones · De ZZH01-P01 a ZZH01-P06». Aviso «Tramo asignado: 6 ubicaciones…». En Tramos activos, 0 de 6 | ☐ |
| H03 | Supervisión · PC | Desde ZZH01-P05, hasta ZZH02-P02 → Ver | «2 ubicaciones ya están asignadas en este recuento: ZZH01-P05 (Prueba Uno + Prueba Dos)…» y **sin** botón Asignar. Descartar | ☐ |
| H04 | Administración · PC | Activar la campaña ficticia | Queda activa. Supervisión no puede activarla | ☐ |
| H05 | Prueba Uno · móvil A | Hacer inventario → Mis recuentos | Chip «CUENTA REAL · RECUENTO EN PAREJA». «Mi tramo · ZZH01-P01 → ZZH01-P06». «Pareja: Prueba Uno + Prueba Dos». «0 de 6 · siguiente: ZZH01-P01», ya preseleccionada. **No aparece el 7 teórico** | ☐ |
| H06 | Prueba Uno · móvil A | Artículo ZZHOM-001, 5 unidades → Guardar | «0 pendientes · Lectura actualizada.» (se ha enviado y releído). «1 de 6 · siguiente: ZZH01-P02» | ☐ |
| H07 | Prueba Uno · móvil A | **Modo avión.** ZZH01-P02, ZZHOM-002, 2 → Guardar. Después «Relevo: pasar a Prueba Dos» | «1 pendientes · Pendiente: …». «Relevo no hecho: …» con el motivo (sin conexión). La sesión sigue y el apunte no se pierde | ☐ |
| H08 | Prueba Uno · móvil A | Quitar el modo avión → Sincronizar → Relevo | «0 pendientes», «2 de 6». Con el relevo se cierra la sesión y vuelve al inicio | ☐ |
| H09 | Prueba Dos · **mismo** móvil A | Iniciar sesión → Mis recuentos → ZZH01-P03, ZZHOM-001, **0** → Guardar | «Pareja: Prueba Dos + Prueba Uno». De 2 de 6 pasa a «3 de 6» (cero es válido) | ☐ |
| H10 | Supervisión · PC | Tramos | «3 de 6 ubicaciones con algún recuento (50 %)» | ☐ |
| H11 | Supervisión · PC | Recuento: Segundo recuento. ZZH01-P01 → ZZH01-P06. Ver. Persona 1: Prueba Uno → Asignar | «Segundo recuento · 3 ubicaciones», «3 sin primer recuento quedan fuera», «Recuento ciego…». Error «Prueba Uno participó en el primer recuento de ZZH01-P01…» | ☐ |
| H12 | Supervisión · PC | Persona 1: Prueba Tres → pulsar **dos veces seguidas** «Asignar tramo» | «Tramo asignado: 3 ubicaciones…» | ☐ |
| H13 | Prueba Tres · móvil B | Mis recuentos → ZZH01-P01, ZZHOM-001, 5 → Guardar | «Segundo recuento (ciego)», «Individual: Prueba Tres», «0 de 3»; después «1 de 3». En «Últimos registros» **no** aparecen los recuentos de Uno ni Dos | ☐ |
| H14 | Supervisión · PC | Tramos activos | **Un solo** tramo de segundo recuento: la doble pulsación de H12 no lo ha duplicado | ☐ |
| H15 | Supervisión · PC, después Prueba Dos | Reasignar el tramo del primer recuento: persona 2 «Sin pareja», motivo «homologación: sale Prueba Dos» → Guardar. Prueba Dos abre Mis recuentos | Aviso «Tramo reasignado…». Prueba Dos ya no ve «Mi tramo» | ☐ |
| H16 | Administración · PC | Cerrar la campaña ficticia | Cerrada. Los 4 recuentos se conservan; no se borra nada | ☐ |
| H17 | Usuario | Capturas de Mis recuentos y de Tramos en el móvil y en el PC | Todo legible, sin solapes ni textos cortados | ☐ |

## 4. Resultado

- **HOMOLOGADO** si H01–H17 están todos en ✔. Se anota en el checkpoint de la línea con las capturas.
- Si un paso falla: anotar el número, el resultado real y la captura. No repetir con datos reales. La reversión `supabase/visura-unificado-pendiente/reversion_tramos.sql` está preparada.
- Fuera de este guion: escáner, datos reales y apertura en frío sin conexión.
