# VISURA INVENTA 07 — Contrato de persistencia propuesto (NO APLICADO)

Fecha 2026-10-27. Repositorio josegude-ux/INVENTA-, rama feature/visura-inventa-07-domain-20261027.
**Estado: diseño técnico pendiente de revisión; no es un esquema implementado ni desplegado.**

## Evidencia de Supabase INVENTA (metadatos; solo lectura)
Proyecto INVENTA wlejxnpphysogrzcxjfh, independiente de PREPARA/Control de Cargas.
- public.counts (RLS sí, 0 filas en esta consulta): campaign_id, location_code, product_code, lot, quantity, actor_id, partner_id, previous_id, correction_reason, client_mutation_id único, entries, created_at. No contiene estado de borrador, revisión, identificador de equipo original, autor declarado de corrección o versión optimista.
- public.assignments (RLS sí): campaña+ubicación+operario; sin tramo exclusivo de equipo ni bloqueo persistente de reasignación tras iniciar recuento. public.campaigns tiene draft/active/closed, sin revisión administrativa independiente.
- public.audit_events registra cambios generales; no sustituye un historial de transiciones específico del recuento.
- El real-counts.js publicado guarda una cantidad en la cola local y la envía directamente a counts; no persiste aún un borrador de referencia ni un recuento real en pareja.
- Tener RLS activada NO prueba el cumplimiento de las nuevas reglas de identidad, permisos transaccionales, cierre y concurrencia.

## Alcance de integración propuesta
No alterar ni sustituir la tabla counts ni la cola actual. Proponer entidades nuevas, aditivas y versionadas solo después de comprobar el modelo activo y PR compartidas. Son entidades lógicas, **no nombres definitivos de tablas ni SQL listo para producción**:
1. Campaña, snapshot oficial de origen e historial inmutable; stock BC solo accesible a roles autorizados.
2. Tramo y equipo original de 1-2 operadores, con asignación inclusiva por ubicación real, sin solapamientos, versión y revocaciones.
3. Ubicación: estado not_started/in_progress/finished y bandera ever_started persistente. No reverter el inicio si se limpia un borrador.
4. Equipo y modalidad: miembros originales, usuario autenticado, sesión real, participantes de cada confirmación y eventos de cambio de modalidad; un terminal activo con concesión verificable del servidor.
5. Referencia física: una clave por campaña+ubicación+referencia/lote; estado uncounted/draft/confirmed, desglose exacto de unidades/cajas/palés, cero explícito, versión optimista y borrador separado de confirmación.
6. Eventos de confirmación y corrección append-only: ID idempotente, revisión, cantidad anterior/nueva, desglose, motivo único por corrección, autor declarado, autenticado, sesión y participantes originales.
7. Productos provisionales con dos eventos de lectura independientes, descripción y cantidad; conciliación administrativa manual.
8. Códigos alternativos versionados y exclusivos; desactivación justificada, lecturas efectivamente afectadas e incidencias.
9. Cierre y rectificaciones: resumen aceptado, bloqueos comprobados, resultado original sellado, expedientes separados, informes V1/V2/... inmutables.

## Operaciones transaccionales que falta implementar
- Guardar borrador: verificar JWT, sesión, campaña abierta, ubicación abierta, equipo/ubicación asignados y versión; escritura idempotente; conservar borradores si se pierde la conexión.
- Revisar: exponer a operario solo código, ubicación, total físico, cero explícito, desglose y versión. Nunca existencias teóricas BC.
- Confirmar: recalcular el total en servidor y validar la versión de revisión; insertar en UNA transacción confirmación, auditoría y nueva versión. Repetir ID y payload idénticos recupera resultado; nuevo payload con mismo ID genera conflicto.
- Corregir confirmado: no editar directamente el registro, exigir motivo y revisión; preservar original y nuevo, autor declarado diferente de cuenta autenticada cuando corresponda, y estado confirmado.
- Cambiar modalidad: conservar equipo original y autorías; para el relevo de A a B exigir sesión propia autenticada y cesión real del terminal; no admitir terceros.
- Finalizar/reabrir ubicación: operación manual con todas las referencias confirmadas, recálculo de tramo/pasillo, comprobación de equipo y estado de campaña.
- Cerrar campaña: solo Administración, aceptación expresa del resumen y verificación atómica de ubicaciones, provisionales, incidencias y estados físicos. Después, ninguna operación ordinaria; rectificaciones solo mediante expediente independiente.

## Seguridad: barreras verificables
1. Operario sin acceso a stock_snapshot, diferencias BC ni sus datos por RPC, vistas, caché o rutas alternativas durante campaña.
2. No confiar en assignmentValid ni participants enviados por cliente: comprobar RLS, roles, usuario/session_id, pertenencia y concesión del equipo dentro de la transacción.
3. Funciones privilegiadas: minimizar SECURITY DEFINER, denegación por defecto, grants limitados; validar auth.uid() y revocación de sesiones sensibles.
4. Concurrencia: serializar por referencia/ubicación y exigir compare-and-swap de versión; impedir modificación retroactiva y duplicados.
5. Secretos y cuentas reales fuera del código del cliente; prohibido publicar service_role.
6. No usar schema shared de PR #22/#23 por suposición. La integración debe ser aprobada y probada por separado.
7. Importación BC mediante Excel manual, sin escribir jamás a BC desde INVENTA.

## Pruebas E2E que serán condición previa para integrar
- A y B asignados → un único recuento y una sola sesión en terminal; B no autorizado → denegación real.
- Ubicación reasignada mientras pantalla abierta → el servidor rechaza nueva cantidad.
- Dos escrituras simultáneas de igual versión → una confirmación y un conflicto, sin pérdida.
- Reintento tras respuesta perdida → una mutación persistida, sin duplicación.
- Cambio A→B sin login propio → denegación; con nueva sesión de B → relevo conservando borrador y equipo.
- Operario intentando consultar stock BC vía API → denegación comprobada.
- Provisional o incidencia pendiente → cierre general rechazado.
- Campaña cerrada → intento de corrección ordinaria rechazado; expediente no cambia histórico original.
- Importación Excel nueva → no sobrescribe borradores, confirmaciones, ubicaciones finalizadas ni históricos.

**Puerta:** no aplicar SQL/RPC a Supabase activa sin revisión contra esquema real, respaldo, ensayos PostgreSQL descartables, pruebas de dos identidades, y autorización específica de producción. Este hito NO modifica bases de datos ni PWA.
