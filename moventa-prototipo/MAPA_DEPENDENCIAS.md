# MOVENTA — Mapa de dependencias y plan de migración

## Hallazgos verificados en Supabase
INVENTA (`wlejxnpphysogrzcxjfh`) utiliza `public.profiles(user_id)` con FK a `auth.users(id)`; roles `operator`, `supervisor`, `admin`, y bandera `enabled`.

KONTROLA (`oevetnszmfxeukcncwji`) utiliza `public.usuarios_app(id)` con FK a `auth.users(id)`; roles `operario`, `administrador`, y bandera `activo`.

`kontrola_cargas` tiene PK `codigo`; referencias a `auth.users` para `publicado_por` y `cerrada_por`, y a `kontrola_almacenes(codigo)` por `almacen`. Sus dependencias incluyen `kontrola_preparaciones`, `kontrola_verificaciones`, `kontrola_incidencias`, `kontrola_carga_revisiones`, `kontrola_actividad` y `kontrola_impresiones`.

## Secuencia de implementación
1. Inspeccionar definiciones SQL de tablas, políticas RLS, funciones, triggers y buckets Storage.
2. Comparar identidades `auth.users` entre proyectos sin asumir que UUIDs coinciden para el mismo correo.
3. Crear esquema de permisos MOVENTA con acceso independiente por aplicación y administrador central, evitando confiar en metadatos editables del usuario.
4. Migrar KONTROLA al proyecto Auth común con mapeo de UUIDs y relaciones; migrar documentos Storage y rutas asociadas.
5. Adaptar cliente KONTROLA al proyecto común en una rama de pruebas; no exponer claves secretas.
6. Validar login único, autorización positiva/negativa, escrituras, sincronización y funcionamiento PWA en dos dispositivos.

## Precauciones
Los datos son ficticios y se permite modificarlos, pero no publicar ni sustituir aplicaciones instaladas sin autorización previa. La seguridad RLS de las tablas se debe volver a comprobar tras migrar.

**Estado:** mapa de dependencias verificado; todavía no se han migrado tablas ni identidades.
