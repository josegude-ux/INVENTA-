# Auditoría inicial de permisos VISURA — 26/10/2026

Estado: revisión de solo lectura, sin cambios de Supabase ni despliegues.

## Hallazgos confirmados
- INVENTA (proyecto wlejxnpphysogrzcxjfh): políticas RLS sobre productos, ubicaciones, recuentos, movimientos, perfiles, importaciones y otras tablas. Varias dependen de funciones internal.is_enabled(), internal.is_manager() e internal.is_admin(). La tabla moventa_app_access permite consultar asignaciones propias; no implica autenticación compartida con PREPARA.
- PREPARA (proyecto oevetnszmfxeukcncwji): políticas RLS sobre kontrola_cargas, kontrola_preparaciones, almacenes, verificaciones y otros recursos. Varias usan kontrola_usuario_activo(), kontrola_puede_almacen() y kontrola_es_administrador(). Las tablas antiguas cargas y usuarios_app tienen otras funciones de autorización.
- Los proyectos tienen sistemas de permisos distintos. La revocación de dispositivo individual NO está demostrada; no darla por implementada.
- En PREPARA hay tablas ajenas al dominio kontrola (tanques_*): no modificar sin investigar titularidad y dependencias.

## Riesgos y decisiones
- La caducidad o revocación del refresh token no basta para invalidar inmediatamente todos los JWT existentes. Las políticas y RPC deben comprobar el estado vigente de la cuenta y, para control por dispositivo, un mecanismo de sesión/dispositivo verificable por servidor.
- Una identificación de instalación enviada libremente por el navegador no es una prueba fuerte de posesión: evitar basar RLS exclusivamente en un ID manipulable del cliente. Estudiar sesiones por dispositivo con tokens ligados a sesión y validación en backend.
- Inventariar políticas para todas las operaciones (SELECT/INSERT/UPDATE/DELETE), funciones SECURITY DEFINER, Storage y RPC antes de prometer bloqueo completo.
- PWA sin conexión: no garantizar borrado remoto; minimizar caché privada y bloquear al recuperar conectividad.

## Próximo incremento seguro
1. Inspeccionar definiciones SQL de funciones de autorización, grants, funciones RPC y políticas de Storage en ambos proyectos (solo lectura).
2. Inspeccionar inicio/cierre de sesión y service workers de ambos repositorios.
3. Elaborar matriz de autorización y casos de prueba para usuario desactivado, sesión antigua y dispositivo revocado.
4. Implementar primero en rama aislada y migración revisable; probar sin afectar a versiones instaladas.
5. Mantener continuidad y pruebas junto a cambios funcionales.

Esta auditoría no certifica seguridad integral ni sustituye pruebas con usuarios reales de ensayo.
