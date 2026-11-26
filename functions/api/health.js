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
  const supabaseAuthConfigured = true; // Public project URL and publishable key are used by the browser.
  const customerSignInReady = database && sessionSecurityConfigured;

  return Response.json({
    ok: true,
    service: "DEVPAGES",
    status: customerSignInReady ? "supabase-auth-configured-awaiting-live-test" : "foundation",
    authProvider: "supabase",
    capabilities: {
      database,
      supabaseAuthConfigured,
      legacyFirebaseAuthConfigured: false,
      sessionSecurityConfigured,
      customerSignInReady,
      emailVerificationRequired: true,
      customSmtpRequiredForPublicEmailDelivery: true,
      customerHostingEncryptionConfigured: hostingEncryptionConfigured,
      customerHostingConnectionReady: customerSignInReady && hostingEncryptionConfigured,
      cloudflareCustomerOAuthReady: false,
      registrarCheckoutReady: false,
      paystackReady: false
    }
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}