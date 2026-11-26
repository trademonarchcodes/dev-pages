export async function onRequest({ env }) {
  let database = false;
  if (env.DEVPAGES_DB) {
    try { await env.DEVPAGES_DB.prepare("SELECT 1 AS ok").first(); database = true; } catch {}
  }
  const emailConfigured = Boolean(env.CF_ACCOUNT_ID && env.CF_EMAIL_API_TOKEN && env.EMAIL_FROM);
  const cryptoConfigured = Boolean(env.AUTH_PEPPER && env.SESSION_SECRET);
  const hostingEncryptionConfigured = /^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || "");
  return Response.json({
    ok: true,
    service: "DEVPAGES",
    status: database && emailConfigured && cryptoConfigured ? "account-ready-pending-provider-integrations" : "foundation",
    capabilities: {
      database,
      emailDeliveryConfigured: emailConfigured,
      sessionSecurityConfigured: cryptoConfigured,
      customerSignInReady: database && emailConfigured && cryptoConfigured,
      customerHostingEncryptionConfigured: hostingEncryptionConfigured,
      customerHostingConnectionReady: database && cryptoConfigured && hostingEncryptionConfigured,
      cloudflareCustomerOAuthReady: false,
      registrarCheckoutReady: false,
      paystackReady: false
    }
  }, { headers: { "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" } });
}
