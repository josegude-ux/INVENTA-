# VISURA INVENTA — Tramos K · LAB
Orden existente: VISURA-13-AUDITORIA-RECUPERACION-001
Matriz: VISURA-00-AUDITORIA-RECUPERACION-001
Distribución: VISURA-00-DIST-F2-001

## Alcance integrado
Página aislada `lab/tramos-k/index.html`, modelo `model.js` y controlador visual `app.js`. Contiene tramos K01–K03 y K04–K06 y estados pending/uncertain/confirmed/blocked/conflict. Selector de vista **no autentica**. Totales independientes del filtro. Respuestas visuales antiguas descartadas. Sin peticiones de red ni escritura.

## Restricciones
Esta es una **integración inicial de interfaz** en la rama de pruebas, no el motor transaccional completo del ZIP. No está conectada a la base de datos real, no se ha desplegado ni se ha validado físicamente. No alterar `main`, `real-counts.js`, producción ni Supabase. A01–A08 bloqueadas.

## Pendientes para prueba física con datos reales
1. Verificar contrato y permisos de consulta existentes, origen de datos y sesión autenticada en el repositorio.
2. Crear adaptador de lectura real que filtre por usuario y campaña desde el servidor, no desde el selector.
3. Verificar control de acceso y exposición mínima de ubicaciones, artículos y stock.
4. Ejecutar pruebas de integración y disponer de un alojamiento privado de la rama autorizado.
5. Solo después, probar físicamente móvil/tablet/escritorio; las escrituras de recuentos siguen bloqueadas hasta validar transacciones reales.

No se ejecutó SQL ni se conectó a una base de datos en esta integración.
