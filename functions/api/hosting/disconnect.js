import { reply, currentUser, randomToken } from "../_lib/auth.js";
function validOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
export async function onRequestPost({ request, env }) {
  if (!env.DEVPAGES_DB) return reply({ok:false,message:"Account services are unavailable."},503);
  if (!validOrigin(request)) return reply({ok:false,message:"Request could not be verified."},403);
  const user = await currentUser(request, env);
  if (!user) return reply({ok:false,message:"Please sign in first."},401);
  let body;
  try { body = await request.json(); } catch { return reply({ok:false,message:"Invalid request."},400); }
  const accountId = String(body.accountId || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId)) return reply({ok:false,message:"Invalid account reference."},400);
  const result = await env.DEVPAGES_DB.prepare(
    "UPDATE hosting_connections SET token_ciphertext=NULL,revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND provider='cloudflare' AND provider_account_id=? AND revoked_at IS NULL"
  ).bind(user.id,accountId).run();
  if (!result.meta?.changes) return reply({ok:false,message:"That hosting connection was not found."},404);
  await env.DEVPAGES_DB.prepare(
    "INSERT INTO audit_events (id,actor_user_id,target_user_id,event_type,metadata_json) VALUES (?, ?, ?, 'hosting.disconnected', ?)"
  ).bind(randomToken(16),user.id,user.id,JSON.stringify({provider:"cloudflare",account_id:accountId})).run();
  return reply({ok:true,message:"The DEVPAGES connection has been removed. For extra security, revoke the API token in Cloudflare too."});
}
