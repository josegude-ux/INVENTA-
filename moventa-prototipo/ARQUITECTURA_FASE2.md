# MOVENTA · Contrato de plataforma (fase 2)

## Decisión de arquitectura
MOVENTA es la aplicación contenedora con **un solo icono**. INVENTA y KONTROLA son módulos hermanos, no uno dentro de otro. Se conservan los repositorios y despliegues actuales durante el desarrollo.

## Estado comprobado
El prototipo en `moventa-prototipo/index.html` es un lanzador de enlaces. No proporciona autenticación compartida ni navegación interna integrada. Los enlaces externos pueden abrir Safari fuera de la PWA en iOS.

## Siguiente implementación
1. Inventariar rutas, manifiestos, service workers, métodos de inicio de sesión y variables de Supabase de ambos repositorios.
2. Definir un origen canónico para MOVENTA y rutas estables para cada módulo. No prometer que los iconos instalados existentes se transformarán automáticamente: la identidad PWA depende de manifest id, scope, start_url y origen.
3. Unificar autenticación con un proyecto Supabase común, migrando esquemas de prueba y configurando RLS por módulo. Nunca exponer service_role en frontend.
4. Sustituir enlaces externos por navegación integrada bajo el mismo origen o un shell que mantenga la sesión, tras verificar compatibilidad.
5. Probar en dos dispositivos: inicio de sesión, acceso a módulos, sincronización, aislamiento de permisos, actualización y funcionamiento sin conexión.
6. Publicar solo tras autorización expresa; mantener las versiones instaladas intactas hasta entonces.

## Criterios de aceptación
- Un icono MOVENTA abre la pantalla de módulos.
- Una sesión de usuario permite acceder a los módulos autorizados sin segundo login.
- INVENTA y KONTROLA conservan independencia funcional.
- Los cambios de prueba se reflejan en ambos dispositivos.
- Se documenta si la transición requiere instalar una vez la nueva PWA MOVENTA.

**No es una integración implementada:** este documento fija las decisiones y pruebas antes de modificar producción.