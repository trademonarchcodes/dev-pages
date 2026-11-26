import { reply, currentUser } from "./_lib/auth.js";

const encoder = new TextEncoder();
function validOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
function bytesFromHex(value) {
  if (!/^(?:[a-f0-9]{2})+$/i.test(value)) throw new Error("invalid_hex");
  return new Uint8Array(value.match(/.{2}/g).map(function (part) { return parseInt(part, 16); }));
}
async function decryptToken(ciphertext, userId, accountId, secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret || "")) throw new Error("encryption_not_configured");
  const parts = String(ciphertext || "").split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("unsupported_ciphertext");
  const keyBytes = bytesFromHex(secret);
  const iv = bytesFromHex(parts[1]);
  const encrypted = bytesFromHex(parts[2]);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const aad = encoder.encode(userId + ":" + accountId + ":cloudflare:v1");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, key, encrypted);
  return new TextDecoder().decode(plain);
}

export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB) return reply({ ok:false, message:"Name checking is temporarily unavailable." }, 503);
  if (!validOrigin(request)) return reply({ ok:false, message:"Request could not be verified. Refresh and try again." }, 403);
  const user = await currentUser(request, env);
  if (!user) return reply({ ok:false, code:"AUTH_REQUIRED", message:"Sign in to DEVPAGES before checking a name." }, 401);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return reply({ ok:false, message:"The submitted name is too long." }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply({ ok:false, message:"Enter a valid Pages project name." }, 400);
  }

  const name = String(body.name || "").trim().toLowerCase();
  if (name.length < 1 || name.length > 40 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) {
    return reply({ ok:false, code:"INVALID_NAME", message:"Use 1–40 lowercase letters, numbers or hyphens. The name cannot start or end with a hyphen." }, 400);
  }

  try {
    const connection = await env.DEVPAGES_DB.prepare(
      "SELECT provider_account_id,token_ciphertext FROM hosting_connections WHERE user_id=? AND provider='cloudflare' AND revoked_at IS NULL AND token_ciphertext IS NOT NULL ORDER BY connected_at DESC LIMIT 1"
    ).bind(user.id).first();

    if (!connection) {
      return reply({ ok:false, code:"HOSTING_NOT_CONNECTED", message:"Connect your Cloudflare account before checking Pages names." }, 409);
    }
    const token = await decryptToken(connection.token_ciphertext, user.id, connection.provider_account_id, env.TOKEN_ENCRYPTION_KEY);
    const url = "https://api.cloudflare.com/client/v4/accounts/" +
      encodeURIComponent(connection.provider_account_id) + "/pages/projects/" + encodeURIComponent(name);
    const response = await fetch(url, {
      method:"GET",
      headers:{ Authorization:"Bearer " + token, Accept:"application/json" }
    });

    if (response.status === 404) {
      return reply({
        ok:true,
        name:name,
        address:name + ".pages.dev",
        foundInAccount:false,
        finalAvailabilityCheckRequired:true,
        message:"No matching Pages project was found in your connected account. This does not reserve the name or guarantee global availability."
      });
    }

    const result = await response.json().catch(function () { return {}; });
    if (response.ok && result.success) {
      return reply({
        ok:true,
        name:name,
        address:name + ".pages.dev",
        foundInAccount:true,
        finalAvailabilityCheckRequired:false,
        message:"A Pages project with this name already exists in your connected account."
      });
    }

    if (response.status === 403) {
      return reply({ ok:false, code:"PAGES_PERMISSION_REQUIRED", message:"Your Cloudflare token cannot read Pages projects. Reconnect with the Cloudflare Pages permission enabled." }, 403);
    }
    console.error("DEVPAGES Cloudflare name check:", response.status, result.errors || result);
    return reply({ ok:false, message:"Cloudflare could not complete the name check. Please try again." }, 502);
  } catch (error) {
    console.error("DEVPAGES name check failed:", error);
    if (error && error.message === "encryption_not_configured") {
      return reply({ ok:false, message:"Secure hosting access is not configured yet." }, 503);
    }
    return reply({ ok:false, message:"We could not securely check this name. Please reconnect your Cloudflare account and try again." }, 502);
  }
}