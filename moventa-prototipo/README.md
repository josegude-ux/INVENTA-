# MOVENTA — prototipo de lanzador (25/10/2026)
- Rama aislada `moventa/prototipo-lanzador`, basada en `main` de INVENTA.
- `moventa-prototipo/index.html` es un lanzador estático **no publicado**, con accesos a INVENTA y KONTROLA al mismo nivel.
- No convierte KONTROLA en un módulo de INVENTA. Su alojamiento temporal en una rama de INVENTA solo permite probar el diseño sin abrir ni mover repositorios.
- No incorpora todavía inicio de sesión único, autorización, enrutamiento PWA integrado ni base de datos compartida. Los enlaces externos pueden abrir el navegador.
- INVENTA mantiene `manifest.webmanifest` con id/start_url/scope `./` y service-worker cache `inventa-demo-v0305-01`. No cambiar estos archivos ni desplegar a `main` sin prueba de instalación.
- Para una única PWA con navegación interna entre aplicaciones, los recursos deberán servirse bajo un origen/ámbito de navegación compatible, mediante integración de compilación o proxy, sin exigir mover sus fuentes originales. Un enlace entre dos rutas de GitHub Pages distintas no garantiza experiencia standalone ni sesión única.
- Próximos hitos: determinar alojamiento definitivo de MOVENTA, Auth único y RLS por app, adaptar rutas internas, validar en iPhone y Windows, y solo entonces publicar.
