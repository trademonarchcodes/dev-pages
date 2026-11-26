import { reply, randomToken, hmac, setSessionCookie } from "../_lib/auth.js";

const PROJECT_ID = "devpagesdomain";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let cachedKeys = null;
let keysExpireAt = 0;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}
async function getSigningKey(kid) {
  const now = Date.now();
  if (!cachedKeys || now >= keysExpireAt) {
    const response = await fetch(JWKS_URL, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Firebase signing keys are temporarily unavailable.");
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new Error("Firebase signing keys response was invalid.");
    cachedKeys = data.keys;
    const cacheControl = response.headers.get("Cache-Control") || "";
    const maxAge = Number((cacheControl.match(/max-age=(\d+)/i) || [])[1] || 1800);
    keysExpireAt = now + Math.min(Math.max(maxAge, 60), 86400) * 1000;
  }
  const jwk = cachedKeys.find(key => key.kid === kid && key.kty === "RSA" && key.alg === "RS256" && key.use === "sig");
  if (!jwk) {
    cachedKeys = null;
    keysExpireAt = 0;
    throw new Error("Firebase signing key was not found.");
  }
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}
async function verifyFirebaseIdToken(token) {
  if (typeof token !== "string" || token.length > 12000) throw new Error("Invalid sign-in token.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid sign-in token.");
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported sign-in token.");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PROJECT_ID ||
      claims.iss !== "https://securetoken.google.com/" + PROJECT_ID ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128 ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
      !Number.isFinite(claims.auth_time) || claims.auth_time > now + 60 ||
      claims.email_verified !== true ||
      typeof claims.email !== "string" || claims.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    throw new Error("Your email must be verified before you can sign in.");
  }
  const key = await getSigningKey(header.kid);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw new Error("Sign-in token verification failed.");
  return claims;
}

export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB || !env.SESSION_SECRET) {
    return reply({ ok: false, message: "Secure sign-in is not configured yet." }, 503);
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return reply({ ok: false, message: "Request origin was not accepted." }, 403);
  }
  let body;
  try { body = await request.json(); } catch {
    return reply({ ok: false, message: "A valid sign-in token is required." }, 400);
  }
  try {
    const claims = await verifyFirebaseIdToken(body.idToken);
    const email = claims.email.trim().toLowerCase();
    const adminEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
    const role = adminEmail && email === adminEmail ? "admin" : "customer";
    const verifiedAt = new Date().toISOString();
    await env.DEVPAGES_DB.prepare(
      "INSERT INTO users (id,email,email_verified_at,role) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET email_verified_at=excluded.email_verified_at, role=excluded.role, updated_at=CURRENT_TIMESTAMP"
    ).bind(claims.sub, email, verifiedAt, role).run();
    const user = await env.DEVPAGES_DB.prepare(
      "SELECT id,email,role,email_verified_at FROM users WHERE email=? LIMIT 1"
    ).bind(email).first();
    if (!user) return reply({ ok: false, message: "Your account could not be created. Please try again." }, 500);
    const session = randomToken(32);
    const sessionHash = await hmac(session, env.SESSION_SECRET);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DEVPAGES_DB.prepare(
      "INSERT INTO auth_sessions (id_hash,user_id,expires_at) VALUES (?,?,?)"
    ).bind(sessionHash, user.id, expires).run();
    return reply({ ok: true, user }, 200, { "Set-Cookie": setSessionCookie(session) });
  } catch (error) {
    return reply({ ok: false, message: error instanceof Error ? error.message : "Unable to verify your sign-in. Please try again." }, 401);
  }
}
