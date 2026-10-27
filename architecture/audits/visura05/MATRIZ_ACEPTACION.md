# VISURA 05 — Matriz de aceptación del contrato entre repositorios
**Versión inicial:** 27/10/2026 · **No habilita integración empresarial**

## Estado verificado
- INVENTA [PR #22](https://github.com/josegude-ux/INVENTA-/pull/22): `a6691f789c390e8bd5a3eb35998205970f5931cb`.
- VISURA 05 [PR #23](https://github.com/josegude-ux/INVENTA-/pull/23): ensayos aislados propios, apilada sobre #22. No fusionar.
- PREPARA PR #76: `fb723501e60597f70197e59cc895818203d2403d`; su motor fue integrado en B01 vía #79. PREPARA [PR #80](https://github.com/josegude-ux/KONTROLA/pull/80): `65a9ddc343921f6be8844476903748a493881a8f`; el blob de `src/fixed-position-report.mjs` es **idéntico** al de #76 (`db7e0ffebf804751f9461f12c996866354b190ab`).
- La CI VISURA 05 importa directamente los módulos puros **sin copias** en checkouts fijados; no prueba un Auth real, ningún Supabase operativo ni una red empresarial.

## Evidencias
| Requisito | Estado | Evidencia / siguiente dueño |
| --- | --- | --- |
| Catálogo único INVENTA → PREPARA | PREPARADO | Adaptador pura forma de PR #22; falta cobertura real |
| Ubicaciones por almacén | PROBADO EN SIMULACIÓN | COR_01_COR y COR_02_NAR, misma ubicación válida |
| Posiciones fijas conciliadas | PENDIENTE | Atribución legacy y completitud — chat 04 |
| Stock calculado decimal exacto, lote y cero explícito | PROBADO EN SIMULACIÓN | Tests cruzados y SQL PG16 aislado |
| Ausencia sin certificación no es cero | PROBADO EN SIMULACIÓN | Flags y clasificador |
| Cuenta activa, sesión real y rol admin PREPARA | PENDIENTE | Gateway server real/Auth — chat 04 |
| Revocación y permiso por almacén por petición | PROTOTIPO | Tests con callbacks falsos; no Auth real |
| Prohibición de lectura de otro almacén | PROBADO EN SIMULACIÓN | Adaptador y vistas PG16 |
| Puntero coincide con lote y datos | PROBADO EN SIMULACIÓN | Adaptador y prueba RR/publicación de #23 |
| Transacción de instantánea única | PROBADO SOLO EN PG16 | Control positivo REPEATABLE READ, negativo READ COMMITTED |
| Fichero BC original y SHA-256 líneas desde parser real | PENDIENTE | Parser XLSX confiable unido a servidor — chat 04 |
| Fecha de exportación BC acreditada | PENDIENTE | No derivar frescura de published_at — chat 04 |
| Ausencia de `stale` en motor consumidor denegada | PENDIENTE | Defecto reproducido — chat 02 |
| `truncated` denegado directamente por clasificador | PENDIENTE | Defecto reproducido — chat 02 |
| Duplicado idéntico rechazado por motor consumidor | PENDIENTE | Defecto reproducido — chat 02 |
| Regresión de informes, CSV/XLSX/PDF, Safari/iOS | PARCIAL | CI PREPARA B01 y prueba física pendiente — chat 02 |
| Infraestructura real, permisos, migración y cutover | NO AUTORIZADO por prompt maestro | Requiere plan de intervención y consentimiento específico |
| Integración/activación PWA | NO AUTORIZADO por prompt maestro | No exponer stock ni claves ni RPC hasta prueba real |

## Decisiones y restricciones
No duplicar `visura_reporting`, el catálogo, pasarela ni la base de datos. Business Central se actualiza **solo** por carga manual Excel. No confiar en `p_actor`, `verifiedScope` u otros valores afirmados por el navegador. Las banderas de calidad solo las acredita el servidor y deben bloquear completitud no demostrada. No tratar CI verde como aprobación de producción.

**Siguiente paso VISURA 05:** seguir la evolución verificada de #22 y #80; repetir solo pruebas afectadas; preparar evidencias para revisión. Chats 02 y 04 implementan las correcciones en sus ramas propias. 
