import { reply, currentUser, randomToken } from "../_lib/auth.js";

const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
function validOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function encryptToken(token, userId, accountId, secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret || "")) throw new Error("encryption_not_configured");
  const keyBytes = new Uint8Array(secret.match(/.{2}/g).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const aad = encoder.encode(userId + ":" + accountId + ":cloudflare:v1");
  const encrypted = await crypto.subtle.encrypt({ name:"AES-GCM", iv, additionalData:aad }, key, encoder.encode(token));
  return "v1:" + hex(iv) + ":" + hex(encrypted);
}
export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB) return reply({ok:false,message:"Hosting connections are temporarily unavailable."},503);
  if (!validOrigin(request)) return reply({ok:false,message:"Request could not be verified. Refresh and try again."},403);
  const user = await currentUser(request, env);
  if (!user) return reply({ok:false,message:"Please sign in to your DEVPAGES account first."},401);
  if (!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || "")) return reply({ok:false,message:"Secure connection setup is not finished yet. Please try again later."},503);
  let raw, body;
  try { raw = await request.text(); if (raw.length > 12000) return reply({ok:false,message:"The submitted information is too large."},413); body = JSON.parse(raw); }
  catch { return reply({ok:false,message:"Please check the submitted details."},400); }
  const accountId = String(body.accountId || "").trim();
  const token = String(body.apiToken || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId)) return reply({ok:false,message:"Enter the 32-character Cloudflare Account ID."},400);
  if (token.length < 20 || token.length > 512 || /\s/.test(token)) return reply({ok:false,message:"Enter a valid API token without spaces."},400);
  try {
    const verifyResponse = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers:{ Authorization:"Bearer " + token, Accept:"application/json" }
    });
    const verify = await verifyResponse.json();
    if (!verifyResponse.ok || !verify.success || verify.result?.status !== "active") {
      return reply({ok:false,message:"Cloudflare could not verify this token. Check it and try again."},400);
    }
    const pagesResponse = await fetch("https://api.cloudflare.com/client/v4/accounts/" + accountId + "/pages/projects?per_page=1", {
      headers:{ Authorization:"Bearer " + token, Accept:"application/json" }
    });
    const pages = await pagesResponse.json();
    if (!pagesResponse.ok || !pages.success || !Array.isArray(pages.result)) {
      return reply({ok:false,message:"The token is valid, but it cannot access Pages in that account. Check that you granted Cloudflare Pages access to the correct account."},403);
    }
    const ciphertext = await encryptToken(token, user.id, accountId, env.TOKEN_ENCRYPTION_KEY);
    const connectionId = randomToken(16);
    await env.DEVPAGES_DB.prepare(
      "INSERT INTO hosting_connections (id,user_id,provider,provider_account_id,provider_account_label,token_ciphertext,token_key_version,connected_at,revoked_at) VALUES (?,?,'cloudflare',?,NULL,?,'v1',CURRENT_TIMESTAMP,NULL) ON CONFLICT(user_id,provider,provider_account_id) DO UPDATE SET token_ciphertext=excluded.token_ciphertext,token_key_version='v1',connected_at=CURRENT_TIMESTAMP,revoked_at=NULL"
    ).bind(connectionId,user.id,accountId,ciphertext).run();
    await env.DEVPAGES_DB.prepare(
      "INSERT INTO audit_events (id,actor_user_id,target_user_id,event_type,metadata_json) VALUES (?, ?, ?, 'hosting.connected', ?)"
    ).bind(randomToken(16),user.id,user.id,JSON.stringify({provider:"cloudflare",account_id:accountId})).run();
    return reply({ok:true,connection:{provider:"cloudflare",accountId,status:"connected"},message:"Your Cloudflare account is connected to DEVPAGES."});
  } catch (error) {
    if (error?.message === "encryption_not_configured") return reply({ok:false,message:"Secure connection setup is not finished yet. Please try again later."},503);
    return reply({ok:false,message:"We could not complete the connection. Please try again later."},502);
  }
}
