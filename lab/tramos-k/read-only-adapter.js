/* VISURA INVENTA · LAB read-only adapter. Uses existing authenticated session, never writes. */
(function(root){'use strict';
const BASE='https://wlejxnpphysogrzcxjfh.supabase.co';
const KEY='sb_publishable_gPeof-fUW3yITvNXqsjHVw_-PjB1Fyd';
const STORE='inventa-real-auth-v1';
const PREFIX=/^K(?:\d{2})(?:$|[-_])/i;
function session(){let s;try{s=JSON.parse(localStorage.getItem(STORE)||'null');}catch(_){throw Error('SESSION_INVALID');}
 if(!s||!s.access_token||!s.user||!s.user.id||!s.expires_at||s.expires_at*1000<=Date.now()+10000)throw Error('LOGIN_REQUIRED_OR_EXPIRED');
 return s;
}
async function get(table,params,token){
 const url=BASE+'/rest/v1/'+table+'?'+params;
 const res=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+token,Accept:'application/json'}});
 if(!res.ok)throw Error('READ_DENIED_'+res.status);
 const value=await res.json();if(!Array.isArray(value))throw Error('INVALID_RESPONSE');return value;
}
async function readK(){
 const s=session(),uid=s.user.id;
 const profiles=await get('profiles','select=user_id,role,enabled&user_id=eq.'+encodeURIComponent(uid)+'&limit=1',s.access_token);
 const p=profiles[0];if(!p||p.user_id!==uid||p.enabled!==true||!['supervisor','admin'].includes(p.role))throw Error('MANAGER_REQUIRED');
 const rows=await get('locations','select=code,aisle,enabled&order=code&limit=1000',s.access_token);
 if(session().user.id!==uid)throw Error('SESSION_CHANGED');
 return Object.freeze({userId:uid,role:p.role,locations:Object.freeze(rows.filter(x=>typeof x.code==='string'&&PREFIX.test(x.code)).map(x=>Object.freeze({code:x.code,aisle:x.aisle||'',enabled:x.enabled===true})))});
}
root.VISURA_K_READONLY=Object.freeze({readK});
})(globalThis);