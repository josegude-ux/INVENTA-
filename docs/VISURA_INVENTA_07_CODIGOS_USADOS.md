# VISURA INVENTA 07 — Trazabilidad real de uso de códigos alternativos (LAB)

Fecha: 28/10/2026. Repositorio josegude-ux/INVENTA-.
Rama feature/visura-inventa-07-domain-20261027. PR #24 borrador.

## Problema resuelto en el contrato experimental

Una asociación alternativa existente en el catálogo no acredita que ese código se escanease durante un recuento. Tampoco basta conocer el identificador de un recuento confirmado para declarar una incidencia de asociación equivocada.

El ensayo inventory-lab/010_disposable_actual_alias_use.sql añade una tabla de enlace privilegiada (verified_alias_use) y exige, antes de admitir el tipo de incidencia used-alias-misattribution:
- Evento de confirmación real del mismo artículo, campaña y ubicación.
- Evento de escáner previamente inscrito por el servicio ficticio, vinculado a cuenta, sesión y dispositivo originales de la lectura.
- Evento específico de activación de alias (su versión histórica), que corresponde al código leído y al artículo contabilizado.
- Orden cronológico activación → lectura → confirmación y ausencia de una desactivación o reasignación intermedia anterior a la lectura.
- La persona que notifica la incidencia debe tener actualmente un equipo y sesión autorizados para esa ubicación. La identidad del operario que contó previamente se conserva por separado.

tests/sql/inventa07_lab_actual_alias_use.sql simula un uso verdadero y tres casos fraudulentos: recuento sin evidencia de escaneo, recuento de otra referencia vinculado a la misma asociación y alias desactivado antes de la lectura aunque anteriormente estuviera activo. Valida que el operario no puede insertar su propia procedencia verificada y que abrir una incidencia no altera el recuento confirmado anterior.

## Seguridad y limitaciones

TODOS los eventos de lectura, cuenta y alias son ficticios, insertados por la cuenta propietaria del PostgreSQL de CI. El experimento no prueba la procedencia criptográfica de la cámara, identidad real del terminal, validez de JWT ni versiones reales del catálogo. La integración debe efectuar estas comprobaciones en backend, impedir cualquier bypass por RPC o tabla antigua y utilizar versiones archivadas del catálogo importado de Excel sin conectar directamente con Business Central.

La prueba no autoriza cambiar datos reales, permisos o políticas RLS de Supabase. No se ha modificado la PWA, los datos productivos ni las PR de otros chats.

## Siguiente tarea segura

Diseñar el contrato unificado de lectura y confirmación, con clave por lote y equipo original, y pruebas de captura real y expiración de concesión con dos cuentas autenticadas en entorno de integración autorizado. No desplegar ni fusionar sin revisión y autorización específica.

NO MERGE. NO DEPLOY. NO DDL EN SUPABASE ACTIVA.
