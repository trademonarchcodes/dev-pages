export async function onRequest({ env }) {
  let database = false;
  if (env.DEVPAGES_DB) {
    try {
      await env.DEVPAGES_DB.prepare("SELECT 1 AS ok").first();
      database = true;
    } catch {}
  }

  const sessionSecurityConfigured = Boolean(env.SESSION_SECRET);
  const hostingEncryptionConfigured = /^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || "");
  const supabaseAuthConfigured = true;
  const publicEmailDeliveryReady = env.SUPABASE_SMTP_CONFIGURED === "true";
  const customerLoginReady = database && sessionSecurityConfigured;
  const customerRegistrationReady = customerLoginReady && publicEmailDeliveryReady;

  let status = "foundation";
  if (customerRegistrationReady) status = "supabase-auth-ready";
  else if (customerLoginReady) status = "awaiting-custom-smtp-for-public-registration";

  return Response.json({
    ok: true,
    service: "DEVPAGES",
    status,
    authProvider: "supabase",
    capabilities: {
      database,
      supabaseAuthConfigured,
      legacyFirebaseAuthConfigured: false,
      sessionSecurityConfigured,
      customerLoginReady,
      customerSignInReady: customerLoginReady,
      customerRegistrationReady,
      publicEmailDeliveryReady,
      customSmtpRequiredForPublicEmailDelivery: true,
      customerHostingEncryptionConfigured: hostingEncryptionConfigured,
      customerHostingConnectionReady: customerLoginReady && hostingEncryptionConfigured,
      cloudflareCustomerOAuthReady: false,
      websiteCreationReady: false,
      registrarCheckoutReady: false,
      paystackReady: false
    }
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}