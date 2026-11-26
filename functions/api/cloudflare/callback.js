const redirect = (status) => Response.redirect("https://devpagesdomain.pages.dev/account.html?cloudflare=" + encodeURIComponent(status), 303);
const fromB64url = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
async function verify(value, signature, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, fromB64url(signature), new TextEncoder().encode(value));
}
async function encryptTokens(tokens, keyText) {
  const raw = Uint8Array.from(atob(keyText), c => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("CF_TOKEN_ENCRYPTION_KEY must be base64 for exactly 32 random bytes.");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(tokens)));
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cookie = (request.headers.get("Cookie") || "").split("; ").find(v => v.startsWith("dp_cf_oauth_state="))?.slice("dp_cf_oauth_state=".length);
  const clearCookie = "dp_cf_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/cloudflare; Max-Age=0";
  if (url.searchParams.has("error")) return new Response(null, { status: 303, headers: { Location: "https://devpagesdomain.pages.dev/account.html?cloudflare=cancelled", "Set-Cookie": clearCookie, "Cache-Control": "no-store" } });
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!cookie || !code || !state || !env.OAUTH_STATE_SECRET) return new Response(null, { status: 303, headers: { Location: "https://devpagesdomain.pages.dev/account.html?cloudflare=failed", "Set-Cookie": clearCookie, "Cache-Control": "no-store" } });
  try {
    const [payload, signature] = cookie.split(".");
    if (!payload || !signature || !(await verify(payload, signature, env.OAUTH_STATE_SECRET))) throw new Error("Invalid OAuth state signature.");
    const stateData = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (stateData.nonce !== state || stateData.exp < Date.now()) throw new Error("OAuth state expired or mismatched.");
    const required = ["CF_OAUTH_CLIENT_ID", "CF_OAUTH_CLIENT_SECRET", "CF_OAUTH_REDIRECT_URI", "CF_TOKEN_ENCRYPTION_KEY", "DB"];
    for (const key of required) if (!env[key]) throw new Error("Missing server setting: " + key);
    const tokenResponse = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.CF_OAUTH_REDIRECT_URI,
        client_id: env.CF_OAUTH_CLIENT_ID,
        client_secret: env.CF_OAUTH_CLIENT_SECRET
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error("Cloudflare token exchange failed.");
    const accountsResponse = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", {
      headers: { Authorization: "Bearer " + tokens.access_token, Accept: "application/json" }
    });
    const accounts = await accountsResponse.json();
    if (!accountsResponse.ok || !accounts.success || !Array.isArray(accounts.result) || !accounts.result.length) throw new Error("No authorized Cloudflare account was returned. Check the granted account permissions.");
    const safeTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_type: tokens.token_type || "Bearer",
      scope: tokens.scope || "",
      expires_at: tokens.expires_in ? Date.now() + Number(tokens.expires_in) * 1000 : null
    };
    const encrypted = await encryptTokens(safeTokens, env.CF_TOKEN_ENCRYPTION_KEY);
    await env.DB.prepare(
      "INSERT INTO cloudflare_connections (user_id, accounts_json, token_ciphertext, token_iv, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET accounts_json=excluded.accounts_json, token_ciphertext=excluded.token_ciphertext, token_iv=excluded.token_iv, updated_at=CURRENT_TIMESTAMP"
    ).bind(stateData.uid, JSON.stringify(accounts.result.map(a => ({ id: a.id, name: a.name }))), encrypted.ciphertext, encrypted.iv).run();
    return new Response(null, { status: 303, headers: { Location: "https://devpagesdomain.pages.dev/account.html?cloudflare=connected", "Set-Cookie": clearCookie, "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 303, headers: { Location: "https://devpagesdomain.pages.dev/account.html?cloudflare=failed", "Set-Cookie": clearCookie, "Cache-Control": "no-store" } });
  }
}
