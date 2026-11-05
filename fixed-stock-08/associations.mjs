/* VISURA INVENTA 08 — dominio de transición lógica, SIN PERSISTENCIA.
 * El servidor debe autenticar, autorizar y sellar cada operación real. */
export const REASONS=Object.freeze(["REUBICACION","BAJA_ARTICULO","CAMBIO_OPERATIVO","ERROR_ASIGNACION","OTROS"]);
export function transitionFixedAssociation({association,actor,action,reason,otherText="",at,revision}={}){
 if(!association||!association.associationId||!association.product_code||!association.location_code||!association.warehouse)
  throw Error("Identidad de asociación incompleta");
 if(!actor?.serverAuthorized||!actor?.userId||!actor?.warehouseGrants?.includes(association.warehouse))
  throw Error("Acceso administrativo no acreditado por servidor");
 if(!["RETIRAR","REACTIVAR"].includes(action)||!REASONS.includes(reason))
  throw Error("Acción o motivo no permitido");
 if(reason==="OTROS"&&!String(otherText).trim())throw Error("Motivo Otros requiere explicación");
 const prior=association.active===true?"ACTIVA":association.active===false?"RETIRADA":null;
 if(!prior)throw Error("Estado anterior no acreditado");
 if((action==="RETIRAR"&&prior!=="ACTIVA")||(action==="REACTIVAR"&&prior!=="RETIRADA"))
  throw Error("Transición de estado inválida");
 const stamp=String(at||"");
 const matched=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,3}))?Z$/.exec(stamp);
 const standard=matched?matched[1]+"."+(matched[2]||"").padEnd(3,"0")+"Z":null;
 if(!matched||!Number.isFinite(Date.parse(stamp))||
    new Date(stamp).toISOString()!==standard||
    !Number.isSafeInteger(association.revision)||association.revision<1||
    !Number.isSafeInteger(revision)||revision!==association.revision+1)
  throw Error("Fecha UTC de servidor o revisión consecutiva inválidas");
 const active=action==="REACTIVAR";
 return {
  association:{...association,active,revision},
  event:{associationId:association.associationId,warehouse:association.warehouse,
   product_code:association.product_code,location_code:association.location_code,
   previousState:prior,nextState:active?"ACTIVA":"RETIRADA",
   reason,reasonDetail:reason==="OTROS"?String(otherText).trim():"",
   actorId:actor.userId,at,revision}
 };
}
