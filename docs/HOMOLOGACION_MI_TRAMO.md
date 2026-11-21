# Guion de homologación en móvil · «Mi tramo» (pareja, relevo y segundo recuento)

**VISURA-100-GUION-HOMOLOGACION-MI-TRAMO-0.32.3-R2** · línea 100 · datos ficticios · normas R10.

_R2 (21/11/2026): referencia a la versión publicada 0.32.3, rutas de migración actuales y comprobación parcial R1–R5 ya hecha. Los pasos H02–H16 no cambian._

Versión a homologar: **INVENTA 0.32.3**, publicada en main (`a1b822b`, PR #33). «Mi tramo» y Tramos llegaron en la 0.32.1 (PR #30) y la 0.32.3 solo añade «He olvidado mi contraseña». Cómo saberlo: en **Ajustes** debe aparecer **0.32.3**.

Migración de servidor: `supabase/visura-unificado/20261118221403_inventa_tramos.sql`, **aplicada** en el Supabase unificado el 18/11/2026 (versión `20261118221403`, MD5 `b557dddca46e6c87e1ca16d57132a537`). Reversión: `supabase/visura-unificado-pendiente/reversion_tramos.sql`.

Cada paso de este guion se ha ensayado en PostgreSQL desechable (`tests/tramos-lab/050_ensayo_homologacion.sql`, H02–H16 superados). El ensayo no sustituye la prueba en el móvil, que es lo que da el estado HOMOLOGADO.

## 1. Entorno (decide 000)

Solo puede haber **una campaña activa** (`one_active_inventa_campaign`). El 21/11/2026 seguía activa en el unificado la campaña real, sin datos ficticios ni cuentas de prueba (comprobación de estructura y recuentos, CP100-023). Por eso:

- ☑ **LAB (D3), recomendado:** el proyecto INVENTA antiguo, convertido en LAB con datos ficticios, con las 5 migraciones de la unificación más la de tramos, y una vista previa de la versión publicada (0.32.3) que apunte al LAB. Requiere «AUTORIZO» y preparar esa vista previa.
- ☐ Unificado, cuando no haya ninguna campaña real activa.
- ☐ Unificado usando la campaña real: no recomendado, porque los recuentos ficticios quedarían para siempre en el inventario real.

El script de datos ficticios **se niega a ejecutarse si hay otra campaña activa**.

## 2. Preparación

| | Quién | Qué |
|---|---|---|
| P1 | 000 | Entorno elegido con las migraciones aplicadas («AUTORIZO»). En el unificado ya están aplicadas; en el LAB hay que aplicar las 5 de `supabase/visura-unificado/` y la de tramos `20261118221403`. |
| P2 | 000 | Ejecutar `supabase/homologacion/ficticio_mi_tramo.sql` («AUTORIZO»). Crea 10 ubicaciones ZZH01-P01…P06 y ZZH02-P01…P04, los artículos ZZHOM-001 y ZZHOM-002, la campaña en borrador «HOMOLOGACIÓN 100 · DATOS FICTICIOS» y un teórico ficticio de 7 en ZZH01-P01. |
| P3 | Usuario | Crear 4 cuentas de prueba con correos de pruebas propios. Nombres visibles: **Prueba Supervisión** (Supervisor), **Prueba Uno**, **Prueba Dos** y **Prueba Tres** (Operario). Administración las habilita con el motivo «homologación». |
| P4 | Usuario | Dispositivos: móvil A (pareja y relevo), móvil B o el mismo (Prueba Tres) y un PC o tableta (Supervisión y Administración). |
| P5 | Usuario | Capturas con el nombre del paso (H05.png…), sin datos personales; se suben a la carpeta 100. |

## 2 bis. Comprobación parcial ya hecha (solo lectura, app publicada)

Hecha el 21/11/2026 por el usuario en el móvil, con la cuenta de administrador y **sin escribir nada** (CP100-023). Después se verificó que el unificado seguía con 0 tramos y 0 acciones.

| Nº | Qué | Resultado |
|---|---|---|
| R1 | Ajustes muestra 0.32.3 | ✔ OK |
| R2 | Mis recuentos sin tarjeta «Mi tramo» y sin errores | ✔ OK |
| R3 | Gestión almacén → Tramos carga sin errores | ✔ OK |
| R4 | Vista previa de un rango corto (`preview_segment`, solo lectura) y descartar, sin pulsar «Asignar tramo» | ✔ OK |
| R5 | Mis recuentos y Tramos legibles en el móvil | ✔ OK |

Cubre H01 y parte de H17 en la versión publicada. **No sustituye a H02–H16**, que escriben datos y solo se hacen en un entorno con datos ficticios.

## 3. Pasos

| Nº | Quién · dónde | Acción | Resultado esperado | ✔ |
|---|---|---|---|---|
| H01 | Todos | Ajustes | Se ve la versión **0.32.3** | ☐ |
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
- Si un paso falla: anotar el número, el resultado real y la captura. No repetir con datos reales. La reversión `supabase/visura-unificado-pendiente/reversion_tramos.sql` está preparada, pero en el unificado solo se aplicaría con decisión de 000 y «AUTORIZO».
- Fuera de este guion: escáner, datos reales y apertura en frío sin conexión.
