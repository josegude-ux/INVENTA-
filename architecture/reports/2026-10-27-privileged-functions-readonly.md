# VISURA 04 — Preflight de funciones privilegiadas (solo lectura)

Fecha: 2026-10-27. Fuentes: `pg_proc`, `pg_namespace`, `has_function_privilege()` y Security Advisor de Supabase. **No se invocó ninguna RPC, se modificó ningún GRANT/RLS ni se suplantó una identidad.**

## Resultado observado

En INVENTA `wlejxnpphysogrzcxjfh`: **0** funciones `SECURITY DEFINER` del esquema `public` con `EXECUTE` disponible para `anon` en la consulta.

En PREPARA/Control de Cargas `oevetnszmfxeukcncwji`: **5** funciones `SECURITY DEFINER` del esquema `public` con permiso `EXECUTE` para `anon`:

| Función | Parámetros |
| --- | --- |
| `es_administrador` | ninguno |
| `kontrola_asignar_bultos_publicados` | ninguno |
| `kontrola_finalizar_preparacion` | `p_codigo text` |
| `kontrola_incidente_auditar` | ninguno |
| `usuario_autorizado` | ninguno |

Estas comprobaciones verifican **ejecutabilidad formal**, no que los cuerpos de las funciones permitan realmente alterar o leer datos sin validaciones internas. Las funciones `SECURITY DEFINER` pueden ejecutar con privilegios del propietario, por lo que debe revisarse cada cuerpo, su `search_path`, llamadas indirectas y comportamiento para `auth.uid() IS NULL`, además de las autorizaciones por módulo y almacén.

Referencia técnica: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## Bloqueo y actuación autorizada

Antes de integrar la identidad y los contratos compartidos:

1. Inspeccionar definiciones de esas cinco funciones y las llamadas dependientes sin mostrar credenciales ni datos empresariales.
2. Preparar una propuesta aislada de permisos mínimos, con pruebas como `anon`, operario activo, operario sin almacén, supervisor y administración.
3. Revisar compatibilidad con clientes PREPARA actuales: quitar `EXECUTE` sobre una función usada en inicio de sesión podría romper funcionalidades.
4. No modificar ni revocar permisos actuales sobre la base de producción durante esta auditoría. Todo parche pasará por prueba descartable y aprobación específica.

**Estado:** evidencia registrada. Remediación productiva **no autorizada y no ejecutada**.
