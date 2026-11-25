import { reply, readCookie, hmac, clearSessionCookie } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const token = readCookie(request, "__Host-devpages_session");
  if (token && env.DEVPAGES_DB && env.SESSION_SECRET) {
    const tokenHash = await hmac(token, env.SESSION_SECRET);
    await env.DEVPAGES_DB.prepare("DELETE FROM auth_sessions WHERE id_hash=?").bind(tokenHash).run();
  }
  return reply({ ok:true }, 200, { "Set-Cookie":clearSessionCookie() });
}
