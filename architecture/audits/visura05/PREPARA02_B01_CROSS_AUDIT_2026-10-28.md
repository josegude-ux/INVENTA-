# VISURA 05 — Auditoría cruzada PREPARA 02 / Bloque 01, 28-10-2026

**Alcance**: solo auditoría independiente, pruebas cruzadas con fixtures ficticios, evaluación de caché y documentación; no fusionar ni desplegar. Propietario: chat 05, PR INVENTA #23.

## 1. Referencias verificadas
| PR | SHA HEAD | Estado | Fuente |
| --- | --- | --- | --- |
| KONTROLA #75 | `861dce15ea8dceba94e2f370fad8f0155c34e215` | OPEN DRAFT, no merged | Evidencia BC, neto cero |
| KONTROLA #76 | `154555fe9990d5347679d23967848c3fc14e6eb4` | OPEN DRAFT, no merged | Informe 02 actualizado |
| KONTROLA #79 | `033ebc1ebeb66c33e9945b30863ad4844c29faf2` | CLOSED MERGED a rama B01 de integración; no presupone merge a main | Incorporación antigua de fijas |
| KONTROLA #80 | `65a9ddc343921f6be8844476903748a493881a8f` | OPEN DRAFT, no merged | Convivencia, caché y navegación B01 |
| INVENTA #22 | `e08c45bb68ee029ef48c703d4e7de588db957067` | OPEN DRAFT, no merged | Arquitectura central |
| INVENTA #23 | Base de auditoría al inicio `977885f0105ef782228a781ff2e18093b80c6e78`; se añaden solo archivos propios | OPEN DRAFT, no merged | Pruebas chat 05 |

**CI en HEAD exacto**: KONTROLA #76 [40637340374](https://github.com/josegude-ux/KONTROLA/actions/runs/40637340374), [40637340375](https://github.com/josegude-ux/KONTROLA/actions/runs/40637340375), [40637340380](https://github.com/josegude-ux/KONTROLA/actions/runs/40637340380) SUCCESS. KONTROLA #80 [40576887948](https://github.com/josegude-ux/KONTROLA/actions/runs/40576887948), [40576887934](https://github.com/josegude-ux/KONTROLA/actions/runs/40576887934), [40576887923](https://github.com/josegude-ux/KONTROLA/actions/runs/40576887923) SUCCESS. Para #75, el endpoint consultado no devolvió runs asociados al SHA; su documento registra resultados anteriores, NO atribuirlos automáticamente a este HEAD. INVENTA #22 [40637814023](https://github.com/josegude-ux/INVENTA-/actions/runs/40637814023) y [40637813922](https://github.com/josegude-ux/INVENTA-/actions/runs/40637813922) SUCCESS. **CI aislada no acredita Auth/RLS real, API ni despliegue**.

## 2. Matriz por archivo y blob (comparados SHA exactos)
| Archivo | PR75 | PR76 actualizado | PR80 B01 | Diagnóstico | Responsable |
| --- | --- | --- | --- | --- | --- |
| src/admin.mjs | `941bfc5c` | `7b385fb9` | `941bfc5c` | **CONFLICTO al sobrescribir**. Mantener admin.mjs de B01, su navegación, permisos, importaciones, review y limpieza de sesión; solo adaptar conexión de fijas | 06 |
| src/admin-fixed-positions.mjs | `2d5c821d` | `2e6fd681` | `2d5c821d` | **REQUIERE PORTADO**: el nuevo import estático V1 y validación previa a clasificar no existen en B01. El resto debe preservarse | 02→06 |
| src/fixed-position-report.mjs | `db7e0ffe` | `577bce3c` | `db7e0ffe` | **CAMBIADO, requiere revalidar**: fail-closed para stale/truncated y duplicados; no usar antiguo sin guard | 02→06 |
| src/fixed-position-contract-v1.mjs | **AUSENTE** | `deba1f55` | **AUSENTE** | **DEPENDENCIA INDISPENSABLE**: import estático roto en versión híbrida | 02→06 |
| src/fixed-position-print.mjs | `e1ed5539` | `f7a6a39a` | `e1ed5539` | **CAMBIADO**, portada/fechas/recorrido A4; transportar sin perder paginado | 02→06 |
| src/fixed-position-xlsx.mjs | `52d7300e` | `d898f613` | `52d7300e` | **CAMBIADO**, exportado/importado/publicado, dos hojas, cifras como texto | 02→06 |
| src/document-review.mjs | `544c972e` | `45eba346` | `544c972e` | **CRÍTICO**: proteger versión B01 de 2+3=5→4+1=5 con eventos; NO sustituir por archivo antiguo de #76 | 06 |
| sw.js | `a0e0f736` | `d9f3b73f` | `31345e62` | **CONFLICTO**, mantener manifest íntegro de #80, agregar V1 y nuevo CACHE versionado | 06 |
| index.html | `122f2b65` | `7341bd45` | `8bdd80e5` | **CONFLICTO**; conservar rutas y menús B01, evitar sustituir índice | 06 |
| tests/fixed-position-b01-integration.test.mjs | `237333b4` | ausente | `c6faa4e8` | **CAMBIADO**; extender expectativas del manifest, del guard V1 y del neto cero | 06 |

Los cuatro módulos antiguos del informe ya estaban en manifest #80, pero **no** el nuevo guard V1. No integrar PR76 completa sobre PR80: su rama base es diferente y contiene versiones anteriores de funciones B01.

## 3. PWA: diagnóstico reproducible y propuesta concreta

**B01 SW SHA 31345e6298f9623ec63e738784338d73cd63cdbf:** caché `kontrola-integral-visura-v074-fijas-ge-cierre`. Incluye `./src/admin-fixed-positions.mjs`, `./src/fixed-position-report.mjs`, `./src/fixed-position-print.mjs`, `./src/fixed-position-xlsx.mjs`, pero NO `./src/fixed-position-contract-v1.mjs`. El `admin-fixed-positions.mjs` de #76 lo importa estáticamente en línea 2.

El service worker usa instalación por `Promise.all(ASSETS.map(fetch(cache:"reload")))`, `skipWaiting`, activación que borra cachés antiguas `kontrola-*`, y estrategia **network-first** de módulos con fallback a `caches.match` cuando falla la red. **Consecuencia:** un híbrido con código de #76 y manifest de #80 puede instalarse correctamente online sin haber cacheado V1; una importación administrativa offline puede fallar. Visitar la pantalla online antes puede cachear el recurso dinámicamente, pero esa suerte no garantiza una instalación offline íntegra.

Ensayo Node de SW real evaluado en VM (sin cachés de dispositivo): [VISURA 05 PR #23](https://github.com/josegude-ux/INVENTA-/pull/23), [CI #40638245074](https://github.com/josegude-ux/INVENTA-/actions/runs/40638245074) **SUCCESS**: el manifest anterior produce ausencia offline; una copia SOLO EXPERIMENTAL con asset V1 y caché renombrada lo proporciona; error de precarga rechaza instalación y no activa la eliminación de caché vieja en el simulador. Se ensayó reconexión, uso posterior offline y no lectura/escritura de localStorage/indexedDB en el SW. El SW real no elimina preferencias, pero la prueba aislada no puede probar datos de usuarios.

**Corrección EXACTA PROPUESTA PARA CHAT 06, NO APLICADA A KONTROLA:**
1. En la rama integrada B01, conservar **todo** el manifest #80 y sumar `"./src/fixed-position-contract-v1.mjs"` junto a `admin-fixed-positions.mjs`, además de cualquier otro import estático nuevo.
2. Versionar `const CACHE` con una etiqueta nueva (por ejemplo `kontrola-integral-visura-v075-fijas-contract-v1`), **no** copiar el `sw.js` de #76, que no contiene las cuatro rutas antiguas del informe.
3. Publicar el paquete de módulos V1, B01, `index.html` y SW de forma conjunta, sin sustituir el código de cantidades B01 o importar una revisión antigua de admin/document-review. El despliegue parcial de archivos con versiones mixtas debe tratarse como fallo.
4. Extender la prueba de la PR #80 para recorrer importaciones estáticas (recursivamente) y exigir que la precarga incluya los recursos requeridos para la administración offline. Verificar scripts externos y rutas de navegación que deben funcionar.
5. Ejecutar la prueba de instalación nueva, actualización desde caché anterior, visita de administración sin conexión, reconexión, doble pestaña, precarga 404/503 e interrupción de descarga. En instalación fallida no se activa el SW nuevo y la versión anterior permanece activa; vigilar limpieza de caché parcial y recuperación posterior.
6. No borrar CacheStorage, IndexedDB, localStorage o colas reales indiscriminadamente, ni modificar cache de usuarios desde esta auditoría. Para revertir, volver a un paquete B01 coherente con nombre de caché nuevo y controles de datos/versión; la eliminación automática de cachés anteriores al activar implica que **no se debe confiar en recuperar el paquete antiguo desde su caché después del corte**.

**Chromium de navegador**: suite propia `architecture/audits/visura05/prepara-b01-browser.mjs` y CI específica preparadas con origen HTTP local y service worker original en rama propia. No confundir ese ensayo con Safari/iPhone físico, ni afirmar su resultado antes de revisar la ejecución final.

## 4. Cantidades del Bloque 01: control de regresión y compatibilidad

La fuente #75 `src/document-review.mjs` conserva la validación por línea y causa de corrección, incluso si el total es 5 antes y después:
- **2+3=5 → 4+1=5 sin eventos**: ERROR por cambio no auditado.
- **Solo evento de primera línea**: ERROR, falta evidencia de segunda línea.
- **Dos eventos válidos**: permite la corrección con autor, fecha y justificación.
- Un evento `lectura_pdf` no se considera automáticamente un contraste `dato_pdf_bc`.

[CI #40638245074](https://github.com/josegude-ux/INVENTA-/actions/runs/40638245074): en el mismo ensayo **10 PASS de pruebas nuevas y 2 TODO**, más regresiones originales de #75 **7 PASS**, de #76 **44 PASS** y de #80 **3 PASS**. Total ejecutado **64 PASS, 0 FAIL, 2 TODO**. Se utilizaron checkouts fijados; SQL, PostgreSQL, Chromium/PDF del HEAD #76 cuentan aparte y sus CI previas eran correctas. Estas pruebas JS no validan RLS real ni eventos SQL productivos.

El contrato estricto V1 rechaza almacén ajeno, flags ausentes, autorizado como texto, stock Number, lotes duplicados y líneas sin catálogo. En la prueba cruzada hay dos almacenes con `K02` independiente; XLSX PREPARA conserva **dos** hojas (Resumen, Incidencias) y 1.205 filas filtradas, CSV completo y HTML A4 multipágina. En INVENTA 08 sigue siendo **una** hoja.

## 5. Seguridad, fechas y bloqueos empresariales

El módulo V1 de #76 valida solo **forma y consistencia** del JSON; las banderas de `authorized`, `stale`, `stockComplete` no prueban identidad real. En #22 la salida `toPreparaFixedReadV1` es un adaptador puro, no RPC ni Auth. Pendiente mantener una única fuente `visura_shared` y control verdadero de sesión, usuario individual revocable, roles de módulo/almacén, RLS, puntero al lote BC vigente, SHA de filas y parser Excel sin pérdida decimal.

Fechas diferentes: **exportación acreditada de BC**, **importación manual** y **publicación**; no inferir frescura desde publicación. Negar cero deducido desde ausencia sin política BC acreditada. No duplicar sumas al repetir SKU en posiciones fijas. Propuesta SQL `visura_reporting` de KONTROLA no puede ser segunda autoridad. Falta prueba real de usuarios revocados, permisos por almacén y E2E.

## 6. Plan de integración no destructiva por responsables
- **02**: confirmar exportaciones y forma del contrato V1, y no editar módulos B01 ajenos. Reentregar lista de blobs actuales.
- **06 / cierre Bloque 01**: portar selectivamente las cuatro revisiones de informe y archivo nuevo, preservar `admin.mjs`/index/document-review B01, actualizar manifest/version y ampliar tests B01; ejecutar E2E de navegación, importación y cantidades, sin deploy.
- **04 / arquitectura**: cerrar proveedor real autenticado, ACL, snapshot consistente, fidelidad de BC, certificación de fechas/stock y rollback de datos. No crear backend duplicado.
- **05 / auditoría**: repetir solo pruebas afectadas sobre nuevos commits/SHAs, revisar CI del browser, completar matriz y continuidad, sin alterar ramas ajenas.

**Fases de salida:** congelar SHAs → comparación por blob → portado selectivo en rama integradora ajena → CI Node/SQL/Chromium → prueba upgrade offline + 404 → verificación con identidades/datos autorizados y dispositivos físicos → backup/plan de rollback → autorización independiente de merge y despliegue. El primer cambio seguro para autorizar al chat 06 es **portar el guard y su import, las revisiones de informe/exportadores y manifest nuevo como unidad aditiva**, conservando toda lógica de #75/#80. No hacer merge de PR76 directamente.

**Veredicto provisional hasta CI browser:** CORRECCIONES PENDIENTES. El código del informe V1 está aislado y probado, pero B01 #80 no contiene la nueva dependencia ni las revisiones; una mezcla sin portado selectivo romperá la garantía offline y puede reintroducir validaciones antiguas. **No está operativo en empresa**.

## 7. Resultado de navegador real aislado y refinamiento de evidencia (28/10/2026)
- CI browser primera [40638439334](https://github.com/josegude-ux/INVENTA-/actions/runs/40638439334) **FAIL del ensayo**: el runner Chromium pudo recuperar el módulo en el supuesto offline (`bad: ok`). No prueba que el manifest fuese completo; el laboratorio no cortaba físicamente el servidor HTTP local.
- Se corrigió exclusivamente el script VISURA05 imponiendo también `req.socket.destroy()` a las peticiones del ámbito ficticio desconectado: commit `23aa07d034ba59ce2827e54bb856a19c96ea0aaa`. [CI navegador 40638666089](https://github.com/josegude-ux/INVENTA-/actions/runs/40638666089) **SUCCESS, 1 escenario integral PASS, 0 FAIL**. Contiene tres subescenarios: precarga antigua + módulo V1 nuevo da fallo offline, propuesta con recurso y versión nueva funciona offline, actualización real de service worker en navegador elimina caché vieja/activa la nueva y conserva una preferencia local. Se sirvió el HTML y módulos de K76 desde un servidor HTTP ficticio; resto de assets B01 se emularon con respuestas de laboratorio, por lo que **no se ha ejecutado la PWA empresarial completa**.
- Los fallos de preparación de scripts/ensayos se conservan como evidencia histórica; nunca contarlos como resultados PASS. La prueba Node de simulación `40638245074` sí fue **SUCCESS** con 64 pruebas JS ejecutadas y 2 TODO.
- El workflow real del HEAD #75 fue recuperado también con filtrado `head_sha`: [40567880740](https://github.com/josegude-ux/KONTROLA/actions/runs/40567880740) SUCCESS. Este resultado completa la verificación documental, pero no reemplaza el cruce posterior.
- El HEAD de arquitectura #22 avanzó durante la auditoría hasta `0d8c444e4b39e1862a241cc1e59949c545c79d84`, **tres commits nuevos exclusivamente de documentación** respecto a `e08c45bb68ee029ef48c703d4e7de588db957067`; no se atribuye CI del anterior a un HEAD posterior ni se repiten tests de código sin diff funcional.
- **Sigue pendiente** actualización efectiva en la rama B01 de Chat 06, pruebas completas de la PWA con todas sus rutas y datos, Safari/iPhone instalado, downgrade/rollback real sobre entorno de ensayo y pruebas de credenciales/almacenes con servidor autorizado.
