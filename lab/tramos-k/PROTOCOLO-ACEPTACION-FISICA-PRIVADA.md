# VISURA INVENTA · F2 Tramos K — protocolo de aceptación física privada
Orden: VISURA-13-AUDITORIA-RECUPERACION-001 · Matriz: VISURA-00-AUDITORIA-RECUPERACION-001 · Distribución: VISURA-00-DIST-F2-001
Checkpoint origen: VISURA-13-F2-CP-RLS-HOSTING-20261110-001

## Puerta de seguridad (NO SUPERADA)
- Repositorio INVENTA- es **público** y tiene GitHub Pages habilitado. La rama LAB **no** es un alojamiento privado por sí misma.
- No publicar aquí URL de prueba ni activar GitHub Pages para la rama; los ficheros HTML/JS de la rama son visibles públicamente.
- Antes de cualquier lectura real desde navegador: alojamiento HTTPS con autenticación de acceso **delante** del sitio (no solo login Supabase), dominio/origen aprobado, sin indexación, sin registro de tokens, sin cache compartida, TLS válido y acceso limitado a participantes autorizados.
- La sesión INVENTA almacenada en localStorage está limitada al **origen**. Un dominio privado diferente no hereda la sesión de GitHub Pages; requiere flujo de autenticación de prueba aprobado y validado sin transferir tokens manualmente.
- No utilizar credenciales de usuarios reales en páginas de prueba no aprobadas.
- Ninguna petición POST/PATCH/PUT/DELETE; no conectar recuentos ni cambiar asignaciones, campañas, stock o perfiles.

## RLS: evidencia disponible y límite
- Verificación de catálogo SQL (solo lectura): RLS activo en profiles, locations, assignments, campaigns y stock_snapshot.
- SELECT locations: internal.is_enabled(); profiles: usuario propio o manager; assignments: operario propio habilitado o manager; stock_snapshot: manager.
- Estas políticas **no** sustituyen una prueba de petición HTTP bajo JWT de un usuario real autorizado. No se han ejecutado esas peticiones ni validado navegador físico.
- La pantalla real-readonly.html solo permite supervisor/admin; por tanto **no** demuestra todavía acceso del operario a sus tramos. No interpretar el selector ficticio de index.html como control de permisos.
- No se ha demostrado el tratamiento de más de 1000 ubicaciones ni paginación real; bloquear aceptación si existe truncamiento.

## Matriz de aceptación, ejecutar solo tras superar puerta de seguridad
| Caso | Dispositivo | Perfil | Acción | Resultado esperado | Evidencia mínima |
|---|---|---|---|---|---|
| F01 | iPhone Safari/PWA | supervisor habilitado | Iniciar sesión por flujo aprobado y abrir consulta K | Solo ubicaciones K, sin datos de stock ni escrituras | Captura con datos sensibles ocultos, hora y versión |
| F02 | Tablet Safari/Chrome | supervisor habilitado | Repetir consulta, rotar orientación | Sin recortes ni errores, totales consistentes | Capturas y resolución |
| F03 | Escritorio Chrome/Edge | supervisor habilitado | Consulta, navegación teclado, zoom 200% | Foco visible y legibilidad | Captura, navegador y zoom |
| F04 | Los tres | operador habilitado | Intentar consulta de supervisor | Acceso denegado por interfaz; no se consulta locations desde esa pantalla | Traza sanitizada de peticiones |
| F05 | Los tres | sesión caducada | Intentar lectura | Error controlado, sin datos | Captura sin token |
| F06 | Los tres | sesión cambiada/cerrada | Consultar de nuevo | Datos previos eliminados; nueva lectura exige sesión válida | Captura sin datos privados |
| F07 | Los tres | supervisor | Denegación HTTP/RLS simulada en entorno controlado | No presentar resultado vacío como éxito | Registro de código HTTP sin credenciales |
| F08 | Los tres | supervisor | Inspeccionar tráfico | Solo GET de profiles y locations, sin envíos a terceros | Lista de métodos/dominios sanitizada |

## Registro por dispositivo
Dispositivo/modelo: ___ · SO: ___ · Navegador/versión: ___ · Resolución: ___
Origen HTTPS privado autorizado: ___ · Rol probado: ___ · Fecha/hora Europe/Madrid: ___
Casos: ___ · PASS/FAIL/BLOCKED: ___ · Evidencia anonimizada: ___ · Incidencia: ___

## Condiciones de cierre
- F01–F08 requieren pruebas físicas reales, no emulación.
- A01–A08 del programa F2 permanecen bloqueadas.
- Las 6 pruebas del adaptador anteriores constan PASS y **no se repiten**.
- No merge, despliegue, Supabase write, Business Central write ni cambios de producción.
