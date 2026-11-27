import { json, blake3SelfTest, isPaystackKeyAllowed } from "../_lib/billing.js";
export async function onRequestGet({env}) {
  const checks={
    assetHashing:blake3SelfTest(),
    database:Boolean(env.DB),
    supabase:Boolean(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY),
    cloudflareHosting:Boolean(env.CF_API_TOKEN),
    paystack:isPaystackKeyAllowed(env),
    paystackWebhook:Boolean(env.PAYSTACK_WEBHOOK_SECRET)
  };
  const ready=Object.values(checks).every(Boolean);
  return json({status:ready?"ready":"needs_configuration",checks,paystack_mode:(env.PAYSTACK_MODE||"test").toLowerCase(),checked_at:new Date().toISOString()});
}
