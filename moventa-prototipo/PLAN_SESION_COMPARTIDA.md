# MOVENTA — integración de sesión (fase de pruebas)

## Estado verificado
- El lanzador usa el proyecto Supabase `wlejxnpphysogrzcxjfh` y consulta `moventa_app_access`.
- La interfaz abre INVENTA y KONTROLA mediante enlaces a rutas distintas de GitHub Pages.
- No existe todavía prueba de inicio de sesión real desde el navegador, ni prueba de sesión compartida entre aplicaciones.

## Restricción importante
El almacenamiento de sesión del navegador (localStorage) está aislado por origen. Abrir un enlace desde MOVENTA **no transmite automáticamente** la sesión de Supabase a otra aplicación, especialmente si usan proyectos de Supabase diferentes. No colocar tokens de acceso ni refresh tokens en parámetros de URL. Tampoco exponer claves secretas o service_role en el cliente.

## Trabajo previo a la implementación
1. Identificar el proyecto Supabase, el cliente de autenticación, el origen y el callback de INVENTA y KONTROLA.
2. Decidir arquitectura: mismo origen con navegación interna y cliente de autenticación compartido, o SSO con proveedor OIDC y redirecciones seguras.
3. Verificar la identidad de usuario en los tres módulos y el mapeo de roles internos.
4. Probar inicio de sesión, cierre de sesión, caducidad, recuperación de sesión y denegación de acceso.
5. Probar PWA en Safari/iPhone y escritorio antes de cambiar iconos.

## Criterios de aceptación
- Un solo icono instalado, navegación interna sin abrir otra PWA.
- Usuario autenticado ve solo módulos autorizados.
- KONTROLA conserva sus restricciones administrativas y los operarios autorizados pueden acceder a todos los almacenes activos, según decisión del propietario.
- No se modifica la versión publicada ni se migran datos sin una prueba y autorización específica.

## Pendiente
Auditar los clientes de INVENTA y KONTROLA y realizar pruebas reales de sesión. Este documento no representa una integración completada.
