# Fase 3 · Descubrimiento verificado de Supabase (25/10/2026)

## Proyectos activos
- INVENTA: `wlejxnpphysogrzcxjfh`. Tablas: `profiles`, `campaigns`, `locations`, `products`, `assignments`, `counts`, entre otras.
- KONTROLA: `oevetnszmfxeukcncwji` (proyecto `control-cargas-movil`). Tablas: `usuarios_app`, `kontrola_cargas`, `kontrola_preparaciones`, `kontrola_almacenes`, `kontrola_importaciones`, entre otras.
- Ambas bases tienen RLS activada en las tablas enumeradas. No equivale a verificar las políticas individuales.

## Consecuencia
Son dos proyectos Auth diferentes. No basta con reutilizar un correo o enlazar pantallas para conseguir una sesión única.

## Estrategia propuesta
Mantener INVENTA como proyecto candidato para Auth común; antes de migrar, inspeccionar esquemas, dependencias, funciones, triggers y políticas. Adaptar KONTROLA a Auth compartido y migrar sus tablas con prefijo `kontrola_`, resolviendo `usuarios_app` con `profiles` sin asumir equivalencia. No mezclar catálogos ni sobrescribir datos de inventario sin reglas de correspondencia.

## Criterios antes de escribir
- Verificar identificadores de usuarios en ambos proyectos.
- Preparar migraciones reproducibles y políticas RLS específicas por módulo.
- Probar lectura y escritura con usuarios autorizados y denegados.
- Confirmar que el cliente no contiene credenciales privilegiadas.

**Estado:** descubrimiento real completado; no se ha migrado ninguna tabla ni conectado la autenticación.
