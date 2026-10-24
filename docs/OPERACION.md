# Puesta en marcha de INVENTA (gestión real)

## Estado actual
Desde v0.28.0 existe un acceso separado **Recuento real · individual** con cola por usuario y envío confirmado al servidor. Ver PRUEBAS_DISPOSITIVOS.md para límites y aceptación pendiente.

La interfaz de recuento de INVENTA sigue utilizando referencias ficticias locales para que se puedan mantener las pruebas de modalidad individual/pareja, escáner y edición. **No está conectada a los recuentos de Supabase.**

La nueva Gestión almacén usa un proyecto independiente:
- Nombre: INVENTA
- Referencia: wlejxnpphysogrzcxjfh
- Región: Europa (Irlanda)
- Coste confirmado por Supabase para la creación: 0 al mes, sujeto a límites del plan gratuito.

## Primer Administrador

1. Abrir INVENTA > **Acceso Supervisor / Administrador** > **Crear cuenta**; introducir un correo propio y contraseña robusta. Confirmar el enlace recibido si está habilitada la confirmación de correo.
2. La cuenta se crea con rol de Operario **deshabilitado**, de forma intencionada: **no existe una contraseña de administrador predefinida**.
3. El propietario de Supabase, una vez verificada esa cuenta y su identidad, ejecuta en **SQL Editor** (sustituyendo el correo):

   UPDATE public.profiles SET role = 'admin', enabled = true,
     permission_reason = 'Alta inicial verificada por el propietario'
   WHERE user_id = (SELECT id FROM auth.users
     WHERE email = 'SUSTITUIR_POR_CORREO_REAL' AND email_confirmed_at IS NOT NULL);

4. Tras reiniciar sesión aparecerá Gestión almacén. Desde **Usuarios y permisos** podrá nombrar supervisores y habilitar otros administradores. No es necesario repetir SQL para esos usuarios.

**No crear una función de autopromoción para el primer usuario**: la PWA está publicada en GitHub Pages y es accesible públicamente.

## Operación de Supervisor
- **Resumen**: campañas registradas, incidencias, artículos, ubicaciones, asignaciones.
- **Asignaciones**: seleccionar campaña, ubicación y operario, y actualizar estado.
- **Incidencias**: registrar y resolver con texto justificativo.
- **Artículos y ubicaciones**: crear maestros, asignar ubicación fija y prioridad 1.
- **Existencias BC**: consulta del snapshot; solo Administrador puede modificarlo (RLS).
- **Movimientos**: registrar traslados internos con artículo, lote, cantidad, motivo, origen y destino; **no exporta a BC**.
- **Auditoría**: eventos registrados en servidor (solo lectura).

## Operación adicional de Administrador
- **Campañas**: crear como borrador, activar una (máximo una activa) y cerrar. Una campaña cerrada no puede reabrirse.
- **Usuarios y permisos**: roles y estado habilitado.
- **Existencias BC**: introducir línea o importar CSV.

### CSV de existencias
Exportar desde Business Central a CSV delimitado por punto y coma, formato:
\`\`\`csv
ubicacion;articulo;lote;cantidad
K00-P01;PRD0003563;L-001;200
K00-P02;PRD0002411;;72
\`\`\`
Antes de importar deben existir ubicaciones y artículos. Seleccionar la campaña de destino en la pestaña Existencias BC. Una combinación de campaña + ubicación + artículo + lote no admite duplicados. La importación se realiza en grupos de 100 líneas; si alguna tanda falla, revisar cuáles se incorporaron antes de reintentar para evitar conflictos. La carga de este fichero no ajusta Business Central.

## Modelo y seguridad
Migraciones de Supabase aplicadas:
- 20261024034448 · inventa_core_secure_roles
- 20261024034818 · inventa_harden_snapshot_and_corrections

Tablas: profiles, campaigns, locations, products, barcodes, fixed_positions, stock_snapshot, assignments, counts, incidents, movements y audit_events.

- Acceso restringido con RLS en las 12 tablas.
- Stock teórico: lectura de Supervisor/Administrador; escritura solo Administrador.
- No hay permiso de modificación ni borrado de recuentos y movimientos desde las API públicas.
- Toda corrección de recuento crea un nuevo registro vinculado al original; exige motivo.
- La consulta teórica de prueba en el JavaScript de operario **no es stock real**.
- Los roles no dependen de datos editables por el usuario.
- No exponer jamás credenciales de servicio ni conectar otros proyectos.

## Antes de pasar a producción
1. Revisar cuentas y política de altas (preferible cerrar registros públicos tras dar de alta usuarios).
2. Migrar la pantalla de recuento desde TEST/localStorage a campañas y asignaciones reales.
3. Diseñar y probar cola offline e idempotencia para pérdida de conexión.
4. Probar cambios de operador y recuentos en pareja con autenticación real y un móvil.
5. Importar maestros oficiales desde BC, lotes y ubicaciones fijas.
6. Validar conflictos por movimientos en ubicaciones ya contadas y cierre de incidencias.
7. Probar con dos dispositivos antes de indicar sincronización funcional.
8. Autorizar manualmente cualquier exportación o ajuste en Business Central.

## Entrega v0.28.0
Altas pendientes, verificación de correo para habilitar, directorio restringido a Administración, versión de perfil, motivo de permisos y protección del último Administrador en servidor. Auditoría de perfil con user_id, autor y antes/después. Reintentos idempotentes y correcciones de cadena única.

La pareja/escáner/teclado original permanecen en DEMO; el nuevo formulario real individual no los sustituye. Consulta y gestión reales existentes se mantienen. La validación en dispositivos y la carga oficial BC siguen pendientes.
