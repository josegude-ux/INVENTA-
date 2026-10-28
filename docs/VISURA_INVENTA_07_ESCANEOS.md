# VISURA INVENTA 07 — Evidencia de escáner con autorización de equipo (LAB)

Fecha: 28/10/2026.
Repositorio josegude-ux/INVENTA-, rama feature/visura-inventa-07-domain-20261027, PR #24 borrador.

## Alcance

Los archivos inventory-lab/009_disposable_verified_scans.sql y tests/sql/inventa07_lab_verified_scans.sql son contratos y pruebas PostgreSQL 16 EXCLUSIVAMENTE DESCARTABLES, instalados después del ensayo de equipos/terminales 008.

La prueba de provisionales anterior solo recibía dos UUID y marcadores declarados por el cliente. El nuevo ensayo crea un libro de eventos de escáner registrado por el propietario del laboratorio, SIN permiso de inserción ni lectura para operarios. Se valida que ambos eventos sean distintos, estén sin consumir, procedan de la misma campaña/ubicación/código, pertenezcan a la sesión y cuenta auténticas del titular y al terminal enrolado, y estén dentro de la ventana sintética de 10 minutos. La reserva de ambos eventos se efectúa atómicamente; dos provisionales no pueden reutilizarlos.

Cada nuevo provisional físico o incidencia recibe su equipo original y ambos integrantes A/B, separados del usuario/sesión realmente autenticados. Las inserciones se bloquean si no existe concesión de terminal, sesión válida o asignación vigente. Las revisiones posteriores de Administración siguen permitidas sin suplantar al titular y sin sustituir la cantidad ni los datos originales; incidencias exigen versión creciente.

## Pruebas de regresión

- No hay altas directas de eventos de escáner por operarios.
- Las dos lecturas han de estar registradas por el servicio de prueba; no basta afirmar source=scanner en el cliente.
- Se rechazan lectura de otro código, otro dispositivo, una lectura caducada y doble uso.
- Una pareja cuyo titular B tiene sesión autorizada puede registrar provisional e incidencia preservando A/B; la sesión anterior A revocada no puede hacerlo.
- Administración resuelve o deja pendiente consolidación con motivo y no borra unidades/identidades originales.

## Límites de seguridad

MUY IMPORTANTE: los eventos «confiables» de este ensayo son inyectados directamente por PostgreSQL como datos sintéticos. NO EXISTE todavía un componente real de atestación del escáner físico, una prueba criptográfica del origen de la cámara, validación de device_id por hardware ni un JWT verificado. Los valores source=camera no constituyen prueba suficiente de escaneo real. El futuro servicio de captura debe autorizar la creación de eventos y validar su origen de forma independiente al navegador.

La evidencia completa del uso de códigos alternativos durante recuentos confirmados sigue pendiente: el hecho de existir un evento de recuento no demuestra cuál fue el código usado para llegar a la referencia. Se necesita guardar el identificador real del evento de lectura y la versión del catálogo del alias. No se han resuelto ni sobrescrito registros históricos.

El SQL de laboratorio se rechaza fuera de la base inventa07_test. No se ha aplicado nada a Supabase, no se ha conectado la PWA, no se han gestionado datos reales ni Business Central.

## Siguiente tarea segura

Diseñar la relación entre lectura autenticada, versión del código alternativo y evento de confirmación; comprobar denegación de atribuciones inventadas en PostgreSQL temporal. Después, diseñar integración de Auth/RLS auténtica y UI responsive operativa en rama coordinada, con aprobación previa a cambios de producción.

NO MERGE, NO DEPLOY, NO DDL EN SUPABASE REAL, NO API BC.
