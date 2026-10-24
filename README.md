# INVENTA · v0.29.0

PWA móvil y PC para inventario. Aplicación: https://josegude-ux.github.io/INVENTA-/

## Usuarios reales

Acceso personal con correo y contraseña a Supabase INVENTA (`wlejxnpphysogrzcxjfh`). Las altas crean un Operario **deshabilitado**. Tras confirmar correo, Administración aprueba y asigna Operario, Supervisor o Administrador. No hay autopromoción del primer registro.

Administración consulta correos y confirmación, cambia permisos con motivo y versión de perfil; los conflictos obligan a recargar. El servidor protege al último Administrador, mantiene auditoría antes/después y comprueba el estado habilitado en cada operación autorizada. Supervisor gestiona campañas/asignaciones y ve stock; Operario no puede leer stock BC ni gestionar permisos.

## Recuento real individual (nuevo)

El acceso «Recuento real · individual» permite elegir una asignación activa, registrar artículo/lote y unidades o desglose de cuatro factores. Correcciones inmutables vinculadas al original, con motivo. No se utiliza ningún dato TEST.

Cada usuario tiene una cola local separada. Se guarda antes de enviar; un error conserva el registro. Los reintentos reutilizan la misma clave y verifican el contenido si el servidor ya lo recibió. Las correcciones simultáneas del mismo original generan conflicto sin sobrescribirlo. La pantalla muestra pendientes y permite actualizar las últimas 100 lecturas desde otro navegador.

**Límites:** sin conexión se puede seguir con las asignaciones cargadas mientras la pantalla y sesión sigan abiertas; no se promete reinicio/autenticación offline. No hay actualización push: pulsar «Actualizar lecturas». Un conflicto bloquea esa tanda hasta revisión técnica; no se descartan registros automáticamente. La pareja, el escáner y el teclado aprobado continúan en la demostración, todavía separados del nuevo recuento real. No usar esta entrega como inventario definitivo sin la aceptación en dispositivos.

## Gestión y Consulta

Se mantienen catálogo, posiciones fijas, incidencias, movimientos internos, campañas y consulta BC para Supervisor/Administrador. No se escribe en Business Central. No se ha cargado el Excel ni stock oficial.

## Verificación

- 22 pruebas de aplicación y cola, además de pruebas transaccionales de RLS en el proyecto indicado.
- Reintentos offline, respuesta perdida, conflicto de contenido, cambio de usuario y cuenta deshabilitada.
- Defaults de alta, stock oculto, asignaciones, escalada bloqueada, directorio admin, último admin, correo confirmado, versiones y auditoría.
- Fixtures SQL sin correo ni contraseña, revertidos mediante ROLLBACK. Ninguna cuenta ficticia persistente.
- Advisor de seguridad: sin advertencias tras las migraciones.
- **Pendiente:** alta y verificación de personas reales; aceptación física en móvil, portátil y tablet.

Ver [operación](docs/OPERACION.md) y [protocolo de pruebas](docs/PRUEBAS_DISPOSITIVOS.md).


## Interfaz v0.29.0

Menú visual según permisos, marca vectorial INVENTA, acceso con imagen del almacén y aplicación instalable. Volver en cabecera, logo con navegación segura y Ajustes con engranaje 3D. Consulta por ubicación usa acciones directas y conserva errores de carga con reintento. El fallo concreto informado no se reprodujo en la versión anterior; comprobar de nuevo en el dispositivo afectado.

Ver [navegación e instalación](docs/NAVEGACION_Y_ESCRITORIO.md) e [identidad visual](docs/IDENTIDAD_VISUAL.md).
