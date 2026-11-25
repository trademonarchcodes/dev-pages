const encoder = new TextEncoder();
export function reply(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}
export function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes); crypto.getRandomValues(data);
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}
export async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}
export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}
export async function currentUser(request, env) {
  if (!env.DEVPAGES_DB || !env.SESSION_SECRET) return null;
  const token = readCookie(request, "__Host-devpages_session");
  if (!token) return null;
  const tokenHash = await hmac(token, env.SESSION_SECRET);
  return await env.DEVPAGES_DB.prepare(
    "SELECT u.id,u.email,u.role,u.email_verified_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? LIMIT 1"
  ).bind(tokenHash, new Date().toISOString()).first();
}
export function setSessionCookie(token) {
  return "__Host-devpages_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000";
}
export function clearSessionCookie() {
  return "__Host-devpages_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
export async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user || null;
}
