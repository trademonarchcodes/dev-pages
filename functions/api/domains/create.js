import { json, getUser, isPromoUser, PROMO_ACCESS_END, getCloudflareAccessToken } from "../../_lib/billing.js";

export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);
  if (!env.DB || !env.CF_TOKEN_ENCRYPTION_KEY) return json({ error: "Hosting connection is not configured." }, 503);

  try {
    const user = await getUser(request, env);
    if (!user?.id) return json({ error: "Please sign in." }, 401);

    const body = await request.json();
    let name = String(body.name || "").trim().toLowerCase();
    name = name.replace(/^https?:\\/\\//, "").replace(/\\/+$/, "");
    if (name.endsWith(".pages.dev")) name = name.slice(0, -".pages.dev".length);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(name)) {
      return json({ error: "Enter a valid name using 1–50 lowercase letters, numbers or hyphens. You can enter the name alone or include .pages.dev." }, 400);
    }

    const connection = await env.DB.prepare("SELECT accounts_json FROM cloudflare_connections WHERE user_id=?").bind(user.id).first();
    if (!connection) return json({ error: "Connect your Cloudflare account before adding a domain." }, 409);
    const accounts = JSON.parse(connection.accounts_json || "[]");
    if (!accounts.length || !accounts[0]?.id) return json({ error: "No Cloudflare account is connected." }, 409);

    // Create the real Cloudflare Pages project before checkout so a taken name is rejected before payment.
    const { tokens } = await getCloudflareAccessToken(env, user.id);
    const accountId = accounts[0].id;
    const cf = await fetch("https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/pages/projects", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokens.access_token, "Content-Type": "application/json" },
      body: JSON.stringify({ name, production_branch: "main", deployment_configs: { production: { compatibility_date: "2026-11-26" } } })
    });
    const result = await cf.json();
    if (!cf.ok || !result.success) {
      const cfMessage = (result.errors || []).map(item => item.message || "").filter(Boolean).join(" ");
      const duplicate = cf.status === 409 || /already exists|already in use|taken|duplicate|name.{0,30}(exists|used)/i.test(cfMessage);
      if (duplicate) return json({ error: name + ".pages.dev is already taken. Please choose a different name." }, 409);
      return json({ error: cfMessage || "Cloudflare could not create this Pages address. Please try another name." }, 400);
    }

    const actualName = result.result?.name || name;
    const hostname = actualName + ".pages.dev";
    const promo = isPromoUser(user) && Date.now() < Date.parse(PROMO_ACCESS_END);
    const id = crypto.randomUUID();
    const expiry = promo ? PROMO_ACCESS_END : null;

    try {
      await env.DB.prepare("INSERT INTO managed_domains(id,user_id,project_name,hostname,status,promo_eligible,activated_at,expires_at,cloudflare_account_id) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(id, user.id, actualName, hostname, promo ? "provisioning" : "pending_payment", promo ? 1 : 0, promo ? new Date().toISOString() : null, expiry, accountId).run();
    } catch (databaseError) {
      // Avoid leaving an untracked Pages project behind if the database insert fails.
      await fetch("https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/pages/projects/" + encodeURIComponent(actualName), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + tokens.access_token }
      }).catch(() => {});
      throw databaseError;
    }

    return json({
      domain: { id, hostname, status: promo ? "provisioning" : "pending_payment", expires_at: expiry },
      promo,
      setup_fee_ngn: promo ? 0 : 16000
    });
  } catch (error) {
    return json({ error: error.message || "Could not create domain." }, 400);
  }
}
