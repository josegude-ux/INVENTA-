// VISURA 04: dependency-injected PRIVATE SERVER gateway seam, test-only.
// This module neither exposes an HTTP/RPC endpoint nor fetches real accounts.
// The supplied authorization and snapshot functions MUST be trusted server
// adapters that re-check account state & per-warehouse role on EVERY request.
// A browser cannot be allowed to provide these functions or their results.
import {toPreparaFixedReadV1} from "./to-prepara-fixed-read-v1.mjs";

const warehousePattern=/^[A-Z0-9_]{3,40}$/;
export function createPreparaFixedReadGateway({authorize,loadSnapshot,serverNow}={}){
 if(typeof authorize!=="function"||typeof loadSnapshot!=="function"||
    typeof serverNow!=="function")throw new TypeError("Trusted server dependencies required");
 return Object.freeze({
  async readFixedPositions({session,warehouse}={}){
   if(typeof warehouse!=="string"||!warehousePattern.test(warehouse))
    throw new TypeError("Invalid warehouse");
   if(session==null)throw new Error("Authentication required");
   // NEVER copy session values to an 'authorized' field. The verifier must
   // independently resolve current identity, session status and ACL.
   const verified=await authorize({session,warehouse,module:"prepara"});
   if(!verified||verified.active!==true||verified.sessionValid!==true||
      verified.enabled!==true||verified.approved!==true||
      verified.module!=="prepara"||verified.role!=="admin"||
      verified.warehouse!==warehouse||!verified.userId){
    throw new Error("PREPARA administrator warehouse access denied");
   }
   // Permission checked BEFORE querying the shared private warehouse.
   const snapshot=await loadSnapshot({warehouse,userId:verified.userId});
   // Prevent a malicious or defective repository adapter leaking a
   // different warehouse even when it returns a plausible data object.
   if(snapshot?.warehouse!==warehouse)
    throw new Error("Shared snapshot warehouse mismatch");
   const now=await serverNow();
   return toPreparaFixedReadV1({
    snapshot,verifiedScope:{serverVerified:true,module:"prepara",role:"admin",warehouse},
    now
   });
  }
 });
}
