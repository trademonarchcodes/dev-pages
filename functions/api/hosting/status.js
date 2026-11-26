import { reply, currentUser } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const user = await currentUser(request, env);
  if (!user) return reply({ok:false,message:"Please sign in first."},401);
  const result = await env.DEVPAGES_DB.prepare(
    "SELECT provider,provider_account_id,connected_at FROM hosting_connections WHERE user_id=? AND provider='cloudflare' AND revoked_at IS NULL AND token_ciphertext IS NOT NULL ORDER BY connected_at DESC"
  ).bind(user.id).all();
  return reply({ok:true,connections:(result.results || []).map(x=>({provider:x.provider,accountId:x.provider_account_id,connectedAt:x.connected_at,status:"connected"}))});
}
