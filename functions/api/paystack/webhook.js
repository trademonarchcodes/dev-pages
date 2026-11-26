import { json, verifyPaystack, applyPayment, hmacHex, safeEqual, isPaystackKeyAllowed } from "../../_lib/billing.js";
export async function onRequestPost({ request, env }) {
  if (!env.DB || !isPaystackKeyAllowed(env)) return json({ error: "Webhook payment key does not match the configured mode." }, 503);
  const raw = new Uint8Array(await request.arrayBuffer());
  const modern = request.headers.get("Paystack-Signature");
  const legacy = request.headers.get("x-paystack-signature");
  let valid = false;
  if (modern && env.PAYSTACK_WEBHOOK_SECRET) {
    const fields = modern.split(",");
    const timestamp = fields.find(x => x.trim().startsWith("t="))?.trim().slice(2);
    const signatures = fields.filter(x => x.trim().startsWith("v1=")).map(x => x.trim().slice(3).split(":").pop());
    if (timestamp && Math.abs(Date.now()/1000 - Number(timestamp)) <= 300) {
      const signed = new Uint8Array(new TextEncoder().encode(timestamp + ".").length + raw.length);
      signed.set(new TextEncoder().encode(timestamp + ".")); signed.set(raw, new TextEncoder().encode(timestamp + ".").length);
      const digest = await hmacHex(env.PAYSTACK_WEBHOOK_SECRET, signed);
      valid = signatures.some(sig => /^[0-9a-f]{128}$/i.test(sig) && safeEqual(digest,sig.toLowerCase()));
    }
  }
  if (!valid && legacy) {
    const digest = await hmacHex(env.PAYSTACK_SECRET_KEY, raw);
    valid = /^[0-9a-f]{128}$/i.test(legacy) && safeEqual(digest,legacy.toLowerCase());
  }
  if (!valid) return json({ error: "Invalid webhook signature." }, 401);
  let event;
  try { event = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (event.event !== "charge.success" || !event.data?.reference) return json({ received: true });
  try {
    const payment = await env.DB.prepare("SELECT reference,user_id,domain_id,purpose,amount_kobo,status FROM domain_payments WHERE reference=?").bind(event.data.reference).first();
    if (!payment) return json({ received: true });
    const transaction = await verifyPaystack(payment.reference,env.PAYSTACK_SECRET_KEY);
    await applyPayment(env,payment,transaction);
    return json({ received: true });
  } catch (error) { return json({ error: error.message || "Webhook processing failed." }, 500); }
}