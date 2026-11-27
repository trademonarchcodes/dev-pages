import { json, blake3SelfTest, isPaystackKeyAllowed, PLATFORM_CF_ACCOUNT_ID } from "../_lib/billing.js";

export async function onRequestGet({ env }) {
  let cloudflareHosting = false;
  if (env.CF_API_TOKEN) {
    try {
      const account = env.DB
        ? await env.DB.prepare("SELECT account_id FROM devcloud_accounts WHERE status='active' AND is_default=1 LIMIT 1").first()
        : null;
      const accountId = account?.account_id || PLATFORM_CF_ACCOUNT_ID;
      const response = await fetch(
        "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/pages/projects?per_page=1",
        { headers: { Authorization: "Bearer " + env.CF_API_TOKEN, Accept: "application/json" } }
      );
      const result = await response.json();
      cloudflareHosting = Boolean(response.ok && result.success);
    } catch {
      cloudflareHosting = false;
    }
  }
  const checks = {
    assetHashing: blake3SelfTest(),
    database: Boolean(env.DB),
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
    cloudflareHosting,
    paystack: isPaystackKeyAllowed(env),
    paystackWebhook: Boolean(env.PAYSTACK_WEBHOOK_SECRET)
  };
  const ready = Object.values(checks).every(Boolean);
  return json({
    status: ready ? "ready" : "needs_configuration",
    checks,
    paystack_mode: (env.PAYSTACK_MODE || "test").toLowerCase(),
    checked_at: new Date().toISOString()
  });
}
