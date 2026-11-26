const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64url = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);
  const auth = request.headers.get("Authorization") || "";
  const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!accessToken) return json({ error: "Please sign in to DEVPAGES first." }, 401);
  const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "CF_OAUTH_CLIENT_ID", "CF_OAUTH_REDIRECT_URI", "OAUTH_STATE_SECRET"];
  for (const key of required) if (!env[key]) return json({ error: "Cloudflare connection setup is incomplete. Missing server setting: " + key }, 503);
  try {
    const userResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + accessToken }
    });
    if (!userResponse.ok) return json({ error: "Your DEVPAGES session has expired. Sign in again." }, 401);
    const user = await userResponse.json();
    if (!user?.id) return json({ error: "Unable to verify your DEVPAGES account." }, 401);
    const nonce = crypto.randomUUID();
    const payload = b64url(new TextEncoder().encode(JSON.stringify({ uid: user.id, nonce, exp: Date.now() + 10 * 60 * 1000 })));
    const signature = await sign(payload, env.OAUTH_STATE_SECRET);
    const state = payload + "." + signature;
    const authUrl = new URL("https://dash.cloudflare.com/oauth2/auth");
    authUrl.searchParams.set("client_id", env.CF_OAUTH_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", env.CF_OAUTH_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "pages.write account.read offline_access");
    authUrl.searchParams.set("state", nonce);
    return json({ authorization_url: authUrl.toString() }, 200, {
      "Set-Cookie": "dp_cf_oauth_state=" + state + "; HttpOnly; Secure; SameSite=Lax; Path=/api/cloudflare; Max-Age=600"
    });
  } catch {
    return json({ error: "Could not start Cloudflare authorization. Please try again." }, 500);
  }
}
