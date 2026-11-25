import { reply, randomToken, hmac } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB || !env.AUTH_PEPPER || !env.CF_EMAIL_API_TOKEN || !env.CF_ACCOUNT_ID || !env.EMAIL_FROM) {
    return reply({ ok:false, code:"AUTH_NOT_CONFIGURED", message:"Email sign-in is not available yet. DEVPAGES is completing its secure email setup." }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return reply({ ok:false, message:"Enter a valid email address." }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok:false, message:"Enter a valid email address." }, 400);
  const recent = await env.DEVPAGES_DB.prepare("SELECT COUNT(*) AS n FROM auth_challenges WHERE email=? AND created_at > datetime('now','-15 minutes')").bind(email).first();
  if ((recent?.n || 0) >= 3) return reply({ ok:false, message:"Too many attempts. Please try again in 15 minutes." }, 429);
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const id = crypto.randomUUID();
  const codeHash = await hmac(email + ":" + code, env.AUTH_PEPPER);
  await env.DEVPAGES_DB.prepare("INSERT INTO auth_challenges (id,email,code_hash,expires_at) VALUES (?,?,?,?)")
    .bind(id, email, codeHash, new Date(Date.now() + 10 * 60 * 1000).toISOString()).run();
  const response = await fetch("https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(env.CF_ACCOUNT_ID) + "/email/sending/send", {
    method:"POST",
    headers:{ "Authorization":"Bearer " + env.CF_EMAIL_API_TOKEN, "Content-Type":"application/json" },
    body:JSON.stringify({ from:env.EMAIL_FROM, to:[email], subject:"Your DEVPAGES sign-in code", text:"Your DEVPAGES verification code is " + code + ". It expires in 10 minutes. If you did not request this, you can ignore this email." })
  });
  if (!response.ok) {
    await env.DEVPAGES_DB.prepare("DELETE FROM auth_challenges WHERE id=?").bind(id).run();
    return reply({ ok:false, code:"EMAIL_DELIVERY_UNAVAILABLE", message:"We could not send your code. Email delivery setup is still being completed." }, 503);
  }
  return reply({ ok:true, message:"If email delivery is configured for your address, your sign-in code will arrive shortly." });
}
