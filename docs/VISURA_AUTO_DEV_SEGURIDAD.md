# VISURA AUTO-DEV — Política de seguridad (propuesta)

Estado: configuración en rama; no implica que haya un agente conectado o ejecutándose.

## Alcance
- VISURA INVENTA y VISURA PREPARA, preservando sus ramas, PR y funciones actuales.
- Antes de actuar, leer docs/CONTINUIDAD.md y verificar el código real en ramas de desarrollo y PR relevantes; main puede no contener la aplicación completa.
- Ejecutar tareas aprobadas sin pedir confirmación entre pasos ordinarios; documentar bloqueos y continuar tareas independientes.

## Permisos mínimos
- El agente de nube debe usar identidad dedicada con acceso limitado a los repositorios necesarios, nunca token personal de administrador.
- Permitir solo ramas de trabajo, commits, ejecución de pruebas, issues y PR.
- Prohibir push directo a main, auto-merge, borrado de ramas/repositorios, cambios de secretos y modificación de protecciones.
- No dar credenciales de producción ni claves service_role de Supabase. Acceso de prueba solo cuando esté expresamente aprobado.
- Sin acceso directo ni escritura a Business Central; entradas mediante archivos cargados manualmente.

## Puertas de aprobación
Requieren autorización expresa: fusiones, despliegues definitivos, migraciones SQL, borrado de datos, cambios de permisos/RLS, acceso a producción y gastos fuera del límite acordado.

## Control de ejecución
- Concurrencia inicial: 1 tarea de programación por repositorio.
- Cada ejecución debe tener timeout y límite de reintentos; detener bucles fallidos.
- Establecer presupuesto mensual y límite por ejecución antes de activar el proveedor de IA.
- No ejecutar código de PR no confiables con secretos disponibles.
- Registrar tarea, rama, commit, pruebas, PR, coste estimado y bloqueo.
- Mantener docs/CONTINUIDAD.md actualizado en los cambios funcionales.

## Requisitos previos a activar
1. Elegir proveedor de agente alojado en la nube y confirmar plan/coste.
2. Conectar su GitHub App/OAuth con acceso mínimo.
3. Configurar reglas de protección de main y revisión requerida en GitHub.
4. Verificar CI en las ramas que contienen código real.
5. Probar una tarea inocua de documentación de extremo a extremo.

No afirmar que el agente trabaja 24/7 hasta comprobar ejecuciones autónomas reales y su mecanismo de reactivación/cola.
