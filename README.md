# INVENTA · v0.27.0

Aplicación PWA de inventario y gestión de almacén para móvil y PC. **Tres áreas diferenciadas en esta etapa:**

1. **Inventario y Consulta (DEMO):** datos ficticios, recuento individual o en pareja (un único móvil), registro local, escáner de códigos, correcciones y navegador sin conexión. El PIN \`1234\` es solamente de demostración.
2. **Consulta (artículo / ubicación):** con acceso de demostración utiliza ejemplos ficticios; con sesión real de Supervisor o Administrador lee la última importación de existencias BC y el catálogo de posiciones fijas desde Supabase. Lista todas las ubicaciones con stock de cada artículo y todos los artículos de cada ubicación, incluidas las posiciones fijas sin stock, identificadas como **FIJA · SIN STOCK**. La suma no incluye cantidades inexistentes.
3. **Gestión de almacén (Supabase real):** inicio de sesión por correo y contraseña, roles protegidos en servidor y persistencia centralizada de campañas, asignaciones, incidencias, maestros, prioridades de ubicación fija, stock teórico, movimientos y auditoría.

**No usar recuentos de esta versión para inventarios reales:** el módulo de operario aún no sincroniza con la base central, y las consultas hechas con un usuario de demostración muestran artículos ficticios. La consulta BC real está limitada a supervisión. Ningún dato de esta PWA modifica Business Central.

## Enlaces y arquitectura

- Aplicación: https://josegude-ux.github.io/INVENTA-/
- GitHub: https://github.com/josegude-ux/INVENTA-
- Supabase: proyecto \`INVENTA\` (\`wlejxnpphysogrzcxjfh\`), separado de Control de Cargas y Tanques.
- \`index.html\`: interfaz y recuentos ficticios aprobados.
- \`warehouse-management.js\`: gestión conectada directamente a Supabase mediante REST y Auth, sin paquetes adicionales.
- \`service-worker.js\`: shell offline y actualización con navegación network-first.
- \`.cursor/rules/inventa.mdc\`: reglas y alcance acordados para evolucionar los recuentos.
- \`docs/OPERACION.md\`: puesta en marcha, perfiles, CSV y requisitos pendientes.

## Funciones de Supervisor

- Consultar campañas, estado, asignaciones y auditoría.
- Asignar ubicaciones a operarios y controlar estados.
- Registrar y resolver incidencias con motivo e historial.
- Crear artículos, ubicaciones y posiciones fijas, dando prioridad a \`1\`.
- Consultar stock teórico de BC por artículo o ubicación, con indicador de posición fija incluso si está a cero, sin exponerlo a Operarios; registrar movimientos internos sin modificar BC.

## Funciones adicionales de Administrador

- Crear, abrir y cerrar campañas micro y anuales.
- Habilitar/deshabilitar usuarios y asignar roles.
- Importar stock teórico manualmente o desde CSV.
- Administrar todos los módulos de Supervisor.

## Seguridad

La base contiene doce tablas con RLS. Los nuevos registros de usuario obtienen el rol **operator** por defecto. La promoción inicial a administrador se realiza una sola vez desde Supabase tras registrar la cuenta, **no desde una pantalla pública ni con el PIN de la demo**. Los recuentos y movimientos son de inserción inmutable; el historial registra modificaciones relevantes. El navegador solo utiliza la **clave publicable**. Jamás subir una clave \`service_role\`.

## Pruebas

- Verificación de sintaxis y pruebas automáticas de agregación de ubicaciones, lotes y posiciones fijas vacías.
- Simulación del inicio de sesión del Administrador y carga del panel: correcta.
- Supabase: creación de esquema y migraciones registrada.
- RLS: Operario no puede leer el stock ficticio insertado para una prueba; Supervisor sí puede. Los datos de la prueba fueron revertidos.
- Advisor de seguridad inicial: sin advertencias.

**Nota:** Los pasillos A–T se muestran siempre; las ubicaciones se alimentan del catálogo auténtico cargado en Supabase y no se generan ubicaciones ficticias. La pestaña de gestión sigue restringida a Supervisor/Administrador con cuenta real.

**Pendiente para puesta en servicio real:** crear y promover el primer administrador, conectar el recuento operario con Supabase, importar maestros/existencias auténticos de BC, probar sincronización multiusuario/offline y validar la conciliación de movimientos. **No afirmar que esas funciones están completas.**
