const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const PROMO_START = "2026-10-15T00:00:00.000Z";
const PROMO_END = "2026-11-16T00:00:00.000Z";
const PROMO_ACCESS_END = "2027-01-16T00:00:00.000Z";
export async function onRequestGet({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in." }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.DB) return json({ error: "Billing service is not configured." }, 503);
  try {
    const auth = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token }
    });
    if (!auth.ok) return json({ error: "Session expired. Please sign in again." }, 401);
    const user = await auth.json();
    if (!user?.id || !user.created_at) return json({ error: "Could not verify account details." }, 401);
    const registered = new Date(user.created_at);
    const promoEligible = registered >= new Date(PROMO_START) && registered < new Date(PROMO_END);
    const result = await env.DB.prepare(
      "SELECT id, project_name, hostname, status, promo_eligible, activated_at, expires_at, created_at FROM managed_domains WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();
    const paymentResult = await env.DB.prepare(
      "SELECT reference, domain_id, purpose, amount_kobo, currency, status, paid_at, created_at FROM domain_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(user.id).all();
    const hostingConnected = Boolean(env.CF_API_TOKEN);
    const now = Date.now();
    const domains = (result.results || []).map((domain) => {
      const expiry = domain.expires_at ? new Date(domain.expires_at).getTime() : null;
      const remaining = expiry ? Math.max(0, Math.ceil((expiry - now) / 86400000)) : null;
      return { ...domain, days_remaining: remaining, is_expired: Boolean(expiry && expiry <= now) };
    });
    return json({
      account: { registered_at: user.created_at, promo_eligible: promoEligible, hosting_connected: hostingConnected },
      promotion: promoEligible ? { active: now < new Date(PROMO_ACCESS_END).getTime(), ends_at: PROMO_ACCESS_END } : { active: false, ends_at: null },
      pricing: { setup_ngn: 16000, renewal_ngn: 5500, cycle_days: 30, currency: "NGN" },
      domains,
      payment_history: paymentResult.results || []
    });
  } catch {
    return json({ error: "Unable to load billing information right now." }, 500);
  }
}