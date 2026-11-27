import { json, getUser, getCloudflareAccessToken } from "../../_lib/billing.js";

export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);
  try {
    const user = await getUser(request, env);
    if (!user?.id) return json({ error: "Please sign in again." }, 401);
    const body = await request.json();
    const domainId = String(body.domain_id || "");
    if (!domainId) return json({ error: "Choose a website first." }, 400);
    const domain = await env.DB.prepare(
      "SELECT id, user_id, project_name, cloudflare_account_id FROM managed_domains WHERE id=? AND user_id=?"
    ).bind(domainId, user.id).first();
    if (!domain) return json({ error: "Website not found in your account." }, 404);
    if (!domain.cloudflare_account_id) return json({ error: "This website has no hosting account assigned. Please contact DEVPAGES support." }, 409);
    const { tokens } = await getCloudflareAccessToken(env, user.id, domain.cloudflare_account_id);
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(domain.cloudflare_account_id) + "/pages/projects/" + encodeURIComponent(domain.project_name),
      { headers: { Authorization: "Bearer " + tokens.access_token } }
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      return json({ error: "DEVPAGES could not restore this hosting connection. Our hosting team needs to check the account." }, 503);
    }
    return json({ success: true, message: "Hosting connection checked and restored for this website." });
  } catch (error) {
    return json({ error: "Hosting could not be reconnected right now. Please try again or contact DEVPAGES support." }, 503);
  }
}
