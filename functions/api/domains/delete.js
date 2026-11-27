import { json, getUser, getCloudflareAccessToken } from "../../_lib/billing.js";

export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return json({ error: "Request origin rejected." }, 403);
  }

  try {
    const user = await getUser(request, env);
    if (!user?.id) return json({ error: "Please sign in." }, 401);

    const body = await request.json();
    const domainId = String(body.domain_id || "").trim();
    if (!domainId) return json({ error: "Select a domain to delete." }, 400);

    const domain = await env.DB.prepare(
      "SELECT id, user_id, project_name, hostname, cloudflare_account_id, status FROM managed_domains WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    ).bind(domainId, user.id).first();

    if (!domain) return json({ error: "Domain not found or already deleted." }, 404);
    if (!domain.cloudflare_account_id) return json({ error: "This domain has no assigned DEVPAGES hosting account. Contact support." }, 409);

    const { tokens } = await getCloudflareAccessToken(env, user.id, domain.cloudflare_account_id);
    const projectUrl = "https://api.cloudflare.com/client/v4/accounts/" +
      encodeURIComponent(domain.cloudflare_account_id) + "/pages/projects/" +
      encodeURIComponent(domain.project_name);

    const removal = await fetch(projectUrl, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + tokens.access_token }
    });

    if (!removal.ok && removal.status !== 404) {
      const result = await removal.json().catch(() => ({}));
      return json({
        error: result.errors?.[0]?.message || "DEVPAGES could not delete this website. Please try again or contact support."
      }, 502);
    }

    await env.DB.prepare(
      "UPDATE managed_domains SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    ).bind(domain.id, user.id).run();

    return json({ success: true, message: domain.hostname + " has been deleted from DEVPAGES." });
  } catch (error) {
    return json({ error: error.message || "Could not delete this domain." }, 400);
  }
}
