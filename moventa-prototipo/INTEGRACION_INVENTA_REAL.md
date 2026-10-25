# Integración de INVENTA completa en MOVENTA

## Decisión de arquitectura
La aplicación INVENTA real reside en la raíz de este repositorio. No se sustituye por la demostración `inventa-integration-demo.html`.

Para integrarla en MOVENTA sin alterar producción:
1. Preparar una compilación de INVENTA bajo la ruta interna `/moventa/inventa/` del mismo origen que MOVENTA, sin modificar su código publicado.
2. Ajustar en la compilación las rutas relativas de assets, manifiesto y service worker para que no registren ni controlen el ámbito de MOVENTA.
3. Mantener el proyecto Supabase y las políticas RLS propias de INVENTA; MOVENTA comprueba además `moventa_app_access`.
4. Compartir sesión solo cuando ambos módulos usan el mismo origen, configuración de cliente y almacenamiento Auth compatibles. No transferir tokens por URL.
5. No habilitar la apertura de INVENTA real hasta validar la revocación, cierre de sesión, recarga, cambio de usuario y caducidad del token.
6. Mantener KONTROLA independiente; no reutilizar tokens de INVENTA en el proyecto Supabase de KONTROLA.

## Bloqueos verificados
- El prototipo actual abre una demostración, no INVENTA real.
- El `index.html` real de INVENTA es una aplicación completa con manifiesto, icono y lógica propia; requiere adaptar su compilación y ámbito de service worker.
- No hay pruebas reales de autenticación ni de instalación iPhone/PC.
- No se autoriza publicación ni migración de usuarios en esta fase.

## Criterio de aceptación
Desde un único icono MOVENTA se abre INVENTA completa, con roles y datos existentes, sin segundo inicio de sesión; cerrar sesión o revocar el permiso bloquea el módulo. INVENTA publicada permanece intacta hasta aprobación explícita.
