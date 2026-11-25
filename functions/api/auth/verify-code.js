import { reply, randomToken, hmac, setSessionCookie } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB || !env.AUTH_PEPPER || !env.SESSION_SECRET) return reply({ ok:false, message:"Secure sign-in is not configured yet." }, 503);
  let body;
  try { body = await request.json(); } catch { return reply({ ok:false, message:"Enter your email and code." }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return reply({ ok:false, message:"Enter the email address and six-digit code." }, 400);
  const challenge = await env.DEVPAGES_DB.prepare("SELECT id,code_hash,expires_at,attempts FROM auth_challenges WHERE email=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if (!challenge || challenge.expires_at <= new Date().toISOString() || challenge.attempts >= 5) return reply({ ok:false, message:"That code has expired. Request a new one." }, 400);
  const supplied = await hmac(email + ":" + code, env.AUTH_PEPPER);
  let mismatch = supplied.length ^ challenge.code_hash.length;
  for (let i=0;i<Math.max(supplied.length,challenge.code_hash.length);i++) mismatch |= (supplied.charCodeAt(i)||0) ^ (challenge.code_hash.charCodeAt(i)||0);
  await env.DEVPAGES_DB.prepare("UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?").bind(challenge.id).run();
  if (mismatch !== 0) return reply({ ok:false, message:"That code is incorrect. Check it and try again." }, 400);
  await env.DEVPAGES_DB.prepare("UPDATE auth_challenges SET consumed_at=? WHERE id=?").bind(new Date().toISOString(), challenge.id).run();
  const id = crypto.randomUUID();
  const adminEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  const role = adminEmail && email === adminEmail ? "admin" : "customer";
  await env.DEVPAGES_DB.prepare("INSERT INTO users (id,email,email_verified_at,role) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET email_verified_at=excluded.email_verified_at, role=excluded.role, updated_at=CURRENT_TIMESTAMP")
    .bind(id, email, new Date().toISOString(), role).run();
  const user = await env.DEVPAGES_DB.prepare("SELECT id,email,role,email_verified_at FROM users WHERE email=?").bind(email).first();
  const token = randomToken(32);
  const tokenHash = await hmac(token, env.SESSION_SECRET);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DEVPAGES_DB.prepare("INSERT INTO auth_sessions (id_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash, user.id, expires).run();
  return reply({ ok:true, user }, 200, { "Set-Cookie":setSessionCookie(token) });
}
