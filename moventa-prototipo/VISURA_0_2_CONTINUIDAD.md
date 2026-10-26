# VISURA 0.2 — Recuperación técnica y continuidad (26/10/2026)

## Procedencia y criterio
Punto de recuperación de VISURA 0.2, continuación de VISURA 0.1. Mantener el fichero histórico `VISURA_0_1_CONTINUIDAD.md` sin sustituirlo. GitHub/Supabase verificables prevalecen sobre recuerdos. Los datos de pruebas no autorizan su eliminación. No utilizar Cursor ni asumir un agente de fondo permanente.

## Identidad
- VISURA: lanzador común (antes concepto MOVENTA); su prototipo está **solo en esta rama** y en `moventa-prototipo/`, no publicado como PWA unificada.
- VISURA INVENTA: código en `josegude-ux/INVENTA-`; 0.30.5 estable documentada, propuesta 0.30.6 de importación en PR #18 y marca VISURA INVENTA en PR #20 (abierta en borrador).
- VISURA PREPARA: código en `josegude-ux/KONTROLA`; 0.3.35 confirmada en la rama operativa y desplegada por GitHub Pages run #60 (`40285888125`), `success`, commit `7bfbb5e0da26eba63b4763b4a88e15aa3393588a`; CI #473/#474 también `success`. El estado de caché PWA en dispositivos físicos sigue sin comprobarse.
- No cambiar nombres técnicos de proyectos, ID PWA, dominios, tablas, repositorios o cuentas por renombre comercial.

## Estado verificado en GitHub
- INVENTA PR #20: `branding/visura-inventa-20261026`, borrador abierto; identidad 3D y iconos PWA integrados en rama, pendientes de verificación física.
- PREPARA PR #28: fusionada **en rama operativa de desarrollo** `cursor/verificacion-fisica-cargas-8ba0`, no representa por sí sola merge a `main`. La rama operativa incorpora desarrollos posteriores de tarjetas y cabeceras documentados en su `docs/CONTINUIDAD.md`.
- VISURA AUTO-DEV PR #37 de KONTROLA: borrador abierto hacia `chore/visura-auto-dev-guardrails` (PR #30), no a `main`; NO fusionar ni desplegar. Rama `feat/visura-auto-dev-task-spec` activa con commits concurrentes, verificar HEAD antes de cambios.
- Commit de VISURA 0.2 `85b5543c2558df8c2ff87ba33de55be72b2736c5` (PR #37): el auditor observa recuentos de aprobaciones en reglas de PR activas; distingue `0` de `desconocido`, registra pruebas y actualiza continuidad. GitHub Code Review Gate #153 (`40287447976`) **success**: 236 pruebas OK. Queue Audit #188 y CSV Pilot Tests #161 **success** para el mismo commit. La PR puede haber avanzado después: releer HEAD y CI.
- Se observó un ruleset de KONTROLA `25846536` activo para `~DEFAULT_BRANCH`: prohíbe borrado y non-fast-forward, exige PR, pero establece `required_approving_review_count: 0`; no constan checks obligatorios en **ese** ruleset. La consulta de protección clásica devolvió 403: no declarar la protección total verificada ni autorizado ningún merge. No cambiar reglas sin autorización.

## Supabase: solo lectura, instantánea 26/10/2026
- `INVENTA` y `control-cargas-movil` continúan como dos proyectos activos y **separados**, aunque la visión aprobada sea una base compartida. Prohibida migración improvisada.
- INVENTA: tablas consultadas con 1853 productos, 794 ubicaciones, 3041 líneas de importación BC; RLS habilitado en tablas listadas.
- PREPARA: 14 cargas, 3 preparaciones y 15 importaciones; RLS habilitado en tablas listadas. Los valores pueden cambiar; cero en UI no equivale a borrado de BD.
- Security Advisor: en PREPARA señala cinco funciones `SECURITY DEFINER` disponibles para `anon`; en INVENTA señala tres disponibles para `authenticated`. La definición de `kontrola_finalizar_preparacion` comprobada tiene guardia de `auth.uid()` y usuario activo; no confundir un aviso de privilegio con una explotación probada. Ambas bases indican desactivada la protección contra contraseñas filtradas.
- No se han ejecutado escrituras, cambios SQL, migraciones, operaciones con Auth, Storage ni despliegues en Supabase.

## Decisiones funcionales que NO deben cambiar
- Entrada manual de Excel desde Business Central; sin API directa ni sincronización automática BC. Importación y validación robustas, sin sustituir datos ante cargas fallidas.
- En PREPARA siguen las cargas PDF manuales cuando proceda: lectura, publicación controlada, preparación y verificación por segundo usuario, incidencias por carga, impresión procesada, retención 90 días, selección de pendientes históricas, totalización por pasillos y persistencia.
- Usuarios con credenciales individuales y revocación individual; no modificar ni publicar datos ajenos. No borrar cargas cerradas ni incidencias pendientes sin autorización.
- Móviles iPhone/Android y escritorio Windows, imágenes 3D exclusivas por app, botón Volver superior izquierdo.
- Nunca fusionar PR, publicar app, activar agente con escritura o ampliar gasto sin aprobación explícita.

## Última tarea interrumpida y lo hecho en VISURA 0.2
La última tarea conocida de VISURA 0.1 era verificar protecciones reales de GitHub y elegibilidad de revisores para AUTO-DEV. En 0.2 se localizó el ruleset activo, se detectó que exige cero aprobaciones, se observó 403 en protección clásica y se añadió lectura fail-closed de recuentos en la PR #37 con 236 pruebas correctas. Siguen sin comprobarse los permisos efectivos de los revisores y las reglas clásicas de rama.

## Orden exacto de próximos trabajos
1. Releer el HEAD de la PR #37 y los checks del SHA actual, porque existen commits concurrentes. No duplicar la implementación de auditoría.
2. Auditar la seguridad real de los RPC `SECURITY DEFINER` de PREPARA/INVENTA mediante inspección no destructiva de permisos y código; diseñar correcciones aisladas y pruebas, no aplicar cambios en bases sin autorización.
3. Comprobar las candidatas móviles PREPARA 0.3.35 e INVENTA 0.30.6, contrastando ramas y versiones antes de actuar; no confundir capturas/CI con pruebas físicas.
4. Evolucionar el prototipo VISURA para navegación/SSO solo después de validar permisos, alojamiento y sesión común; preservar los repositorios y desplegados existentes.
5. En cada commit de código actualizar `docs/CONTINUIDAD.md` en el mismo commit. Mantener este documento para el próximo salto VISURA 0.3.

## Enlaces
- https://github.com/josegude-ux/KONTROLA/pull/37
- https://github.com/josegude-ux/KONTROLA/commit/85b5543c2558df8c2ff87ba33de55be72b2736c5
- https://github.com/josegude-ux/INVENTA-/pull/20
- https://github.com/josegude-ux/KONTROLA/pull/28

**Limitación de validación:** este commit es documental. No constituye prueba de sincronización móvil, autorización real de GitHub, ni funcionalidad SSO.

## Corrección verificada de despliegue PREPARA (26/10/2026)

- PR #41 de interfaz responsiva fue fusionada el 26/10 a `cursor/verificacion-fisica-cargas-8ba0`.
- `version.json` de esa rama declara `0.3.35`.
- GitHub Pages run #60 (`40285888125`) finalizó `success` sobre SHA `7bfbb5e0da26eba63b4763b4a88e15aa3393588a`, igual al HEAD operativo observado. Los runs `40285888364` y `40285894086` de Verificar KONTROLA también finalizaron `success`.
- La respuesta HTTP del `version.json` público y el estado de caché de los dispositivos no pudieron verificarse desde esta sesión. No equiparar Actions desplegado con actualización comprobada en cada móvil.

## Riesgo de despliegue automático y control de futuras fusiones

- Verificación de `.github/workflows/pages.yml` de KONTROLA: `on.push.branches` incluye `cursor/verificacion-fisica-cargas-8ba0`. GitHub Pages #60 fue activado por `push` tras merge de PR #41; publicación `success`.
- **Issue de seguimiento #42:** https://github.com/josegude-ux/KONTROLA/issues/42. Antes de fusionar sobre la rama operativa, verificar autorización explícita de publicación, porque merge puede desplegar automáticamente.
- Opciones (no decididas): separar integración y despliegue, pasar Pages a activación manual controlada o requerir aprobaciones del entorno. **No se ha cambiado el workflow**.
