# Auditoría PWA y migración a MOVENTA · 25/10/2026

## INVENTA (comprobado en rama main)
- `manifest.webmanifest`: `id: "./"`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`.
- `index.html`: título INVENTA, `apple-mobile-web-app-title=INVENTA`, manifiesto e iconos propios.
- Conclusión: la PWA instalada está identificada como INVENTA. Cambiar simplemente el texto de la portada no garantiza convertir su icono en MOVENTA; el nuevo contenedor debe probarse con su propia identidad y origen.

## KONTROLA
- No se pudo recuperar `index.html` ni `manifest.webmanifest` de `josegude-ux/KONTROLA` con las rutas consultadas. Su ubicación/configuración queda pendiente de verificación; no asumir su URL publicada.

## Plan ejecutable
1. Mantener las versiones actuales intactas.
2. Definir despliegue y origen definitivos de MOVENTA y su manifiesto con id estable.
3. Identificar URL y repositorio correctos de KONTROLA, y revisar autenticación de ambos módulos.
4. Elegir un Supabase común, definir tablas de usuarios, asignaciones de módulos y RLS.
5. Implementar navegación integrada y sesión compartida, sin claves privilegiadas en cliente.
6. Verificar instalación nueva de MOVENTA en un dispositivo y sincronización en el segundo; publicar solo con autorización.

## Estado
Auditoría parcial verificada. No hay inicio de sesión compartido ni despliegue nuevo.