import { json, getUser, verifyPaystack, applyPayment } from "../../_lib/billing.js";
export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Request origin rejected." }, 403);
  if (!env.DB || !env.PAYSTACK_SECRET_KEY) return json({ error: "Payment service is not configured." }, 503);
  try {
    const user = await getUser(request, env);
    if (!user?.id) return json({ error: "Please sign in again." }, 401);
    const { reference } = await request.json();
    if (!reference || typeof reference !== "string") return json({ error: "Payment reference is required." }, 400);
    const payment = await env.DB.prepare("SELECT reference,user_id,domain_id,purpose,amount_kobo,status FROM domain_payments WHERE reference=? AND user_id=?").bind(reference,user.id).first();
    if (!payment) return json({ error: "Payment record not found." }, 404);
    const transaction = await verifyPaystack(reference, env.PAYSTACK_SECRET_KEY);
    const result = await applyPayment(env,payment,transaction);
    return json({ success: true, result });
  } catch (error) { return json({ error: error.message || "Payment verification failed." }, 400); }
}