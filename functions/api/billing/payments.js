const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!token) return json({ error: "Please sign in." }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.DB) {
    return json({ error: "Payment history service is not configured." }, 503);
  }

  try {
    const auth = await fetch(env.SUPABASE_URL.replace(/\\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token }
    });
    if (!auth.ok) return json({ error: "Your session has expired. Please sign in again." }, 401);
    const user = await auth.json();
    if (!user?.id) return json({ error: "Could not verify your account." }, 401);

    const result = await env.DB.prepare(
      "SELECT reference, domain_id, purpose, amount_kobo, currency, status, paid_at, created_at FROM domain_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(user.id).all();

    const payments = result.results || [];
    const successful = payments.filter(payment => payment.status === "success");
    const totalPaidKobo = successful.reduce((total, payment) => total + Number(payment.amount_kobo || 0), 0);
    return json({
      payments,
      summary: {
        total_paid_kobo: totalPaidKobo,
        successful_count: successful.length,
        pending_count: payments.filter(payment => payment.status === "pending").length,
        transaction_count: payments.length
      }
    });
  } catch {
    return json({ error: "We could not retrieve payment history right now. Please try again." }, 500);
  }
}
