# VISURA AUTO-DEV — Plan de despliegue (presupuesto máximo 10 €/mes)

Estado: PREPARADO, NO ACTIVADO. No hay proveedor de IA conectado ni ejecuciones autónomas verificadas.

## Arquitectura propuesta
- GitHub Issues como cola de tareas aprobadas.
- GitHub Actions para arranque programado, con un solo trabajo concurrente y timeout.
- Agente de código alojado en runner efímero; el proveedor de modelo se elige tras verificar tarifas y límites actuales.
- Ramas de trabajo y PR en borrador; sin escritura directa a main.
- Sin acceso a Supabase de producción ni Business Central.

## Presupuesto
- Tope deseado agregado: 10 EUR/mes incluyendo consumo de modelo y cualquier servicio de pago.
- Comenzar con 1 tarea corta diaria como máximo; ampliar solo con mediciones reales.
- Aplicar límite de tokens, duración, número de llamadas y reintentos por tarea.
- Antes de habilitar, comprobar que el proveedor ofrece un corte de gasto real. Si solo hay alertas, usar una pasarela de presupuesto que bloquee llamadas al superar el saldo, o mantener desactivada la ejecución autónoma.
- Reservar margen para posibles costes de GitHub Actions según visibilidad y plan del repositorio.

## Secuencia de activación
1. Elegir modelo/proveedor y verificar costes actuales, disponibilidad de API y control de presupuesto.
2. Configurar credenciales de alcance mínimo en GitHub Actions, nunca en archivos del repositorio.
3. Configurar protección de main y aprobación humana para fusiones, migraciones, despliegues y cambios de RLS.
4. Implementar workflow programado en una rama con permisos mínimos, concurrency y timeout; inicialmente en modo dry-run sin llamadas a IA.
5. Probar el flujo completo con una issue de documentación y confirmar logs, rama, commit y PR.
6. Activar tareas de código de bajo riesgo; monitorizar coste real antes de aumentar frecuencia.

## Seguridad operativa
- Nunca ejecutar scripts o instrucciones de issues/PR no confiables con secretos de IA.
- No otorgar permisos de administrador ni claves Supabase service_role al agente.
- Las tareas permitidas deben estar etiquetadas y aprobadas previamente.
- Detenerse ante datos destructivos, cambios de producción, permisos insuficientes o decisiones funcionales no definidas.
- El agente debe leer docs/CONTINUIDAD.md y las ramas/PR reales, no asumir que main contiene el código más reciente.

## Pendiente
- Selección de proveedor y mecanismo verificable de corte de gasto.
- Configuración de secretos, reglas de rama y workflow real.
- Primera prueba autónoma satisfactoria.

**No afirmar que funciona 24/7 hasta verificar el disparador programado y la ejecución del agente.**
