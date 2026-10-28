# VISURA INVENTA 08 — compatibilidad con consumidores históricos
28/10/2026 · Auditoría de solo lectura · NO ES UNA MIGRACIÓN

## Confirmaciones en main (sin modificar)
| Archivo / líneas aproximadas | Consumo | Incompatibilidad 08 |
|---|---|---|
| supabase/migrations/006_admin_fixed_positions_report.sql:55-79 | RPC admin_fixed_positions_report | Suma el stock de la posición fija, no el total de artículo de todo el almacén; COALESCE convierte ausencias en cero |
| warehouse-management.js:152-160 | Invoca RPC y pagina en grupos de 1000 | Lecturas separadas sin garantía de una instantánea frente a publicación concurrente |
| warehouse-management.js:204-229,449-466 | UI de primeras 100 filas y filtro textual | No distingue cero acreditado, negativo, sin datos y no fiable |
| warehouse-management.js:483-496 | CSV e impresión desde fixedReportRows | Exporta todo el conjunto cargado, sin respetar filtro actual; no XLSX nativo |
| warehouse-management.js:420,430-438 | Alta POST y retirada DELETE directa | La futura retirada lógica exige motivo, actor, revisión y registro inmutable |
| consultation-ui.js:151,183-199 | Botón de marcar/desmarcar delega al gestor | Consumidor indirecto de DELETE |
| fixed-positions-import.js:189-200 | RPC admin_import_fixed_positions con p_replace | Modo replace activa bajas físicas en migración 008 |
| supabase/migrations/006_admin_fixed_positions_report.sql:17-52 | fixed_position_events y trigger DELETE | Tiene auditoría básica pero no motivo obligatorio ni estado lógico |
| supabase/migrations/008_fixed_positions_safe_merge_mode.sql:75-90 | Modo replace borra asociaciones BC ausentes del Excel | Necesita reconciliación no destructiva con historial conservado |

## Plan de convivencia no destructiva
1. No tocar las RPC ni las rutas históricas hasta disponer de migración, permisos y pruebas autorizados. La herramienta 08 sigue aislada. No reutilizar la RPC antigua como fuente del informe nuevo.
2. Coordinar con PR #22/#23 el maestro único por almacén y ubicación, lotes BC certificados, autorización por ámbito e instantánea coherente; no duplicar los modelos de PREPARA.
3. En un esquema ficticio, ensayar lectura versionada: suma BC por artículo de todas las ubicaciones del almacén; no inferir cero por ausencia salvo regla acreditada de exportación.
4. Solo tras autorización expresa: diseñar y aplicar migración aditiva reversible de estado/revisión/motivo y auditoría append-only, con respaldo y plan de vuelta atrás. No borrar datos históricos.
5. Adaptar conjuntamente consumidores de Gestión, Consulta e importación, incluyendo reemplazo de posiciones antiguas, en lugar de cambiar solo el listado.
6. Con permiso específico de integración, conectar el menú Administración a un servicio con identidad y permisos efectivos de servidor; conservar recuento ciego.
7. Desactivar la RPC histórica únicamente tras verificar todos los consumidores y ejecutar pruebas físicas en dispositivos.

## Pruebas imprescindibles de integración futura
- Administrador activa/retira tanto en Gestión como en Consulta; se guarda actor, motivo, revisión y eventos sin borrar antecedentes.
- Importador con p_replace mantiene historia de posiciones retiradas.
- Total BC por artículo incluye ubicaciones no fijas y difiere correctamente del valor local por posición.
- La exportación de todas las filas filtradas corresponde al mismo lote/versión, aun con publicación concurrente.
- Dos almacenes con el mismo código de ubicación no se cruzan y los operarios no reciben stock teórico durante recuentos.
- iPhone, tablet, escritorio y regresión completa de inventario físico funcionan después de la futura integración.

## Alcance y bloqueo
Auditoría comprobada en ficheros de la rama main de GitHub, no es lectura del estado actual de Supabase ni de una PWA cacheada. NO ALTERAR PRODUCCIÓN, NO FUSIONAR, NO DESPLEGAR. La integración depende de arquitectura compartida y autorizaciones distintas.

## Advertencia adicional: fallback de Consulta
La función readConsultData de warehouse-management.js (líneas aproximadas 108-128) utiliza bc_import_current y, si no hay importación BC activa, recurre a stock_snapshot de una campaña. El módulo administrativo 08 **no puede adoptar ese fallback**: el contrato aprobado exige una única importación teórica de Excel BC validada y publicada, sin reemplazar su origen por snapshots de inventario físico o campaña. Cuando no existe, debe aparecer SIN DATOS / NO FIABLE. No cambiar este comportamiento histórico de Consulta desde el chat 08; coordinarlo con su responsable antes de integrar.
