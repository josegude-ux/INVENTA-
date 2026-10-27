# VISURA 04 — Revisión de cuerpos de las cinco funciones privilegiadas de PREPARA

**Fecha:** 27/10/2026. **Modalidad:** inspección SQL SOLO LECTURA sobre `oevetnszmfxeukcncwji`. No ejecuciones de RPC de negocio, no cambio de GRANT, RLS, usuarios, estados o tablas. Esta revisión complementa `2026-10-27-privileged-functions-readonly.md`, no la sustituye.

## Evidencia comprobada directamente

Consulta limitada a `pg_proc`, `pg_namespace`, `pg_get_functiondef`, `has_function_privilege` y `pg_trigger`, `pg_get_triggerdef`. Cinco funciones son `SECURITY DEFINER`; **las cinco tienen permiso formal EXECUTE tanto para `anon` como para `authenticated`**. Todas usan `SET search_path TO ''`, con referencias calificadas en el cuerpo inspeccionado. No se han emitido consultas con identidades reales ni se han leído datos empresariales.

| Función | Entrada/uso inspeccionado | Resultado de revisión de superficie, SIN prueba de explotación |
| --- | --- | --- |
| `es_administrador()` | Retorna `exists` sobre `usuarios_app`, `id=auth.uid()`, `activo=true`, `rol='administrador'` | Consulta de permiso ligada al usuario de sesión. Para `anon` no autenticado, `auth.uid()` sería NULL; no se demostró filtración de otros usuarios. Mantener compatibilidad con posibles políticas RLS dependientes. |
| `usuario_autorizado()` | Comprueba `usuarios_app.id=auth.uid()` y `activo=true` | Igual: consulta de autorización vinculada a sesión, no acceso abierto verificado. Puede ser necesaria para login/políticas heredadas; auditar dependencias. |
| `kontrola_finalizar_preparacion(p_codigo text)` | RPC de negocio: primero comprueba `auth.uid()` no nulo y `kontrola_usuario_activo()`; luego bloquea operario/carga y valida `operario_id=v_user` antes de marcar preparación y carga, registrando evento | Es la **principal función mutadora directamente invocable** entre las cinco. El cuerpo incluye controles positivos de usuario y propiedad, por lo que su mera ejecutabilidad formal **no prueba acceso anónimo no autorizado**; falta prueba de autorización por almacén, cuentas suspendidas, errores y regresiones con roles reales. |
| `kontrola_asignar_bultos_publicados()` | Retorna `trigger`; trigger `BEFORE INSERT OR UPDATE OF documento_hash, productos, almacen` sobre `public.kontrola_cargas`, habilitado | Función de trigger, no RPC SQL normal invocable como operación de usuario sin contexto `NEW`. Verifica estado/importación/firma de metadatos y calcula bultos desde JSON. No cambiar permisos o trigger sin analizar flujos de inserción/actualización. |
| `kontrola_incidente_auditar()` | Retorna `trigger`; trigger `AFTER INSERT OR UPDATE` sobre `public.kontrola_incidencias`, habilitado | Audita incidencias/avisos; no RPC normal invocable fuera del contexto de trigger. Riesgo indirecto depende de permisos de escritura en tabla base y RLS. Requiere pruebas de integridad y de permisos de INSERT/UPDATE. |

## Lectura práctica del aviso de seguridad

`SECURITY DEFINER` + `EXECUTE` para `anon` en `public` es una **superficie a revisar**, no una explotación demostrada. Las funciones con retorno `trigger` son distintas de una RPC de usuario; el aviso genérico puede incluirlas aunque no sean directamente invocables para ejecutar la acción. También `authenticated` tiene permiso formal sobre las cinco, de modo que revocar solo `anon` no cubriría todas las posibilidades. Tampoco puede darse por seguro el acceso de administradores PREPARA a datos BC de INVENTA por esta evidencia.

Documentación de seguridad:
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A

## Recomendaciones de preparación **no ejecutadas**

1. Inventariar llamadas reales desde PREPARA y posibles funciones de políticas RLS antes de proponer revocaciones; mantener los triggers existentes mientras no haya pruebas de regresión.
2. En proyecto descartable, ensayar acceso de `anon`, `authenticated` no habilitado, usuario de almacén no autorizado, operario propietario, supervisor y administrador. Las pruebas deben mirar **efectos y errores**, no solo `has_function_privilege`.
3. Clasificar separadamente funciones auxiliares de comprobación de identidad, funciones trigger y la RPC mutadora; endurecer únicamente tras autorizar plan de transición con alternativas para los clientes.
4. Revisar la autoridad de `kontrola_finalizar_preparacion` por carga y almacén, el estado `activo`, y dependencias de `kontrola_usuario_activo` sin alterar la funcionalidad del responsable de PREPARA.
5. Nunca aplicar cambios de `GRANT/REVOKE` ni funciones nuevas a la base real desde el chat 04 sin aprobación. No migrar `usuarios_app` o `auth.users` basándose solo en nombre/correo.

**Estado:** definición y triggers inspeccionados; compatibilidad y autorización práctica de cada escenario todavía PENDIENTES. Ninguna modificación de producción.
