import { json, blake3SelfTest } from "../_lib/billing.js";
export async function onRequestGet({env}) {
  const checks={
    assetHashing:blake3SelfTest(),
    database:Boolean(env.DB),
    supabase:Boolean(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY),
    cloudflareOAuth:Boolean(env.CF_OAUTH_CLIENT_ID&&env.CF_OAUTH_CLIENT_SECRET&&env.CF_OAUTH_REDIRECT_URI&&env.OAUTH_STATE_SECRET),
    tokenEncryption:Boolean(env.CF_TOKEN_ENCRYPTION_KEY),
    paystack:Boolean(env.PAYSTACK_SECRET_KEY),
    paystackWebhook:Boolean(env.PAYSTACK_WEBHOOK_SECRET)
  };
  const ready=Object.values(checks).every(Boolean);
  return json({status:ready?"ready":"needs_configuration",checks,checked_at:new Date().toISOString()});
}
