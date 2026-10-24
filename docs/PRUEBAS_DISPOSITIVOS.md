# Prueba de aceptación: móvil, portátil y tablet

## Preparación humana
1. Abrir la aplicación, solicitar alta con correo real y contraseña propia, y confirmar correo. Nunca compartir la contraseña en chats.
2. El propietario verifica la identidad de la cuenta inicial y la promueve a Administrador por el canal de administración de Supabase. No existe autopromoción.
3. Cada persona solicita su propia alta. Administración ve correo confirmado, introduce motivo, habilita la cuenta y asigna rol. Para ensayar aislamiento entre personas hacen falta dos cuentas reales distintas.
4. Crear una campaña de pruebas y cargar únicamente maestros autorizados, asignando una ubicación al Operario. **No importar stock oficial ni el Excel BC sin confirmación expresa.**

## Sincronización de recuentos individuales
1. Abrir la misma cuenta habilitada en móvil y portátil. En Recuento real, seleccionar asignación, artículo auténtico y lote.
2. Guardar una cantidad; el móvil debe mostrar cero pendientes tras confirmar servidor.
3. Pulsar Actualizar lecturas en portátil/tablet; comprobar mismo identificador de mutación, cantidad, artículo/lote y fecha. No basta con que ambos muestren «Conectado».
4. Con la pantalla y sesión abiertas, desconectar el móvil, guardar otra cantidad y comprobar un pendiente. Reconectar, sincronizar y verificar un solo registro en los otros dispositivos.
5. En dos pantallas corregir el mismo original con motivos distintos. Una corrección puede entrar; la otra debe quedar en conflicto, sin borrar ni sustituir datos.
6. Cerrar sesión y entrar como otra persona: su pantalla y cola deben estar separadas; los pendientes anteriores siguen asociados a su autor.

## Permisos
- Operario: no Gestión, no Consulta BC real, solo recuentos propios y asignaciones propias.
- Supervisor: consulta y gestión operativa; no directorio de correos ni cambios de rol.
- Administrador: alta aprobada, cambio de permisos con motivo e historial. Probar deshabilitar un Operario conectado: los nuevos envíos deben rechazarse y conservar la cola.
- Dos Administradores editan el mismo perfil: el segundo guardado con versión antigua debe exigir recarga.
- No desactivar el último Administrador: el servidor debe impedirlo.

## Resultado pendiente
Registrar dispositivo/navegador, cuenta/rol, hora, identificador de mutación y resultado. Estas pruebas físicas **no se han ejecutado en esta entrega**. Las pruebas automatizadas usan datos sintéticos separados y no sustituyen esta aceptación.

La pareja y el escáner siguen en DEMO. El modo offline exige una pantalla/sesión previamente cargadas. No se garantiza apertura en frío offline. La lectura entre dispositivos es manual, no push.
