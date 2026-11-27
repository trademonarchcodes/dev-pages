import { json, getUser, isPromoUser, SETUP_AMOUNT, RENEWAL_AMOUNT, isPaystackKeyAllowed } from "../../_lib/billing.js";
export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);
  if (!env.DB || !isPaystackKeyAllowed(env)) return json({ error: "Paystack is in safe test mode. Set a valid Paystack test secret key before testing payments." }, 503);
  try {
    const user = await getUser(request, env);
    if (!user?.id || !user.email) return json({ error: "Please sign in again." }, 401);
    const body = await request.json();
    const domainId = String(body.domain_id || "");
    const purpose = body.purpose === "renewal" ? "renewal" : "setup";
    const domain = await env.DB.prepare("SELECT id, user_id, status, expires_at, cloudflare_account_id FROM managed_domains WHERE id=? AND user_id=?").bind(domainId, user.id).first();
    if (!domain) return json({ error: "Domain not found." }, 404);
    if (!domain.cloudflare_account_id) return json({ error: "This website's hosting assignment needs attention. Please use Reconnect Hosting or contact DEVPAGES support." }, 409);
    const account = await env.DB.prepare("SELECT account_id, status FROM devcloud_accounts WHERE account_id=?").bind(domain.cloudflare_account_id).first();
    if (!account || !["active","disabled"].includes(account.status)) return json({ error: "This website's hosting account is temporarily unavailable. Please contact DEVPAGES support." }, 409);
    if (isPromoUser(user) && Date.now() < Date.parse("2027-01-16T00:00:00.000Z")) return json({ error: "Your launch promotion is active. No payment is due yet." }, 409);
    if (purpose === "setup" && domain.status !== "pending_payment") return json({ error: "Setup payment is not due for this domain." }, 409);
    if (purpose === "renewal" && domain.status !== "suspended") return json({ error: "Renewal becomes available after the 30-day hosting period expires." }, 409);
    const amount = purpose === "setup" ? SETUP_AMOUNT : RENEWAL_AMOUNT;
    const reference = "dp_" + crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare("INSERT INTO domain_payments(reference,user_id,domain_id,purpose,amount_kobo,currency,status) VALUES(?,?,?,?,?,'NGN','pending')").bind(reference,user.id,domainId,purpose,amount).run();
    const callback = new URL("/payment-return.html", new URL(request.url).origin);
    callback.searchParams.set("reference", reference);
    const pay = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", headers: { Authorization: "Bearer " + env.PAYSTACK_SECRET_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: user.email, amount, currency: "NGN", reference, callback_url: callback.toString(), metadata: { user_id: user.id, domain_id: domainId, purpose, custom_fields: [{ display_name: "DEVPAGES domain", variable_name: "domain_id", value: domainId }] } })
    });
    const data = await pay.json();
    if (!pay.ok || !data.status || !data.data?.authorization_url) throw new Error(data.message || "Could not initialize Paystack checkout.");
    return json({ authorization_url: data.data.authorization_url, reference, amount_kobo: amount, currency: "NGN" });
  } catch (error) { return json({ error: error.message || "Could not start payment." }, 400); }
}