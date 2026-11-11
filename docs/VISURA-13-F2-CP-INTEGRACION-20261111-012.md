# VISURA-13-F2-CP-INTEGRACION-20261111-012
Orden: VISURA-13-AUDITORIA-RECUPERACION-001
Matriz: VISURA-00-AUDITORIA-RECUPERACION-001
Distribución: VISURA-00-DIST-F2-001
Fecha verificada Europe/Madrid: 11/11/2026 14:15 CET

## Cambios
- Navegación F2 integrada en warehouse-management.js e index.html.
- f2-tramos-k.js: lectura de ubicaciones/ciclos F2, operaciones administrativas, recuento operador y recuperación local de mutaciones pendientes.
- supabase/f2-tramos-k-contract.sql: tablas f2_k_slots, f2_k_actions, f2_k_events, f2_k_entries; RPC f2_k_command; RLS y índice único parcial de responsable activo.
- SQL aplicado al proyecto de desarrollo INVENTA wlejxnpphysogrzcxjfh; main/producción/BC sin cambios.
- Corregida restricción histórica de unicidad que impedía transferencias sucesivas.

## Evidencia
- SQL de creación compilado en transacción con ROLLBACK, después aplicado.
- Post-verificación: 4/4 tablas RLS; índice parcial activo 1/1; 0 restricciones únicas históricas incorrectas; 0 filas en las cuatro tablas F2.
- RPC rechaza sesión no autenticada con SQLSTATE 42501.
- Sintaxis JavaScript de f2-tramos-k.js y warehouse-management.js correcta; referencias UI y reintento comprobadas estáticamente.
- Se conservan las 6/6 PASS históricas sin reejecución.

## NO-GO pendiente
- Solo hay una cuenta admin habilitada; no hay operarios habilitados para prueba autenticada de dos roles.
- No se han validado todavía pruebas de concurrencia con sesiones independientes, pérdidas de respuesta reales, transferencias repetidas, segundo ciclo ni aceptación iPhone.
- Advisor Supabase: aviso por función SECURITY DEFINER pública ejecutable por authenticated (control de rol explícito en función; requiere revisión adicional); f2_k_actions sin policy por diseño, sin GRANT de lectura.
- No se ha publicado la rama. El módulo F2 no está disponible en la PWA actualmente publicada.
- Revisar la coherencia entre recuentos legacy y f2_k_entries antes de usar F2 para inventario final.

Siguiente paso: pruebas transaccionales autenticadas de dos roles, revisión de seguridad RPC, UX de selección de ciclos y recuperación de sesión, pruebas iPhone, autorización de despliegue de desarrollo.
