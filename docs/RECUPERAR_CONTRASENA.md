# «He olvidado mi contraseña» · INVENTA 0.32.3

Línea 100 · rama `lab/100-recuperar-contrasena-20261119` · PROBADO LAB (sin publicar).

## Qué hace

1. En **Acceso seguro** se escribe el correo y se pulsa **He olvidado mi contraseña**.
   INVENTA llama a `POST /auth/v1/recover?redirect_to=https://josegude-ux.github.io/INVENTA-/`.
   El aviso es siempre el mismo, exista o no la cuenta, para no revelar qué correos están dados de alta.
2. Supabase envía un correo con un enlace. El enlace vuelve a INVENTA con una sesión de recuperación
   (`#access_token=…&type=recovery`) o, si la plantilla se cambia, con `?token_hash=…&type=recovery`
   (INVENTA lo canjea en `POST /auth/v1/verify`).
3. INVENTA borra esos códigos de la barra de direcciones al leerlos y muestra **Elige una contraseña nueva**
   (dos campos, mínimo 8 caracteres).
4. **Guardar contraseña nueva** llama a `PUT /auth/v1/user` con la sesión de recuperación. Si sale bien, la persona
   queda dentro con su perfil. La contraseña no se guarda nunca en el móvil, y la sesión de recuperación solo se guarda
   después de cambiarla.
5. Mensajes en castellano para estos casos: enlace caducado o ya usado (`otp_expired`), contraseña igual a la anterior
   (`same_password`), contraseña débil (`weak_password`), demasiados correos (429) y dirección no autorizada por el
   correo de pruebas de Supabase (`email_address_not_authorized`).
6. Al fallar el acceso con «Invalid login credentials» se muestra «Correo o contraseña incorrectos. Si no la recuerdas,
   pulsa «He olvidado mi contraseña».».

En iPhone el enlace del correo se abre en Safari, no en la app instalada. La contraseña se cambia ahí;
después se abre INVENTA instalada y se entra con la contraseña nueva.

## Lo que falta en Supabase (pieza compartida: decide 000, con AUTORIZO)

INVENTA no toca la configuración de Supabase. Para que el correo funcione con todo el personal hacen falta dos cosas:

- **Redirect URLs** (Authentication → URL Configuration): añadir `https://josegude-ux.github.io/INVENTA-/`.
  Si no está, Supabase envía el enlace al *Site URL* del proyecto, que es de otra app del unificado,
  y esa app no sabe fijar la contraseña. **No hay que cambiar el Site URL**: lo usan otras apps.
- **Servidor de correo propio (custom SMTP)**. El correo de pruebas de Supabase solo envía a las direcciones del
  equipo de la organización de Supabase y tiene un límite de pocos correos por hora. Para el personal hace falta un
  SMTP propio (por ejemplo, Resend, Brevo o AWS SES). Puede tener coste: necesita AUTORIZO.

Mientras tanto, un Administrador puede cambiar una contraseña desde el SQL Editor del panel. La consulta la ejecuta
la persona, nunca este chat:
`update auth.users set encrypted_password = extensions.crypt('…', extensions.gen_salt('bf')), updated_at = now() where email = '…';`

## Pruebas

- `tests/recuperar-contrasena.test.cjs`: 16 pruebas con Supabase Auth simulado y datos ficticios.
- Recorrido en Chrome sin interfaz (390×844) con la red de Supabase simulada: enlace → contraseña nueva → dentro;
  correo pedido; enlace caducado. URL limpia en todos los casos y sin errores de JavaScript.
