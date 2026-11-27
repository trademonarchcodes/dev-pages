import { json, suspendExpiredDomains, safeEqual } from "../../_lib/billing.js";
export async function onRequestPost({request,env}) {
  const expected=env.DEVPAGES_EXPIRY_CRON_SECRET||"";
  const supplied=(request.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
  if(!expected||!supplied||!safeEqual(expected,supplied))return json({error:"Unauthorized."},401);
  if(!env.DB)return json({error:"Expiry service is not configured."},503);
  try {
    const result=await suspendExpiredDomains(env);
    return json({success:true,...result});
  } catch(error) {
    return json({error:error.message||"Expiry processing failed."},500);
  }
}
