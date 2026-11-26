import { reply, randomToken, hmac, setSessionCookie } from "../_lib/auth.js";

const SUPABASE_URL = "https://xkkczzhjffocfywjlukr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN";

function validOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB || !env.SESSION_SECRET) {
    return reply({ok:false,message:"Secure account sessions are temporarily unavailable."},503);
  }
  if (!validOrigin(request)) return reply({ok:false,message:"Request origin was not accepted."},403);

  let raw, body;
  try {
    raw=await request.text();
    if(raw.length>16000) return reply({ok:false,message:"The submitted sign-in data is too large."},413);
    body=JSON.parse(raw);
  } catch {
    return reply({ok:false,message:"A valid Supabase access token is required."},400);
  }
  const accessToken=String(body.accessToken||"").trim();
  if(accessToken.length<100||accessToken.length>12000||accessToken.split(".").length!==3) {
    return reply({ok:false,message:"Your sign-in has expired. Please sign in again."},401);
  }

  try {
    // Ask Supabase Auth to validate the bearer token and return the authoritative user record.
    const verifyResponse=await fetch(SUPABASE_URL+"/auth/v1/user",{
      method:"GET",
      headers:{
        "apikey":SUPABASE_PUBLISHABLE_KEY,
        "Authorization":"Bearer "+accessToken,
        "Accept":"application/json"
      }
    });
    const verified=await verifyResponse.json().catch(()=>null);
    if(!verifyResponse.ok||!verified?.id||!verified?.email) {
      return reply({ok:false,message:"Supabase could not verify this session. Please sign in again."},401);
    }
    if(!verified.email_confirmed_at && !verified.confirmed_at) {
      return reply({ok:false,message:"Please verify your email address before accessing DEVPAGES."},403);
    }
    const email=String(verified.email).trim().toLowerCase();
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ok:false,message:"The verified account email is not valid."},401);
    }
    const adminEmail=String(env.ADMIN_EMAIL||"").trim().toLowerCase();
    const role=adminEmail&&email===adminEmail?"admin":"customer";
    const now=new Date().toISOString();

    // Preserve an existing D1 customer ID on email conflict so existing sites,
    // hosting connections, orders and payment history remain attached.
    await env.DEVPAGES_DB.prepare(
      "INSERT INTO users (id,email,email_verified_at,role) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET email_verified_at=excluded.email_verified_at,role=excluded.role,updated_at=CURRENT_TIMESTAMP"
    ).bind(String(verified.id),email,now,role).run();

    const user=await env.DEVPAGES_DB.prepare(
      "SELECT id,email,role,email_verified_at FROM users WHERE email=? LIMIT 1"
    ).bind(email).first();
    if(!user) return reply({ok:false,message:"Your DEVPAGES account could not be prepared. Please try again."},500);

    const session=randomToken(32);
    const sessionHash=await hmac(session,env.SESSION_SECRET);
    const expires=new Date(Date.now()+30*24*60*60*1000).toISOString();
    await env.DEVPAGES_DB.prepare(
      "INSERT INTO auth_sessions (id_hash,user_id,expires_at) VALUES (?,?,?)"
    ).bind(sessionHash,user.id,expires).run();

    return reply({ok:true,user},200,{"Set-Cookie":setSessionCookie(session)});
  } catch(error) {
    console.error("DEVPAGES Supabase session exchange failed:",error);
    return reply({ok:false,message:"We could not create your DEVPAGES session. Please try again."},503);
  }
}
